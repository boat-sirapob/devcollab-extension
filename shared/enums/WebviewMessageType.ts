export enum WebviewMessageType {
    REQUEST = "request",
    RESPONSE = "response",
    CHAT_MESSAGE = "chatMessage",
    UPDATE_CHAT_HISTORY = "updateChatHistory",
    BEGIN_SESSION = "userInfo",
    SESSION_INFO_UPDATE = "sessionInfoUpdate",
    TOGGLE_FOLLOW = "toggleFollow",
    END_SESSION = "endSession",
    COPY_ROOM_CODE = "copyRoomCode",
}
