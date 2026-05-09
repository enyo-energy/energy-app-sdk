import {EnergyAppInterval} from "./packages/energy-app-interval.js";
import {EnergyAppModbus} from "./packages/energy-app-modbus.js";
import {EnergyAppStorage} from "./packages/energy-app-storage.js";
import {EnergyAppAppliance} from "./packages/energy-app-appliance.js";
import {EnergyAppNetworkDevice} from "./packages/energy-app-network-device.js";
import {EnergyAppDataBus} from "./packages/energy-app-data-bus.js";
import {EnergyAppOcpp} from "./packages/energy-app-ocpp.js";
import {EnergyAppCharge} from "./packages/energy-app-charge.js";
import {EnergyAppVehicle} from "./packages/energy-app-vehicle.js";
import {EnergyAppChargingCard} from "./packages/energy-app-charging-card.js";
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
import {EnergyAppBluetooth} from "./packages/energy-app-bluetooth.js";
import {EnergyAppDiagnostics} from "./packages/energy-app-diagnostics.js";
import {EnergyAppLearningPhase} from "./packages/energy-app-learning-phase.js";

export enum EnergyAppStateEnum {
    Launching = 'launching',
    Running = 'running',
    /** This state tells the user that a configuration is required which blocks the energy app from running*/
    ConfigurationRequired = 'configuration-required',
    /** This state tells the user that an internet connection of the system is required which blocks the energy app from running*/
    InternetConnectionRequired = 'internet-connection-required',
}

/**
 * Main API interface for enyo Energy App packages.
 * Provides access to all system capabilities including lifecycle management,
 * network operations, storage, and device communication.
 */
export interface EnyoEnergyAppSdk {
    /** Register a callback that gets called when the package is initialized */
    register: (callback: (packageName: string, version: number, channel: EnyoPackageChannel, deviceId: string) => void | Promise<void>) => void;
    /** Register a callback that gets called when the system is shutting down */
    onShutdown: (callback: () => void | Promise<void>) => void;
    /** Update the state of the Energy App. Default state set is launching*/
    updateEnergyAppState: (state: EnergyAppStateEnum) => void;
    /** Check if the system is currently online */
    isSystemOnline: () => boolean;
    /** Register a listener that gets called when the network status changes */
    onNetworkStatusChanged: (listener: (online: boolean) => void | Promise<void>) => string;
    /** Get the fetch API for HTTP requests */
    useFetch: () => typeof fetch;
    /** Get the interval management API */
    useInterval: () => EnergyAppInterval;
    /** Get the Modbus communication API */
    useModbus: () => EnergyAppModbus;
    /** Get the network device discovery API */
    useNetworkDevices: () => EnergyAppNetworkDevice;
    /** Get the persistent storage API */
    useStorage: () => EnergyAppStorage;
    /** Get the Appliance API */
    useAppliances: () => EnergyAppAppliance;
    /** Get the Data Bus API */
    useDataBus: () => EnergyAppDataBus;
    /** Get the OCPP API */
    useOcpp: () => EnergyAppOcpp;
    /** Get the Charge API*/
    useCharge: () => EnergyAppCharge;
    /** Get the Vehicle API*/
    useVehicle: () => EnergyAppVehicle;
    /** Get the Charging Card API*/
    useChargingCard: () => EnergyAppChargingCard;
    /** Get the Authentication API */
    useAuthentication: () => EnergyAppAuthentication;
    /** Get the Settings API */
    useSettings: () => EnergyAppSettings;
    /** Get the Electricity Prices API */
    useElectricityPrices: () => EnergyAppEnergyPrices;
    /** Get the Notification API */
    useNotification: () => EnergyAppNotification;
    /** Get the Secret Manager API */
    useSecretManager: () => EnergyAppSecretManager;
    /** Get the Location API */
    useLocation: () => EnergyAppLocation;
    /** Get the Onboarding API */
    useOnboarding: () => EnergyAppOnboarding;
    /** Get the Timeseries API for querying historical energy data */
    useTimeseries: () => EnergyAppTimeseries;
    /** Get the Energy Manager API for retrieving energy manager info and capabilities */
    useEnergyManager: () => EnergyAppEnergyManager;
    /** Get the Electricity Tariff API for managing electricity tariffs */
    useElectricityTariff: () => EnergyAppElectricityTariff;
    /** Get the Weather Forecasting API for managing weather forecast providers and retrieving weather forecasts */
    useWeatherForecasting: () => EnergyAppWeatherForecasting;
    /** Get the PV Forecasting API for managing PV forecast providers and retrieving PV forecasts */
    usePvForecasting: () => EnergyAppPvForecasting;
    /** Get the PV System API for managing PV system registrations and configurations */
    usePvSystem: () => EnergyAppPvSystem;
    /** Get the Sequence Generator API for generating unique sequential numbers per named sequence */
    useSequenceGenerator: () => EnergyAppSequenceGenerator;
    /** Get the Modbus RTU serial communication API */
    useModbusRtu: () => EnergyAppModbusRtu;
    /** Get the EEbus SHIP/SPINE communication API for device pairing, data access, and power management */
    useEebus: () => EnergyAppEebus;
    /** Get the MQTT communication API for connecting to internal or external MQTT brokers */
    useMqtt: () => EnergyAppMqtt;
    /** Get the Bluetooth Low Energy API for scanning and GATT communication with peripherals */
    useBluetooth: () => EnergyAppBluetooth;
    /** Get the Diagnostics API for submitting energy manager diagnostics data */
    useDiagnostics: () => EnergyAppDiagnostics;
    /** Get the Learning Phase API for registering and tracking learning phases */
    useLearningPhase: () => EnergyAppLearningPhase;
}