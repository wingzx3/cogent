import * as vscode from 'vscode';
import { registerToolUserChatParticipant } from './toolParticipant';
import { FileReadTool, FileWriteTool, FileUpdateTool, CommandRunTool, ParallelToolUseTool } from './tools';
import { DiffView } from './components/DiffView';

export function activate(context: vscode.ExtensionContext) {
    console.log('Autopilot extension is now active!');
    
    // Register tools
    context.subscriptions.push(
        //vscode.lm.registerTool('autopilot_readFile', new FileReadTool()),
        vscode.lm.registerTool('autopilot_writeFile', new FileWriteTool()),
        vscode.lm.registerTool('autopilot_updateFile', new FileUpdateTool()),
        vscode.lm.registerTool('autopilot_runCommand', new CommandRunTool()),
        vscode.lm.registerTool('multi-tool-use-parallel', new ParallelToolUseTool())
    );
    
    // Register the tool participant
    registerToolUserChatParticipant(context);
}

export function deactivate() {
    DiffView.dispose();
}
