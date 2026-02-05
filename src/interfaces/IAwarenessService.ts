import { Awareness } from "y-protocols/awareness.js";
import { ParticipantType } from "../enums/ParticipantType.js";
import { SessionParticipant } from "../../shared/models/SessionParticipant.js";

import * as vscode from "vscode";

export interface IAwarenessService {
    participants: SessionParticipant[];
    awareness: Awareness;

    readonly onParticipantsDidChange: vscode.Event<void>;
    readonly onParticipantDisconnect: vscode.Event<void>;

    get currentUser(): SessionParticipant;

    setupAwareness(onUpdate: () => void, onHostDisconnect?: () => void): void;
    addParticipant(participant: SessionParticipant): void;
    dispose(): void;
}
