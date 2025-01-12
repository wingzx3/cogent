import { renderPrompt } from '@vscode/prompt-tsx';
import * as vscode from 'vscode';
import { ToolCallRound, ToolResultMetadata, ToolUserPrompt, ToolUserProps } from './toolsPrompt';
import { exec, execSync } from 'child_process';
const { promisify } = require('util');

export interface TsxToolUserMetadata {
    toolCallsMetadata: ToolCallsMetadata;
}

export interface ToolCallsMetadata {
    toolCallRounds: ToolCallRound[];
    toolCallResults: Record<string, vscode.LanguageModelToolResult>;
}

interface ExtendedPromptProps extends ToolUserProps {
    codeReviewDiff?: string;
}

interface ReadFileToolInput {
    paths: string[];
}

export function isTsxToolUserMetadata(obj: unknown): obj is TsxToolUserMetadata {
    return !!obj &&
        !!(obj as TsxToolUserMetadata).toolCallsMetadata &&
        Array.isArray((obj as TsxToolUserMetadata).toolCallsMetadata.toolCallRounds);
}

export function registerToolUserChatParticipant(context: vscode.ExtensionContext) {
    const handler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, chatContext: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => {
        if (request.command === 'list') {
            stream.markdown(`Available tools: ${vscode.lm.tools.map(tool => tool.name).join(', ')}\n\n`);
            return;
        }
        let commandOptions:any;

        if (request.command === 'codeReview') {
            const execAsync = promisify(exec);
            try {
                const { diff, stderr } = await execAsync('git diff --cached');
                if (stderr) {
                    stream.markdown(`Error generating diff: ${stderr}`);
                    return;
                }
                commandOptions = diff;

            } catch (error) {
                stream.markdown(`Error generating diff: ${error}`);
                return;
            }
        }

        const [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'claude-3.5-sonnet' });

        const tools = vscode.lm.tools.filter(tool =>
            tool.name.startsWith('cogent_') ||
            tool.name === 'multi-tool-use-parallel'
        );

        const options: vscode.LanguageModelChatRequestOptions = {
            justification: 'To make a request to Cogent',
        };

        const result = await renderPrompt(
            ToolUserPrompt,
            {
                context: chatContext,
                request,
                commandOptions,
                toolCallRounds: [],
                toolCallResults: {},
            },
            { modelMaxPromptTokens: model.maxInputTokens },
            model
        );

        let messages = result.messages;
        result.references.forEach(ref => {
            if (ref.anchor instanceof vscode.Uri || ref.anchor instanceof vscode.Location) {
                stream.reference(ref.anchor);
            }
        });

        const toolReferences = [...request.toolReferences];
        const accumulatedToolResults: Record<string, vscode.LanguageModelToolResult> = {};
        const toolCallRounds: ToolCallRound[] = [];
        let hasFileUpdateCall = false;

        const runWithTools = async (): Promise<void> => {
            const requestedTool = toolReferences.shift();
            if (requestedTool) {
                options.toolMode = vscode.LanguageModelChatToolMode.Required;
                options.tools = vscode.lm.tools.filter(tool => tool.name === requestedTool.name);
            } else {
                options.toolMode = undefined;
                options.tools = [...tools];
            }

            const response = await model.sendRequest(messages, options, token);
            const toolCalls: vscode.LanguageModelToolCallPart[] = [];
            let responseStr = '';

            for await (const part of response.stream) {
                if (part instanceof vscode.LanguageModelTextPart) {
                    stream.markdown(part.value);
                    responseStr += part.value;
                } else if (part instanceof vscode.LanguageModelToolCallPart) {
                    if (part.name === 'cogent_patchFile') {
                        hasFileUpdateCall = true;
                    }
                    if (part.name === 'cogent_readFile') {
                        const input = part.input as ReadFileToolInput;
                        stream.markdown(`\n\nReading files:\n${input.paths.map(path => `* ${path}`).join('\n')}`);
                    }
                    if (part.name === 'cogent_searchSymbol') {
                        const input = part.input as { symbol: string };
                        stream.markdown(`\n\nSearching for symbol: ${input.symbol}`);
                    }
                    if (part.name === 'cogent_searchFile') {
                        const input = part.input as { filename: string };
                        stream.markdown(`\n\nSearching for file: ${input.filename}`);
                    }
                    if (part.name === 'cogent_searchText') {
                        const input = part.input as { text: string };
                        stream.markdown(`\n\nSearching for text: ${input.text}`);
                    }
                    toolCalls.push(part);
                }
            }

            if (toolCalls.length) {
                toolCallRounds.push({
                    response: responseStr,
                    toolCalls
                });

                const result = await renderPrompt(
                    ToolUserPrompt,
                    {
                        context: chatContext,
                        request,
                        commandOptions,
                        toolCallRounds,
                        toolCallResults: accumulatedToolResults
                    },
                    { modelMaxPromptTokens: model.maxInputTokens },
                    model
                );

                messages = result.messages;
                const toolResultMetadata = result.metadatas.getAll(ToolResultMetadata);
                if (toolResultMetadata?.length) {
                    toolResultMetadata.forEach(meta => accumulatedToolResults[meta.toolCallId] = meta.result);
                }

                return runWithTools();
            }
        };

        await runWithTools();

        if (hasFileUpdateCall) {
            stream.button({
                command: 'cogent.applyChanges',
                title: vscode.l10n.t('Save All Changes')
            });
        }

        return {
            metadata: {
                toolCallsMetadata: {
                    toolCallResults: accumulatedToolResults,
                    toolCallRounds
                }
            } satisfies TsxToolUserMetadata,
        };
    };

    const toolUser = vscode.chat.createChatParticipant('cogent.assistant', handler);
    toolUser.iconPath = vscode.Uri.joinPath(context.extensionUri, 'assets/cogent.jpeg');

    // Register the apply changes command
    const applyChangesCommand = vscode.commands.registerCommand('cogent.applyChanges', async () => {
        await vscode.workspace.saveAll();
        vscode.window.showInformationMessage('All changes have been saved');
    });

    context.subscriptions.push(toolUser, applyChangesCommand);
}
