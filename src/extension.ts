import * as vscode from 'vscode'
import { exec } from 'child_process'

export function activate(context: vscode.ExtensionContext) {
    let isBlameActive = false
    let blameDecorationType: vscode.TextEditorDecorationType | undefined
    let selectionChangeListener: vscode.Disposable | undefined

    // 定义一个函数来检测当前文件是否在 Git 管理的项目中
    function checkGitRepositoryForActiveEditor() {
        const editor = vscode.window.activeTextEditor
        if (editor) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri)
            if (workspaceFolder) {
                // 默认启动文件，blameActive都是false
                isBlameActive = false
                vscode.commands.executeCommand('setContext', 'blameActive', false)

                const workspacePath = workspaceFolder.uri.fsPath
                // 检查当前文件是否在 Git 管理的项目中
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

    // 激活时检查当前活动的文件
    checkGitRepositoryForActiveEditor()

    // 动态设置 isGitRepository 上下文，监听文件切换
    vscode.window.onDidChangeActiveTextEditor(() => {
        checkGitRepositoryForActiveEditor()
    })

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

                // 检查文件是否在 Git 管理的项目中
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

                        // 处理 git blame 输出
                        const blameInfo = stdout.split('\n')
                        const decorations: vscode.DecorationOptions[] = []
                        let maxLength = 0

                        // 计算最长的 blame 信息长度
                        blameInfo.forEach(line => {
                            let match = line.match(/^\^?(\w+)\s\((.*?)\s+(\d{4}-\d{2}-\d{2})\s.*?\s(\d+)\)\s/)
                            // 检测 Vue 文件中的 `blameInfo` 格式
                            if (!match) {
                                match = line.match(/^\^?(\w+)\s.*?\((.*?)\s+(\d{4}-\d{2}-\d{2})\s.*?\s(\d+)\)\s/)
                            }

                            if (match) {
                                const commitHash = match[1]
                                const author = match[2]
                                const date = match[3].replace(/-/g, '/') // 将日期格式转换为年/月/日
                                const blameText = `${date} ${author}`
                                if (commitHash !== '000000000' && blameText.length > maxLength) {
                                    maxLength = blameText.length
                                }
                            }
                        })

                        blameInfo.forEach((line, index) => {
                            let match = line.match(/^\^?(\w+)\s\((.*?)\s+(\d{4}-\d{2}-\d{2})\s.*?\s(\d+)\)\s/)
                            // 检测 Vue 文件中的 `blameInfo` 格式
                            if (!match) {
                                match = line.match(/^\^?(\w+)\s.*?\((.*?)\s+(\d{4}-\d{2}-\d{2})\s.*?\s(\d+)\)\s/)
                            }

                            if (match) {
                                const commitHash = match[1]
                                const author = match[2]
                                const date = match[3].replace(/-/g, '/') // 将日期格式转换为年/月/日
                                const lineNumber = parseInt(match[4], 10) - 1
                                let blameText = `${date} ${author}`

                                // 补齐长度
                                while (blameText.length < maxLength) {
                                    blameText += ' '
                                }

                                // 过滤掉未提交的修改
                                if (commitHash !== '000000000') {
                                    const decoration = {
                                        range: new vscode.Range(lineNumber, 0, lineNumber, 0),
                                        renderOptions: {
                                            before: {
                                                contentText: ` ${blameText}`,
                                                color: 'rgb(142,145,152)', // 字体颜色
                                                backgroundColor: 'rgba(36,41,57,0.7)', // 背景颜色
                                                fontStyle: 'normal',
                                                fontWeight: 'normal',
                                                margin: '0 1em 0 0',
                                                textDecoration: 'none',
                                                borderRadius: '3px 0 0 3px', // 添加圆角
                                                padding: '0 5px', // 添加内边距
                                                width: `${maxLength + 1}ch`, // 设置固定宽度
                                                display: 'inline-block', // 确保为块级元素
                                                cursor: 'block',
                                                borderWidth: '0 2px 0 0',
                                                borderStyle: 'solid',
                                                borderColor: 'rgb(111,99,212)',
                                            },
                                            light: {
                                                before: {
                                                    color: '#000000', // 浅色主题下的字体颜色
                                                    backgroundColor: '#F3F3F3', // 浅色主题下的背景颜色
                                                },
                                            },
                                            dark: {
                                                before: {
                                                    color: 'rgb(142,145,152)', // 深色主题下的字体颜色
                                                    backgroundColor: 'rgba(36,41,57,0.7)', // 深色主题下的背景颜色
                                                },
                                            },
                                        },
                                    }
                                    decorations.push(decoration)
                                }
                            }
                        })

                        blameDecorationType = vscode.window.createTextEditorDecorationType({})
                        editor.setDecorations(blameDecorationType, decorations)

                        // 添加点击事件
                        selectionChangeListener = vscode.window.onDidChangeTextEditorSelection(
                            (e: vscode.TextEditorSelectionChangeEvent) => {
                                // 获取当前选择的文本范围
                                let selection = e.selections[0]
                                // 获取点击位置的字符
                                let position = selection.active

                                const selectedLine = selection.start.line
                                const selectedDecoration = decorations.find(
                                    decoration => decoration.range.start.line === selectedLine
                                )

                                // position.character === 0是为了实现：只能在commit 信息区域时才能跳转~~
                                if (selectedDecoration && position.character === 0) {
                                    const commitHash = selectedDecoration.renderOptions?.before?.contentText
                                        ?.trim()
                                        .split(' ')[0]
                                    console.log(`Selected commit hash: ${commitHash}`) // 添加日志
                                    console.log(`Selected commit repoPath: ${workspaceFolder.uri.path}`) // 添加日志
                                    if (commitHash) {
                                        // 检查 GitLens 是否能够匹配 commit graph 信息
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

                        // 监听文件切换，自动清理装饰器和事件
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

    // 注册 Clear Annotate 命令
    let clearDisposable = vscode.commands.registerCommand('extension.clearAnnotations', () => {
        if (!isBlameActive) {
            vscode.window.showWarningMessage('No annotations to clear.')
            return
        }

        isBlameActive = false
        vscode.commands.executeCommand('setContext', 'blameActive', false)

        const editor = vscode.window.activeTextEditor
        if (editor) {
            // 创建一个空的 TextEditorDecorationType 来清除所有装饰
            const emptyDecorationType = vscode.window.createTextEditorDecorationType({})
            editor.setDecorations(emptyDecorationType, []) // 清除所有装饰
        }

        // 清理状态
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

export function deactivate() {}
