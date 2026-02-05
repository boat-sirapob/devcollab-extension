import { SessionParticipant } from "../../shared/models/SessionParticipant.js";

export interface IFollowService {
    toggleFollow(participant: SessionParticipant): void;
    dispose(): void;
}
