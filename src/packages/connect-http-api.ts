export interface ConnectHttpApi {
    isPermitted: () => boolean;
    get: <T, ERR>(url: string, options?: ConnectHttpApiOptions) => Promise<ConnectHttpApiResponse<T, ERR>>;
    post: <T, ERR>(url: string, body?: any, options?: ConnectHttpApiOptions) => Promise<ConnectHttpApiResponse<T, ERR>>;
    put: <T, ERR>(url: string, body?: any, options?: ConnectHttpApiOptions) => Promise<ConnectHttpApiResponse<T, ERR>>;
    patch: <T, ERR>(url: string, body?: any, options?: ConnectHttpApiOptions) => Promise<ConnectHttpApiResponse<T, ERR>>;
    delete: <T, ERR>(url: string, options?: ConnectHttpApiOptions) => Promise<ConnectHttpApiResponse<T, ERR>>;
}

export interface ConnectHttpApiResponse<T, ERR> {
    status: number;
    data: T | ERR;
}

export interface ConnectHttpApiOptions {
    headers?: Record<string, string>;
}