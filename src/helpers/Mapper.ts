import { SessionParticipant } from "../models/SessionParticipant.js";
import { SessionParticipantDto } from "../dto/SessionParticipantDto.js";

export class Mapper {
    static toSessionParticipantDto(val: SessionParticipant): SessionParticipantDto {
        return {
            displayName: val.displayName,
            color: val.color,
            type: val.type,
        }
    }
    static fromSessionParticipantDto(val: SessionParticipantDto, clientId: number): SessionParticipant {
        return {
            clientId: clientId,
            displayName: val.displayName,
            color: val.color,
            type: val.type,
        }
    }
} 

