import {EnyoNetworkDevice, EnyoNetworkDeviceAccessStatus} from "../types/enyo-network-device.js";

/**
 * Interface for network device discovery and management in enyo packages.
 * Provides functionality to detect and interact with devices on the local network.
 */
export interface EnergyAppNetworkDevice {
    /** Get list of all previously detected network devices */
    getDevices: (filter?: { accessStatus?: EnyoNetworkDeviceAccessStatus }) => Promise<EnyoNetworkDevice[]>;
    /** Get a specific device by its unique ID */
    getDevice: (deviceId: string) => Promise<EnyoNetworkDevice | null>;
    /** Trigger an asynchronous search for new devices on the network */
    searchDevices: () => Promise<EnyoNetworkDevice[]>;
    /** Trigger an async request to the user to accept or reject a network device access request. Ports are optional */
    requestDeviceAccess: (deviceId: string, ports?: number[]) => Promise<{ status: EnyoNetworkDeviceAccessStatus }>;
    /** listen for device access changes. Returns a listener id */
    listenForDeviceAccessChange: (listener: (deviceId: string, status: EnyoNetworkDeviceAccessStatus) => void) => string;
    /** listen for detected devices, based on the device definition in the energy app package definition */
    listenForDetectedDevice: (listener: (detectedDevices: EnyoNetworkDevice[]) => void) => string;
    /** Removes the listener */
    removeListener: (listenerId: string) => void;
}