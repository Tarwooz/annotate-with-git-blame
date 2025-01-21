import * as vscode from 'vscode'
import { exec } from 'child_process'

export function checkGitRepositoryForActiveEditor() {
    const editor = vscode.window.activeTextEditor
    if (editor) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri)
        if (workspaceFolder) {
            const workspacePath = workspaceFolder.uri.fsPath
            exec(`git rev-parse --is-inside-work-tree`, { cwd: workspacePath }, (error, stdout) => {
                if (error || stdout.trim() !== 'true') {
                    vscode.commands.executeCommand('setContext', 'isGitRepository', false)
                } else {
                    vscode.commands.executeCommand('setContext', 'isGitRepository', true)
                }
            })
        } else {
            vscode.commands.executeCommand('setContext', 'isGitRepository', false)
        }
    } else {
        vscode.commands.executeCommand('setContext', 'isGitRepository', false)
    }
}
