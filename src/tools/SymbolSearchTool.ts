import * as vscode from 'vscode';
import { Location, Position } from 'vscode';

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
                new vscode.LanguageModelTextPart(`No symbols found for: ${symbol}`)
            ]);
        }

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

                    console.log(`Found symbol: ${symbol} in file: ${symbolInfo.location.uri.fsPath} at line: ${startLine}`);

                    results.push(`File: ${symbolInfo.location.uri.fsPath}\nLine ${startLine}:\n${symbolText}`);

                    const references = await this.findReferences(symbolInfo.location);
                    results.push(...references);
                }
            }
        }

        return results;
    }

    private async findReferences(location: Location): Promise<string[]> {
        const results: string[] = [];
        const references = await vscode.commands.executeCommand<Location[]>('vscode.executeReferenceProvider', location.uri, new Position(location.range.start.line, location.range.start.character));

        if (references) {
            for (const reference of references) {
                const document = await vscode.workspace.openTextDocument(reference.uri);
                const referenceRange = reference.range;
                const referenceText = document.getText(referenceRange);
                const startLine = referenceRange.start.line + 1;

                console.log(`Found reference in file: ${reference.uri.fsPath} at line: ${startLine}`);

                results.push(`Reference in file: ${reference.uri.fsPath}\nLine ${startLine}:\n${referenceText}`);
            }
        }

        return results;
    }
}
