export interface ITelemetryService {
    recordEdit(): void;
    recordCursorMove(): void;
    recordAction(action: string, extra?: Record<string, unknown>): void;
    dispose(): void;
}