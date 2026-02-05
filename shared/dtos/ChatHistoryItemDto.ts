import { ChatHistoryItemType, ChatTimelineItemType } from "../models/ChatHistoryItem.js";

export interface ChatHistoryItemDtoBase {
    type: ChatHistoryItemType;
    timestamp: string;
}

export interface ChatMessageDto extends ChatHistoryItemDtoBase {
    type: ChatHistoryItemType.MESSAGE;
    id: string;
    senderId: number;
    displayName: string;
    content: string;
    timestamp: string;
}

export interface ChatTimelineStartSessionDto extends ChatHistoryItemDtoBase {
    type: ChatHistoryItemType.TIMELINE;
    id: string;
    timestamp: string;
    timelineType: ChatTimelineItemType.START_SESSION;
    user: string;
}

export interface ChatTimelineJoinSessionDto extends ChatHistoryItemDtoBase {
    type: ChatHistoryItemType.TIMELINE;
    id: string;
    timestamp: string;
    timelineType: ChatTimelineItemType.JOIN_SESSION;
    user: string;
}

export interface ChatTimelineLeaveSessionDto extends ChatHistoryItemDtoBase {
    type: ChatHistoryItemType.TIMELINE;
    id: string;
    timestamp: string;
    timelineType: ChatTimelineItemType.LEAVE_SESSION;
    user: string;
}

export type ChatHistoryTimelineItemDto =
    | ChatTimelineStartSessionDto
    | ChatTimelineJoinSessionDto
    | ChatTimelineLeaveSessionDto;

export type ChatHistoryItemDto = ChatMessageDto | ChatHistoryTimelineItemDto;
