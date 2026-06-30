export enum EnyoNetworkDeviceDetectedAtEnum {
    Eebus = 'eebus',
    Ocpp = 'ocpp',
    Hostname = 'hostname',
    Modbus = 'modbus',
    Http = 'http',
    Mdns = 'mdns'
}

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
    detectedAt: EnyoNetworkDeviceDetectedAtEnum[];
    /**
     * Structured DNS-SD service data for mDNS-discovered devices, one entry per
     * advertised service type. Populated only for devices found via mDNS
     * (otherwise `undefined`) and refreshed on re-discovery. A host may advertise
     * several service types, so this is an array. Additive to `ports` — existing
     * fields are unchanged.
     */
    mdnsServices?: EnyoMdnsService[];
}

export type EnyoNetworkDeviceAccessStatus = 'granted' | 'denied' | 'pending';

/**
 * One advertised DNS-SD service for an mDNS-discovered device, retained verbatim
 * so partner integrations can read service-specific TXT data (e.g. the
 * Bosch/Buderus heat-pump gateway publishes its OAuth `authport` only in TXT,
 * used to build the token URL `https://<host>:<authport>/auth/token`). `txt`
 * values are kept as raw strings — consumers parse what they need.
 */
export interface EnyoMdnsService {
    /** DNS-SD service type, e.g. `"_gateway-tt-local-api._tcp.local"`. */
    serviceType: string;
    /** DNS-SD instance name, e.g. `"k40rf-101042019"`. */
    instanceName: string;
    /** SRV target host. Optional — currently omitted by core. */
    target?: string;
    /** SRV port (the API port, e.g. 8443). Optional. */
    port?: number;
    /**
     * Full TXT key/value map (e.g. `authport`, `model`, `brand`, `uuid`,
     * `serial`, `txtvers`). Values are raw strings and are not coerced.
     */
    txt: Record<string, string>;
}

/**
 * Represents an open network port on a device.
 */
export interface EnyoNetworkPort {
    /** Port number */
    port: number;
    /** Service name running on the port (if detected) */
    service?: string;
}