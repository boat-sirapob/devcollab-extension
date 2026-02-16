import { SessionParticipant } from "../../shared/models/SessionParticipant.js";

export interface IFollowService {
    get followingParticipant(): SessionParticipant | null;
    toggleFollow(participant: SessionParticipant): void;
    dispose(): void;
}
