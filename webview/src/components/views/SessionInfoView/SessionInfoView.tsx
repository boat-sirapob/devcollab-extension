import { useEffect, useMemo, useState } from "react";

import ParticipantItem from "../../common/ParticipantItem/ParticipantItem.js";
import Section from "../../common/Section/Section.js";
import type { SessionInfoPayload } from "../../../../../shared/models/webview-messages/SessionInfoUpdateEvent.js";
import styles from "./SessionInfoView.module.scss";
import { useSessionInfoService } from "../../../services/SessionInfoService.js";

function SessionInfoView() {
    const sessionInfoService = useSessionInfoService();
    const [sessionInfo, setSessionInfo] = useState<SessionInfoPayload | null>(
        null
    );
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setSessionInfo(sessionInfoService.getSessionInfo());
        setLoading(false);

        const disposable = sessionInfoService.onSessionInfoDidChange((updatedInfo) => {
            setSessionInfo(updatedInfo);
        });

        return () => {
            disposable.dispose();
        };
    }, [sessionInfoService]);

    const sortedParticipants = useMemo(() => {
        if (!sessionInfo) return [];
        return [...sessionInfo.participants].sort((a, b) => {
            if (a.isSelf !== b.isSelf) {
                return a.isSelf ? -1 : 1;
            }
            if (a.type !== b.type) {
                return a.type === "Host" ? -1 : 1;
            }
            return a.displayName.localeCompare(b.displayName);
        });
    }, [sessionInfo]);

    const handleEndSession = async () => {
        await sessionInfoService.endSession();
    };

    const handleCopyRoomCode = async () => {
        await sessionInfoService.copyRoomCode();
    };

    const handleToggleFollow = async (clientId: number) => {
        await sessionInfoService.toggleFollow(clientId);
    };

    const endLabel = sessionInfo?.isHost ? "End Session" : "Leave Session";

    return (
        <div className={styles.container}>
            {
                loading ? <div>Loading session info...</div> : (
                    <>
                        <div className={styles.infoList}>
                            <Section title="Room Code">
                                <div className={styles.roomCodeContainer}>
                                    <span className={styles.roomCode}>{sessionInfo?.roomCode}</span>
                                    <button onClick={handleCopyRoomCode}>
                                        Copy
                                    </button>
                                </div>
                            </Section>
                            <Section title="Participants">
                                <div className={styles.participantsList}>
                                    {sortedParticipants.map((participant) => (
                                        <ParticipantItem
                                            key={participant.displayName}
                                            participant={participant}
                                            onToggleFollow={handleToggleFollow}
                                        />
                                    ))}
                                </div>
                            </Section>
                        </div>

                        <button onClick={handleEndSession}>
                            {endLabel}
                        </button>
                    </>
                )
            }
        </div>
    );
}

export default SessionInfoView;
