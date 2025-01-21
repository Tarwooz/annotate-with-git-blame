import * as vscode from 'vscode'
import { checkGitRepositoryForActiveEditor } from './gitUtils'
import { registerCommands } from './commands'

export function activate(context: vscode.ExtensionContext) {
    checkGitRepositoryForActiveEditor()

    vscode.window.onDidChangeActiveTextEditor(() => {
        checkGitRepositoryForActiveEditor()
    })

    registerCommands(context)
}

export function deactivate() {}
