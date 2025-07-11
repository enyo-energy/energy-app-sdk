export interface ConnectEmsApi {
    register: (callback: (packageName: string, version: number) => void) => void;
    shutdown: (callback: () => Promise<void>) => void;
    isOnline: () => boolean;
}