import {EnergyAppInterval} from "./packages/energy-app-interval.js";
import {EnergyAppModbus} from "./packages/energy-app-modbus.js";
import {EnergyAppStorage} from "./packages/energy-app-storage.js";
import {EnergyAppAppliance} from "./packages/energy-app-appliance.js";
import {EnergyAppNetworkDevice} from "./packages/energy-app-network-device.js";
import {EnergyAppDataBus} from "./packages/energy-app-data-bus.js";
import {EnergyAppOcpp} from "./packages/energy-app-ocpp.js";

export enum EnergyAppStateEnum {
    Launching = 'launching',
    Running = 'running',
    /** This state tells the user that a configuration is required which blocks the energy app from running*/
    ConfigurationRequired = 'configuration-required',
    /** This state tells the user that an internet connection of the system is required which blocks the energy app from running*/
    InternetConnectionRequired = 'internet-connection-required',
}

/**
 * Main API interface for HEMS One Energy App packages.
 * Provides access to all system capabilities including lifecycle management,
 * network operations, storage, and device communication.
 */
export interface HemsOneEnergyAppSdk {
    /** Register a callback that gets called when the package is initialized */
    register: (callback: (packageName: string, version: number) => void) => void;
    /** Register a callback that gets called when the system is shutting down */
    onShutdown: (callback: () => Promise<void>) => void;
    /** Update the state of the Energy App. Default state set is launching*/
    updateEnergyAppState: (state: EnergyAppStateEnum) => void;
    /** Check if the system is currently online */
    isSystemOnline: () => boolean;
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
}