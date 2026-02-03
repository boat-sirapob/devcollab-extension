import { ParticipantType } from "../../src/enums/ParticipantType.js";

export interface SessionParticipant {
    clientId: number;
    displayName: string;
    color: string;
    type: ParticipantType;
}
