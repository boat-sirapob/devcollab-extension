import { ChatMessage } from "../../../../../shared/models/ChatHistoryItem";
import classNames from "classnames";
import styles from "./ChatMessageItem.module.scss";
import { useChatService } from "../../../services/ChatService";

type ChatMessageItemProps = {
    value: ChatMessage;
    showSenderName?: boolean;
};

function ChatMessageItem({ value, showSenderName = true }: ChatMessageItemProps) {
    const chatService = useChatService();

    const className = classNames(styles.container, {
        [styles.ownMessage]: chatService.currentUser?.clientId === value.senderId,
    });
    return (
        <div className={className}>
            {showSenderName && (
                <div className={styles.chatSenderName}>{value.displayName}</div>
            )}
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
