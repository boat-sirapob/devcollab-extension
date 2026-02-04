import { Awareness } from "y-protocols/awareness.js";
import { ParticipantType } from "../enums/ParticipantType.js";
import { SessionParticipant } from "../../shared/models/SessionParticipant.js";

export interface IAwarenessService {
    participants: SessionParticipant[];
    awareness: Awareness;

    setupAwareness(onUpdate: () => void, onHostDisconnect?: () => void): void;
    initializeUser(username: string, userType: ParticipantType): void;
    addParticipant(participant: SessionParticipant): void;
    dispose(): void;
}
