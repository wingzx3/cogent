import { listImportantFiles } from './components/listFiles';
import * as path from 'path';

// Get the current directory
const currentDir = process.cwd();
const result = listImportantFiles(currentDir);

// Print directory structure
console.log('\n📁 Directory Structure:');
console.log(result.structure);

// Print full file contents with separators
console.log('\n📄 File Contents:');
Object.entries(result.contents).forEach(([filePath, content]) => {
    const fullPath = path.join(currentDir, filePath);
    console.log('\n' + '='.repeat(80));
    console.log(`📝 File: ${filePath}`);
    console.log('='.repeat(80));
    console.log(content);
});