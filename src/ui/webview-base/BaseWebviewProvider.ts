import * as vscode from "vscode";

import type { RequestMessage } from "../../../shared/models/webview-messages/RequestMessage.js";
import type { ResponseMessage } from "../../../shared/models/webview-messages/ResponseMessage.js";
import { WebviewMessageBase } from "../../../shared/models/webview-messages/WebviewMessageBase.js";
import { WebviewMessageType } from "../../../shared/enums/WebviewMessageType.js";
import { getNonce } from "../../helpers/Utilities.js";

export abstract class BaseWebviewProvider
    implements vscode.WebviewViewProvider {
    protected _view?: vscode.WebviewView;
    private pendingMessages: any[] = [];

    abstract viewType: string;
    protected abstract viewParam: string;

    constructor(protected readonly _extensionUri: vscode.Uri) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.onDidDispose(() => {
            this._view = undefined;
        });

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((data) => {
            if (data.type === WebviewMessageType.REQUEST) {
                this.handleRequest(data as RequestMessage);
            } else {
                this.onDidReceiveMessage(data);
            }
        });

        if (this.pendingMessages.length > 0) {
            for (const message of this.pendingMessages) {
                webviewView.webview.postMessage(message);
            }
            this.pendingMessages.length = 0;
        }
    }

    private async handleRequest(message: RequestMessage): Promise<void> {
        try {
            let result: any;

            if (message.method === "GET") {
                result = await this.handleGet(message.endpoint);
            } else if (message.method === "POST") {
                result = await this.handlePost(message.endpoint, message.data);
            }

            this.sendResponse(message.id, result);
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
            this.sendResponse(message.id, undefined, errorMessage);
        }
    }

    protected sendResponse(id: number, result?: any, error?: string): void {
        const response: ResponseMessage = {
            type: WebviewMessageType.RESPONSE,
            id,
            result,
            error,
        };
        this.postMessage(response);
    }

    protected postMessage(message: any): void {
        if (this._view) {
            this._view.webview.postMessage(message);
        } else {
            this.pendingMessages.push(message);
        }
    }

    protected async handleGet(_endpoint: string): Promise<any> {
        throw new Error("GET handler not implemented");
    }

    protected async handlePost(_endpoint: string, _data: any): Promise<any> {
        throw new Error("POST handler not implemented");
    }

    protected onDidReceiveMessage(_data: WebviewMessageBase): void {
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
