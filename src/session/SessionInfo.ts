import { ParticipantType } from "../enums/ParticipantType.js";

export interface SessionInfo {
    readonly username: string;
    readonly participantType: ParticipantType;
}