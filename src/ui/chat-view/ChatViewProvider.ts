import * as vscode from "vscode";

import { BaseWebviewProvider } from "../webview-base/BaseWebviewProvider.js";
import { SessionParticipant } from "../../../shared/models/SessionParticipant.js";
import { inject } from "tsyringe";
import { ISessionService } from "../../interfaces/ISessionService.js";
import { WebviewMessageType } from "../../../shared/enums/WebviewMessageType.js";
import { WebviewMessageBase } from "../../../shared/models/webview-messages/WebviewMessageBase.js";
import { SendChatEvent } from "../../../shared/models/webview-messages/SendChatEvent.js";

export class ChatViewProvider extends BaseWebviewProvider {
    viewType = "devcollab.chat";
    protected viewParam = "chat";

    constructor(
        @inject("ISessionService") private sessionService: ISessionService,
        extensionUri: vscode.Uri
    ) {
        super(extensionUri);

        sessionService.onBeginSession(this.handleBeginSession);
    }

    handleBeginSession = () => {
        const session = this.sessionService.session!;
        const user = session.participants.find(
            (p) => p.clientId === session.awareness.clientID
        )!;

        this.postMessage({
            type: WebviewMessageType.BEGIN_SESSION,
            user: user,
        });
    };

    protected override onDidReceiveMessage(data: WebviewMessageBase): void {
        switch (data.type) {
            case WebviewMessageType.CHAT_MESSAGE:
                this.handleSendChatMessage(data as SendChatEvent);
                break;
        }
    }

    private handleSendChatMessage(data: SendChatEvent): void {
        console.log("test");
    }
}
