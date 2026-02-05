import { ChatMessage } from "../../../../../shared/models/ChatHistoryItem";
import classNames from "classnames";
import styles from "./ChatMessageItem.module.scss";
import { useChatService } from "../../../services/ChatService";
import { useEffect } from "react";

function ChatMessageItem({ value }: { value: ChatMessage }) {
    const chatService = useChatService();

    const className = classNames(styles.container, {
        [styles.ownMessage]: chatService.currentUser?.clientId === value.senderId,
    });
    return (
        <div className={className}>
            <div className={styles.chatSenderName}>{value.displayName}</div>
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
