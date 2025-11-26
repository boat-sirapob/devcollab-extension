import * as vscode from "vscode";

import { MainLogic } from "./logic.js";
import { WebviewMessage } from "./models/WebviewMessage.js";
import { WebviewMessageType } from "./enums/WebviewMessageType.js";
import { getNonce } from "./helpers/utilities.js";

export class MainSidebarProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = "devcollab";

	private _view?: vscode.WebviewView;

    private _logic: MainLogic

  constructor(
    private readonly _extensionUri: vscode.Uri,
    logic: MainLogic
  ) { 
    this._logic = logic;
  }

  resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {

      this._view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};
    
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(this.handleSidebarMessage.bind(this));
  }

  handleSidebarMessage(data: WebviewMessage) {
    switch (data.type) {
      case WebviewMessageType.HOST_SESSION: {
        this._logic.openConnection();

        break;
      }
      case WebviewMessageType.JOIN_SESSION: {
        this._logic.openConnection();

        break;
      }
      case WebviewMessageType.END_SESSION: {
        this._logic.endCollaboration();

        break;
      }
      case WebviewMessageType.DISCONNECT_SESSION: {
        this._logic.endCollaboration();

        break;
      }
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src/webview-ui', 'main.js'));

		// Do the same for the stylesheet.
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src/webview-ui', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src/webview-ui', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src/webview-ui', 'main.css'));

		// Use a nonce to only allow a specific script to be run.
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">

				<title>DevCollab</title>
			</head>
			<body>

        <div class="button-container">
  				<button class="host-session-button">Host Session</button>
  				<button class="join-session-button">Join Session</button>
  				<button class="end-session-button">End Session</button>
  				<button class="disconnect-session-button">Disconnect</button>
        </div>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}