import {
    AssistantMessage,
    BasePromptElementProps,
    Chunk,
    PrioritizedList,
    PromptElement,
    PromptElementProps,
    PromptMetadata,
    PromptPiece,
    PromptReference,
    PromptSizing,
    ToolCall,
    ToolMessage,
    UserMessage
} from '@vscode/prompt-tsx';
import { ToolResult } from '@vscode/prompt-tsx/dist/base/promptElements';
import * as vscode from 'vscode';
import { isTsxToolUserMetadata } from './toolParticipant';
import { listImportantFiles } from './components/listFiles';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ToolCallRound {
    response: string;
    toolCalls: vscode.LanguageModelToolCallPart[];
}

export interface ToolUserProps extends BasePromptElementProps {
    request: vscode.ChatRequest;
    context: vscode.ChatContext;
    commandOptions: any;
    toolCallRounds: ToolCallRound[];
    toolCallResults: Record<string, vscode.LanguageModelToolResult>;
}

const DEFAULT_PROMPT = `You are cogent, a sophisticated coding assistant that combines technical expertise with practical problem-solving abilities. You excel at providing clear, maintainable, and efficient solutions while adhering to best practices.

## Core Strengths
- Writing clean, maintainable, and well-documented code
- Providing optimal solutions that balance performance and readability
- Following language-specific best practices and design patterns
- Debugging and troubleshooting complex issues
- Ensuring type safety and error handling

## Coding Standards
- Write self-documenting code with clear variable and function names
- Include appropriate error handling and input validation
- Follow consistent formatting and structure
- Consider edge cases and potential failure points
- Prioritize maintainability and extensibility

## Tool Use Guidelines
- When patching files, verify line numbers are accurate and context is preserved
- For file operations, use line numbers from search results as reference points
- Keep file reads focused and minimal, preferring targeted searches
`;

const CODE_REVIEW_PROMPT = `You are a code review assistant. Your goal is to provide comprehensive and actionable feedback on code changes using the provided unified diff as the initial input. You have access to tools that allow you to investigate the code base further, including:

### Guidelines for Review:
- **Correctness**: Check whether the code changes are logically correct and follow best practices.
- **Code Style & Consistency**: Ensure that the changes adhere to the coding style and conventions used in the rest of the code base.
- **Potential Bugs**: Identify any potential bugs introduced by the changes, including edge cases that may not have been handled.
- **Performance**: Assess whether the changes might introduce performance regressions or can be optimized.
- **Security**: Highlight any potential security issues introduced by the changes.
- **Readability & Maintainability**: Suggest improvements that make the code easier to read, understand, and maintain.
- **Documentation**: Ensure that any necessary documentation, comments, or tests are provided or updated.

### Workflow:
1. Start by analyzing the unified diff to understand what has changed.
2. Use the available tools to gather context as needed (e.g., look up related code, find symbol definitions, or search for references).
3. Provide a clear and structured review with specific, actionable suggestions. Use examples when necessary.
4. If further investigation reveals complex issues, explain your reasoning thoroughly.

### Output Format:
- **General Feedback**: High-level comments on the changes.
- **Line-Specific Feedback**: For each significant change or issue, specify the line(s) in the diff and provide detailed comments.
- **Suggestions**: Whenever possible, offer concrete suggestions for improvement.
- **Questions**: If certain decisions are unclear, pose questions to the author for clarification.
`;

const TOOLS_PROMPT = `
## Tool Use Instructions
1. cogent_patchFile
* You must provide your output in a standard unified diff (patch) format.
* Example Patch Format
### Below is a minimal example showing how to change the text in a file.

\`\`\`diff
@@ -1,7 +1,6 @@
-The Way that can be told of is not the eternal Way;
-The name that can be named is not the eternal name.
 The Nameless is the origin of Heaven and Earth;
-The Named is the mother of all things.
+The named is the mother of all things.
+
 Therefore let there always be non-being,
   so we may see their subtlety,
 And let there always be being,
@@ -9,3 +8,6 @@
 The two are the same,
 But after they are produced,
   they have different names.
+They both may be called deep and profound.
+Deeper and more profound,
+The door of all subtleties!
\`\`\`
When providing a patch for cogent_patchFile, follow this structure.

2. cogent_writeFile
   - MUST provide complete new file content
   - No placeholder comments or partial code
   - Ensure proper file structure and formatting

3. cogent_runCommand
   - Avoid running dangerous commands
   - Run commands according to User's OS Level and Shell Type
   - Commands that create a template or scaffold a project should use the current working directory, avoid creating sub folder projects.

4. cogent_searchSymbol
   - Use this tool to search for symbols in the code base
   - Return the whole function, class, or method containing the symbol
   - Include the starting line number at the beginning of the snippet

5. cogent_searchFile
   - Use this tool to search for files by partial filename matching
   - Return the relevant file paths

6. cogent_readFile
   - Use this tool to read the contents of files
   - Specify start and end line numbers to read partial file content
   - Avoid reading too many lines.  Try to keep it to less then 100 lines.  Use cogent_searchSymbol to narrow down the lines to read.

7. cogent_searchText
   - Use this tool to search for exact text matches in workspace files
   - Return the file paths and line numbers where the exact text matches are found
`;

export class ToolUserPrompt extends PromptElement<ToolUserProps, void> {
    private async getCustomInstructions(): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return '';
        }

        try {
            const rulesPath = path.join(workspaceFolder.uri.fsPath, '.cogentrules');
            const content = await fs.readFile(rulesPath, 'utf-8');
            return content.trim();
        } catch (error) {
            // File doesn't exist or can't be read, return empty string
            return '';
        }
    }

    private getProjectStructure() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return { structure: 'No workspace folder found', contents: {} };
        }
        return listImportantFiles(workspaceFolder.uri.fsPath);
    }

    private getOSLevel(): string {
        return process.platform === 'win32'
            ? 'Windows'
            : process.platform === 'darwin'
                ? 'macOS'
                : 'Linux';
    }

    private getShellType(): string {
        return process.platform === 'win32'
            ? 'PowerShell'
            : process.platform === 'darwin'
                ? 'zsh'
                : 'bash';
    }

    async render(_state: void, _sizing: PromptSizing) {
        const customInstructions = await this.getCustomInstructions();
        const osLevel = this.getOSLevel();
        const shellType = this.getShellType();
        const osInfo = `\n## User's OS Level\n- ${osLevel} (using ${shellType})\n`;

        let prompt, finalInstructions = '';
        switch( this.props.request.command ) {
            case 'codeReview':
                prompt = CODE_REVIEW_PROMPT;
                finalInstructions = '\n## Unified Diff for Review.\n' + this.props.commandOptions;
            break;
            default:
                prompt = DEFAULT_PROMPT;
            break;
        }

        const customInstructionsSection = customInstructions
        ? `\n## User's Custom Instructions\nThe following additional instructions are provided by the user.\n${customInstructions}`
        : '';

        return (
            <>
                <UserMessage priority={100}>
                    {`${prompt}${osInfo}${customInstructionsSection}${finalInstructions}`}
                </UserMessage>
                <History context={this.props.context} priority={10} />
                <PromptReferences
                    references={this.props.request.references}
                    priority={20}
                />
                <UserMessage>{`# User Instructions:\n${this.props.request.prompt}`}</UserMessage>
                <ToolCalls
                    toolCallRounds={this.props.toolCallRounds}
                    toolInvocationToken={this.props.request.toolInvocationToken}
                    toolCallResults={this.props.toolCallResults} />
            </>
        );
    }
}

interface ToolCallsProps extends BasePromptElementProps {
    toolCallRounds: ToolCallRound[];
    toolCallResults: Record<string, vscode.LanguageModelToolResult>;
    toolInvocationToken: vscode.ChatParticipantToolToken | undefined;
}

const dummyCancellationToken: vscode.CancellationToken = new vscode.CancellationTokenSource().token;

class ToolCalls extends PromptElement<ToolCallsProps, void> {
    async render(_state: void, _sizing: PromptSizing) {
        if (!this.props.toolCallRounds.length) {
            return undefined;
        }

        return <>
            {this.props.toolCallRounds.map(round => this.renderOneToolCallRound(round))}
            <UserMessage>Above is the result of calling one or more tools. The user cannot see the results, so you should explain them to the user if referencing them in your answer.</UserMessage>
        </>;
    }

    private renderOneToolCallRound(round: ToolCallRound) {
        const assistantToolCalls: ToolCall[] = round.toolCalls.map(tc => ({
            type: 'function',
            function: {
                name: tc.name,
                arguments: JSON.stringify(tc.input)
            },
            id: tc.callId
        }));

        return (
            <Chunk>
                <AssistantMessage toolCalls={assistantToolCalls}>{round.response}</AssistantMessage>
                {round.toolCalls.map(toolCall =>
                    <ToolResultElement
                        toolCall={toolCall}
                        toolInvocationToken={this.props.toolInvocationToken}
                        toolCallResult={this.props.toolCallResults[toolCall.callId]}
                    />
                )}
            </Chunk>
        );
    }
}

interface ToolResultElementProps extends BasePromptElementProps {
    toolCall: vscode.LanguageModelToolCallPart;
    toolInvocationToken: vscode.ChatParticipantToolToken | undefined;
    toolCallResult: vscode.LanguageModelToolResult | undefined;
}

class ToolResultElement extends PromptElement<ToolResultElementProps, void> {
    async render(state: void, sizing: PromptSizing): Promise<PromptPiece | undefined> {
        const tool = vscode.lm.tools.find(t => t.name === this.props.toolCall.name);
        if (!tool) {
            console.error(`Tool not found: ${this.props.toolCall.name}`);
            return <ToolMessage toolCallId={this.props.toolCall.callId}>Tool not found</ToolMessage>;
        }

        const tokenizationOptions: vscode.LanguageModelToolTokenizationOptions = {
            tokenBudget: sizing.tokenBudget,
            countTokens: async (content: string) => sizing.countTokens(content),
        };

        const toolResult = this.props.toolCallResult ??
            await vscode.lm.invokeTool(
                this.props.toolCall.name,
                {
                    input: this.props.toolCall.input,
                    toolInvocationToken: this.props.toolInvocationToken,
                    tokenizationOptions
                },
                dummyCancellationToken
            );

        return (
            <ToolMessage toolCallId={this.props.toolCall.callId}>
                <meta value={new ToolResultMetadata(this.props.toolCall.callId, toolResult)}></meta>
                <ToolResult data={toolResult} />
            </ToolMessage>
        );
    }
}

export class ToolResultMetadata extends PromptMetadata {
    constructor(
        public toolCallId: string,
        public result: vscode.LanguageModelToolResult,
    ) {
        super();
    }
}

interface HistoryProps extends BasePromptElementProps {
    priority: number;
    context: vscode.ChatContext;
}

class History extends PromptElement<HistoryProps, void> {
    render(_state: void, _sizing: PromptSizing) {
        return (
            <PrioritizedList priority={this.props.priority} descending={false}>
                {this.props.context.history.map((message) => {
                    if (message instanceof vscode.ChatRequestTurn) {
                        return (
                            <>
                                <PromptReferences
                                    references={message.references}
                                    excludeReferences={true}
                                />
                                <UserMessage>{message.prompt}</UserMessage>
                            </>
                        );
                    } else if (message instanceof vscode.ChatResponseTurn) {
                        const metadata = message.result.metadata;
                        if (isTsxToolUserMetadata(metadata) && metadata.toolCallsMetadata.toolCallRounds.length > 0) {
                            return <ToolCalls
                                toolCallResults={metadata.toolCallsMetadata.toolCallResults}
                                toolCallRounds={metadata.toolCallsMetadata.toolCallRounds}
                                toolInvocationToken={undefined}
                            />;
                        }
                        return <AssistantMessage>{chatResponseToString(message)}</AssistantMessage>;
                    }
                })}
            </PrioritizedList>
        );
    }
}

function chatResponseToString(response: vscode.ChatResponseTurn): string {
    return response.response
        .map((r) => {
            if (r instanceof vscode.ChatResponseMarkdownPart) {
                return r.value.value;
            } else if (r instanceof vscode.ChatResponseAnchorPart) {
                if (r.value instanceof vscode.Uri) {
                    return r.value.fsPath;
                } else {
                    return r.value.uri.fsPath;
                }
            }
            return '';
        })
        .join('');
}

interface PromptReferencesProps extends BasePromptElementProps {
    references: ReadonlyArray<vscode.ChatPromptReference>;
    excludeReferences?: boolean;
}

class PromptReferences extends PromptElement<PromptReferencesProps, void> {
    render(_state: void, _sizing: PromptSizing): PromptPiece {
        return (
            <UserMessage>
                {this.props.references.map(ref => (
                    <PromptReferenceElement
                        ref={ref}
                        excludeReferences={this.props.excludeReferences}
                    />
                ))}
            </UserMessage>
        );
    }
}

interface PromptReferenceProps extends BasePromptElementProps {
    ref: vscode.ChatPromptReference;
    excludeReferences?: boolean;
}

class PromptReferenceElement extends PromptElement<PromptReferenceProps> {
    async render(_state: void, _sizing: PromptSizing): Promise<PromptPiece | undefined> {
        const value = this.props.ref.value;
        if (value instanceof vscode.Uri) {
            const fileContents = (await vscode.workspace.fs.readFile(value)).toString();
            return (
                <Tag name="context">
                    {!this.props.excludeReferences &&
                        <references value={[new PromptReference(value)]} />}
                    {value.fsPath}:<br />
                    ``` <br />
                    {fileContents}<br />
                    ```<br />
                </Tag>
            );
        } else if (value instanceof vscode.Location) {
            const rangeText = (await vscode.workspace.openTextDocument(value.uri))
                .getText(value.range);
            return (
                <Tag name="context">
                    {!this.props.excludeReferences &&
                        <references value={[new PromptReference(value)]} />}
                    {value.uri.fsPath}:{value.range.start.line + 1}-
                    {value.range.end.line + 1}: <br />
                    ```<br />
                    {rangeText}<br />
                    ```
                </Tag>
            );
        } else if (typeof value === 'string') {
            return <Tag name="context">{value}</Tag>;
        }
    }
}

type TagProps = PromptElementProps<{
    name: string;
}>;

class Tag extends PromptElement<TagProps> {
    private static readonly _regex = /^[a-zA-Z_][\w.-]*$/;

    render() {
        const { name } = this.props;
        if (!Tag._regex.test(name)) {
            throw new Error(`Invalid tag name: ${this.props.name}`);
        }
        return (
            <>
                {'<' + name + '>'}<br />
                <>{this.props.children}<br /></>
                {'</' + name + '>'}<br />
            </>
        );
    }
}
