import {MockConnectEmsApi} from "./mockConnectEmsApi.js";
import {ConnectEmsApi} from "./connect-ems-api.js";
import {ConnectHttpApi} from "./packages/connect-http-api.js";

export class ConnectEmsPackageClient implements ConnectEmsApi {
    private readonly connectEmsApi: ConnectEmsApi;

    constructor() {
        // in our runtime, there is a instance of connectEmsApi available which needs to be used here
        // if the connectEmsApi is not available, instantiate a mocked version for local development
        // @ts-ignore
        if (typeof connectEmsApi === 'undefined') {
            console.warn('Connect EMS API is not available, using mock implementation.');
            this.connectEmsApi = new MockConnectEmsApi();
        } else {
            // @ts-ignore
            this.connectEmsApi = connectEmsApi;
        }
    }

    public isOnline(): boolean {
        return this.connectEmsApi.isOnline();
    }

    public register(callback: (packageName: string, version: number) => void) {
        // This registers the package with the Connect EMS system
        this.connectEmsApi.register(callback);
    }

    public shutdown(callback: () => Promise<void>) {
        process.on('beforeExit', async (code) => {
            await callback();
        });
        process.on('exit', async (code) => {
            await callback();
        });
    }

    public useHttp(): ConnectHttpApi {
        return this.connectEmsApi.useHttp();
    }
}
