import * as vscode from "vscode";

import { BaseWebviewProvider } from "../webview-base/BaseWebviewProvider.js";

export class ChatViewProvider extends BaseWebviewProvider {
    viewType = "devcollab.chat";
    protected viewParam = "chat";

    constructor(extensionUri: vscode.Uri) {
        super(extensionUri);
    }

    protected override onDidReceiveMessage(data: any): void {
        // ...
    }
}
