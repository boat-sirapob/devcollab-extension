import { ChatHistoryItemDto } from "../dtos/ChatHistoryItemDto.js";
import { ChatHistoryItem, ChatHistoryItemType, ChatMessage, ChatTimelineItemType } from "../models/ChatHistoryItem.js";
import { SessionParticipant } from "../models/SessionParticipant.js";
import { SessionParticipantDto } from "../../src/dto/SessionParticipantDto.js";

export class Mapper {
    static toSessionParticipantDto(
        val: SessionParticipant
    ): SessionParticipantDto {
        return {
            displayName: val.displayName,
            color: val.color,
            type: val.type,
        };
    }
    static fromSessionParticipantDto(
        val: SessionParticipantDto,
        clientId: number
    ): SessionParticipant {
        return {
            clientId: clientId,
            displayName: val.displayName,
            color: val.color,
            type: val.type,
        };
    }

    static toChatHistoryItemDto(item: ChatHistoryItem): ChatHistoryItemDto {
        if (item.type === ChatHistoryItemType.MESSAGE) {
            return {
                type: ChatHistoryItemType.MESSAGE,
                id: item.id,
                senderId: item.senderId,
                displayName: item.displayName,
                content: item.content,
                timestamp: item.timestamp.toISOString(),
            };
        }

        switch (item.timelineType) {
            case ChatTimelineItemType.START_SESSION:
                return {
                    type: ChatHistoryItemType.TIMELINE,
                    id: item.id,
                    timelineType: ChatTimelineItemType.START_SESSION,
                    user: item.user,
                    timestamp: item.timestamp.toISOString(),
                };
            case ChatTimelineItemType.JOIN_SESSION:
                return {
                    type: ChatHistoryItemType.TIMELINE,
                    id: item.id,
                    timelineType: ChatTimelineItemType.JOIN_SESSION,
                    user: item.user,
                    timestamp: item.timestamp.toISOString(),
                };
            case ChatTimelineItemType.LEAVE_SESSION:
                return {
                    type: ChatHistoryItemType.TIMELINE,
                    id: item.id,
                    timelineType: ChatTimelineItemType.LEAVE_SESSION,
                    user: item.user,
                    timestamp: item.timestamp.toISOString(),
                };
        }

        throw new Error("Unsupported chat history item type");
    }

    static fromChatHistoryItemDto(val: ChatHistoryItemDto): ChatHistoryItem {
        if (val.type === ChatHistoryItemType.MESSAGE) {
            const msg: ChatMessage = {
                type: ChatHistoryItemType.MESSAGE,
                id: val.id,
                senderId: val.senderId,
                displayName: val.displayName,
                content: val.content,
                timestamp: new Date(val.timestamp),
            };
            return msg;
        }

        switch (val.timelineType) {
            case ChatTimelineItemType.START_SESSION:
                return {
                    type: ChatHistoryItemType.TIMELINE,
                    id: val.id,
                    timelineType: ChatTimelineItemType.START_SESSION,
                    user: val.user,
                    timestamp: new Date(val.timestamp),
                };
            case ChatTimelineItemType.JOIN_SESSION:
                return {
                    type: ChatHistoryItemType.TIMELINE,
                    id: val.id,
                    timelineType: ChatTimelineItemType.JOIN_SESSION,
                    user: val.user,
                    timestamp: new Date(val.timestamp),
                };
            case ChatTimelineItemType.LEAVE_SESSION:
                return {
                    type: ChatHistoryItemType.TIMELINE,
                    id: val.id,
                    timelineType: ChatTimelineItemType.LEAVE_SESSION,
                    user: val.user,
                    timestamp: new Date(val.timestamp),
                };
        }

        throw new Error("Unsupported chat history item type");
    }
}
