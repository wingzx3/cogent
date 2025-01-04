import * as vscode from 'vscode';

interface ISymbolSearchParams {
    symbol: string;
}

export class SymbolSearchTool implements vscode.LanguageModelTool<ISymbolSearchParams> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ISymbolSearchParams>,
        _token: vscode.CancellationToken
    ) {
        const symbol = options.input.symbol;
        const results = await this.searchSymbolInWorkspace(symbol);

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(results.join('\n\n'))
        ]);
    }

    private async searchSymbolInWorkspace(symbol: string): Promise<string[]> {
        const results: string[] = [];
        const symbolInfos = await vscode.commands.executeCommand<vscode.SymbolInformation[]>('vscode.executeWorkspaceSymbolProvider', symbol);

        if (symbolInfos) {
            for (const symbolInfo of symbolInfos) {
                if (symbolInfo.name === symbol) {
                    const document = await vscode.workspace.openTextDocument(symbolInfo.location.uri);
                    const symbolRange = symbolInfo.location.range;
                    const symbolText = document.getText(symbolRange);
                    const startLine = symbolRange.start.line + 1;

                    results.push(`File: ${symbolInfo.location.uri.fsPath}\nLine ${startLine}:\n${symbolText}`);
                }
            }
        }

        return results;
    }
}
