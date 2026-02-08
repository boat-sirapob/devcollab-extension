import { ChatHistoryItem, ChatHistoryItemType, ChatHistoryTimelineItem, ChatMessage } from "../../../../../shared/models/ChatHistoryItem";
import { useEffect, useRef, useState } from "react";

import ChatMessageItem from "../../common/ChatMessageItem/ChatMessageItem";
import ChatTimelineItem from "../../common/ChatTimelineItem/ChatTimelineItem";
import { VscodeTextarea } from "@vscode-elements/react-elements";
import { VscodeTextarea as VscodeTextareaType } from "@vscode-elements/elements/dist/vscode-textarea/vscode-textarea.js";
import styles from "./ChatView.module.scss";
import { useChatService } from "../../../services/ChatService";

function ChatView() {
    const chatService = useChatService();
    const messageInputRef = useRef<VscodeTextareaType>(null);
    const chatListRef = useRef<HTMLDivElement>(null);
    const [chatItems, setChatItems] = useState<ChatHistoryItem[]>([]);

    useEffect(() => {
        setChatItems(chatService.getChatHistory());

        const disposable = chatService.onDidChangeHistory((updatedHistory) => {
            setChatItems(updatedHistory);
        });

        return () => {
            disposable.dispose();
        };
    }, [chatService]);

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

    useEffect(() => {
        if (chatListRef.current) {
            chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
        }
    }, [chatItems]);

    return (
        <div className={styles.container}>
            <div className={styles.chatList} ref={chatListRef}>
                {
                    chatItems.length === 0 ?
                        <div className={styles.emptyState}>
                            No messages yet. Start the conversation!
                        </div>
                        : chatItems.map((item, index) => {
                            if (item.type === ChatHistoryItemType.MESSAGE) {
                                const chatMessage = item as ChatMessage;
                                const previousItem = chatItems[index - 1];
                                const showSenderName =
                                    !previousItem ||
                                    previousItem.type !== ChatHistoryItemType.MESSAGE ||
                                    (previousItem as ChatMessage).senderId !== chatMessage.senderId;

                                return (
                                    <ChatMessageItem
                                        key={chatMessage.id}
                                        value={chatMessage}
                                        showSenderName={showSenderName}
                                    />
                                );
                            } else if (item.type === ChatHistoryItemType.TIMELINE) {
                                const timelineItem = item as ChatHistoryTimelineItem;
                                return (
                                    <ChatTimelineItem
                                        key={timelineItem.id}
                                        value={timelineItem}
                                    />
                                );
                            }
                        })
                }
            </div>
            <VscodeTextarea
                placeholder="Type a message"
                ref={messageInputRef}
            />
        </div>
    );
}

export default ChatView;
