export interface HemsOneWebsocketConnection {
    send(data: string): void;
    close(code?: number, reason?: string): void;
    on(event: 'message', listener: (data: Buffer) => void): this;
    on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    readyState: number;
}