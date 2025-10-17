import {HemsOneNetworkDevice} from "../types/hems-one-network-device.js";

/**
 * Interface for network device discovery and management in HEMS one packages.
 * Provides functionality to detect and interact with devices on the local network.
 */
export interface EnergyAppNetworkDevice {
    /** Get list of all previously detected network devices */
    getDetectedDevices: () => Promise<HemsOneNetworkDevice[]>;
    /** Get a specific device by its unique ID */
    getDevice: (deviceId: string) => Promise<HemsOneNetworkDevice | null>;
    /** Trigger an asynchronous search for new devices on the network */
    searchDevices: () => Promise<HemsOneNetworkDevice[]>;
}