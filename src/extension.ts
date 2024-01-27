// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as child_process from 'node:child_process';

let statusBarItem: vscode.StatusBarItem;

function runCommandForAllOutput(command: string, args: string[]): Promise<string> {
	let child = child_process.spawn(command, args);
	let allData: any[] = [];
	return new Promise((resolve, reject) => {
		child.stdout.on('data', (chunk) => {
			allData.push(Buffer.from(chunk));
			console.log(typeof chunk);
		});
		child.on('close', (code) => {
			if (code === 0) {
				resolve(Buffer.concat(allData).toString());
			} else {
				reject();
			}
		});
	});
}

function runToolchainUpdate(which: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const process = child_process.spawn('rustup', ['update', which]);

		process.on('close', (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject();
			}
		});
	});
}

function updateStatus() {
	runCommandForAllOutput('rustup', ['show', 'active-toolchain']).then((data) => {
		let cur_toolchain = data.split(' ')[0];
		statusBarItem.text = `rustup: ${cur_toolchain}`;
		statusBarItem.show();
	});
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate({ subscriptions }: vscode.ExtensionContext) {
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	const checkUpdates = async () => {
		setTimeout(checkUpdates, 1000 * 60 * 60);
		let data = await runCommandForAllOutput('rustup', ['check']);
		if (data.includes('Update available')) {
			vscode.window.showInformationMessage('rustup toolchain updates are available', 'Install All', 'Choose').then((selected) => {
				if (selected) {
					if (selected === 'Install All') {
						child_process.spawn('rustup', ['update']).on('exit', () => vscode.window.showInformationMessage('Rustup toolchain updates complete!'));
					} else if (selected === 'Choose') {
						vscode.commands.executeCommand('rustup.checkUpdates');
					}
				}
			});
		}
	};
	updateStatus();
	checkUpdates();
	subscriptions.push(vscode.commands.registerCommand('rustup.listToolchains', () => {
		runCommandForAllOutput('rustup', ['toolchain', 'list']).then((data) => {
			let lines = data.split('\n');
			vscode.window.showQuickPick(lines, { "title": "Change active toolchain?" }).then((selected) => {
				if (selected && vscode.window.activeTextEditor !== undefined) {
					var currentWorkspacePath = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri)?.uri.fsPath;
					if (currentWorkspacePath === undefined) {
						vscode.window.showErrorMessage("cannot determine workspace of active editor");
					} else {
						child_process.spawn('rustup', ['override', 'set', '--path', currentWorkspacePath, selected]).on('exit', () => updateStatus());
					}
				} else if (selected) {
					vscode.window.showErrorMessage('No workspace folders found to set rustup override');
				}
			});
		});
	}));
	subscriptions.push(vscode.commands.registerCommand('rustup.checkUpdates', () => {
		runCommandForAllOutput('rustup', ['check']).then((data) => {
			let lines = data.split('\n').filter((line) => line.includes('Update available') && line.split(' - ')[0] !== "rustup");
			if (lines.length !== 0) {
				vscode.window.showQuickPick(lines, { "canPickMany": true, "title": "Update selected toolchains?" }).then((selected) => {
					if (selected) {
						vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Updating toolchains...' }, async (progress, cancel) => {
							for (let item of selected) {
								let toolchain_name = item.split(' - ')[0];
								try {
									if (cancel.isCancellationRequested) { return; }
									await runToolchainUpdate(toolchain_name);
								} catch (error) {
									vscode.window.showErrorMessage(`Failed to update ${toolchain_name}`);
									return;
								}
								progress.report({ increment: 100 / selected.length, message: `Updated ${toolchain_name}` });
							}
							vscode.window.showInformationMessage('All toolchains updated successfully! 🥳');
						});
					}
				});
			} else {
				vscode.window.showInformationMessage('No updates available');
			}
		});
	}));
	subscriptions.push(statusBarItem);
	statusBarItem.command = "rustup.listToolchains";
}

// This method is called when your extension is deactivated
export function deactivate() { }
