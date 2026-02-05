import * as vscode from "vscode";
import { injectable, inject } from "tsyringe";
import { Awareness } from "y-protocols/awareness.js";
import { IAwarenessService } from "../interfaces/IAwarenessService.js";
import { SessionParticipant } from "../../shared/models/SessionParticipant.js";
import { SessionParticipantDto } from "../dto/SessionParticipantDto.js";
import { ParticipantType } from "../enums/ParticipantType.js";
import { Mapper } from "../../shared/helpers/Mapper.js";
import { Session } from "../session/Session.js";
import { AwarenessState } from "../models/AwarenessState.js";
import { SessionInfo } from "../session/SessionInfo.js";

const usercolors = [
    "#30bced",
    "#6eeb83",
    "#ffbc42",
    "#ecd444",
    "#ee6352",
    "#9ac2c9",
    "#8acb88",
    "#1be7ff",
];

@injectable()
export class AwarenessService implements IAwarenessService {
    participants: SessionParticipant[] = [];
    awareness: Awareness;
    private _currentUser: SessionParticipant;

    private _onParticipantsDidChange = new vscode.EventEmitter<void>();
    readonly onParticipantsDidChange = this._onParticipantsDidChange.event;

    private _onParticipantDisconnect = new vscode.EventEmitter<void>();
    readonly onParticipantDisconnect = this._onParticipantDisconnect.event;

    constructor(
        @inject("SessionInfo") private sessionInfo: SessionInfo,
        @inject("Session") private session: Session
    ) {
        this.awareness = session.awareness;

        this._currentUser = this.createCurrentUser(
            this.sessionInfo.username,
            this.sessionInfo.participantType
        );

        this.upsertParticipant(this._currentUser);
        this.publishCurrentUser();

        this.setupAwareness();
    }

    get currentUser(): SessionParticipant {
        return this._currentUser;
    }

    private upsertParticipant(participant: SessionParticipant): void {
        const index = this.participants.findIndex(
            (p) => p.clientId === participant.clientId
        );
        if (index === -1) {
            this.participants.push(participant);
        } else {
            this.participants[index] = participant;
        }
    }

    setupAwareness(): void {
        const syncParticipantsFromStates = () => {
            const allStates = this.awareness.getStates();
            for (const [id, state] of allStates) {
                const user: SessionParticipantDto | undefined = (state as AwarenessState).user;
                if (!user) {
                    continue;
                }

                const sessionUser = Mapper.fromSessionParticipantDto(user, id);
                this.upsertParticipant(sessionUser);
            }
        };

        syncParticipantsFromStates();
        this._onParticipantsDidChange.fire();

        this.awareness.on(
            "change",
            ({
                added,
                updated,
                removed,
            }: {
                added: Array<number>;
                updated: Array<number>;
                removed: Array<number>;
            }) => {
                const allStates = this.awareness.getStates();

                added.forEach((id) => {
                    const state = allStates.get(id);
                    const user: SessionParticipantDto = state?.user;
                    if (!user) {
                        return;
                    }

                    vscode.window.showInformationMessage(
                        `User joined: ${user?.displayName ?? id}`
                    );

                    let sessionUser = Mapper.fromSessionParticipantDto(
                        user,
                        id
                    );
                    this.upsertParticipant(sessionUser);
                });

                updated.forEach((id) => {
                    const state = allStates.get(id);
                    const user: SessionParticipantDto = state?.user;
                    if (!user) {
                        return;
                    }

                    const sessionUser = Mapper.fromSessionParticipantDto(
                        user,
                        id
                    );
                    this.upsertParticipant(sessionUser);
                });

                removed.forEach((id) => {
                    const existingParticipant = this.participants.find(
                        (p) => p.clientId === id
                    );

                    this.participants = this.participants.filter(
                        (p) => p.clientId !== id
                    );

                    vscode.window.showInformationMessage(
                        `User disconnected: ${existingParticipant?.displayName ?? id}`
                    );
                });

                if (updated.length > 0 || added.length > 0 || removed.length > 0) {
                    this._onParticipantsDidChange.fire();
                }

                // todo: make this a message from the server
                // disconnect on session end
                let hostPresent = false;
                for (const [, state] of allStates) {
                    const user = (state as any).user;
                    if (user?.type === "Host") {
                        hostPresent = true;
                        break;
                    }
                }

                if (!hostPresent && this.session.connected) {
                    vscode.window.showInformationMessage(
                        "Host has ended the session. Disconnecting..."
                    );
                    this.session.provider.disconnect();
                    this._onParticipantDisconnect.fire();
                }
            }
        );
    }

    private createCurrentUser(
        username: string,
        userType: ParticipantType
    ): SessionParticipant {
        return {
            clientId: this.awareness.clientID,
            displayName: username,
            color: usercolors[Math.floor(Math.random() * usercolors.length)],
            type: userType
        };
    }

    private publishCurrentUser(): void {
        const awarenessUser = Mapper.toSessionParticipantDto(this._currentUser);
        this.awareness.setLocalStateField("user", awarenessUser);
    }

    addParticipant(participant: SessionParticipant): void {
        this.upsertParticipant(participant);
    }

    dispose(): void {
        // Awareness cleanup handled by provider
    }
}
