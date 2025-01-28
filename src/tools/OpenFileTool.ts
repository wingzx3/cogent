import * as vscode from 'vscode';
import * as path from 'path';

interface IOpenFileParams {
    path: string;
    line?: number;
}

export class OpenFileTool implements vscode.LanguageModelTool<IOpenFileParams> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IOpenFileParams>,
        _token: vscode.CancellationToken
    ) {
        try {
            const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            if (!workspacePath) {
                throw new Error('No workspace folder found');
            }

            const filePath = options.input.path;
            const line = options.input.line ?? 1;

            const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspacePath, filePath);
            const uri = vscode.Uri.file(fullPath);

            // Open the document and show it in the editor
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);

            // Move cursor to specified line
            const position = new vscode.Position(line - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position));

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Opened ${filePath} at line ${line}`)
            ]);
        } catch (err: unknown) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Error opening file: ${(err as Error)?.message}`)
            ]);
        }
    }
}
