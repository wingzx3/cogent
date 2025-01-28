import * as vscode from 'vscode';
import { registerToolUserChatParticipant } from './toolParticipant';
import { FileReadTool, FileWriteTool, FilePatchTool, CommandRunTool } from './tools';
import { DiffView } from './components/DiffView';
import { SymbolSearchTool } from './tools/SymbolSearchTool';
import { FileSearchTool } from './tools/FileSearchTool';
import { TextSearchTool } from './tools/TextSearchTool';
import { OpenFileTool } from './tools/OpenFileTool';
import { CodeOutlineTool } from './tools/CodeOutlineTool';

export function activate(context: vscode.ExtensionContext) {
    console.log('Cogent extension is now active!');

    // Register tools
    context.subscriptions.push(
        vscode.lm.registerTool('cogent_readFile', new FileReadTool()),
        vscode.lm.registerTool('cogent_writeFile', new FileWriteTool()),
        vscode.lm.registerTool('cogent_patchFile', new FilePatchTool()),
        vscode.lm.registerTool('cogent_runCommand', new CommandRunTool()),
        vscode.lm.registerTool('cogent_searchSymbol', new SymbolSearchTool()),
        vscode.lm.registerTool('cogent_searchFile', new FileSearchTool()),
        vscode.lm.registerTool('cogent_searchText', new TextSearchTool()),
        vscode.lm.registerTool('cogent_openFile', new OpenFileTool()),
        vscode.lm.registerTool('cogent_codeOutline', new CodeOutlineTool()),

    );

    // Register the tool participant
    registerToolUserChatParticipant(context);
}

export function deactivate() {
    DiffView.dispose();
}
