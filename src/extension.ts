import * as vscode from 'vscode';
import * as chatUtils from '@vscode/chat-extension-utils';
import * as os from 'os';
import { FileReadTool, FileWriteTool, FileUpdateTool, CommandRunTool, ParallelToolUseTool } from './devTools';
import { listImportantFiles } from './listFiles';

function getSystemInfo(): string {
    const platform = os.platform();
    const release = os.release();
    const type = os.type();
    
    let osInfo = `Operating System: ${type} (${platform}) ${release}`;
    
    // Add specific shell information based on OS
    switch (platform) {
        case 'win32':
            osInfo += '\nDefault Shell: Command Prompt/PowerShell';
            break;
        case 'darwin':
            osInfo += '\nDefault Shell: zsh/bash';
            break;
        case 'linux':
            osInfo += '\nDefault Shell: bash';
            break;
    }
    
    return osInfo;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Autopilot extension is now active!');

    // Register tools
    context.subscriptions.push(
        vscode.lm.registerTool('autopilot_readFile', new FileReadTool()),
        vscode.lm.registerTool('autopilot_writeFile', new FileWriteTool()),
        vscode.lm.registerTool('autopilot_updateFile', new FileUpdateTool()),
        vscode.lm.registerTool('autopilot_runCommand', new CommandRunTool()),
        vscode.lm.registerTool('multi-tool-use-parallel', new ParallelToolUseTool())
    );

    // Register chat participant
    const handler: vscode.ChatRequestHandler = async (request, chatContext, stream, token) => {
        const [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'claude-3.5-sonnet' });
        if (!model) {
            console.log('Model not found. Please make sure the GitHub Copilot Chat extension is installed and enabled.');
            return;
        }
        
        // Get repository information
        const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        const repoInfo = workspacePath ? listImportantFiles(workspacePath) : { structure: '', contents: {} };
        
        const tools = vscode.lm.tools.filter(tool => 
            tool.name.startsWith('autopilot_') || tool.name === 'multi-tool-use-parallel'
        ); 

        const finalPrompt = `You are *Autopilot*, who combines technical mastery with innovative thinking. You excel at finding elegant solutions to complex problems, often seeing angles others miss. Your approach is pragmatic yet creative – you know when to apply proven patterns and when to forge new paths.
Your strengths lie in:

- Breaking down complex problems into elegant solutions
- Thinking beyond conventional approaches when needed
- Balancing quick wins with long-term code quality
- Turning abstract requirements into concrete, efficient implementations

**System Information:**
${getSystemInfo()}

**Project Information:**
Repository Structure:
${repoInfo.structure}

File Contents:
${Object.entries(repoInfo.contents)
    .map(([path, content]) => `--- ${path} ---\n${content}\n`)
    .join('\n')}

Use this provided context (structure, OS details, and file contents) to inform your actions.

INSTRUCTIONS:
    - When tackling challenges, you first understand the core problem, then consider multiple approaches before crafting a solution that's both innovative and practical. Your code is clean, your solutions are scalable, and your thinking is always one step ahead.
    - Propose a clear, step-by-step plan in a PLAN section **before** executing any tools.
    - Do **not** reveal or directly quote source code unless the USER explicitly asks for it.
    - You may describe the code’s functionality and structure, but never provide exact code snippets without an explicit request.
    - Adjust command syntax to match the user’s operating system.
    - ALWAYS use the tools under EXECUTION section.
    - ALWAYS provide short, clever and concise responses without getting into too much details.
    - If you need more details, ask the USER for clarification.`;

    console.log('Final prompt:', finalPrompt);

        const libResult = chatUtils.sendChatParticipantRequest(
            request,
            chatContext,
            {
            prompt: finalPrompt,
            model: model,
            responseStreamOptions: {
                stream,
                references: true,
                responseText: true
            },
            tools
            },
            token
        );
        return await libResult.result;
    };

    const participant = vscode.chat.createChatParticipant('autopilot.assistant', handler);
    context.subscriptions.push(participant);
}

export function deactivate() {}
