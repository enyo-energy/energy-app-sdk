import {HemsOneEnergyAppSdk} from "./hems-one-energy-app-sdk.js";
import {EnergyAppInterval} from "./packages/energy-app-interval.js";
import {EnergyAppModbus} from "./packages/energy-app-modbus.js";
import {HemsOneNetworkDevice} from "./types/hems-one-network-device.js";
import {EnergyAppStorage} from "./packages/energy-app-storage.js";
import {HemsOneAppliances} from "./types/hems-one-appliance.js";

export * from './energy-app-package-definition.js';

export class EnergyApp implements HemsOneEnergyAppSdk {
    private readonly energyAppSdk: HemsOneEnergyAppSdk;

    constructor() {
        // in our runtime, there is an instance of energyAppSdk available which needs to be used here
        // if the energyAppSdk is not available, instantiate a mocked version for local development
        // @ts-ignore
        if (energyAppSdkInstance === undefined || energyAppSdkInstance === null) {
            throw new Error('Missing energyAppSdk instance');
        } else {
            // @ts-ignore
            this.energyAppSdk = energyAppSdkInstance;
        }
    }

    public isOnline(): boolean {
        return this.energyAppSdk.isOnline();
    }

    public register(callback: (packageName: string, version: number) => void) {
        // This registers the package with the HEMS one system
        this.energyAppSdk.register(callback);
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
        return this.energyAppSdk.useFetch();
    }

    public useInterval(): EnergyAppInterval {
        return this.energyAppSdk.useInterval();
    }

    public useModbus(): EnergyAppModbus {
        return this.energyAppSdk.useModbus();
    }

    public useNetworkDevices(): HemsOneNetworkDevice {
        return this.energyAppSdk.useNetworkDevices();
    }

    public useStorage(): EnergyAppStorage {
        return this.energyAppSdk.useStorage();
    }

    public useAppliances(): HemsOneAppliances {
        return this.energyAppSdk.useAppliances();
    }
}
