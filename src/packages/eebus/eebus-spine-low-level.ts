import {EebusDataPoint, SpineRemoteTarget} from '../../types/enyo-eebus.js';

/**
 * Low-level SPINE escape hatch for direct feature data access.
 *
 * The typed use-case clients ({@link EebusUseCaseRegistry}) cover the
 * common cases — prefer them when they exist. Reach for this interface
 * only when:
 * - the remote exposes a SPINE feature not yet wrapped by a typed client
 * - you need to interact with a custom or vendor-specific feature
 * - you are prototyping a new use-case wrapper
 *
 * **Feature types are strings, not an enum.** SPINE defines roughly 80
 * feature types and the catalog grows. The previous closed enum was
 * removed because it silently blocked consumers from anything outside
 * its 7 entries. Canonical feature-type names include
 * `'DeviceClassification'`, `'DeviceDiagnosis'`, `'ElectricalConnection'`,
 * `'Measurement'`, `'LoadControl'`, `'DeviceConfiguration'`,
 * `'Identification'`, `'IncentiveTable'`, `'TimeSeries'`, `'Hvac'`,
 * `'SmartEnergyManagementPs'`, and many more — consult the SPINE spec.
 *
 * **Entity targeting.** Heat pumps and other multi-entity peers routinely
 * expose the same `featureType` on more than one entity (e.g. `Measurement`
 * on both `HeatPumpAppliance` and `Compressor`). Without a {@link SpineRemoteTarget}
 * the SDK picks the first matching entity it resolves, which can deliver
 * notifies from the wrong vantage point. Pass a `target` to scope reads /
 * writes / subscriptions to a specific entity; inbound data points then
 * carry `source` on every event so consumers can attribute multi-entity
 * subscriptions. Use {@link EebusFeatureCatalog.findFeatureAddresses} to
 * enumerate candidates before targeting.
 */
export interface EebusSpineLowLevel {
    /**
     * Read specific data points from a SPINE feature on a remote device.
     *
     * When `target` is omitted the SDK reads from whichever entity it
     * resolves first — fine on flat peers, ambiguous on peers that expose
     * the feature type on multiple entities. Pass `target` to bind the read
     * to a specific entity.
     *
     * @param ski Subject Key Identifier of the target device
     * @param featureType SPINE feature type name (e.g. `'Measurement'`)
     * @param functionName Specific function or data set to read (e.g. `'measurementListData'`)
     * @param target Optional remote entity (and feature) to scope the read to
     * @returns The data point containing the raw value, timestamp, and optional unit
     */
    readData: (
        ski: string,
        featureType: string,
        functionName: string,
        target?: SpineRemoteTarget
    ) => Promise<EebusDataPoint>;

    /**
     * Write data or send a command to a SPINE feature on a remote device.
     *
     * When `target` is omitted the SDK writes to whichever entity it
     * resolves first. Use `target` to bind the write to a specific entity
     * (e.g. `SmartEnergyManagementPs` on `Compressor` rather than on
     * `HeatPumpAppliance`).
     *
     * @param ski Subject Key Identifier of the target device
     * @param featureType SPINE feature type name (e.g. `'LoadControl'`)
     * @param functionName Specific function or command to invoke (e.g. `'loadControlLimitListData'`)
     * @param payload The raw data payload to send — caller is responsible for matching the SPINE schema
     * @param target Optional remote entity (and feature) to scope the write to
     */
    writeData: (
        ski: string,
        featureType: string,
        functionName: string,
        payload: unknown,
        target?: SpineRemoteTarget
    ) => Promise<void>;

    /**
     * Subscribe to automatic notifications when a SPINE feature's data changes.
     * Sets up a SPINE binding so the local device is notified whenever the
     * subscribed data changes.
     *
     * When `target` is omitted the subscription matches the feature type
     * across every entity that hosts it on the remote, and the listener is
     * invoked once per source — inspect {@link EebusDataPoint.source} to
     * attribute each notify. Pass `target` to bind the subscription to a
     * single entity (the recommended shape on multi-entity peers).
     *
     * @param ski Subject Key Identifier of the target device
     * @param featureType SPINE feature type name to subscribe to
     * @param listener Callback invoked with updated data whenever the value changes
     * @param target Optional remote entity (and feature) to scope the subscription to
     * @returns Listener ID that can be passed to {@link removeListener} to cancel the subscription
     */
    subscribe: (
        ski: string,
        featureType: string,
        listener: (data: EebusDataPoint) => void,
        target?: SpineRemoteTarget
    ) => string;

    /**
     * Remove a subscription previously registered via {@link subscribe}.
     * @param listenerId The ID returned by the registration method
     */
    removeListener: (listenerId: string) => void;
}
