/**
 * Represents a detected network device with its connectivity information.
 */
export interface EnyoNetworkDevice {
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
    ports?: EnyoNetworkPort[];
    /** Access status for the device */
    accessStatus: EnyoNetworkDeviceAccessStatus | undefined;
}

export type EnyoNetworkDeviceAccessStatus = 'granted' | 'denied' | 'pending';

/**
 * Represents an open network port on a device.
 */
export interface EnyoNetworkPort {
    /** Port number */
    port: number;
    /** Service name running on the port (if detected) */
    service?: string;
}