import {
    EebusConnectionStatusEnum,
    EebusDataPoint,
    EebusDevice,
    EebusDeviceDetails,
    EebusDiscoveredDevice,
    EebusFeatureTypeEnum,
    EebusPowerLimit,
} from "../types/enyo-eebus.js";

/**
 * Interface for EEbus (SHIP/SPINE) device communication in enyo packages.
 *
 * Provides three layers of API:
 * - **Device Management**: Pairing, connecting, and managing EEbus devices
 * - **Low-Level API**: Direct SPINE feature data read/write/subscribe operations
 * - **High-Level API**: Convenient methods for common energy use cases (power consumption, power limits, device details)
 *
 * The high-level API supports both directions of communication:
 * - **Energy Manager role**: Reads power consumption from appliances and sends power limit commands
 * - **Appliance role**: Receives power limit commands and provides power consumption data via registered handlers
 *
 * @example
 * ```typescript
 * const eebus = energyApp.useEebus();
 *
 * // Discover and pair a device
 * const discovered = await eebus.getDiscoveredDevices();
 * const device = await eebus.pairDevice(discovered[0].ski);
 *
 * // Connect and read power (Energy Manager role)
 * await eebus.connect(device.ski);
 * const watts = await eebus.getPowerConsumption(device.ski);
 *
 * // Receive power limits (Appliance role)
 * eebus.onPowerLimitReceived((ski, limit) => {
 *   console.log(`Received limit: ${limit.watts}W from ${ski}`);
 * });
 * ```
 */
export interface EnergyAppEebus {

    // ─── Device Management ───────────────────────────────────────────

    /**
     * Get all devices that have been successfully paired (trusted).
     * @returns Array of paired EEbus devices with their current connection status
     */
    getPairedDevices: () => Promise<EebusDevice[]>;

    /**
     * Get devices currently visible on the network that have not yet been paired.
     * Uses mDNS discovery to find EEbus-capable devices.
     * @returns Array of discovered but unpaired EEbus devices
     */
    getDiscoveredDevices: () => Promise<EebusDiscoveredDevice[]>;

    /**
     * Initiate the EEbus pairing (trust) handshake with a device identified by its SKI.
     * The device must have been previously discovered via {@link getDiscoveredDevices}.
     * @param ski Subject Key Identifier of the device to pair with
     * @returns The newly paired device
     */
    pairDevice: (ski: string) => Promise<EebusDevice>;

    /**
     * Remove the trust relationship and delete stored connection information for a paired device.
     * If the device is currently connected, it will be disconnected first.
     * @param ski Subject Key Identifier of the device to unpair
     */
    unpairDevice: (ski: string) => Promise<void>;

    /**
     * Establish an active SHIP connection to an already-paired device.
     * The device must have been previously paired via {@link pairDevice}.
     * @param ski Subject Key Identifier of the device to connect to
     */
    connect: (ski: string) => Promise<void>;

    /**
     * Safely disconnect from a currently connected device.
     * @param ski Subject Key Identifier of the device to disconnect from
     */
    disconnect: (ski: string) => Promise<void>;

    /**
     * Check the current connection status of a device.
     * @param ski Subject Key Identifier of the device to check
     * @returns The current connection status (Connected, Disconnected, or Connecting)
     */
    getConnectionStatus: (ski: string) => Promise<EebusConnectionStatusEnum>;

    /**
     * Register a listener for connection status changes of EEbus devices.
     * The listener is invoked whenever any paired device's connection status changes.
     * @param listener Callback invoked with the device SKI and its new connection status
     * @returns Listener ID that can be passed to {@link removeListener} to stop listening
     */
    listenForConnectionStatusChange: (
        listener: (ski: string, status: EebusConnectionStatusEnum) => void
    ) => string;

    // ─── Low-Level API ───────────────────────────────────────────────

    /**
     * Read specific data points from a device's SPINE feature.
     * @param ski Subject Key Identifier of the target device
     * @param featureType The SPINE feature type to read from
     * @param functionName The specific function or data set to read (e.g. "measurementListData")
     * @returns The data point containing the value, timestamp, and optional unit
     */
    readData: (
        ski: string,
        featureType: EebusFeatureTypeEnum,
        functionName: string
    ) => Promise<EebusDataPoint>;

    /**
     * Write data or send a command to a device's SPINE feature.
     * @param ski Subject Key Identifier of the target device
     * @param featureType The SPINE feature type to write to
     * @param functionName The specific function or command to invoke (e.g. "loadControlLimitListData")
     * @param payload The data payload to send
     */
    writeData: (
        ski: string,
        featureType: EebusFeatureTypeEnum,
        functionName: string,
        payload: unknown
    ) => Promise<void>;

    /**
     * Subscribe to automatic notifications when a SPINE feature's data changes on the remote device.
     * Sets up a SPINE binding so the local device is notified whenever the subscribed data changes.
     * @param ski Subject Key Identifier of the target device
     * @param featureType The SPINE feature type to subscribe to
     * @param listener Callback invoked with updated data whenever the value changes
     * @returns Listener ID that can be passed to {@link removeListener} to cancel the subscription
     */
    subscribe: (
        ski: string,
        featureType: EebusFeatureTypeEnum,
        listener: (data: EebusDataPoint) => void
    ) => string;

    // ─── High-Level API ──────────────────────────────────────────────

    /**
     * Get the current active power consumption of a remote device in Watts.
     * Reads the Measurement feature (SPINE) for active power data.
     * Intended for the **energy manager role** — reading consumption from a remote appliance.
     * @param ski Subject Key Identifier of the target device
     * @returns Current power consumption in Watts
     */
    getPowerConsumption: (ski: string) => Promise<number>;

    /**
     * Send a power limit command to a consumer device (e.g. a wallbox).
     * Uses the LoadControl feature (SPINE) to set consumption limits.
     * Intended for the **energy manager role** — sending limits to a remote appliance.
     * @param ski Subject Key Identifier of the target device
     * @param limit The power limit to apply, including watts and optional duration
     *
     * @example
     * ```typescript
     * // Limit a wallbox to 11kW
     * await eebus.setPowerLimit(wallboxSki, { watts: 11000 });
     *
     * // Temporary limit for 30 minutes
     * await eebus.setPowerLimit(wallboxSki, { watts: 6000, durationSeconds: 1800 });
     * ```
     */
    setPowerLimit: (ski: string, limit: EebusPowerLimit) => Promise<void>;

    /**
     * Get detailed device information including manufacturer, model, and serial number.
     * Reads the DeviceClassification feature (SPINE).
     * @param ski Subject Key Identifier of the target device
     * @returns Device classification details
     */
    getDeviceDetails: (ski: string) => Promise<EebusDeviceDetails>;

    /**
     * Register a handler for incoming power limit commands (appliance role).
     * When this device acts as an appliance, a remote energy manager may send
     * power limit commands via LoadControl. This handler is invoked for each incoming command.
     * @param handler Callback invoked with the sender's SKI and the power limit received
     * @returns Listener ID that can be passed to {@link removeListener} to deregister the handler
     *
     * @example
     * ```typescript
     * eebus.onPowerLimitReceived((ski, limit) => {
     *   console.log(`Energy manager ${ski} requests limit: ${limit.watts}W`);
     *   applyChargingLimit(limit.watts);
     * });
     * ```
     */
    onPowerLimitReceived: (
        handler: (ski: string, limit: EebusPowerLimit) => void
    ) => string;

    /**
     * Register a handler to provide power consumption data on request (appliance role).
     * When this device acts as an appliance, a remote energy manager may request
     * the current power consumption. The handler should return the current value in Watts.
     * @param handler Async callback invoked with the requester's SKI, returning power in Watts
     * @returns Listener ID that can be passed to {@link removeListener} to deregister the handler
     *
     * @example
     * ```typescript
     * eebus.onPowerConsumptionRequested(async (ski) => {
     *   return getCurrentChargingPowerWatts();
     * });
     * ```
     */
    onPowerConsumptionRequested: (
        handler: (ski: string) => Promise<number>
    ) => string;

    // ─── Listener Management ─────────────────────────────────────────

    /**
     * Remove a previously registered listener, subscription, or handler.
     * Works for IDs returned by {@link listenForConnectionStatusChange}, {@link subscribe},
     * {@link onPowerLimitReceived}, and {@link onPowerConsumptionRequested}.
     * @param listenerId The ID returned by the registration method
     */
    removeListener: (listenerId: string) => void;
}
