import {ConnectEmsApi} from "./connect-ems-api.js";
import express, {type Request, type Response} from "express";
import {ConnectHttpApi, ConnectHttpApiOptions} from "./packages/connect-http-api.js";

export class MockConnectEmsApi implements ConnectEmsApi {
    register(callback: (packageName: string, version: number) => void) {
        console.log('MockConnectEmsApi: Registering package with Connect EMS API');
        const app = express();
        app.use(express.json());
        app.get('/', (req: Request, res: Response) => {
        });
        app.listen(4001, () => {
            callback('com.example', 1);
        })
    }

    shutdown(callback: () => void) {
    }

    isOnline() {
        return true;
    }

    useHttp(): ConnectHttpApi {
        return {
            isPermitted: () => true,
            get: async <T, ERR>(url: string, options?: ConnectHttpApiOptions) => {
                try {
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: options?.headers
                    });
                    const data = await response.json() as T;
                    return {
                        status: response.status,
                        data
                    };
                } catch (error) {
                    return {
                        status: 0,
                        data: {message: error?.toString()} as ERR
                    };
                }
            },
            post: async <T, ERR>(url: string, body?: any, options?: ConnectHttpApiOptions) => {
                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...options?.headers
                        },
                        body: body ? JSON.stringify(body) : undefined
                    });
                    const data = await response.json() as T;
                    return {
                        status: response.status,
                        data
                    };
                } catch (error) {
                    return {
                        status: 0,
                        data: {message: error?.toString()} as ERR
                    };
                }
            },
            put: async <T, ERR>(url: string, body?: any, options?: ConnectHttpApiOptions) => {
                try {
                    const response = await fetch(url, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            ...options?.headers
                        },
                        body: body ? JSON.stringify(body) : undefined
                    });
                    const data = await response.json() as T;
                    return {
                        status: response.status,
                        data
                    };
                } catch (error) {
                    return {
                        status: 0,
                        data: {message: error?.toString()} as ERR
                    };
                }
            },
            patch: async <T, ERR>(url: string, body?: any, options?: ConnectHttpApiOptions) => {
                try {
                    const response = await fetch(url, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            ...options?.headers
                        },
                        body: body ? JSON.stringify(body) : undefined
                    });
                    const data = await response.json() as T;
                    return {
                        status: response.status,
                        data
                    };
                } catch (error) {
                    return {
                        status: 0,
                        data: {message: error?.toString()} as ERR
                    };
                }
            },
            delete: async <T, ERR>(url: string, options?: ConnectHttpApiOptions) => {
                try {
                    const response = await fetch(url, {
                        method: 'DELETE',
                        headers: options?.headers
                    });
                    const data = await response.json() as T;
                    return {
                        status: response.status,
                        data
                    };
                } catch (error) {
                    return {
                        status: 0,
                        data: {message: error?.toString()} as ERR
                    };
                }
            }
        };
    }

}