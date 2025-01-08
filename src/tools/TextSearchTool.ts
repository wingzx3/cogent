import * as vscode from 'vscode';
import * as fs from 'fs/promises';

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
        const files = await vscode.workspace.findFiles('**/*');

        for (const file of files) {
            const filePath = file.fsPath;
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
}
