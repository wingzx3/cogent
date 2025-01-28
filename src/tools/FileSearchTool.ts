import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

interface IFileSearchParams {
    globPatternList: string;
}

export class FileSearchTool implements vscode.LanguageModelTool<IFileSearchParams> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IFileSearchParams>,
        _token: vscode.CancellationToken
    ) {
        const globPatterns = options.input.globPatternList;
        const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';
        const results = (await this.searchFilesInWorkspace(globPatterns)).map(result => path.relative(workspacePath, result).replace(/\\/g, '/'));
        console.log(`🔍 Searching for files matching patterns: ${globPatterns}\n${results.join('\n')}`);

        if (results.length === 0) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`No files found matching patterns: ${globPatterns}`)
            ]);
        }

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(results.join('\n\n'))
        ]);
    }

    private async searchFilesInWorkspace(globPatterns: string): Promise<string[]> {
        const excludePatterns = vscode.workspace.getConfiguration('cogent').get('search_exclude_patterns', '').split(',').map(pattern => pattern.charAt(0) != '/' ? '**/' + pattern.trim() : pattern.trim());
        const patterns = globPatterns.split(',').map( p => p.charAt(0) != '/' ? '**/' + p.trim() : p.trim());
        const globPattern = patterns.length > 1 ? `{${patterns.join(',')}}` : patterns[0];

        const files = await vscode.workspace.findFiles(
            globPattern,
            excludePatterns.length > 0 ? '{' + excludePatterns.join(',') + '}' : null
        );

        return files.map(file => file.fsPath);
    }
}
