import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ITextSearchParams {
    text: string;
}

export class TextSearchTool implements vscode.LanguageModelTool<ITextSearchParams> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ITextSearchParams>,
        _token: vscode.CancellationToken
    ) {
        const searchText = options.input.text;
        const results = await this.searchTextInWorkspace(searchText);

        if (results.length === 0) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`No matches found for: ${searchText}`)
            ]);
        }

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(results.join('\n\n'))
        ]);
    }

    private async searchTextInWorkspace(text: string): Promise<string[]> {
        const results: string[] = [];
        const ignorePatterns = await this.getIgnorePatterns();
        const files = await vscode.workspace.findFiles('**/*');

        for (const file of files) {
            const filePath = file.fsPath;
            if (this.isIgnored(filePath, ignorePatterns)) {
                continue;
            }
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
                if (line.includes(text)) {
                    results.push(`File: ${filePath}:${index + 1}\n${line}`);
                }
            });
        }

        return results;
    }

    private async getIgnorePatterns(): Promise<string[]> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        const ignoreFilePath = path.join(workspaceFolder.uri.fsPath, '.cogentignore');
        try {
            const content = await fs.readFile(ignoreFilePath, 'utf-8');
            return content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
        } catch (error) {
            return [];
        }
    }

    private isIgnored(filePath: string, ignorePatterns: string[]): boolean {
        return ignorePatterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(filePath);
        });
    }
}
