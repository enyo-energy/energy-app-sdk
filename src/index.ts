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
import {EnergyAppEnergyPrices} from "./packages/energy-app-energy-prices.js";
import {EnergyAppNotification} from "./packages/energy-app-notification.js";
import {EnergyAppSecretManager} from "./packages/energy-app-secret-manager.js";
import {EnergyAppLocation} from "./packages/energy-app-location.js";
import {EnergyAppOnboarding} from "./packages/energy-app-onboarding.js";
import {EnergyAppTimeseries} from "./packages/energy-app-timeseries.js";
import {EnyoPackageChannel} from "./enyo-package-channel.js";
import {EnergyAppEnergyManager} from "./packages/energy-app-energy-manager.js";
import {EnergyAppElectricityTariff} from "./packages/energy-app-electricity-tariff.js";
import {EnergyAppWeatherForecasting} from "./packages/energy-app-weather-forecasting.js";
import {EnergyAppPvForecasting} from "./packages/energy-app-pv-forecasting.js";
import {EnergyAppPvSystem} from "./packages/energy-app-pv-system.js";
import {EnergyAppSequenceGenerator} from "./packages/energy-app-sequence-generator.js";
import {EnergyAppModbusRtu} from "./packages/energy-app-modbus-rtu.js";
import {EnergyAppEebus} from "./packages/energy-app-eebus.js";
import {EnergyAppMqtt} from "./packages/energy-app-mqtt.js";

export * from './energy-app-appliance-type.enum.js';
export * from './energy-app-package-definition.js';
export * from './version.js';
export * from './implementations/ocpp/ocpp16.js';
export * from './implementations/ocpp/ocpp201.js';
export * from './implementations/ocpp/ocpp-common.js';
export * from './types/enyo-authentication.js'
export * from './types/enyo-settings.js'
export * from './types/enyo-energy-prices.js'
export * from './types/enyo-notification.js'
export * from './types/enyo-secret-manager.js'
export * from './types/enyo-location.js'
export * from './implementations/appliances/appliance-manager.js'
export * from './implementations/appliances/identifier-strategies.js'
export * from './enyo-package-channel.js';
export * from './types/enyo-timeseries.js';
export * from './types/enyo-energy-manager.js';
export * from './packages/energy-app-energy-manager.js';
export * from './types/enyo-electricity-tariff.js';
export * from './packages/energy-app-electricity-tariff.js';
export * from './types/enyo-pv-forecast.js';
export * from './types/enyo-forecasting.js';
export * from './packages/energy-app-weather-forecasting.js';
export * from './packages/energy-app-pv-forecasting.js';
export * from './types/enyo-pv-system.js';
export * from './packages/energy-app-pv-system.js';
export * from './implementations/data-bus/data-bus-command-handler.js';
export * from './types/enyo-currency.js';
export * from './packages/energy-app-sequence-generator.js';
export * from './packages/energy-app-energy-prices.js'
export * from './packages/energy-app-modbus-rtu.js'
export * from './types/enyo-eebus.js'
export * from './packages/energy-app-eebus.js'
export * from './types/enyo-mqtt.js'
export * from './packages/energy-app-mqtt.js'

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

    /**
     * Registers a listener that gets called when the network status changes.
     * @param listener - Callback invoked with `true` when the system goes online, `false` when it goes offline
     * @returns A unique listener ID that can be used to remove the listener
     */
    public onNetworkStatusChanged(listener: (online: boolean) => void | Promise<void>): string {
        return this.energyAppSdk.onNetworkStatusChanged(listener);
    }

    public updateEnergyAppState(state: EnergyAppStateEnum) {
        this.energyAppSdk.updateEnergyAppState(state)
    }

    public register(callback: (packageName: string, version: number, channel: EnyoPackageChannel, deviceId: string) => void | Promise<void>) {
        // This registers the package with the enyo system
        this.energyAppSdk.register(callback);
    }

    public onShutdown(callback: () => void | Promise<void>) {
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

    public useElectricityPrices(): EnergyAppEnergyPrices {
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
     * Gets the Energy Manager API for retrieving information about the active energy manager.
     * Provides methods to check the current energy manager and its supported features.
     * @returns The Energy Manager API instance
     */
    public useEnergyManager(): EnergyAppEnergyManager {
        return this.energyAppSdk.useEnergyManager();
    }

    /**
     * Gets the Electricity Tariff API for managing electricity tariffs.
     * Provides methods to register, retrieve, and remove electricity tariffs
     * used for energy pricing and consumption calculations.
     * @returns The Electricity Tariff API instance
     */
    public useElectricityTariff(): EnergyAppElectricityTariff {
        return this.energyAppSdk.useElectricityTariff();
    }

    /**
     * Gets the Weather Forecasting API for managing weather forecast providers and retrieving weather forecasts.
     * Provides methods to register/deregister weather forecast providers, list available providers,
     * and fetch weather forecasts by zip code or coordinates.
     * @returns The Weather Forecasting API instance
     */
    public useWeatherForecasting(): EnergyAppWeatherForecasting {
        return this.energyAppSdk.useWeatherForecasting();
    }

    /**
     * Gets the PV Forecasting API for managing PV forecast providers and retrieving PV forecasts.
     * Provides methods to register/deregister PV forecast providers and fetch power production forecasts.
     * @returns The PV Forecasting API instance
     */
    public usePvForecasting(): EnergyAppPvForecasting {
        return this.energyAppSdk.usePvForecasting();
    }

    /**
     * Gets the PV System API for managing PV system registrations and configurations.
     * Provides methods to register, retrieve, update, and remove PV systems
     * including DC string orientations, peak power, associated appliances, and feature flags.
     * @returns The PV System API instance
     */
    public usePvSystem(): EnergyAppPvSystem {
        return this.energyAppSdk.usePvSystem();
    }

    /**
     * Gets the Sequence Generator API for generating unique sequential numbers per named sequence.
     * Each sequence is identified by a string name and maintains its own independent counter.
     * @returns The Sequence Generator API instance
     */
    public useSequenceGenerator(): EnergyAppSequenceGenerator {
        return this.energyAppSdk.useSequenceGenerator();
    }

    /**
     * Gets the Modbus RTU serial communication API.
     * Provides methods to connect to Modbus RTU devices over serial ports
     * and read/write registers using slave IDs.
     * @returns The Modbus RTU API instance
     */
    public useModbusRtu(): EnergyAppModbusRtu {
        return this.energyAppSdk.useModbusRtu();
    }

    /**
     * Gets the EEbus API for SHIP/SPINE device communication.
     * Provides device pairing and discovery, low-level SPINE data access,
     * and high-level convenience methods for power management and device classification.
     * Supports both appliance and energy manager roles for bidirectional communication.
     * @returns The EEbus API instance
     */
    public useEebus(): EnergyAppEebus {
        return this.energyAppSdk.useEebus();
    }

    /**
     * Gets the MQTT communication API.
     * Provides methods to connect to the SDK-provided internal MQTT broker
     * or external custom brokers for publishing and subscribing to topics.
     * @returns The MQTT API instance
     */
    public useMqtt(): EnergyAppMqtt {
        return this.energyAppSdk.useMqtt();
    }

    /**
     * Gets the current SDK version.
     * @returns The semantic version string of the SDK
     */
    public getSdkVersion(): string {
        return getSdkVersion();
    }
}
