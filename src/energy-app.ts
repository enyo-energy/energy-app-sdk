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
import {EnergyAppDynamicPriceForecast} from "./packages/energy-app-dynamic-price-forecast.js";
import {EnergyAppPvSystem} from "./packages/energy-app-pv-system.js";
import {EnergyAppSequenceGenerator} from "./packages/energy-app-sequence-generator.js";
import {EnergyAppModbusRtu} from "./packages/energy-app-modbus-rtu.js";
import {EnergyAppEebus} from "./packages/energy-app-eebus.js";
import {EnergyAppMqtt} from "./packages/energy-app-mqtt.js";
import {EnergyAppBluetooth} from "./packages/energy-app-bluetooth.js";
import {EnergyAppDiagnostics} from "./packages/energy-app-diagnostics.js";
import {EnergyAppLearningPhase} from "./packages/energy-app-learning-phase.js";
import {EnergyAppWifi} from "./packages/energy-app-wifi.js";
import {EnergyAppUdp} from "./packages/energy-app-udp.js";
import {EnergyAppGridConnectionPoint} from "./packages/energy-app-grid-connection-point.js";
import {EnergyAppConfigurationManager} from "./packages/energy-app-configuration-manager.js";
import {EnergyAppApplianceEnergyManagerForecast} from "./packages/energy-app-appliance-energy-manager-forecast.js";
import {EnergyAppBattery} from "./packages/energy-app-battery.js";
import {UseFetchOptions} from "./types/enyo-fetch.js";

/**
 * Concrete implementation of {@link EnyoEnergyAppSdk} that delegates every call
 * to the runtime-provided `energyAppSdkInstance` global.
 *
 * This class is the canonical entry point for an energy app: an integrator
 * instantiates one `EnergyApp`, then either consumes its `use*()` accessors
 * directly or extends one of the specialized abstract integration classes
 * (e.g. `HeatpumpIntegrationEnergyApp`) which build on top of this class.
 *
 * @example
 * ```ts
 * const app = new EnergyApp();
 * app.register((packageName, version, channel, deviceId) => {
 *   // perform initialization
 * });
 * ```
 */
export class EnergyApp implements EnyoEnergyAppSdk {
    private readonly energyAppSdk: EnyoEnergyAppSdk;
    private udpInstance: EnergyAppUdp | undefined;

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

    /**
     * Returns a `fetch` implementation provided by the runtime.
     * @param options - Optional configuration (e.g. {@link TlsClientOptions} for mutual TLS).
     *   When `options.tls` is set the runtime binds a TLS-configured dispatcher to the fetch.
     * @returns A `fetch` function that still passes through the runtime allow-list.
     */
    public useFetch(options?: UseFetchOptions): typeof fetch {
        return this.energyAppSdk.useFetch(options);
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
     * Gets the Dynamic Price Forecast API for publishing and consuming
     * forward-looking electricity price forecasts (e.g. day-ahead spot
     * prices). The data is forecast only — see
     * {@link EnergyAppDynamicPriceForecast} for the full contract.
     * @returns The Dynamic Price Forecast API instance
     */
    public useDynamicPriceForecast(): EnergyAppDynamicPriceForecast {
        return this.energyAppSdk.useDynamicPriceForecast();
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
     *
     * The returned facade splits responsibilities across four sub-interfaces:
     * - `devices` — SHIP-level device lifecycle (pairing, discovery, connection)
     * - `identity` — EEBUS Node Identification (NID): observable identity, diagnosis, use-case discovery
     * - `useCases` — typed use-case clients: LPC, LPP, MGCP, MPC, OHPCF
     * - `spine` — low-level SPINE escape hatch for features not yet wrapped
     *
     * Use-case clients carry both Energy Management System and Controllable
     * System methods; consumers act in whichever role(s) they need.
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
     * Gets the Bluetooth Low Energy API for scanning peripherals and
     * performing GATT operations against them.
     * @returns The Bluetooth API instance
     */
    public useBluetooth(): EnergyAppBluetooth {
        return this.energyAppSdk.useBluetooth();
    }

    /**
     * Gets the Diagnostics API for submitting energy manager diagnostics data.
     * Allows energy managers to report current state, forecast, and control plan
     * for internal processing and analysis.
     * @returns The Diagnostics API instance
     */
    public useDiagnostics(): EnergyAppDiagnostics {
        return this.energyAppSdk.useDiagnostics();
    }

    /**
     * Gets the Learning Phase API for registering and tracking learning phases.
     * Provides methods to register new learning phases, check their status,
     * and retrieve learning phase history for the package or specific appliances.
     * @returns The Learning Phase API instance
     */
    public useLearningPhase(): EnergyAppLearningPhase {
        return this.energyAppSdk.useLearningPhase();
    }

    /**
     * Gets the WiFi API for scanning and listing known WiFi networks (SSIDs).
     * Provides methods to discover saved/known SSIDs that are currently
     * in range of the device's WiFi adapter.
     * @returns The WiFi API instance
     */
    public useWifi(): EnergyAppWifi {
        return this.energyAppSdk.useWifi();
    }

    /**
     * Gets the UDP communication API for binding sockets and exchanging
     * datagrams. Requires the `Udp` permission to be granted.
     *
     * Lazily instantiates a single {@link EnergyAppUdpServer} on first call
     * and returns the same instance on subsequent calls. The runtime SDK's
     * permission gate is invoked on every call so that revoked permissions
     * are surfaced consistently with the other `use*` accessors.
     *
     * @returns The UDP API instance.
     * @throws {EnergyAppPermissionNotGrantedError} If the `Udp` permission
     *         is not granted.
     */
    public useUdp(): EnergyAppUdp {
        return this.energyAppSdk.useUdp();
    }

    /**
     * Gets the Grid Connection Point API for retrieving details about the
     * site's grid connection (main fuse rating in amperes, number of phases,
     * and maximum allowed grid power in watts).
     * @returns The Grid Connection Point API instance
     */
    public useGridConnectionPoint(): EnergyAppGridConnectionPoint {
        return this.energyAppSdk.useGridConnectionPoint();
    }

    /**
     * Gets the Configuration Manager API for registering internal (non user-facing)
     * package configurations. Configurations are typed as either `number` or
     * `select`, addressed by a unique key, and emit change events when their
     * persisted value is updated.
     * @returns The Configuration Manager API instance
     */
    public useConfigurationManager(): EnergyAppConfigurationManager {
        return this.energyAppSdk.useConfigurationManager();
    }

    /**
     * Gets the Appliance Energy-Manager Forecast API for publishing
     * forecasted command plans per appliance (charger, battery,
     * heatpump). The publisher must hold the `EnergyManager` permission.
     * @returns The Appliance Energy-Manager Forecast API instance
     */
    public useApplianceEnergyManagerForecast(): EnergyAppApplianceEnergyManagerForecast {
        return this.energyAppSdk.useApplianceEnergyManagerForecast();
    }

    /**
     * Gets the Battery API for retrieving the current runtime state of each
     * battery storage (state of charge, stored kWh, average price per kWh,
     * optional solar share). Read-only; query by appliance ID or list all
     * storages.
     * @returns The Battery API instance
     */
    public useBatteries(): EnergyAppBattery {
        return this.energyAppSdk.useBatteries();
    }

    /**
     * Gets the current SDK version.
     * @returns The semantic version string of the SDK
     */
    public getSdkVersion(): string {
        return getSdkVersion();
    }
}
