import * as vscode from "vscode";
import { inject, injectable } from "tsyringe";
import { BaseWebviewProvider } from "../webview-base/BaseWebviewProvider.js";
import { ChatViewModel } from "./ChatViewModel.js";
import { ISessionService } from "../../interfaces/ISessionService.js";
import { WebviewMessageBase } from "../../../shared/models/webview-messages/WebviewMessageBase.js";
import { WebviewMessageType } from "../../../shared/enums/WebviewMessageType.js";
import { SendChatEvent } from "../../../shared/models/webview-messages/SendChatEvent.js";

@injectable()
export class ChatViewProvider extends BaseWebviewProvider {
    viewType = "devcollab.chat";
    protected viewParam = "chat";

    private viewModel?: ChatViewModel;

    constructor(
        @inject("ISessionService") private sessionService: ISessionService,
        @inject("ExtensionContext") extensionContext: vscode.ExtensionContext,
    ) {
        super(extensionContext.extensionUri);

        this.sessionService.onBeginSession(this.bindSession);
        this.sessionService.onEndSession(this.unbindSession);
    }

    bindSession = () => {
        this.viewModel = this.sessionService.get(ChatViewModel);
        this.viewModel.bind(msg => this.postMessage(msg));
    }

    unbindSession = () => {
        this.viewModel?.unbind();
        this.viewModel = undefined;
    }

    protected override onDidReceiveMessage(data: WebviewMessageBase): void {
        if (!this.viewModel) return;

        switch (data.type) {
            case WebviewMessageType.CHAT_MESSAGE:
                this.viewModel.sendChatMessage(
                    (data as SendChatEvent).message
                );
                break;
        }
    }
}
