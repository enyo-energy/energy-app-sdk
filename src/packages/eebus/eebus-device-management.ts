import {
    EebusConnectionStatusEnum,
    EebusDevice,
    EebusDiscoveredDevice,
    EebusPeerManufacturerData,
} from '../../types/enyo-eebus.js';

/**
 * SHIP-level device lifecycle management for EEbus devices.
 *
 * Handles discovery, pairing (trust establishment), connection control, and
 * connection-status observation. This interface is concerned only with the
 * underlying SHIP transport — application-level interactions (identity,
 * use cases) live in {@link EebusIdentityService} and {@link EebusUseCaseRegistry}.
 *
 * @example
 * ```typescript
 * const eebus = energyApp.useEebus();
 *
 * const discovered = await eebus.devices.getDiscoveredDevices();
 * const device = await eebus.devices.pairDevice(discovered[0].ski);
 * await eebus.devices.connect(device.ski);
 *
 * const listenerId = eebus.devices.listenForConnectionStatusChange((ski, status) => {
 *   console.log(`${ski} → ${status}`);
 * });
 * ```
 */
export interface EebusDeviceManagement {
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
     * Read the cached `DeviceClassification.ManufacturerData` payload
     * the peer published after the SHIP handshake — the compact
     * identity record vendor packages need to gate vendor-specific
     * behaviour (e.g. enabling partial LoadControl writes on Vaillant
     * VR940 firmware).
     *
     * Synchronous on the wire — the lib auto-fetches the payload after
     * connect and surfaces the cached value here. Returns:
     * - the populated record once the peer has answered the post-handshake fetch
     * - `null` when the peer is paired but has not answered the fetch yet
     * - `undefined` when the SDK has no record of the peer (never paired or fully forgotten)
     *
     * The async wrapper is preserved for symmetry with the other
     * `EebusDeviceManagement` methods; the result resolves immediately
     * from the cached snapshot.
     *
     * Prefer this over reaching for {@link EebusIdentityService.get}
     * when all you need is vendor sniffing — it avoids waking the full
     * identity pipeline and keeps vendor matching at the consumer
     * boundary.
     *
     * @param ski Subject Key Identifier of the remote node
     */
    getPeerManufacturerData: (ski: string) => Promise<EebusPeerManufacturerData | null | undefined>;

    /**
     * Register a listener for connection status changes of EEbus devices.
     * The listener is invoked whenever any paired device's connection status changes.
     * @param listener Callback invoked with the device SKI and its new connection status
     * @returns Listener ID that can be passed to {@link removeListener} to stop listening
     */
    listenForConnectionStatusChange: (
        listener: (ski: string, status: EebusConnectionStatusEnum) => void
    ) => string;

    /**
     * Remove a connection-status listener previously registered via
     * {@link listenForConnectionStatusChange}.
     * @param listenerId The ID returned by the registration method
     */
    removeListener: (listenerId: string) => void;
}
