/**
 * Closed set of error codes raised by the WiFi API.
 *
 * - `permission_denied`: package is missing the `Wifi` permission.
 * - `adapter_unavailable`: no WiFi adapter is present or the radio is disabled.
 * - `scan_in_progress`: a concurrent scan request was rejected.
 * - `scan_failed`: the underlying WiFi stack reported a failure during scanning.
 * - `timeout`: the scan exceeded its allotted time.
 */
export type EnergyAppWifiErrorCode =
    | 'permission_denied'
    | 'adapter_unavailable'
    | 'scan_in_progress'
    | 'scan_failed'
    | 'timeout';

/**
 * Error subtype thrown by the WiFi API.
 * Always carries a structured {@link EnergyAppWifiErrorCode}; callers
 * should branch on `code` rather than parsing the human-readable message.
 */
export interface EnergyAppWifiError extends Error {
    /** Machine-readable error code. */
    readonly code: EnergyAppWifiErrorCode;
}

/**
 * Security mode advertised by a discovered WiFi network.
 *
 * - `open`: no encryption; the network is unprotected.
 * - `wep`: deprecated WEP encryption.
 * - `wpa`: WPA-Personal (TKIP/AES).
 * - `wpa2`: WPA2-Personal.
 * - `wpa3`: WPA3-Personal.
 * - `wpa2_enterprise`: WPA2-Enterprise (802.1X).
 * - `wpa3_enterprise`: WPA3-Enterprise (802.1X).
 * - `unknown`: the security mode could not be determined from the beacon.
 */
export type EnergyAppWifiSecurity =
    | 'open'
    | 'wep'
    | 'wpa'
    | 'wpa2'
    | 'wpa3'
    | 'wpa2_enterprise'
    | 'wpa3_enterprise'
    | 'unknown';

/**
 * A WiFi network (SSID) discovered during a scan.
 *
 * The shape mirrors what is available in the WiFi beacon/probe response;
 * values that are not present are omitted rather than zeroed.
 */
export interface EnergyAppWifiSsid {
    /**
     * The network name (SSID) as broadcast by the access point.
     * Empty string for hidden networks that do not broadcast their SSID.
     */
    ssid: string;
    /**
     * BSSID of the access point in uppercase, colon-separated form
     * (e.g. "AA:BB:CC:DD:EE:FF"). When multiple APs broadcast the same SSID
     * (roaming), the strongest one is reported.
     */
    bssid?: string;
    /** Last received signal strength indicator in dBm. */
    rssi?: number;
    /** Operating channel number on which the network was observed. */
    channel?: number;
    /** Operating frequency in MHz on which the network was observed. */
    frequencyMhz?: number;
    /** Security mode advertised by the access point. */
    security?: EnergyAppWifiSecurity;
    /**
     * `true` when the network is currently saved/known on the device, meaning
     * credentials are stored and the device can auto-connect.
     */
    known?: boolean;
}

/**
 * Options controlling a single WiFi discovery run.
 */
export interface EnergyAppWifiScanOptions {
    /**
     * Wall-clock duration of the scan in milliseconds. Defaults to 5000;
     * the host caps this value at 30000 to protect the WiFi adapter.
     */
    durationMs?: number;
    /**
     * When `true`, restrict the result to networks that are currently saved
     * on the device (i.e. SSIDs the device has previously joined).
     * Defaults to `false`.
     */
    onlyKnown?: boolean;
}
