import {SpineRemoteTarget} from '../../types/enyo-eebus.js';
import {EebusVabdTelemetry} from '../../types/enyo-eebus-use-cases.js';
import {SpineEntityType} from '../../types/enyo-spine.js';
import {EebusUseCaseClient} from './eebus-use-case-client.js';

/**
 * Per-call configuration for {@link EebusUseCaseRegistry.vabd}.
 */
export interface VabdClientOptions {
    address?: SpineRemoteTarget;
    /**
     * Resolution hint when {@link address} is omitted. Pin to
     * {@link SpineEntityType.BATTERY} or
     * {@link SpineEntityType.HHES_BATTERY} depending on the peer's
     * advertised entity type.
     */
    prefer?: SpineEntityType | 'auto';
    descriptionReadTimeoutMs?: number;
}

/**
 * Client for the EEBUS **Visualization of Aggregated Battery Data
 * (VABD)** use case.
 *
 * VABD is read-only telemetry from a battery / home-storage system:
 * power, SoC, and nominal capacity. Used by an EMS to render the
 * battery state in its UI; not a control surface (use SetStorageSchedule
 * over the data bus for control).
 *
 * Backed by `ElectricalConnection` + `Measurement` + `DeviceConfiguration`
 * on the lib side.
 */
export interface EebusVabdClient extends EebusUseCaseClient {
    /**
     * Read the battery's current state of charge in percent (0–100).
     */
    getBatterySocPercent: () => Promise<number>;

    /**
     * Read the battery's current active power in Watts. Positive =
     * charging, negative = discharging.
     */
    getBatteryPowerW: () => Promise<number>;

    /**
     * Read the battery's nominal capacity in Watt-hours, if advertised.
     */
    getBatteryNominalCapacityWh: () => Promise<number | undefined>;

    /**
     * Return the most recent consolidated battery telemetry the SDK has
     * observed on this peer, without dispatching a wire read.
     * Synchronous and side-effect-free.
     *
     * Returns `undefined` until the first `measurementListData` notify
     * has landed. Once populated, the snapshot tracks every subsequent
     * notify — callers can drop their {@link onTelemetry} subscription
     * if they only need to poll the latest value.
     */
    getLastTelemetry: () => EebusVabdTelemetry | undefined;

    /**
     * Subscribe to consolidated battery telemetry updates.
     */
    onTelemetry: (handler: (telemetry: EebusVabdTelemetry) => void) => string;

    /**
     * Remove a listener previously registered via {@link onTelemetry}.
     */
    removeListener: (listenerId: string) => void;
}
