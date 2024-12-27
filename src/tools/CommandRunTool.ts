import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ICommandParams {
    command: string;
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
