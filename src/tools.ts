import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { DiffView } from './components/DiffView';

const execAsync = promisify(exec);

interface IFileOperationParams {
    path: string;
    content?: string;
}

interface ICommandParams {
    command: string;
}

interface IParallelToolUseParams {
    tool_uses: Array<{
        recipient_name: string;
        parameters: { [key: string]: any };
    }>;
}

export class FileReadTool implements vscode.LanguageModelTool<IFileOperationParams> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IFileOperationParams>,
        _token: vscode.CancellationToken
    ) {
        try {
            const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            if (!workspacePath) {
                throw new Error('No workspace folder found');
            }
            const filePath = path.join(workspacePath, options.input.path);
            const content = await fs.readFile(filePath, 'utf-8');
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(content)
            ]);
        } catch (err: unknown) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Error reading file: ${(err as Error)?.message}`)
            ]);
        }
    }
}

export class FileWriteTool implements vscode.LanguageModelTool<IFileOperationParams> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IFileOperationParams>,
        _token: vscode.CancellationToken
    ) {
        try {
            const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            if (!workspacePath) {
                throw new Error('No workspace folder found');
            }
            const filePath = path.join(workspacePath, options.input.path);
            await fs.writeFile(filePath, options.input.content || '');
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`File created successfully at ${options.input.path}`)
            ]);
        } catch (err: unknown) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Error writing file: ${(err as Error)?.message}`)
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IFileOperationParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: `Creating new file at ${options.input.path}`,
            confirmationMessages: {
                title: 'Create New File',
                message: new vscode.MarkdownString(`Create a new file at ${options.input.path}?`)
            }
        };
    }
}

export class FileUpdateTool implements vscode.LanguageModelTool<IFileOperationParams> {
    private diffView?: DiffView;

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IFileOperationParams>,
        _token: vscode.CancellationToken
    ) {
        try {
            const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            if (!workspacePath) {
                throw new Error('No workspace folder found');
            }
            
            const filePath = path.join(workspacePath, options.input.path);
            const originalContent = await fs.readFile(filePath, 'utf-8');
            
            this.diffView = new DiffView(filePath, originalContent);
            await this.diffView.show();
            
            if (options.input.content) {
                const lines = options.input.content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    await this.diffView.update(
                        lines.slice(0, i + 1).join('\n'),
                        i
                    );
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }

            const choice = await this.diffView.waitForConfirmation();

            if (choice === 'apply') {
                if (this.diffView.editor?.document.isDirty) {
                    await this.diffView.editor.document.save();
                }
                await this.diffView.close();
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`File updated successfully at ${options.input.path}`)
                ]);
            } else {
                await this.diffView.revertChanges();
                await this.diffView.close();
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`File update cancelled by user`)
                ]);
            }
        } catch (err: unknown) {
            if (this.diffView) {
                await this.diffView.close();
            }
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Error updating file: ${(err as Error)?.message}`)
            ]);
        }
    }
}

export class CommandRunTool implements vscode.LanguageModelTool<ICommandParams> {
    private static terminal: vscode.Terminal | undefined;

    private getTerminal(): vscode.Terminal {
        if (!CommandRunTool.terminal || CommandRunTool.terminal.exitStatus !== undefined) {
            CommandRunTool.terminal = vscode.window.createTerminal('Autopilot');
        }
        return CommandRunTool.terminal;
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ICommandParams>,
        _token: vscode.CancellationToken
    ) {
        try {
            const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            if (!workspacePath) {
                throw new Error('No workspace folder found');
            }

            const terminal = this.getTerminal();
            terminal.show();
            terminal.sendText(options.input.command);

            const result = await execAsync(options.input.command, { cwd: workspacePath });
            const output = [
                `Command executed: ${options.input.command}`,
                '',
                'Output:',
                result.stdout.trim(),
                result.stderr ? `Error output:\n${result.stderr.trim()}` : null,
                'Exit code: 0'
            ].filter(Boolean).join('\n');

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(output)
            ]);
        } catch (err: any) {
            const errorOutput = [
                `Command executed: ${options.input.command}`,
                '',
                'Output:',
                err.stdout?.trim(),
                err.stderr ? `Error output:\n${err.stderr.trim()}` : null,
                `Exit code: ${err.code || 1}`
            ].filter(Boolean).join('\n');

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(errorOutput)
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<ICommandParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: `Executing command: ${options.input.command}`,
            confirmationMessages: {
                title: 'Run Command',
                message: new vscode.MarkdownString(`Execute command: \`${options.input.command}\`?`)
            }
        };
    }
}

export class ParallelToolUseTool implements vscode.LanguageModelTool<IParallelToolUseParams> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IParallelToolUseParams>,
        token: vscode.CancellationToken
    ) {
        try {
            const results = await Promise.all(
                options.input.tool_uses.map(async (toolUse) => {
                    const toolInfo = vscode.lm.tools.find(t => t.name === toolUse.recipient_name);
                    if (!toolInfo) {
                        throw new Error(`Tool ${toolUse.recipient_name} not found`);
                    }
                    
                    const result = await vscode.lm.invokeTool(
                        toolUse.recipient_name, 
                        { 
                            input: toolUse.parameters,
                            toolInvocationToken: options.toolInvocationToken 
                        }, 
                        token
                    );

                    return {
                        tool: toolUse.recipient_name,
                        result: result.content.map((p) => {
                            if (p instanceof vscode.LanguageModelTextPart) {
                                return p.value;
                            }
                            return '';
                        }).join('\n')
                    };
                })
            );

            const output = results.map(r => 
                `[${r.tool}]:\n${r.result}`
            ).join('\n\n');

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(output)
            ]);
        } catch (err: unknown) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Error executing parallel tools: ${(err as Error)?.message}`)
            ]);
        }
    }
}
