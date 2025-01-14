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
            let startLine = options.input.startLine ?? 1;
            const endLine = options.input.endLine ?? Number.MAX_SAFE_INTEGER;

            const results = await Promise.all(filePaths.map(async (filePath) => {
                try {
                    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspacePath, filePath);
                    const uri = vscode.Uri.file(fullPath);
                    let content = '';

                    const openDoc = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === uri.fsPath);
                    if (openDoc) {
                        content = openDoc.getText();
                    } else {
                        content = await fs.readFile(fullPath, 'utf-8');
                    }

                    const allLines = content.split('\n');
                    const totalLines = allLines.length;

                    // Handle negative startLine
                    if (startLine < 0) {
                        startLine = Math.max(1, totalLines + startLine + 1);
                    }

                    // Ensure bounds
                    const effectiveStartLine = Math.max(1, Math.min(startLine, totalLines));
                    const effectiveEndLine = Math.min(endLine, totalLines);

                    const lines = allLines.slice(effectiveStartLine - 1, effectiveEndLine);
                    console.log(`📝 File: ${filePath}:${effectiveStartLine}:${effectiveEndLine}`);
                    return [
                        `📝 File: ${filePath}:${effectiveStartLine}:${effectiveEndLine}`,
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
