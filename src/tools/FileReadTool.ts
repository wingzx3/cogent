import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

interface IFileOperationParams {
    path?: string;
    paths?: string[];
    content?: string;
    startLine?: number;
    endLine?: number;
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

            const filePaths = options.input.paths || (options.input.path ? [options.input.path] : []);
            const startLine = (options.input.startLine ?? 1); // Ensure startLine indexes from 1
            const endLine = options.input.endLine ?? Number.MAX_SAFE_INTEGER;

            const results = await Promise.all(filePaths.map(async (filePath) => {
                try {
                    const content = await fs.readFile(path.join(workspacePath,filePath), 'utf-8');
                    const lines = content.split('\n').slice(startLine - 1, endLine - 1);
                    console.log( `📝 File: ${filePath}:${startLine}:${endLine}`);
                    return [
                        `📝 File: ${filePath}:${startLine}:${endLine}`,
                        `\`\`\``,
                        lines.join('\n'),
                        `\`\`\``
                    ].join('\n');
                } catch (err) {
                    return `Error reading ${filePath}: ${(err as Error)?.message}`;
                }
            }));

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(results.join('\n\n'))
            ]);
        } catch (err: unknown) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Error reading files: ${(err as Error)?.message}`)
            ]);
        }
    }
}
