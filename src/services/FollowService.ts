import { injectable, inject } from "tsyringe";
import { IFollowService } from "../interfaces/IFollowService.js";
import { SessionParticipant } from "../models/SessionParticipant.js";
import { ISessionService } from "../interfaces/ISessionService.js";
import { AwarenessState } from "../models/AwarenessState.js";
import * as vscode from "vscode";

@injectable()
export class FollowService implements IFollowService {
    followingParticipant: SessionParticipant | null = null;
    private editListener: vscode.Disposable | null = null;

    constructor(
        @inject("ISessionService") private sessionService: ISessionService
    ) {}

    get session() {
        return this.sessionService.getSession();
    }

    toggleFollow(participant: SessionParticipant): void {
        let currentSession = this.session;
        if (!currentSession) {
            return;
        }

        let awareness = currentSession.awareness;

        if (participant.clientId === awareness.clientID) {
            vscode.window.showErrorMessage("You cannot follow yourself.");
            return;
        }

        if (this.followingParticipant) {
            this.followingParticipant = null;
            awareness.off("change", this.followHandler);
            if (this.editListener) {
                this.editListener.dispose();
                this.editListener = null;
            }
            vscode.window.showInformationMessage(
                `Stopped following ${participant.displayName}`
            );
        } else {
            this.followingParticipant = participant;
            awareness.on("change", this.followHandler);
            this.editListener = vscode.workspace.onDidChangeTextDocument(
                (e) => {
                    if (
                        this.followingParticipant &&
                        e.contentChanges.length > 0
                    ) {
                        const documentBindings =
                            currentSession!.bindings.values();
                        let isRemoteChange = false;
                        for (const binding of documentBindings) {
                            if (binding.applyingRemote) {
                                isRemoteChange = true;
                                break;
                            }
                        }

                        if (!isRemoteChange) {
                            this.toggleFollow(this.followingParticipant!);
                        }
                    }
                }
            );
            vscode.window.showInformationMessage(
                `Now following ${participant.displayName}`
            );
        }
    }

    followHandler = ({
        added,
        updated,
        removed,
    }: {
        added: Array<number>;
        updated: Array<number>;
        removed: Array<number>;
    }) => {
        const session = this.session;
        if (!session) {
            return;
        }

        const allStates = session.awareness.getStates();

        for (const [clientId, s] of allStates.entries()) {
            if (clientId !== this.followingParticipant!.clientId) {
                continue;
            }

            const state = s as AwarenessState;

            console.log(state);

            const cursor = state.cursor;

            var document = session.getDocumentFromRelPath(cursor.uri);

            if (!document) {
                return;
            }

            vscode.window.showTextDocument(document).then((editor) => {
                editor.revealRange(
                    new vscode.Range(
                        cursor.selections[0].anchor.line,
                        cursor.selections[0].anchor.character,
                        cursor.selections[0].head.line,
                        cursor.selections[0].head.character
                    ),
                    vscode.TextEditorRevealType.InCenter
                );
            });
        }
    };
}
