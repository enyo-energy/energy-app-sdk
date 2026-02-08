import {EnergyAppStateEnum, EnyoEnergyAppSdk} from "./enyo-energy-app-sdk.js";
import {EnergyAppInterval} from "./packages/energy-app-interval.js";
import {EnergyAppModbus} from "./packages/energy-app-modbus.js";
import {EnergyAppStorage} from "./packages/energy-app-storage.js";
import {EnergyAppAppliance} from "./packages/energy-app-appliance.js";
import {EnergyAppNetworkDevice} from "./packages/energy-app-network-device.js";
import {EnergyAppDataBus} from "./packages/energy-app-data-bus.js";
import {EnergyAppOcpp} from "./packages/energy-app-ocpp.js";
import {EnergyAppVehicle} from "./packages/energy-app-vehicle.js";
import {EnergyAppChargingCard} from "./packages/energy-app-charging-card.js";
import {EnergyAppCharge} from "./packages/energy-app-charge.js";
import {getSdkVersion} from "./version.js";
import {EnergyAppAuthentication} from "./packages/energy-app-authentication.js";
import {EnergyAppSettings} from "./packages/energy-app-settings.js";
import {EnergyAppElectricityPrices} from "./packages/energy-app-electricity-prices.js";
import {EnergyAppNotification} from "./packages/energy-app-notification.js";
import {EnergyAppSecretManager} from "./packages/energy-app-secret-manager.js";
import {EnergyAppLocation} from "./packages/energy-app-location.js";
import {EnergyAppOnboarding} from "./packages/energy-app-onboarding.js";
import {EnergyAppTimeseries} from "./packages/energy-app-timeseries.js";
import {EnyoPackageChannel} from "./enyo-package-channel.js";

export * from './energy-app-package-definition.js';
export * from './version.js';
export * from './implementations/ocpp/ocpp16.js';
export * from './implementations/ocpp/ocpp201.js';
export * from './implementations/ocpp/ocpp-common.js';
export * from './types/enyo-authentication.js'
export * from './types/enyo-settings.js'
export * from './types/enyo-energy-tariff.js'
export * from './types/enyo-electricity-prices.js'
export * from './types/enyo-notification.js'
export * from './types/enyo-secret-manager.js'
export * from './types/enyo-location.js'
export * from './implementations/appliances/appliance-manager.js'
export * from './implementations/appliances/identifier-strategies.js'
export * from './enyo-package-channel.js';
export * from './types/enyo-timeseries.js';

export class EnergyApp implements EnyoEnergyAppSdk {
    private readonly energyAppSdk: EnyoEnergyAppSdk;

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

    public isSystemOnline(): boolean {
        return this.energyAppSdk.isSystemOnline();
    }

    public updateEnergyAppState(state: EnergyAppStateEnum) {
        this.energyAppSdk.updateEnergyAppState(state)
    }

    public register(callback: (packageName: string, version: number, channel: EnyoPackageChannel) => void) {
        // This registers the package with the enyo system
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

    public useNetworkDevices(): EnergyAppNetworkDevice {
        return this.energyAppSdk.useNetworkDevices();
    }

    public useStorage(): EnergyAppStorage {
        return this.energyAppSdk.useStorage();
    }

    public useAppliances(): EnergyAppAppliance {
        return this.energyAppSdk.useAppliances();
    }

    public useDataBus(): EnergyAppDataBus {
        return this.energyAppSdk.useDataBus();
    }

    public useOcpp(): EnergyAppOcpp {
        return this.energyAppSdk.useOcpp();
    }

    public useVehicle(): EnergyAppVehicle {
        return this.energyAppSdk.useVehicle();
    }

    public useChargingCard(): EnergyAppChargingCard {
        return this.energyAppSdk.useChargingCard();
    }

    public useCharge(): EnergyAppCharge {
        return this.energyAppSdk.useCharge();
    }

    public useAuthentication(): EnergyAppAuthentication {
        return this.energyAppSdk.useAuthentication();
    }

    public useSettings(): EnergyAppSettings {
        return this.energyAppSdk.useSettings();
    }

    public useElectricityPrices(): EnergyAppElectricityPrices {
        return this.energyAppSdk.useElectricityPrices();
    }

    public useNotification(): EnergyAppNotification {
        return this.energyAppSdk.useNotification();
    }

    public useOnboarding(): EnergyAppOnboarding {
        return this.energyAppSdk.useOnboarding();
    }

    /**
     * Gets the Secret Manager API for retrieving secrets from the developer organization.
     * Provides methods to fetch secrets that have been configured in the developer org's secret store.
     * @returns The Secret Manager API instance
     */
    public useSecretManager(): EnergyAppSecretManager {
        return this.energyAppSdk.useSecretManager();
    }

    /**
     * Gets the Location API for retrieving device location information.
     * Provides methods to fetch location with varying levels of detail based on permissions.
     * @returns The Location API instance
     */
    public useLocation(): EnergyAppLocation {
        return this.energyAppSdk.useLocation();
    }

    /**
     * Gets the Timeseries API for querying historical energy data.
     * Provides methods to retrieve aggregated timeseries data with 15-minute bucket granularity
     * for various energy metrics including PV production, battery state, meter values, and grid power.
     * @returns The Timeseries API instance
     */
    public useTimeseries(): EnergyAppTimeseries {
        return this.energyAppSdk.useTimeseries();
    }

    /**
     * Gets the current SDK version.
     * @returns The semantic version string of the SDK
     */
    public getSdkVersion(): string {
        return getSdkVersion();
    }
}
