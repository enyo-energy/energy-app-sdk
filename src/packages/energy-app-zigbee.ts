import {
    EnyoZigbeeAttributeRecord,
    EnyoZigbeeCommandResult,
    EnyoZigbeeConfigureReportingRequest,
    EnyoZigbeeDevice,
    EnyoZigbeeDeviceUpdate,
    EnyoZigbeeMessage,
    EnyoZigbeeMessageFilter,
    EnyoZigbeePairingStatus,
    EnyoZigbeeReadAttributesRequest,
    EnyoZigbeeRemoveDeviceOptions,
    EnyoZigbeeSendCommandRequest,
    EnyoZigbeeStartPairingOptions,
    EnyoZigbeeWriteAttributesRequest,
} from "../types/enyo-zigbee.js";

/**
 * Zigbee API for enyo packages.
 *
 * The host owns the Zigbee coordinator and the network it forms; this API lets
 * an app bring new devices into that network, manage the devices it owns, and
 * exchange ZCL data with them so it can translate it to data bus values.
 *
 * Not every enyo box has a Zigbee radio — check
 * {@link EnergyApp.isZigbeeSupported} before relying on this API.
 *
 * **Permissions.** Every method requires the `Zigbee` permission. Opening the
 * network for new devices ({@link startPairing} / {@link stopPairing})
 * additionally requires `ZigbeePairing`, because an open network lets *any*
 * device in range join the customer's home.
 *
 * **Ownership.** A device belongs to the app that brought it into the network:
 * the app whose onboarding run paired it (see
 * `EnyoOnboardingV2ZigbeePairingBlock`), or the app that called
 * {@link startPairing} while it joined. {@link getDevices}, the listeners and
 * all data-access methods only ever see the app's own devices.
 *
 * @example
 * ```ts
 * if (!(await energyApp.isZigbeeSupported())) return;
 * const zigbee = energyApp.useZigbee();
 *
 * // Take over newly joined smart plugs
 * zigbee.listenForDeviceJoined(async (device) => {
 *     const applianceId = await createSmartPlugAppliance(device);
 *     await zigbee.updateDevice(device.ieeeAddress, {applianceId});
 *     await zigbee.configureReporting(device.ieeeAddress, {
 *         endpoint: 1,
 *         cluster: EnyoZigbeeClusterIdEnum.ElectricalMeasurement,
 *         attributes: [{
 *             attributeId: 0x050B, // ActivePower
 *             dataType: EnyoZigbeeDataTypeEnum.Int16,
 *             minIntervalSeconds: 5,
 *             maxIntervalSeconds: 60,
 *             reportableChange: 5,
 *         }],
 *     });
 * });
 *
 * // Translate reports to data bus values
 * zigbee.listenForMessages((message) => {
 *     if (message.type !== EnyoZigbeeMessageTypeEnum.AttributeReport) return;
 *     publishToDataBus(message);
 * }, {clusters: [EnyoZigbeeClusterIdEnum.ElectricalMeasurement]});
 *
 * // Switch the plug on
 * await zigbee.sendCommand('0x00124b0012345678', {
 *     endpoint: 1,
 *     cluster: EnyoZigbeeClusterIdEnum.OnOff,
 *     commandId: 0x01,
 * });
 * ```
 */
export interface EnergyAppZigbee {
    // -----------------------------------------------------------------------
    // Pairing
    // -----------------------------------------------------------------------

    /**
     * Open the Zigbee network so new devices can join (permit join).
     *
     * Devices that join while the network is open belong to this app and are
     * delivered to {@link listenForDeviceJoined} once their interview has
     * finished. Calling it while pairing is already open extends the window.
     *
     * Prefer the onboarding pairing block for installer-facing flows — it opens
     * and closes the network around a screen of its own. Use this method for
     * pairing started from the app's own settings.
     *
     * @param options - How long the network stays open; see {@link EnyoZigbeeStartPairingOptions}.
     * @returns The pairing status after opening the network.
     * @throws {EnergyAppPermissionNotGrantedError} If the `ZigbeePairing`
     *         permission is not granted.
     */
    startPairing(options?: EnyoZigbeeStartPairingOptions): Promise<EnyoZigbeePairingStatus>;

    /**
     * Close the Zigbee network for new devices before its window runs out.
     * Idempotent — resolves immediately when pairing is not open.
     *
     * @throws {EnergyAppPermissionNotGrantedError} If the `ZigbeePairing`
     *         permission is not granted.
     */
    stopPairing(): Promise<void>;

    /**
     * Whether the network is currently open for new devices, whoever opened it.
     *
     * @returns The current pairing status.
     */
    getPairingStatus(): Promise<EnyoZigbeePairingStatus>;

    // -----------------------------------------------------------------------
    // Devices
    // -----------------------------------------------------------------------

    /**
     * Get all Zigbee devices this app owns.
     *
     * @returns The app's devices; an empty array when it owns none.
     */
    getDevices(): Promise<EnyoZigbeeDevice[]>;

    /**
     * Get one of this app's Zigbee devices.
     *
     * @param ieeeAddress - IEEE address of the device, see {@link EnyoZigbeeDevice.ieeeAddress}.
     * @returns The device, or `null` when the app owns no device with this address.
     */
    getDevice(ieeeAddress: string): Promise<EnyoZigbeeDevice | null>;

    /**
     * Rename a device, or link it to (or unlink it from) an appliance.
     *
     * Linking here does not touch the appliance — also set
     * {@link EnyoApplianceZigbeeMetadata} on the appliance, which is the
     * authoritative side of the link.
     *
     * @param ieeeAddress - IEEE address of the device to update.
     * @param update - The fields to change; omitted fields are kept, `null` clears.
     * @returns The updated device.
     */
    updateDevice(ieeeAddress: string, update: EnyoZigbeeDeviceUpdate): Promise<EnyoZigbeeDevice>;

    /**
     * Remove a device from the Zigbee network: the host sends it a leave
     * request and deletes it from the coordinator.
     *
     * Does not delete an appliance linked to the device — remove that through
     * the appliance API if it should go too.
     *
     * @param ieeeAddress - IEEE address of the device to remove.
     * @param options - Pass `force: true` to delete it even when it does not
     *                  acknowledge the leave request.
     */
    removeDevice(ieeeAddress: string, options?: EnyoZigbeeRemoveDeviceOptions): Promise<void>;

    /**
     * Listen for new devices joining the network on this app's behalf.
     *
     * Called once per device, after its interview has finished (check
     * {@link EnyoZigbeeDevice.interviewState} — a failed interview is reported
     * too, with possibly incomplete endpoints). Devices paired by an onboarding
     * pairing block are delivered here as well as to the onboarding handler.
     *
     * @param listener - Callback invoked with the newly joined device.
     * @returns A listener id for {@link removeListener}.
     */
    listenForDeviceJoined(listener: (device: EnyoZigbeeDevice) => void | Promise<void>): string;

    /**
     * Listen for this app's devices leaving the network — removed through
     * {@link removeDevice}, or reset and left on their own.
     *
     * @param listener - Callback invoked with the IEEE address of the device that left.
     * @returns A listener id for {@link removeListener}.
     */
    listenForDeviceLeft(listener: (ieeeAddress: string) => void | Promise<void>): string;

    // -----------------------------------------------------------------------
    // Data access
    // -----------------------------------------------------------------------

    /**
     * Read attributes from a cluster of one of this app's devices.
     *
     * @param ieeeAddress - IEEE address of the device.
     * @param request - Endpoint, cluster and attribute ids to read.
     * @returns One record per requested attribute, each with its own status.
     */
    readAttributes(
        ieeeAddress: string,
        request: EnyoZigbeeReadAttributesRequest,
    ): Promise<EnyoZigbeeAttributeRecord[]>;

    /**
     * Write attributes on a cluster of one of this app's devices.
     *
     * Rejects when the device answers with a non-success status for any of
     * the attributes.
     *
     * @param ieeeAddress - IEEE address of the device.
     * @param request - Endpoint, cluster and the attributes to write.
     */
    writeAttributes(ieeeAddress: string, request: EnyoZigbeeWriteAttributesRequest): Promise<void>;

    /**
     * Send a ZCL command to a cluster of one of this app's devices — switch a
     * plug, change a thermostat set point, trigger a manufacturer command.
     *
     * @param ieeeAddress - IEEE address of the device.
     * @param request - Endpoint, cluster, command id and payload.
     * @returns The device's response; see {@link EnyoZigbeeCommandResult}.
     */
    sendCommand(ieeeAddress: string, request: EnyoZigbeeSendCommandRequest): Promise<EnyoZigbeeCommandResult>;

    /**
     * Ask a device to report attribute values on its own, delivered to
     * {@link listenForMessages} as attribute reports.
     *
     * The host binds the cluster to the coordinator before configuring
     * reporting, so this one call is all an app needs. Prefer reports over
     * polling with {@link readAttributes}: they cost less airtime and are the
     * only reliable way to get data from battery-powered devices.
     *
     * @param ieeeAddress - IEEE address of the device.
     * @param request - Endpoint, cluster and one configuration per attribute.
     */
    configureReporting(ieeeAddress: string, request: EnyoZigbeeConfigureReportingRequest): Promise<void>;

    /**
     * Listen for messages this app's devices send on their own — attribute
     * reports and cluster commands such as button presses or alarms.
     *
     * Responses to {@link readAttributes} and {@link sendCommand} are returned
     * by those calls and are not delivered here.
     *
     * @param listener - Callback invoked with every matching message.
     * @param filter - Optional filter by device, cluster or message type.
     * @returns A listener id for {@link removeListener}.
     */
    listenForMessages(
        listener: (message: EnyoZigbeeMessage) => void | Promise<void>,
        filter?: EnyoZigbeeMessageFilter,
    ): string;

    /**
     * Remove a listener registered with any `listenFor…` method.
     *
     * @param listenerId - The id returned when the listener was registered.
     */
    removeListener(listenerId: string): void;
}
