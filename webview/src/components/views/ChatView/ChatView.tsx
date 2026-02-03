import {
    ChatHistoryItemType,
    ChatTimelineItemType,
    type ChatHistoryTimelineItem,
    type ChatMessage,
} from "../../../models/ChatHistoryItem";
import { VscodeTextarea } from "@vscode-elements/react-elements";
import { useEffect, useRef } from "react";

import ChatMessageItem from "../../common/ChatMessageItem/ChatMessageItem";
import { VscodeTextarea as VscodeTextareaType } from "@vscode-elements/elements/dist/vscode-textarea/vscode-textarea.js";
import styles from "./ChatView.module.scss";
import ChatTimelineItem from "../../common/ChatTimelineItem/ChatTimelineItem";
import { useChatService } from "../../../services/ChatService";

function ChatView() {
    const chatService = useChatService();
    const messageInputRef = useRef<VscodeTextareaType>(null);

    const chatItems: (ChatMessage | ChatHistoryTimelineItem)[] = [
        {
            type: ChatHistoryItemType.MESSAGE,
            id: "1",
            sender: "user",
            content: "Hello, how are you?",
            timestamp: new Date(),
        },
        // {
        //     type: ChatHistoryItemType.TIMELINE,
        //     id: "2",
        //     timestamp: new Date(),
        //     timelineType: ChatTimelineItemType.START_SESSION,
        //     user: "user1",
        // },
        // {
        //     type: ChatHistoryItemType.MESSAGE,
        //     id: "3",
        //     sender: "bot",
        //     content: "I'm fine, thank you! How can I assist you today?",
        //     timestamp: new Date(),
        // },
    ];

    useEffect(() => {
        const textareaElement = messageInputRef.current;
        if (textareaElement) {
            textareaElement.wrappedElement.style.padding = "6px 8px";
            textareaElement.wrappedElement.onkeydown = (
                event: KeyboardEvent
            ) => {
                if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    const message = textareaElement.value.trim();
                    if (message.length > 0) {
                        chatService.sendChatMessage(message);
                        textareaElement.value = "";
                    }
                }
            };
        }
    }, []);

    return (
        <div className={styles.container}>
            <div className={styles.chatList}>
                {chatItems.map((item) => {
                    if (item.type === ChatHistoryItemType.MESSAGE) {
                        let chatMessage = item as ChatMessage;
                        return (
                            <ChatMessageItem
                                key={chatMessage.id}
                                value={chatMessage}
                            />
                        );
                    } else if (item.type === ChatHistoryItemType.TIMELINE) {
                        let timelineItem = item as ChatHistoryTimelineItem;
                        return (
                            <ChatTimelineItem
                                key={timelineItem.id}
                                value={timelineItem}
                            />
                        );
                    }
                })}
            </div>
            <VscodeTextarea
                placeholder="Type a message"
                ref={messageInputRef}
            />
        </div>
    );
}

export default ChatView;
