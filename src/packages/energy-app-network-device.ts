import {HemsOneNetworkDevice, HemsOneNetworkDeviceAccessStatus} from "../types/hems-one-network-device.js";

/**
 * Interface for network device discovery and management in HEMS one packages.
 * Provides functionality to detect and interact with devices on the local network.
 */
export interface EnergyAppNetworkDevice {
    /** Get list of all previously detected network devices */
    getDevices: (filter?: { accessStatus?: HemsOneNetworkDeviceAccessStatus }) => Promise<HemsOneNetworkDevice[]>;
    /** Get a specific device by its unique ID */
    getDevice: (deviceId: string) => Promise<HemsOneNetworkDevice | null>;
    /** Trigger an asynchronous search for new devices on the network */
    searchDevices: () => Promise<HemsOneNetworkDevice[]>;
    /** Trigger an async request to the user to accept or reject a network device access request. Ports are optional */
    requestDeviceAccess: (deviceId: string, ports?: number[]) => Promise<{ status: HemsOneNetworkDeviceAccessStatus }>;
    /** listen for device access changes. Returns a listener id */
    listenForDeviceAccessChange: (listener: (deviceId: string, status: HemsOneNetworkDeviceAccessStatus) => void) => string;
    /** Removes the listener */
    removeDeviceAccessChangeListener: (listenerId: string) => void;
}