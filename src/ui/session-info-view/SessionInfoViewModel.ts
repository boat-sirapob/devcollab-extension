import { inject, injectable } from "tsyringe";
import { Session } from "../../session/Session.js";
import { IAwarenessService } from "../../interfaces/IAwarenessService.js";
import { AwarenessState } from "../../models/AwarenessState.js";

@injectable()
export class SessionInfoViewModel {
    constructor(
        @inject("Session") private session: Session,
        @inject("IAwarenessService") private awarenessService: IAwarenessService,
    ) { }

    getChildrenWithSession() {
        return [
            {
                label: "Session Info",
                children: [
                    {
                        label: "Room Code",
                        description: this.session.roomCode,
                        command: {
                            command: "devcollab.copyRoomCode",
                            title: "Copy room code",
                            arguments: [this.session.roomCode],
                        },
                    },
                ],
            },
            {
                label: "Participants",
                children: this.awarenessService.participants.map((p) => {
                    const allStates = this.awarenessService.awareness.getStates();
                    const participantState = allStates?.get(p.clientId) as
                        | AwarenessState
                        | undefined;
                    const currentFile = participantState?.cursor?.uri;

                    const statusLabel =
                        p.clientId === this.awarenessService.awareness.clientID
                            ? "You" + (p.type === "Host" ? " (Host)" : "")
                            : p.type === "Host"
                                ? "Host"
                                : undefined;

                    const description = currentFile
                        ? statusLabel
                            ? `${statusLabel} - ${currentFile}`
                            : currentFile
                        : statusLabel;

                    return {
                        label: p.displayName,
                        description: description,
                        command: {
                            command: "devcollab.toggleFollow",
                            title: `Follow ${p.displayName}`,
                            arguments: [p],
                        },
                    };
                }),
            },
        ];
    }
}