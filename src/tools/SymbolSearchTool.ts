import { relative } from 'path';
import * as vscode from 'vscode';
import { Location, Position } from 'vscode';
import * as path from 'path';

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
        const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';

        if (symbolInfos) {
            for (const symbolInfo of symbolInfos) {
                if (symbolInfo.name === symbol) {
                    const document = await vscode.workspace.openTextDocument(symbolInfo.location.uri);
                    const symbolRange = symbolInfo.location.range;
                    const symbolText = document.getText(symbolRange);
                    const startLine = symbolRange.start.line + 1;
                    const endLine = symbolRange.end.line + 1;
                    const symbolLines = document.getText(new vscode.Range(symbolRange.start.line, 0, symbolRange.end.line, document.lineAt(symbolRange.end.line).text.length));

                    const relativePath = path.relative(workspacePath, symbolInfo.location.uri.fsPath);

                    console.log(`📝 File: ${relativePath}:${startLine}:${endLine}\n\`\`\`${symbolLines}\`\`\`\n`);
                    results.push(`📝 File: ${relativePath}:${startLine}:${endLine}\n\`\`\`${symbolLines}\`\`\`\n`);

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
        const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';

        if (references) {
            for (const reference of references) {
                const document = await vscode.workspace.openTextDocument(reference.uri);
                const referenceRange = reference.range;
                let startLine = Math.max(referenceRange.start.line - 7, 0);
                let endLine = Math.min(referenceRange.end.line + 7, document.lineCount - 1);
                const referenceText = document.getText(new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length));
                startLine++;
                endLine++;

                const relativePath = path.relative( workspacePath, reference.uri.fsPath );
                console.log(`📝 File: ${relativePath}:${startLine}:${endLine}\n\`\`\`${referenceText}\`\`\``);
                results.push(`📝 File: ${relativePath}:${startLine}:${endLine}\n\`\`\`${referenceText}\`\`\`\n`);
            }
        }

        return results;
    }
}
