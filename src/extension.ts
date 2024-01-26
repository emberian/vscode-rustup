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
				if (selected) {
					child_process.spawn('rustup', ['override', 'set', selected]).on('exit', () => updateStatus());
				}
			});
		});
	}));
	subscriptions.push(vscode.commands.registerCommand('rustup.checkUpdates', () => {
		runCommandForAllOutput('rustup', ['check']).then((data) => {
			let lines = data.split('\n');
			vscode.window.showQuickPick(lines, { "canPickMany": true, "title": "Update selected toolchains?" }).then((selected) => {
				if (selected) {
					selected.forEach((item) => {
						let toolchain_name = item.split(' - ')[0];
						child_process.spawn('rustup', ['update', toolchain_name]);
					});
				}
			});
		});
	}));
	subscriptions.push(statusBarItem);
	statusBarItem.command = "rustup.listToolchains";
}

// This method is called when your extension is deactivated
export function deactivate() { }
