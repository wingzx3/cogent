import * as vscode from 'vscode';
import * as path from 'path';

interface ICodeOutlineParams {
    path: string;
}

export class CodeOutlineTool implements vscode.LanguageModelTool<ICodeOutlineParams> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ICodeOutlineParams>,
        _token: vscode.CancellationToken
    ) {
        try {
            const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            if (!workspacePath) {
                throw new Error('No workspace folder found');
            }

            const filePath = options.input.path;
            const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspacePath, filePath);
            const uri = vscode.Uri.file(fullPath);

            const document = await vscode.workspace.openTextDocument(uri);
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', uri);

            if (!symbols || symbols.length === 0) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`No symbols found in ${filePath}`)
                ]);
            }

            const outlines: string[] = [];
            await this.processSymbols(document, symbols, '', outlines);

            console.log(`📝 Symbols found in ${filePath}:\n${outlines.join('\n')}`);

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(outlines.join('\n'))
            ]);
        } catch (err: unknown) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Error processing file: ${(err as Error)?.message}`)
            ]);
        }
    }

    private async processSymbols(
        document: vscode.TextDocument,
        symbols: vscode.DocumentSymbol[],
        prefix: string,
        outlines: string[]
    ): Promise<void> {
        // First process case statements in the entire document
        await this.processCaseStatements(document, outlines);

        // Then process function and method symbols
        for (const symbol of symbols) {
            if (symbol.kind === vscode.SymbolKind.Function ||
                symbol.kind === vscode.SymbolKind.Method) {
                const signature = await this.getSymbolSignature(document, symbol);
                outlines.push(`${prefix}${signature}`);
            } else if (symbol.kind === vscode.SymbolKind.Class) {
                // Process class methods with class prefix
                if (symbol.children.length > 0) {
                    await this.processSymbols(document, symbol.children, `${symbol.name}::`, outlines);
                }
            }

            // Process nested symbols (except for class methods which are handled above)
            if (symbol.kind !== vscode.SymbolKind.Class && symbol.children.length > 0) {
                await this.processSymbols(document, symbol.children, prefix, outlines);
            }
        }
    }

    private async processCaseStatements(
        document: vscode.TextDocument,
        outlines: string[]
    ): Promise<void> {
        const text = document.getText();
        const lines = text.split('\n');

        let inSwitch = false;
        let caseStartLine = -1;
        let currentCase = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.match(/\bswitch\b.*/)) {
                inSwitch = true;
                continue;
            }

            if (inSwitch) {
                const caseMatch = line.match(/\bcase\b\s+([^:]+):/);
                if (caseMatch) {
                    // If we had a previous case, add it to outlines before starting new one
                    if (currentCase && caseStartLine !== -1) {
                        outlines.push(`case ${currentCase}:${caseStartLine + 1}:${i}`);
                    }
                    currentCase = caseMatch[1].trim();
                    caseStartLine = i;
                    continue;
                }

                // Check for end of case
                if (line.match(/\b(break|return)\b/) || line.match(/\bcase\b/) || line.match(/\bdefault\b/)) {
                    if (currentCase && caseStartLine !== -1) {
                        outlines.push(`case ${currentCase}:${caseStartLine + 1}:${i + 1}`);
                        currentCase = '';
                        caseStartLine = -1;
                    }
                }

                if (line.match(/endswitch$/)) {
                    inSwitch = false;
                }
            }
        }

        // Handle the last case if we're still processing one
        if (inSwitch && currentCase && caseStartLine !== -1) {
            outlines.push(`case ${currentCase}:${caseStartLine + 1}:${lines.length}`);
        }
    }

    private async getSymbolSignature(document: vscode.TextDocument, symbol: vscode.DocumentSymbol): Promise<string> {
        const line = document.lineAt(symbol.range.start.line).text;

        // Extract function/method name and parameters
        const match = line.match(/(?:function\s+)?(\w+)\s*\((.*?)\)/);
        if (match) {
            const [, name, params] = match;
            // Keep parameter types but clean up extra whitespace
            const cleanParams = params
                .split(',')
                .map(p => p.trim())
                .join(', ');
            return `${name}(${cleanParams})`;
        }

        // Fallback to just the symbol name if we can't parse the signature
        return `${symbol.name}()`;
    }
}
