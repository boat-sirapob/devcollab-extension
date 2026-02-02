export enum ChatHistoryItemType {
    MESSAGE = "message",
    TIMELINE = "timeline",
}

export interface ChatHistoryItemBase {
    type: ChatHistoryItemType;
    timestamp: Date;
}

export interface ChatMessage extends ChatHistoryItemBase {
    type: ChatHistoryItemType.MESSAGE;
    id: string;
    sender: string;
    content: string;
    timestamp: Date;
}

export enum ChatTimelineItemType {
    START_SESSION = "start_session",
    JOIN_SESSION = "join_session",
    LEAVE_SESSION = "leave_session",
}

export interface ChatTimelineStartSession extends ChatHistoryItemBase {
    type: ChatHistoryItemType.TIMELINE;
    id: string;
    timestamp: Date;
    timelineType: ChatTimelineItemType.START_SESSION;
    user: string;
}

export interface ChatTimelineJoinSession extends ChatHistoryItemBase {
    type: ChatHistoryItemType.TIMELINE;
    id: string;
    timestamp: Date;
    timelineType: ChatTimelineItemType.JOIN_SESSION;
    user: string;
}

export interface ChatTimelineLeaveSession extends ChatHistoryItemBase {
    type: ChatHistoryItemType.TIMELINE;
    id: string;
    timestamp: Date;
    timelineType: ChatTimelineItemType.LEAVE_SESSION;
    user: string;
}

export type ChatHistoryTimelineItem =
    | ChatTimelineStartSession
    | ChatTimelineJoinSession
    | ChatTimelineLeaveSession;
