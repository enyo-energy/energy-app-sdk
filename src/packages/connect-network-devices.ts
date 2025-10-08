export interface NetworkDevice {
    id: string;
    hostname: string;
    ipAddress: string;
    macAddress?: string;
    isOnline: boolean;
    lastSeen: Date;
    ports?: NetworkPort[];
}

export interface NetworkPort {
    port: number;
    service?: string;
}

export interface ConnectNetworkDevices {
    // Get list of all detected network devices
    getDetectedDevices: () => Promise<NetworkDevice[]>;
    // Get a specific device by ID
    getDevice: (deviceId: string) => Promise<NetworkDevice | null>;
    // Trigger async search for devices
    searchDevices: () => Promise<NetworkDevice[]>;
}