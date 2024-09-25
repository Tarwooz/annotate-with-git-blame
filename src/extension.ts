import * as vscode from 'vscode';
import { exec } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('extension.annotateWithGitBlame', () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const filePath = editor.document.fileName;
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
			if (workspaceFolder) {
				const workspacePath = workspaceFolder.uri.fsPath;

				// 检查文件是否在 Git 管理的项目中
				exec(`git rev-parse --is-inside-work-tree`, { cwd: workspacePath }, (error, stdout, stderr) => {
					if (error || stdout.trim() !== 'true') {
						vscode.window.showErrorMessage('This file is not part of a Git repository.');
						return;
					}

					exec(`git blame ${filePath}`, { cwd: workspacePath }, (error, stdout, stderr) => {
						if (error) {
							vscode.window.showErrorMessage(`Error: ${stderr}`);
							return;
						}

						const blameInfo = stdout.split('\n');
						const decorations: vscode.DecorationOptions[] = [];
						let maxLength = 0;

						// 计算最长的 blame 信息长度
						blameInfo.forEach((line) => {
							let match = line.match(/^(\^?\w+)\s\((.*?)\s+(\d{4}-\d{2}-\d{2})\s.*?\s(\d+)\)\s/);

							// 检测 Vue 文件中的 `blameInfo` 格式
							if (!match) {
								match = line.match(/^(\^?\w+)\s.*?\((.*?)\s+(\d{4}-\d{2}-\d{2})\s.*?\s(\d+)\)\s/);
							}

							if (match) {
								const commitHash = match[1];
								const author = match[2];
								const date = match[3].replace(/-/g, '/'); // 将日期格式转换为年/月/日
								const blameText = `${commitHash} ${date} ${author}`;
								if (commitHash !== '000000000' && blameText.length > maxLength) {
									maxLength = blameText.length;
								}
							}
						});

						blameInfo.forEach((line, index) => {
							let match = line.match(/^(\^?\w+)\s\((.*?)\s+(\d{4}-\d{2}-\d{2})\s.*?\s(\d+)\)\s/);

							// 检测 Vue 文件中的 `blameInfo` 格式
							if (!match) {
								match = line.match(/^(\^?\w+)\s.*?\((.*?)\s+(\d{4}-\d{2}-\d{2})\s.*?\s(\d+)\)\s/);
							}

							if (match) {
								const commitHash = match[1];
								const author = match[2];
								const date = match[3].replace(/-/g, '/'); // 将日期格式转换为年/月/日
								const lineNumber = parseInt(match[4], 10) - 1;
								let blameText = `${commitHash} ${date} ${author}`;

								// 补齐长度
								while (blameText.length < maxLength) {
									blameText += ' ';
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
												borderRadius: '3px', // 添加圆角
												padding: '0 5px', // 添加内边距
												width: `${maxLength + 1}ch`, // 设置固定宽度
												display: 'inline-block', // 确保为块级元素
												cursor: 'pointer' // 添加鼠标指针样式
											},
											light: {
												before: {
													color: '#000000', // 浅色主题下的字体颜色
													backgroundColor: '#F3F3F3' // 浅色主题下的背景颜色
												}
											},
											dark: {
												before: {
													color: 'rgb(142,145,152)', // 深色主题下的字体颜色
													backgroundColor: 'rgba(36,41,57,0.7)' // 深色主题下的背景颜色
												}
											}
										}
									};
									decorations.push(decoration);
								}
							}
						});

						const blameDecorationType = vscode.window.createTextEditorDecorationType({});
						editor.setDecorations(blameDecorationType, decorations);

						// 添加点击事件
						const selectionChangeListener = vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) => {
							const selectedLine = e.selections[0].start.line;
							const selectedDecoration = decorations.find(decoration => decoration.range.start.line === selectedLine);
							if (selectedDecoration) {
								const commitHash = selectedDecoration.renderOptions?.before?.contentText?.trim().split(' ')[0];
								console.log(`Selected commit hash: ${commitHash}`); // 添加日志
								if (commitHash) {
									// 检查 GitLens 是否能够匹配 commit graph 信息
									vscode.commands.executeCommand('gitlens.showInCommitGraphView', { 
										ref: '68dccb7b79efa682ecea4568024df7b491e7e4d2', 
										id: commitHash, 
										preserveFocus: true,
										attachedTo: 'graph'
									})
									    .then(() => {
											console.log(`Successfully executed command for commit hash: ${commitHash}`);
										}, (err) => {
											console.error(`Failed to execute command for commit hash: ${commitHash}`, err);
											vscode.window.showErrorMessage(`Failed to execute command for commit hash: ${commitHash}`);
										});
								}
							}
						});

						// 监听文件切换事件，移除监听器
						const activeEditorChangeListener = vscode.window.onDidChangeActiveTextEditor(() => {
							selectionChangeListener.dispose();
						});

						context.subscriptions.push(selectionChangeListener);
						context.subscriptions.push(activeEditorChangeListener);
					});
				});
			} else {
				vscode.window.showErrorMessage('This file is not part of any workspace.');
			}
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }