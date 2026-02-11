
export interface TunnelRequest {
    method: string;
    path: string;
    headers: Record<string, string | string[] | undefined>;
    body?: string; // base64
}
