import {ConnectInterval} from "./packages/connect-interval.js";
import {ConnectModbus} from "./packages/connect-modbus.js";
import {ConnectNetworkDevices} from "./packages/connect-network-devices.js";
import {ConnectStorage} from "./packages/connect-storage.js";
import {ConnectAppliances} from "./packages/connect-appliance.js";

/**
 * Main API interface for Connect EMS packages.
 * Provides access to all system capabilities including lifecycle management,
 * network operations, storage, and device communication.
 */
export interface ConnectEmsApi {
    /** Register a callback that gets called when the package is initialized */
    register: (callback: (packageName: string, version: number) => void) => void;
    /** Register a callback that gets called when the system is shutting down */
    onShutdown: (callback: () => Promise<void>) => void;
    /** Check if the system is currently online */
    isOnline: () => boolean;
    /** Get the fetch API for HTTP requests */
    useFetch: () => typeof fetch;
    /** Get the interval management API */
    useInterval: () => ConnectInterval;
    /** Get the Modbus communication API */
    useModbus: () => ConnectModbus;
    /** Get the network device discovery API */
    useNetworkDevices: () => ConnectNetworkDevices;
    /** Get the persistent storage API */
    useStorage: () => ConnectStorage;
    /** Get the Appliance API */
    useAppliances: () => ConnectAppliances;
}