import * as vscode from 'vscode';
import * as child_process from 'node:child_process';

let statusBarItem: vscode.StatusBarItem;
let dbgLog: vscode.OutputChannel;

function findRustup(): string {
	return vscode.workspace.getConfiguration('rustup').get('path') || 'rustup';
}

function dbgStdio(argv: string[]): child_process.ChildProcess {
	let proc = child_process.spawn(findRustup(), argv);
	proc.stdout?.on('data', (chunk) => {
		dbgLog.append(chunk.toString());
	});
	proc.stderr?.on('data', (chunk) => {
		dbgLog.append(chunk.toString());
	});
	return proc;
}

function collectStdout(args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		let child = child_process.spawn(findRustup(), args);
		let stdout: any[] = [];
		let stderr: any[] = [];
		child.stdout?.on('data', (data) => stdout.push(data));
		child.stderr?.on('data', (data) => stderr.push(data));
		child.on('close', (code) => {
			dbgLog.append(Buffer.concat(stderr).toString());
			if (code === 0) {
				resolve(Buffer.concat(stdout).toString());
			} else {
				reject(code);
			}
		});
	});
}

function runToolchainUpdate(which: string): Promise<void> {
	return new Promise((resolve, reject) => {
		dbgLog.appendLine(`$ rustup update ${which}`);

		const process = dbgStdio(['update', which]);
		process.on('close', (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(code);
			}
		});
	});
}

async function updateStatus() {
	let data = await collectStdout(['show', 'active-toolchain']);
	let cur_toolchain = data.split(' ')[0];
	statusBarItem.text = `rustup: ${cur_toolchain}`;
	statusBarItem.show();
}

async function checkUpdates() {
	let checkOutput = await collectStdout(['check']);
	let lines = checkOutput.split('\n').filter((line) => line.includes('Update available') && line.split(' - ')[0] !== "rustup");
	if (lines.length !== 0) {
		const selected = await vscode.window.showQuickPick(lines, { "canPickMany": true, "title": "Update selected toolchains?" });
		if (selected && selected.length !== 0) {
			dbgLog.show();
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
	} else {
		vscode.window.showInformationMessage('rustup and toolchains up to date');
	}
}

async function listToolchains() {
	let availableToolchains = (await collectStdout(['toolchain', 'list'])).split('\n');
	let selected = await vscode.window.showQuickPick(availableToolchains, { "title": "Change active toolchain?" });
	if (selected && vscode.window.activeTextEditor !== undefined) {
		let currentWorkspacePath = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri)?.uri.fsPath;
		if (currentWorkspacePath === undefined) {
			vscode.window.showErrorMessage("cannot determine workspace of active editor");
		} else {
			dbgStdio(['override', 'set', '--path', currentWorkspacePath, selected]).on('exit', () => updateStatus());
		}
	} else if (selected) {
		vscode.window.showErrorMessage('No workspace folders found to set rustup override');
	}
}

async function updateChecker() {
	dbgLog.clear();
	let hours_to_wait = vscode.workspace.getConfiguration('rustup').get('updateInterval', 24);
	if (hours_to_wait == 0) {
		return;
	}
	setTimeout(updateChecker, 1000 * 60 * 60 * hours_to_wait);

	let data = await collectStdout(['check']);
	if (data.includes('Update available')) {
		vscode.window.showInformationMessage('rustup toolchain updates are available', 'Install All', 'Choose').then((selected) => {
			if (selected) {
				if (selected === 'Install All') {
					vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Updating toolchains...' }, async (progress, cancel) => {
						dbgStdio(['update']).on('exit', () => {
							progress.report({ increment: 100 });
							vscode.window.showInformationMessage('Rustup toolchain updates complete!');
						})
					});
				} else if (selected === 'Choose') {
					vscode.commands.executeCommand('rustup.checkUpdates');
				}
			}
		});
	}
};

export function activate({ subscriptions }: vscode.ExtensionContext) {
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	dbgLog = vscode.window.createOutputChannel('rustup');

	updateStatus();
	updateChecker();

	subscriptions.push(vscode.commands.registerCommand('rustup.listToolchains', listToolchains));
	subscriptions.push(vscode.commands.registerCommand('rustup.checkUpdates', checkUpdates));
	subscriptions.push(statusBarItem, dbgLog);
	statusBarItem.command = "rustup.listToolchains";
}

export function deactivate() { }