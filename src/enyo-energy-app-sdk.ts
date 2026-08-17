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
import {EnergyAppDynamicPriceForecast} from "./packages/energy-app-dynamic-price-forecast.js";
import {EnergyAppPvSystem} from "./packages/energy-app-pv-system.js";
import {EnergyAppSequenceGenerator} from "./packages/energy-app-sequence-generator.js";
import {EnergyAppModbusRtu} from "./packages/energy-app-modbus-rtu.js";
import {EnergyAppModbusServer} from "./packages/energy-app-modbus-server.js";
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
import {EnergyAppFile} from "./packages/energy-app-file.js";
import {EnergyAppFirmwareRegistry} from "./packages/energy-app-firmware-registry.js";
import {EnergyAppAutomation} from "./packages/energy-app-automation.js";
import {EnergyAppSavings} from "./packages/energy-app-savings.js";
import {EnergyAppDeviceTest} from "./packages/energy-app-device-test.js";
import {EnergyAppEpexSpotPrice} from "./packages/energy-app-epex-spot-price.js";
import {UseFetchOptions} from "./types/enyo-fetch.js";

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
    /** health check - returns the current date to check if alive */
    healthcheck: () => Date;
    /** Register a callback that gets called when the system is shutting down */
    onShutdown: (callback: () => void | Promise<void>) => void;
    /** Update the state of the Energy App. Default state set is launching*/
    updateEnergyAppState: (state: EnergyAppStateEnum) => void;
    /** Check if the system is currently online */
    isSystemOnline: () => boolean;
    /** Register a listener that gets called when the network status changes */
    onNetworkStatusChanged: (listener: (online: boolean) => void | Promise<void>) => string;
    /** Get the fetch API for HTTP requests, optionally configured with TLS options */
    useFetch: (options?: UseFetchOptions) => typeof fetch;
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
    /** Get the Dynamic Price Forecast API for publishing and consuming forward-looking electricity price forecasts */
    useDynamicPriceForecast: () => EnergyAppDynamicPriceForecast;
    /** Get the PV System API for managing PV system registrations and configurations */
    usePvSystem: () => EnergyAppPvSystem;
    /** Get the Sequence Generator API for generating unique sequential numbers per named sequence */
    useSequenceGenerator: () => EnergyAppSequenceGenerator;
    /** Get the Modbus RTU serial communication API */
    useModbusRtu: () => EnergyAppModbusRtu;
    /** Get the Modbus server API for serving registers to Modbus clients */
    useModbusServer: () => EnergyAppModbusServer;
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
    /** Get the WiFi API for scanning and listing known SSIDs */
    useWifi: () => EnergyAppWifi;
    /** Get the UDP communication API for binding sockets and exchanging datagrams */
    useUdp: () => EnergyAppUdp;
    /** Get the Grid Connection Point API for retrieving fuse rating, phase count, and power limit of the site's grid connection */
    useGridConnectionPoint: () => EnergyAppGridConnectionPoint;
    /** Get the Configuration Manager API for registering internal (non user-facing) package configurations with change notifications */
    useConfigurationManager: () => EnergyAppConfigurationManager;
    /** Get the Appliance Energy-Manager Forecast API for publishing forecasted command plans per appliance (charger, battery, heatpump) */
    useApplianceEnergyManagerForecast: () => EnergyAppApplianceEnergyManagerForecast;
    /** Get the Battery API for retrieving the current runtime state of each battery storage (SoC, stored kWh, average price per kWh, optional solar share) */
    useBatteries: () => EnergyAppBattery;
    /** Get the File API for providing user-facing files whose translated names/explanations are shown by the host and whose content is produced on demand when the user stores them */
    useFiles: () => EnergyAppFile;
    /** Get the Firmware Registry API for resolving the next firmware step for a device and requesting signed download URLs for the firmware images published with the package */
    useFirmwareRegistry: () => EnergyAppFirmwareRegistry;
    /** Get the Automation API for reading user-configured automations and (with EnergyManager permission) registering triggers, reporting trigger state, and publishing automation forecasts */
    useAutomations: () => EnergyAppAutomation;
    /** Get the Savings API for publishing day-scoped savings reports and reading back which days were already reported */
    useSavings: () => EnergyAppSavings;
    /** Get the Device Test API for answering the host's requests to test detected network devices and report whether appliances were found or created */
    useDeviceTest: () => EnergyAppDeviceTest;
    /** Get the EPEX SPOT Price API for reading the cleared day-ahead wholesale electricity prices that apply to this device */
    useEpexSpotPrices: () => EnergyAppEpexSpotPrice;
}