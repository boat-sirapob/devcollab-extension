import { CursorAwarenessState } from "./CursorAwarenessState.js";
import { FileSavedAwarenessState } from "./FileSavedAwarenessState.js";
import { SessionParticipantDto } from "../dto/SessionParticipantDto.js";

export interface AwarenessState {
    user?: SessionParticipantDto;
    cursor?: CursorAwarenessState;
    lastSavedFile?: FileSavedAwarenessState;
}
