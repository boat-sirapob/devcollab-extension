import { ParticipantType } from "../enums/ParticipantType.js";

export interface SessionParticipantDto {
    displayName: string;
    color: string;
    type: ParticipantType;
}
