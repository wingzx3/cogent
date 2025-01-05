import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

interface IFileOperationParams {
    path?: string;
    paths?: string[];
    content?: string;
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

            const results = await Promise.all(filePaths.map(async (filePath) => {
                //const fullPath = path.join(workspacePath, filePath);
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    return [
                        '=' .repeat(80),
                        `📝 File: ${filePath}`,
                        '=' .repeat(80),
                        content
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