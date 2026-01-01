
export interface SessionParticipant {
  clientId: number;
  displayName: string;
  color: string;
  type: "Host" | "Guest";
}
