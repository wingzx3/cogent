import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

interface IFileSearchParams {
    filename: string;
}

export class FileSearchTool implements vscode.LanguageModelTool<IFileSearchParams> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IFileSearchParams>,
        _token: vscode.CancellationToken
    ) {
        const filename = options.input.filename;
        const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';
        const results = (await this.searchFilesInWorkspace(filename)).map(result => path.relative(workspacePath, result) );
        console.log(`🔍 Searching for files with name: ${filename}\n${results.join('\n')}`);

        if (results.length === 0) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`No files found for: ${filename}`)
            ]);
        }

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(results.join('\n\n'))
        ]);
    }

    private async searchFilesInWorkspace(filename: string): Promise<string[]> {
        const results: string[] = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (workspaceFolders) {
            for (const folder of workspaceFolders) {
                const folderPath = folder.uri.fsPath;
                const files = await this.findFiles(folderPath, filename);
                results.push(...files);
            }
        }

        return results;
    }

    private async findFiles(dir: string, filename: string): Promise<string[]> {
        const results: string[] = [];
        const files = await fs.readdir(dir, { withFileTypes: true });

        for (const file of files) {
            const filePath = path.join(dir, file.name);

            if (file.isDirectory()) {
                const subDirResults = await this.findFiles(filePath, filename);
                results.push(...subDirResults);
            } else if (file.name.includes(filename)) {
                results.push(filePath);
            }
        }

        return results;
    }
}
