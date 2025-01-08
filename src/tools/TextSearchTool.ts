import * as vscode from 'vscode';

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
        const query = new vscode.TextSearchQuery(text, { isCaseSensitive: true, isRegExp: false });
        const options: vscode.TextSearchOptions = { maxResults: 1000 };

        await vscode.workspace.findTextInFiles(query, options, result => {
            const filePath = result.uri.fsPath;
            result.ranges.forEach(range => {
                const startLine = range.start.line + 1;
                console.log(`Found match in file: ${filePath} at line: ${startLine}\n${result.preview.text}`);
                results.push(`File: ${filePath}:${startLine}\n${result.preview.text}`);
            });
        });

        return results;
    }
}
