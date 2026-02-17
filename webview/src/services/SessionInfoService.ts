import { container, inject, injectable } from "tsyringe";

import type { ISessionInfoService } from "../interfaces/ISessionInfoService.js";
import { EventEmitter, type Event } from "../utilities/EventEmitter.js";
import { WebviewMessageType } from "../../../shared/enums/WebviewMessageType.js";
import type { SessionInfoPayload } from "../../../shared/models/webview-messages/SessionInfoUpdateEvent.js";
import type { WebviewMessageBase } from "../../../shared/models/webview-messages/WebviewMessageBase.js";
import { vscode } from "../utilities/vscode.js";
import { EndSessionMessage } from "../../../shared/models/webview-messages/EndSessionMessage.js";
import { CopyRoomCodeMessage } from "../../../shared/models/webview-messages/CopyRoomCodeMessage.js";
import { ToggleFollowMessage } from "../../../shared/models/webview-messages/ToggleFollowMessage.js";

@injectable()
export class SessionInfoService implements ISessionInfoService {
    private _onSessionInfoDidChange = new EventEmitter<SessionInfoPayload>();
    readonly onSessionInfoDidChange: Event<SessionInfoPayload> = this._onSessionInfoDidChange.event;

    sessionInfo: SessionInfoPayload | null = null;

    constructor(
    ) {
        window.addEventListener("message", this.handleMessageReceived);
    }

    getSessionInfo(): SessionInfoPayload | null {
        return this.sessionInfo;
    }

    async endSession(): Promise<void> {
        let msg: EndSessionMessage = { type: WebviewMessageType.END_SESSION };
        vscode.postMessage(msg);
    }

    async copyRoomCode(): Promise<void> {
        let msg: CopyRoomCodeMessage = { type: WebviewMessageType.COPY_ROOM_CODE };
        vscode.postMessage(msg);
    }

    async toggleFollow(clientId: number): Promise<void> {
        let msg: ToggleFollowMessage = {
            type: WebviewMessageType.TOGGLE_FOLLOW,
            clientId,
        };
        vscode.postMessage(msg);
    }

    private handleMessageReceived = (event: MessageEvent) => {
        const data = event.data as WebviewMessageBase;
        if (data.type === WebviewMessageType.SESSION_INFO_UPDATE) {
            const message = data as WebviewMessageBase & {
                sessionInfo?: SessionInfoPayload;
            };
            if (message.sessionInfo) {
                this.sessionInfo = message.sessionInfo;
                this._onSessionInfoDidChange.fire(message.sessionInfo);
            }
        }
    };
}

export function useSessionInfoService(): ISessionInfoService {
    return container.resolve<ISessionInfoService>("ISessionInfoService");
}
