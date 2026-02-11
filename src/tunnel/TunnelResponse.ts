
export interface TunnelResponse {
    statusCode: number;
    statusMessage: string;
    headers: Record<string, string | string[]>;
    body: string; // base64
}
