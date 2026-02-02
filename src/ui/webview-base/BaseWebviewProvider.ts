import * as vscode from "vscode";

import { getNonce } from "../../helpers/Utilities.js";

export abstract class BaseWebviewProvider
    implements vscode.WebviewViewProvider
{
    protected _view?: vscode.WebviewView;

    abstract viewType: string;
    protected abstract viewParam: string;

    constructor(protected readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((data) => {
            this.onDidReceiveMessage(data);
        });
    }

    protected onDidReceiveMessage(_data: any): void {
        // override in subclasses to handle messages
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const getAssetUri = (filePath: string): vscode.Uri => {
            return webview.asWebviewUri(
                vscode.Uri.joinPath(
                    this._extensionUri,
                    "webview",
                    "build",
                    "assets",
                    filePath
                )
            );
        };

        const webviewStyles = getAssetUri("index.css");
        const webviewScript = getAssetUri("index.js");

        const nonce = getNonce();

        return /*html*/ `<!DOCTYPE html>
        	<html lang="en">
        	<head>
        		<meta charset="UTF-8">
        		<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
        		<meta name="viewport" content="width=device-width, initial-scale=1.0">

        		<link href="${webviewStyles}" rel="stylesheet">

        		<title>DevCollab</title>
        	</head>
        	<body>
                <div id="root" data-view="${this.viewParam}"></div>
                <script type="module" nonce="${nonce}" src="${webviewScript}"></script>
            </body>
        	</html>`;
    }
}
