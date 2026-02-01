import { CursorAwarenessState } from "./CursorAwarenessState.js";
import { SessionParticipantDto } from "../dto/SessionParticipantDto.js";

export interface AwarenessState {
    user: SessionParticipantDto;
    cursor: CursorAwarenessState;
}
