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

        if (results.length === 0) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`No references found for: ${symbol}`)
            ]);
        }

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(results.join('\n\n'))
        ]);
    }

    private async searchSymbolInWorkspace(symbol: string): Promise<string[]> {
        const results: string[] = [];
        const symbolReferences = await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeReferenceProvider', { includeDeclaration: false }, symbol);

        if (symbolReferences) {
            for (const reference of symbolReferences) {
                const document = await vscode.workspace.openTextDocument(reference.uri);
                const referenceRange = reference.range;
                const referenceText = document.getText(referenceRange);
                const startLine = referenceRange.start.line + 1;

                console.log(`Found reference: ${symbol} in file: ${reference.uri.fsPath} at line: ${startLine}`);

                results.push(`File: ${reference.uri.fsPath}\nLine ${startLine}:\n${referenceText}`);
            }
        }

        return results;
    }
}
