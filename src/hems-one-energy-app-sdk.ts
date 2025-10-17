import {EnergyAppInterval} from "./packages/energy-app-interval.js";
import {EnergyAppModbus} from "./packages/energy-app-modbus.js";
import {HemsOneNetworkDevice} from "./packages/hems-one-network-device.js";
import {EnergyAppStorage} from "./packages/energy-app-storage.js";
import {HemsOneAppliances} from "./packages/connect-appliance.js";

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
    /** Check if the system is currently online */
    isOnline: () => boolean;
    /** Get the fetch API for HTTP requests */
    useFetch: () => typeof fetch;
    /** Get the interval management API */
    useInterval: () => EnergyAppInterval;
    /** Get the Modbus communication API */
    useModbus: () => EnergyAppModbus;
    /** Get the network device discovery API */
    useNetworkDevices: () => HemsOneNetworkDevice;
    /** Get the persistent storage API */
    useStorage: () => EnergyAppStorage;
    /** Get the Appliance API */
    useAppliances: () => HemsOneAppliances;
}