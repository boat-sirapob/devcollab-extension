import * as vscode from "vscode";

import type { RequestMessage } from "../../../shared/models/RequestMessage.js";
import type { ResponseMessage } from "../../../shared/models/ResponseMessage.js";
import { getNonce } from "../../helpers/Utilities.js";
import { WebviewMessageType } from "../../../shared/enums/WebviewMessageType.js";

export type GetEndpointMap = Record<string, unknown>;
export type PostEndpointMap = Record<
    string,
    { request: unknown; response: unknown }
>;

export abstract class BaseWebviewProvider<
    GETEndpoints extends GetEndpointMap = GetEndpointMap,
    POSTEndpoints extends PostEndpointMap = PostEndpointMap,
>
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
            if (data.type === WebviewMessageType.REQUEST) {
                this.handleRequest(data as RequestMessage);
            } else {
                this.onDidReceiveMessage(data);
            }
        });
    }

    private async handleRequest(message: RequestMessage): Promise<void> {
        try {
            let result: any;

            if (message.method === "GET") {
                result = await this.handleGet(
                    message.endpoint as keyof GETEndpoints
                );
            } else if (message.method === "POST") {
                result = await this.handlePost(
                    message.endpoint as keyof POSTEndpoints,
                    message.data as POSTEndpoints[keyof POSTEndpoints]["request"]
                );
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
        this._view?.webview.postMessage(response);
    }

    protected async handleGet<K extends keyof GETEndpoints>(
        _endpoint: K
    ): Promise<GETEndpoints[K]> {
        throw new Error("GET handler not implemented");
    }

    protected async handlePost<K extends keyof POSTEndpoints>(
        _endpoint: K,
        _data?: POSTEndpoints[K]["request"]
    ): Promise<POSTEndpoints[K]["response"]> {
        throw new Error("POST handler not implemented");
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
