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
        const includePatterns = vscode.workspace.getConfiguration('cogent').get('search_include_patterns', '**/*').split(',').map( pattern => pattern.charAt(0) != '/' ? '**/' + pattern.trim() : pattern.trim() );
        const excludePatterns = vscode.workspace.getConfiguration('cogent').get('search_exclude_patterns', '').split(',').map( pattern => pattern.charAt(0) != '/' ? '**/' + pattern.trim() : pattern.trim() );
        const files = await vscode.workspace.findFiles( '{'+includePatterns.join(',')+'}', excludePatterns.length > 0 ? '{'+excludePatterns.join(',')+'}' : null );
        const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';

        for (const file of files) {
            const filePath = file.fsPath;
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
                if (line.includes(text)) {
                    const relativePath = path.relative( workspacePath, filePath );
                    console.log(`📝 File: ${relativePath}:${index + 1}\n\`\`\`${line}\`\`\`\n`);
                    results.push(`📝 File: ${relativePath}:${index + 1}\n\`\`\`${line}\`\`\`\n`);
                }
            });
        }

        return results;
    }
}
