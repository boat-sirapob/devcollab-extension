import * as vscode from "vscode";

import { IAwarenessService } from "../../interfaces/IAwarenessService.js";
import { WebviewMessageType } from "../../../shared/enums/WebviewMessageType.js";
import { inject, injectable } from "tsyringe";
import { Session } from "../../session/Session.js";
import { AwarenessState } from "../../models/AwarenessState.js";
import { SessionInfo } from "../../session/SessionInfo.js";
import { IFollowService } from "../../interfaces/IFollowService.js";
import {
    SessionInfoPayload,
    SessionInfoUpdateEvent,
} from "../../../shared/models/webview-messages/SessionInfoUpdateEvent.js";

@injectable()
export class SessionInfoWebviewModel {
    private readonly disposables: vscode.Disposable[] = [];
    private postMessage?: (msg: any) => void;

    constructor(
        @inject("Session") private session: Session,
        @inject("SessionInfo") private sessionInfo: SessionInfo,
        @inject("IAwarenessService") private awarenessService: IAwarenessService,
        @inject("IFollowService") private followService: IFollowService
    ) { }

    bind(postMessage: (msg: any) => void): void {
        this.postMessage = postMessage;
        const postUpdate = () => this.postUpdate();

        this.postUpdate();
        this.awarenessService.onParticipantsDidChange(
            postUpdate,
            null,
            this.disposables
        );
    }

    unbind(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables.length = 0;
        this.postMessage = undefined;
    }

    postUpdate(): void {
        if (!this.postMessage) {
            return;
        }

        const update: SessionInfoUpdateEvent = {
            type: WebviewMessageType.SESSION_INFO_UPDATE,
            sessionInfo: this.getSessionInfoPayload(),
        };
        this.postMessage(update);
    }

    getSessionInfoPayload(): SessionInfoPayload {
        const allStates = this.awarenessService.awareness.getStates();
        const currentClientId = this.awarenessService.awareness.clientID;
        const followingClientId = this.followService.followingParticipant?.clientId ?? null;

        return {
            roomCode: this.session.roomCode,
            username: this.sessionInfo.username,
            isHost: this.sessionInfo.participantType === "Host",
            participants: this.awarenessService.participants.map((p) => {
                const participantState = allStates.get(p.clientId) as
                    | AwarenessState
                    | undefined;
                const currentFile = participantState?.cursor?.uri;

                return {
                    clientId: p.clientId,
                    displayName: p.displayName,
                    type: p.type,
                    isSelf: p.clientId === currentClientId,
                    isFollowing: followingClientId === p.clientId,
                    currentFile: currentFile,
                };
            }),
        };
    }
}
