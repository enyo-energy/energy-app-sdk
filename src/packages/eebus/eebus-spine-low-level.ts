import {EebusDataPoint} from '../../types/enyo-eebus.js';

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
 */
export interface EebusSpineLowLevel {
    /**
     * Read specific data points from a SPINE feature on a remote device.
     * @param ski Subject Key Identifier of the target device
     * @param featureType SPINE feature type name (e.g. `'Measurement'`)
     * @param functionName Specific function or data set to read (e.g. `'measurementListData'`)
     * @returns The data point containing the raw value, timestamp, and optional unit
     */
    readData: (
        ski: string,
        featureType: string,
        functionName: string
    ) => Promise<EebusDataPoint>;

    /**
     * Write data or send a command to a SPINE feature on a remote device.
     * @param ski Subject Key Identifier of the target device
     * @param featureType SPINE feature type name (e.g. `'LoadControl'`)
     * @param functionName Specific function or command to invoke (e.g. `'loadControlLimitListData'`)
     * @param payload The raw data payload to send — caller is responsible for matching the SPINE schema
     */
    writeData: (
        ski: string,
        featureType: string,
        functionName: string,
        payload: unknown
    ) => Promise<void>;

    /**
     * Subscribe to automatic notifications when a SPINE feature's data changes.
     * Sets up a SPINE binding so the local device is notified whenever the
     * subscribed data changes.
     * @param ski Subject Key Identifier of the target device
     * @param featureType SPINE feature type name to subscribe to
     * @param listener Callback invoked with updated data whenever the value changes
     * @returns Listener ID that can be passed to {@link removeListener} to cancel the subscription
     */
    subscribe: (
        ski: string,
        featureType: string,
        listener: (data: EebusDataPoint) => void
    ) => string;

    /**
     * Remove a subscription previously registered via {@link subscribe}.
     * @param listenerId The ID returned by the registration method
     */
    removeListener: (listenerId: string) => void;
}
