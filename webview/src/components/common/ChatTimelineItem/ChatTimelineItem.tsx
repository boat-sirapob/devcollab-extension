import { ChatHistoryTimelineItem, ChatTimelineItemType } from "../../../../../shared/models/ChatHistoryItem";

import styles from "./ChatTimelineItem.module.scss";

function ChatTimelineItem({ value }: { value: ChatHistoryTimelineItem }) {
    var message: string;
    switch (value.timelineType) {
        case ChatTimelineItemType.START_SESSION: {
            message = `${value.user} started the session`;
            break;
        }
        case ChatTimelineItemType.JOIN_SESSION: {
            message = `${value.user} started the session`;
            break;
        }
        case ChatTimelineItemType.LEAVE_SESSION: {
            message = `${value.user} left the session`;
            break;
        }
        default:
            throw new Error("Unknown timeline type");
    }

    return (
        <div className={styles.container}>
            <div className={styles.timelineMessage}>{message}</div>
            <div className={styles.timelineTimestamp}>
                {value.timestamp.toLocaleTimeString()}
            </div>
        </div>
    );
}

export default ChatTimelineItem;
