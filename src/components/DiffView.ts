import * as vscode from 'vscode';
import * as path from 'path';
import { DecorationManager } from './DecorationManager';

class DiffContentProvider implements vscode.TextDocumentContentProvider {
    private contents = new Map<string, string>();

    provideTextDocumentContent(uri: vscode.Uri): string {
        return this.contents.get(uri.toString()) || '';
    }

    setContent(uri: vscode.Uri, content: string) {
        this.contents.set(uri.toString(), content);
    }

    clear(uri: vscode.Uri) {
        this.contents.delete(uri.toString());
    }
}

export class DiffView {
    private static readonly contentProvider = new DiffContentProvider();
    private static readonly registration = vscode.workspace.registerTextDocumentContentProvider(
        'autopilot-diff',
        DiffView.contentProvider
    );

    private editor?: vscode.TextEditor;
    private decorationManager?: DecorationManager;
    private originalContent: string;
    private uri: vscode.Uri;
    private diffUri: vscode.Uri;

    constructor(filePath: string, originalContent: string) {
        this.originalContent = originalContent;
        this.uri = vscode.Uri.file(filePath);
        const fileName = path.basename(filePath);
        this.diffUri = vscode.Uri.parse(`autopilot-diff:${fileName}`);
    }

    async show(): Promise<boolean> {
        try {
            const fileName = path.basename(this.uri.fsPath);
            
            // Set the content for the diff view
            DiffView.contentProvider.setContent(this.diffUri, this.originalContent);
            
            this.editor = await vscode.window.showTextDocument(
                this.uri,
                { preview: false, viewColumn: vscode.ViewColumn.Active }
            );

            if (!this.editor) return false;

            this.decorationManager = new DecorationManager(this.editor);
            await vscode.commands.executeCommand('vscode.diff',
                this.diffUri,
                this.uri,
                `${fileName}: Original ↔ Changes`
            );

            return true;
        } catch (error) {
            console.error('Failed to open diff view:', error);
            return false;
        }
    }

    async update(content: string, line: number) {
        if (!this.editor) return;

        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            0, 0,
            this.editor.document.lineCount, 0
        );
        
        edit.replace(this.uri, fullRange, content);
        await vscode.workspace.applyEdit(edit);
        
        if (this.decorationManager) {
            this.decorationManager.updateActiveLine(line);
            this.decorationManager.updateFadedLines(line + 1, this.editor.document.lineCount);
        }
    }

    async close() {
        if (this.decorationManager) {
            this.decorationManager.clear();
        }
        DiffView.contentProvider.clear(this.diffUri);
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }
}
