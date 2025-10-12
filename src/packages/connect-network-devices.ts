/**
 * Represents a detected network device with its connectivity information.
 */
export interface NetworkDevice {
    /** Unique identifier for the device */
    id: string;
    /** Network hostname of the device */
    hostname: string;
    /** IP address of the device */
    ipAddress: string;
    /** MAC address of the device (if available) */
    macAddress?: string;
    /** Whether the device is currently online */
    isOnline: boolean;
    /** Timestamp when the device was last seen */
    lastSeen: Date;
    /** List of open network ports on the device */
    ports?: NetworkPort[];
}

/**
 * Represents an open network port on a device.
 */
export interface NetworkPort {
    /** Port number */
    port: number;
    /** Service name running on the port (if detected) */
    service?: string;
}

/**
 * Interface for network device discovery and management in Connect EMS packages.
 * Provides functionality to detect and interact with devices on the local network.
 */
export interface ConnectNetworkDevices {
    /** Get list of all previously detected network devices */
    getDetectedDevices: () => Promise<NetworkDevice[]>;
    /** Get a specific device by its unique ID */
    getDevice: (deviceId: string) => Promise<NetworkDevice | null>;
    /** Trigger an asynchronous search for new devices on the network */
    searchDevices: () => Promise<NetworkDevice[]>;
}