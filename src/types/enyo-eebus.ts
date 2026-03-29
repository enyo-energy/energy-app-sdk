/**
 * Enum representing the connection status of an EEbus device.
 */
export enum EebusConnectionStatusEnum {
    /** The device is actively connected via SHIP */
    Connected = 'connected',
    /** The device is not connected */
    Disconnected = 'disconnected',
    /** A SHIP connection is currently being established */
    Connecting = 'connecting',
}

/**
 * Enum representing EEbus SPINE feature types for low-level data access.
 * These map to the functional model feature types defined in the SPINE specification.
 */
export enum EebusFeatureTypeEnum {
    /** Device manufacturer, model, serial number */
    DeviceClassification = 'DeviceClassification',
    /** Device operational state and diagnostics */
    DeviceDiagnosis = 'DeviceDiagnosis',
    /** Electrical connection parameters (voltage, current, power limits) */
    ElectricalConnection = 'ElectricalConnection',
    /** Measurement data (power, energy, temperature) */
    Measurement = 'Measurement',
    /** Load control limits and obligations */
    LoadControl = 'LoadControl',
    /** Device configuration key-value pairs */
    DeviceConfiguration = 'DeviceConfiguration',
    /** Device and entity identification */
    Identification = 'Identification',
}

/**
 * Represents an EEbus device that has been successfully paired (trusted).
 */
export interface EebusDevice {
    /** Subject Key Identifier — unique cryptographic identifier for the device */
    ski: string;
    /** Human-readable device name */
    deviceName: string;
    /** Device brand or model description, if available */
    deviceModel?: string;
    /** Current connection status of the device */
    connectionStatus: EebusConnectionStatusEnum;
    /** Timestamp of when the pairing (trust) was established */
    pairedAt: Date;
    /** Timestamp of the last successful communication with the device */
    lastSeen?: Date;
}

/**
 * Represents a device discovered on the network via mDNS that has not yet been paired.
 */
export interface EebusDiscoveredDevice {
    /** Subject Key Identifier — unique cryptographic identifier for the device */
    ski: string;
    /** Human-readable device name advertised during discovery */
    deviceName?: string;
    /** IP address or hostname of the device */
    host: string;
    /** Port number for the SHIP connection */
    port: number;
}

/**
 * Detailed device information retrieved from the EEbus Device Classification feature.
 */
export interface EebusDeviceDetails {
    /** Device manufacturer name */
    manufacturer?: string;
    /** Device model name */
    model?: string;
    /** Device serial number */
    serialNumber?: string;
    /** Firmware or software version of the device */
    softwareVersion?: string;
    /** Hardware version of the device */
    hardwareVersion?: string;
    /** Device type description */
    deviceType?: string;
}

/**
 * Represents a data point read from an EEbus device via the low-level SPINE API.
 */
export interface EebusDataPoint {
    /** The value of the data point */
    value: unknown;
    /** Timestamp when the value was read or last updated */
    timestamp: Date;
    /** Unit of measurement, if applicable (e.g. "W", "Wh", "°C") */
    unit?: string;
}

/**
 * Represents a power limit command to be sent to or received from an EEbus device.
 */
export interface EebusPowerLimit {
    /** Power limit in Watts */
    watts: number;
    /** Whether this limit is an obligation (true) or a recommendation (false). Defaults to true. */
    isObligatory?: boolean;
    /** Duration in seconds for which the limit applies. 0 or undefined means indefinite. */
    durationSeconds?: number;
}
