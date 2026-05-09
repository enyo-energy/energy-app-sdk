/**
 * Filter clause applied during a Bluetooth scan.
 * The clauses inside this object are OR-combined: a device matches when at
 * least one populated clause matches its advertisement. An empty filter
 * (no populated clauses) returns every advertised device.
 */
export interface EnergyAppBluetoothScanFilter {
    /**
     * Match if any advertised GATT service UUID is in this list.
     * Comparison is case-insensitive.
     */
    serviceUuids?: string[];
    /** Match if any of the advertised manufacturer IDs is in this list. */
    manufacturerIds?: number[];
    /** Match if the BLE local name starts with this prefix (case-sensitive). */
    namePrefix?: string;
}

/**
 * Options controlling a single Bluetooth discovery run.
 */
export interface EnergyAppBluetoothScanOptions {
    /**
     * Wall-clock duration of the scan in milliseconds. Defaults to 5000;
     * the host caps this value at 15000 to protect the HCI controller.
     */
    durationMs?: number;
    /**
     * Optional filter narrowing which advertisements are returned. When
     * omitted or empty, every advertised device is returned.
     */
    filter?: EnergyAppBluetoothScanFilter;
}

/**
 * A device discovered during a Bluetooth scan.
 *
 * The shape mirrors what is available in the BLE advertisement; values that
 * are not present in the advertisement are omitted rather than zeroed.
 */
export interface EnergyAppBluetoothDevice {
    /**
     * Uppercase, colon-separated MAC address (e.g. "AA:BB:CC:DD:EE:FF").
     * Use this value as the `address` argument to {@link EnergyAppBluetooth.connect}
     * or {@link EnergyAppBluetooth.withDevice}.
     */
    address: string;
    /** BLE local name (advertised). May be undefined for nameless beacons. */
    name?: string;
    /** Last received signal strength indicator in dBm. */
    rssi?: number;
    /**
     * Manufacturer-specific advertisement data, keyed by manufacturer ID.
     * Values are the raw bytes as advertised.
     */
    manufacturerData?: Record<number, Uint8Array>;
    /** Advertised service UUIDs in lowercase. */
    serviceUuids?: string[];
}

/**
 * Options applied when opening a GATT connection to a peripheral.
 */
export interface EnergyAppBluetoothConnectOptions {
    /**
     * Maximum total time (milliseconds) to spend on the BlueZ `Connect` call
     * plus `ServicesResolved`. Defaults to 15000.
     */
    timeoutMs?: number;
}

/**
 * Closed set of error codes raised by the Bluetooth API.
 *
 * - `permission_denied`: package is missing the `Bluetooth` permission.
 * - `controller_unavailable`: BlueZ is down or the HCI device is not up.
 * - `scan_in_progress`: a concurrent scan request was rejected.
 * - `not_connected`: a GATT operation was issued on a stale session.
 * - `service_not_found`: the requested service UUID could not be resolved.
 * - `characteristic_not_found`: the characteristic UUID could not be resolved.
 * - `authentication_required`: the characteristic requires pairing/encryption.
 * - `timeout`: an operation exceeded its allotted time.
 * - `invalid_address`: the MAC address argument is malformed.
 */
export type EnergyAppBluetoothErrorCode =
    | 'permission_denied'
    | 'controller_unavailable'
    | 'scan_in_progress'
    | 'not_connected'
    | 'service_not_found'
    | 'characteristic_not_found'
    | 'authentication_required'
    | 'timeout'
    | 'invalid_address';

/**
 * Error subtype thrown by the Bluetooth API.
 * Always carries a structured {@link EnergyAppBluetoothErrorCode}; callers
 * should branch on `code` rather than parsing the human-readable message.
 */
export interface EnergyAppBluetoothError extends Error {
    /** Machine-readable error code. */
    readonly code: EnergyAppBluetoothErrorCode;
    /**
     * MAC address of the device the failed operation targeted, when relevant.
     * Omitted for errors that are not tied to a specific device (e.g.
     * `controller_unavailable`).
     */
    readonly address?: string;
}
