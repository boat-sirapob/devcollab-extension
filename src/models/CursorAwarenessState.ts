import { CursorSelection } from "./CursorSelection.js";

export interface CursorAwarenessState {
    uri: string;
    selections: CursorSelection[];
}
