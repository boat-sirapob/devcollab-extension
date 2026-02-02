import type { ChatMessage } from "../../../models/ChatHistoryItem";
import styles from "./ChatMessageItem.module.scss";

function ChatMessageItem({ value }: { value: ChatMessage }) {
    return (
        <div className={styles.container}>
            <div className={styles.chatSenderName}>{value.sender}</div>
            <div className={styles.chatContent}>
                <div className={styles.chatMessage}>{value.content}</div>
                <div className={styles.chatTimestamp}>
                    {value.timestamp.toLocaleTimeString()}
                </div>
            </div>
        </div>
    );
}

export default ChatMessageItem;
