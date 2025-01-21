import * as vscode from 'vscode'
import { exec } from 'child_process'
import { createBlameDecorations } from './blameDecorator'

let isBlameActive = false
let blameDecorationType: vscode.TextEditorDecorationType | undefined
let selectionChangeListener: vscode.Disposable | undefined

export function registerCommands(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('extension.annotateWithGitBlame', () => {
        if (isBlameActive) {
            vscode.window.showWarningMessage('Annotate with Git Blame is already active.')
            return
        }

        isBlameActive = true
        vscode.commands.executeCommand('setContext', 'blameActive', true)

        const editor = vscode.window.activeTextEditor
        if (editor) {
            const filePath = editor.document.fileName
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri)

            if (workspaceFolder) {
                const workspacePath = workspaceFolder.uri.fsPath

                exec(`git rev-parse --is-inside-work-tree`, { cwd: workspacePath }, (error, stdout, stderr) => {
                    if (error || stdout.trim() !== 'true') {
                        vscode.window.showErrorMessage('This file is not part of a Git repository.')
                        return
                    }

                    exec(`git blame ${filePath}`, { cwd: workspacePath }, (error, stdout, stderr) => {
                        if (error) {
                            vscode.window.showErrorMessage(`Error: ${stderr}`)
                            return
                        }

                        const blameInfo = stdout.split('\n')
                        const decorations = createBlameDecorations(blameInfo, 0)

                        // .
                        blameDecorationType = vscode.window.createTextEditorDecorationType({})
                        editor.setDecorations(blameDecorationType, decorations)

                        selectionChangeListener = vscode.window.onDidChangeTextEditorSelection(
                            (e: vscode.TextEditorSelectionChangeEvent) => {
                                let selection = e.selections[0]
                                let position = selection.active

                                const selectedLine = selection.start.line
                                const selectedDecoration = decorations.find(
                                    decoration => decoration.range.start.line === selectedLine
                                )

                                if (selectedDecoration && position.character === 0) {
                                    const commitHash = selectedDecoration.renderOptions?.before?.contentText
                                        ?.trim()
                                        .split(' ')[0]
                                    if (commitHash) {
                                        vscode.commands
                                            .executeCommand('gitlens.showInCommitGraphView', {
                                                ref: {
                                                    name: commitHash,
                                                    ref: commitHash,
                                                    refType: 'revision',
                                                    repoPath: workspaceFolder.uri.path,
                                                    sha: commitHash,
                                                },
                                            })
                                            .then(
                                                () => {
                                                    console.log(
                                                        `Successfully executed command for commit hash: ${commitHash}`
                                                    )
                                                },
                                                err => {
                                                    console.error(
                                                        `Failed to execute command for commit hash: ${commitHash}`,
                                                        err
                                                    )
                                                    vscode.window.showErrorMessage(
                                                        `Failed to execute command for commit hash: ${commitHash}`
                                                    )
                                                }
                                            )
                                    }
                                }
                            }
                        )

                        vscode.window.onDidChangeActiveTextEditor(() => {
                            if (blameDecorationType) {
                                blameDecorationType.dispose()
                            }
                            if (selectionChangeListener) {
                                selectionChangeListener.dispose()
                            }
                        })
                    })
                })
            }
        }
    })

    let clearDisposable = vscode.commands.registerCommand('extension.clearAnnotations', () => {
        if (!isBlameActive) {
            vscode.window.showWarningMessage('No annotations to clear.')
            return
        }

        isBlameActive = false
        vscode.commands.executeCommand('setContext', 'blameActive', false)

        const editor = vscode.window.activeTextEditor
        if (editor) {
            const emptyDecorationType = vscode.window.createTextEditorDecorationType({})
            editor.setDecorations(emptyDecorationType, [])
        }

        if (blameDecorationType) {
            blameDecorationType.dispose()
            blameDecorationType = undefined
        }
        if (selectionChangeListener) {
            selectionChangeListener.dispose()
            selectionChangeListener = undefined
        }
    })

    context.subscriptions.push(disposable)
    context.subscriptions.push(clearDisposable)
}
