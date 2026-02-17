import * as vscode from "vscode";
import { inject, injectable } from "tsyringe";
import { BaseWebviewProvider } from "../webview-base/BaseWebviewProvider.js";
import { ISessionService } from "../../interfaces/ISessionService.js";
import { WebviewMessageBase } from "../../../shared/models/webview-messages/WebviewMessageBase.js";
import { SessionInfoWebviewModel } from "./SessionInfoWebviewModel.js";
import { WebviewMessageType } from "../../../shared/enums/WebviewMessageType.js";
import { ToggleFollowMessage } from "../../../shared/models/webview-messages/ToggleFollowMessage.js";
import { IAwarenessService } from "../../interfaces/IAwarenessService.js";
import { IFollowService } from "../../interfaces/IFollowService.js";

@injectable()
export class SessionInfoWebviewProvider extends BaseWebviewProvider {
    viewType = "devcollab.main";
    protected viewParam = "session-info";

    private viewModel?: SessionInfoWebviewModel;

    constructor(
        @inject("ISessionService") private sessionService: ISessionService,
        @inject("ExtensionContext") extensionContext: vscode.ExtensionContext,
    ) {
        super(extensionContext.extensionUri);

        this.sessionService.onBeginSession(this.bindSession);
        this.sessionService.onEndSession(this.unbindSession);
    }

    bindSession = () => {
        this.viewModel = this.sessionService.get<SessionInfoWebviewModel>(
            "SessionInfoWebviewModel"
        );
        this.viewModel.bind(msg => this.postMessage(msg));
    }

    unbindSession = () => {
        this.viewModel?.unbind();
        this.viewModel = undefined;
    }

    protected override async onDidReceiveMessage(data: WebviewMessageBase): Promise<void> {
        if (!this.viewModel) return;

        switch (data.type) {
            case WebviewMessageType.END_SESSION:
                await this.sessionService.endSession();
                break;
            case WebviewMessageType.COPY_ROOM_CODE:
                await this.sessionService.copyRoomCode();
                break;
            case WebviewMessageType.TOGGLE_FOLLOW: {
                const message = data as ToggleFollowMessage;
                const awarenessService = this.sessionService.get<IAwarenessService>(
                    "IAwarenessService"
                );
                const participant = awarenessService.participants.find(
                    (p) => p.clientId === message.clientId
                );

                if (!participant) {
                    vscode.window.showErrorMessage("Participant not found.");
                    break;
                }

                const followService = this.sessionService.get<IFollowService>(
                    "IFollowService"
                );
                followService.toggleFollow(participant);
                this.viewModel.postUpdate();
                break;
            }
            default:
                return undefined;
        }
    }
}
