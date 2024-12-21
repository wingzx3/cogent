import * as vscode from 'vscode';

export class DecorationManager {
    private static readonly fadeDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 255, 0, 0.1)',
        opacity: '0.4',
        isWholeLine: true
    });

    private static readonly activeDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 255, 0, 0.3)',
        opacity: '1',
        isWholeLine: true,
        border: '1px solid rgba(255, 255, 0, 0.5)'
    });

    private editor: vscode.TextEditor;
    private ranges: vscode.Range[] = [];

    constructor(editor: vscode.TextEditor) {
        this.editor = editor;
    }

    updateActiveLine(line: number) {
        this.editor.setDecorations(DecorationManager.activeDecoration, [
            new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER)
        ]);
    }

    updateFadedLines(startLine: number, endLine: number) {
        if (startLine > endLine) return;
        
        this.ranges = [new vscode.Range(
            startLine, 0,
            endLine, Number.MAX_SAFE_INTEGER
        )];
        this.editor.setDecorations(DecorationManager.fadeDecoration, this.ranges);
    }

    clear() {
        this.editor.setDecorations(DecorationManager.fadeDecoration, []);
        this.editor.setDecorations(DecorationManager.activeDecoration, []);
        this.ranges = [];
    }
}
