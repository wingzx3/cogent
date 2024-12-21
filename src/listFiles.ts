import * as fs from 'fs';
import * as path from 'path';

const defaultIgnored = [
    // Build and distribution
    'dist',
    'build',
    'out',
    'target',
    'bin',
    'lib',
    '.next',
    
    // Dependencies
    'node_modules',
    'package-lock.json',
    'bower_components',
    'vendor',
    'packages',
    
    // Environment and virtual environments
    '.venv',
    'venv',
    'env',
    '.env',
    'virtualenv',
    
    // Version control
    '.git',
    '.svn',
    '.hg',
    
    // IDE and editor files
    '.idea',
    '.vscode',
    '.vs',
    '.sublime-workspace',
    
    // Cache and temp files
    '.cache',
    'tmp',
    'temp',
    '__pycache__',
    
    // System files
    '.DS_Store',
    '*.db',
    
    // Test and coverage
    'coverage',
    '.nyc_output',
    '.pytest_cache',
    
    // Logs
    'logs',
    '*.log',
    'npm-debug.log*',
    'yarn-debug.log*',
    'yarn-error.log*',

    // Images and media
    '*.jpg',
    '*.jpeg',
    '*.png',
    '*.gif',
    '*.webp',
    '*.mov',
    '*.flv',
    '*.wmv',
    '*.swf',
    '*.fla',
    '*.svg',
    '*.ico',
    '*.webm',
    '*.woff'

];

function getGitignorePatterns(dir: string): string[] {
    const gitignorePath = path.join(dir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) return [];

    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    return gitignoreContent
        .split('\n')
        .filter(Boolean)
        .map(line => line.trim())
        .filter(line => !line.startsWith('#'));
}

function isIgnored(filePath: string, ignorePatterns: string[]): boolean {
    return ignorePatterns.some(pattern => {
        const cleanPattern = pattern.replace(/\/$/, '');
        const escaped = cleanPattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');
        const regex = new RegExp(`^${escaped}(?:$|/.*$)`);
        return regex.test(filePath);
    });
}

interface FileDetails {
    structure: string;
    contents: { [path: string]: string };
}

export function listImportantFiles(dir: string, level: number = 0, contents: { [path: string]: string } = {}): FileDetails {
    let structure = '';
    const ignorePatterns = [...defaultIgnored, ...getGitignorePatterns(dir)];
    const list = fs.readdirSync(dir);

    list.forEach(file => {
        const filePath = path.join(dir, file);
        const relativePath = path.relative(dir, filePath);
        const stat = fs.statSync(filePath);

        if (isIgnored(relativePath, ignorePatterns)) {
            return;
        }

        if (stat && stat.isDirectory()) {
            structure += '  '.repeat(level) + file + '/\n';
            const subDirResult = listImportantFiles(filePath, level + 1, contents);
            structure += subDirResult.structure;
            Object.assign(contents, subDirResult.contents);
        } else {
            structure += '  '.repeat(level) + file + '\n';
            try {
                contents[relativePath] = fs.readFileSync(filePath, 'utf-8');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                contents[relativePath] = `Error reading file: ${errorMessage}`;
            }
        }
    });

    return { structure, contents };
}
