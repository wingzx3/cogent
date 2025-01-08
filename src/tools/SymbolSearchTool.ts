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

                    results.push(`File: ${symbolInfo.location.uri.fsPath}:${startLine}`);

                    const exactPosition = this.findSymbolPositionInRange(symbolText, symbol, symbolRange.start);
                    const references = await this.findReferences(new Location(symbolInfo.location.uri, exactPosition));
                    results.push(...references);
                }
            }
        }

        return results;
    }

    private findSymbolPositionInRange(text: string, symbol: string, startPos: Position): Position {
        const symbolIndex = text.indexOf(symbol);
        if (symbolIndex === -1) {
            return startPos;
        }
        return new Position(
            startPos.line,
            startPos.character + symbolIndex
        );
    }

    private async findReferences(location: Location): Promise<string[]> {
        const results: string[] = [];
        const references = await vscode.commands.executeCommand<Location[]>('vscode.executeReferenceProvider', location.uri, new Position(location.range.start.line, location.range.start.character));

        if (references) {
            for (const reference of references) {
                const document = await vscode.workspace.openTextDocument(reference.uri);
                const referenceRange = reference.range;
                let startLine = Math.max(referenceRange.start.line - 2, 0);
                const endLine = Math.min(referenceRange.end.line + 2, document.lineCount - 1);
                const referenceText = document.getText(new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length));
                startLine++;

                console.log(`File: ${reference.uri.fsPath}:${startLine}\n${referenceText}`);

                results.push(`File: ${reference.uri.fsPath}:${startLine}\n${referenceText}`);
            }
        }

        return results;
    }
}
