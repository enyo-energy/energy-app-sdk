import {ConnectEmsApi} from "./connect-ems-api.js";
import {ConnectInterval} from "./packages/connect-interval.js";
import {ConnectModbus} from "./packages/connect-modbus.js";
import {ConnectNetworkDevices} from "./packages/connect-network-devices.js";
import {ConnectStorage} from "./packages/connect-storage.js";
import {ConnectAppliances} from "./packages/connect-appliance.js";

export * from './connect-package-definition.js';

export class ConnectEmsPackageClient implements ConnectEmsApi {
    private readonly connectEmsApi: ConnectEmsApi;

    constructor() {
        // in our runtime, there is a instance of connectEmsApi available which needs to be used here
        // if the connectEmsApi is not available, instantiate a mocked version for local development
        // @ts-ignore
        if (connectEmsApi === undefined || connectEmsApi === null) {
            throw new Error('Missing connectEmsApi');
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

    public onShutdown(callback: () => Promise<void>) {
        process.on('beforeExit', async (code) => {
            await callback();
        });
        process.on('exit', async (code) => {
            await callback();
        });
    }

    public useFetch(): typeof fetch {
        return this.connectEmsApi.useFetch();
    }

    public useInterval(): ConnectInterval {
        return this.connectEmsApi.useInterval();
    }

    public useModbus(): ConnectModbus {
        return this.connectEmsApi.useModbus();
    }

    public useNetworkDevices(): ConnectNetworkDevices {
        return this.connectEmsApi.useNetworkDevices();
    }

    public useStorage(): ConnectStorage {
        return this.connectEmsApi.useStorage();
    }

    public useAppliances(): ConnectAppliances {
        return this.connectEmsApi.useAppliances();
    }
}
