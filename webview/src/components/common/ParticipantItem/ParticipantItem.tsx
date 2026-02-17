import { SessionInfoParticipant } from "../../../../../shared/models/webview-messages/SessionInfoUpdateEvent";
import styles from "./ParticipantItem.module.scss";

function ParticipantItem({
    participant,
    onToggleFollow,
}: {
    participant: SessionInfoParticipant;
    onToggleFollow: (clientId: number) => void;
}) {
    const showFollowControls = !participant.isSelf;

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.nameContainer}>
                    <div className={styles.displayName}>
                        {participant.displayName}
                        {participant.isSelf ? " (You)" : participant.type === "Host" ? " (Host)" : ""}
                    </div>
                    {participant.isFollowing ? (
                        <div className={styles.followStatusIndicator}>Following</div>
                    ) : null}
                </div>
                <div className={styles.editingFileContainer}>
                    {participant.currentFile ? `Editing: ${participant.currentFile}` : "Idle"}
                </div>
            </div>
            {showFollowControls ? (
                <div className={styles.followControls}>
                    <button
                        className={styles.followButton}
                        onClick={() => onToggleFollow(participant.clientId)}
                    >
                        {participant.isFollowing ? "Unfollow" : "Follow"}
                    </button>
                </div>
            ) : null}
        </div>
    );
}

export default ParticipantItem;
