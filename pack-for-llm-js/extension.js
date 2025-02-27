const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * Gets the programming language from file extension for syntax highlighting
 * @param {string} filePath - Path to the file
 * @returns {string} Language ID for the file or empty string
 */
function getLanguageId(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const langMap = {
        '.js': 'javascript',
        '.ts': 'typescript',
        '.py': 'python',
        '.html': 'html',
        '.css': 'css',
        '.json': 'json',
        '.md': 'markdown',
        '.java': 'java',
        '.cpp': 'cpp',
        '.c': 'c',
        '.go': 'go',
        '.rb': 'ruby',
        '.php': 'php',
        '.rs': 'rust',
        '.swift': 'swift',
        '.sh': 'shell',
        '.jsx': 'javascriptreact',
        '.tsx': 'typescriptreact',
        '.vue': 'vue'
    };
    
    return langMap[ext] || '';
}

/**
 * Recursively gets all files from a directory
 * @param {string} dirPath - Path to the directory
 * @param {Array} fileList - Array to store file paths
 * @returns {Array} Array of file paths
 */
function getAllFilesFromDir(dirPath, fileList = []) {
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);
        
        // Skip hidden files and directories
        if (file.startsWith('.')) {
            return;
        }
        
        if (stat.isDirectory()) {
            getAllFilesFromDir(filePath, fileList);
        } else {
            fileList.push(vscode.Uri.file(filePath));
        }
    });
    
    return fileList;
}

/**
 * Gets all files from selected resources, handling both files and directories
 * @param {vscode.Uri[]} resources - Selected resources (files or directories)
 * @returns {vscode.Uri[]} Array of file URIs
 */
async function getFilesFromResources(resources) {
    let allFiles = [];
    
    for (const resource of resources) {
        const stat = fs.statSync(resource.fsPath);
        
        if (stat.isDirectory()) {
            // For directories, get all files recursively
            const dirFiles = getAllFilesFromDir(resource.fsPath);
            allFiles = allFiles.concat(dirFiles);
        } else {
            // For files, add directly
            allFiles.push(resource);
        }
    }
    
    return allFiles;
}

/**
 * Packs the contents of multiple files into a single string with enhanced headers
 * @param {vscode.Uri[]} files - Array of file URIs to process
 * @param {object} options - Formatting options
 * @returns {string} The packed content
 */
function packFiles(files, options = {}) {
    let packedContent = '';
    const dividerLength = 80;
    
    // Add a title and summary
    packedContent += '# Project Files Pack for LLM\n';
    packedContent += `# Total files: ${files.length}\n`;
    packedContent += `# Generated: ${new Date().toISOString()}\n\n`;
    
    // Add a table of contents
    packedContent += '## Files included:\n';
    files.forEach((fileUri, index) => {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
        const relativePath = workspaceFolder ? path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath) : fileUri.fsPath;
        packedContent += `${index + 1}. ${relativePath}\n`;
    });
    packedContent += '\n' + '='.repeat(dividerLength) + '\n\n';
    
    // Add each file with enhanced separators
    files.forEach((fileUri, index) => {
        const filePath = fileUri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
        const relativePath = workspaceFolder ? path.relative(workspaceFolder.uri.fsPath, filePath) : filePath;
        const lang = getLanguageId(filePath);
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const fileStats = fs.statSync(filePath);
            
            // Create a prominent file header
            packedContent += `${'#'.repeat(dividerLength)}\n`;
            packedContent += `# FILE ${index + 1}/${files.length}: ${relativePath}\n`;
            packedContent += `# Size: ${(fileStats.size / 1024).toFixed(1)} KB | Last modified: ${fileStats.mtime.toISOString()}\n`;
            
            if (lang) {
                packedContent += `# Language: ${lang}\n`;
            }
            
            packedContent += `${'#'.repeat(dividerLength)}\n\n`;
            
            // Add file content with markdown code block if we have a language identifier
            if (lang) {
                packedContent += '```' + lang + '\n';
                packedContent += content;
                packedContent += '\n```\n\n';
            } else {
                packedContent += content + '\n\n';
            }
            
            // Add a clear separator between files
            packedContent += '\n' + '='.repeat(dividerLength) + '\n\n';
        } catch (err) {
            vscode.window.showErrorMessage(`Error reading file ${relativePath}: ${err}`);
        }
    });
    
    return packedContent;
}

/**
 * Activates the extension
 * @param {vscode.ExtensionContext} context 
 */
function activate(context) {
    let disposable = vscode.commands.registerCommand('extension.packForLlm', async (...args) => {
        let selectedResources = [];
        
        // If called from Explorer context menu with selection
        if (args && args.length > 0) {
            // Check for multi-selection (args[1] will contain additional resources)
            if (args.length > 1 && Array.isArray(args[1])) {
                selectedResources = args[1];
                // If the first item wasn't included in the array (happens sometimes with VS Code API)
                if (args[0] && args[0].fsPath && !selectedResources.some(r => r.fsPath === args[0].fsPath)) {
                    selectedResources.unshift(args[0]);
                }
            } else if (args[0] && args[0].fsPath) {
                // Single resource selection
                selectedResources = [args[0]];
            }
        }
        
        // If no resources were provided or found in args, try to get from active editor or show dialog
        if (selectedResources.length === 0) {
            if (vscode.window.activeTextEditor) {
                selectedResources = [vscode.Uri.file(vscode.window.activeTextEditor.document.fileName)];
            } else {
                // Prompt for resource selection
                const result = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: true,
                    canSelectMany: true,
                    openLabel: "Select files or folders to pack"
                });
                
                if (result) {
                    selectedResources = result;
                }
            }
        }
        
        if (selectedResources.length === 0) {
            vscode.window.showWarningMessage("No files or folders selected to pack.");
            return;
        }
        
        // Show progress indicator
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Packing files for LLM",
            cancellable: false
        }, async (progress) => {
            progress.report({ message: "Processing selected resources..." });
            
            try {
                // Process directories and gather all files
                const allFiles = await getFilesFromResources(selectedResources);
                
                if (allFiles.length === 0) {
                    vscode.window.showWarningMessage("No files found in the selected resources.");
                    return;
                }
                
                // Update progress
                progress.report({ message: `Packing ${allFiles.length} files...` });
                
                // Pack the contents of all files
                const content = packFiles(allFiles);
                
                // Open a new untitled document with the packed content
                const doc = await vscode.workspace.openTextDocument({ content, language: 'markdown' });
                await vscode.window.showTextDocument(doc);
                
                vscode.window.showInformationMessage(`Successfully packed ${allFiles.length} files.`);
            } catch (error) {
                vscode.window.showErrorMessage(`Error packing files: ${error.message}`);
            }
        });
    });
    
    context.subscriptions.push(disposable);
}

/**
 * Deactivates the extension
 */
function deactivate() {}

module.exports = {
    activate,
    deactivate
};