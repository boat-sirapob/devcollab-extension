import { ParticipantType } from "../../../src/enums/ParticipantType.js";
import { WebviewMessageBase } from "./WebviewMessageBase.js";
import { WebviewMessageType } from "../../enums/WebviewMessageType.js";

export interface SessionInfoParticipant {
    clientId: number;
    displayName: string;
    type: ParticipantType;
    isSelf: boolean;
    isFollowing: boolean;
    currentFile?: string;
}

export interface SessionInfoPayload {
    roomCode: string;
    username: string;
    isHost: boolean;
    participants: SessionInfoParticipant[];
}

export interface SessionInfoUpdateEvent extends WebviewMessageBase {
    type: WebviewMessageType.SESSION_INFO_UPDATE;
    sessionInfo: SessionInfoPayload;
}
