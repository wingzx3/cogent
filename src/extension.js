const vscode = require('vscode');
const { SymbolSearchTool } = require('./tools/SymbolSearchTool');

function activate(context) {
    console.log('Cogent extension is now active!');

    // Register tools
    context.subscriptions.push(
        vscode.lm.registerTool('cogent_searchSymbol', new SymbolSearchTool())
    );
}

function deactivate() {
    console.log('Cogent extension is now deactivated!');
}

module.exports = {
    activate,
    deactivate
};
