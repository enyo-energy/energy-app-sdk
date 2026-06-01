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
 * **Library status.** Methods throw
 * {@link EebusFeatureUnavailableError} from the `connect-core` runtime
 * until `ElectricalConnectionClient` lands in `@enyo-energy/eebus`.
 * `Measurement` and `DeviceConfiguration` are already present.
 */
export interface EebusVabdClient extends EebusUseCaseClient {
    /**
     * Read the battery's current state of charge in percent (0–100).
     *
     * @throws {EebusFeatureUnavailableError} Until
     *          `ElectricalConnectionClient` lands in
     *          `@enyo-energy/eebus`.
     */
    getBatterySocPercent: () => Promise<number>;

    /**
     * Read the battery's current active power in Watts. Positive =
     * charging, negative = discharging.
     *
     * @throws {EebusFeatureUnavailableError} Until
     *          `ElectricalConnectionClient` lands in
     *          `@enyo-energy/eebus`.
     */
    getBatteryPowerW: () => Promise<number>;

    /**
     * Read the battery's nominal capacity in Watt-hours, if advertised.
     *
     * @throws {EebusFeatureUnavailableError} Until
     *          `ElectricalConnectionClient` lands in
     *          `@enyo-energy/eebus`.
     */
    getBatteryNominalCapacityWh: () => Promise<number | undefined>;

    /**
     * Subscribe to consolidated battery telemetry updates.
     *
     * @throws {EebusFeatureUnavailableError} Until
     *          `ElectricalConnectionClient` lands in
     *          `@enyo-energy/eebus`.
     */
    onTelemetry: (handler: (telemetry: EebusVabdTelemetry) => void) => string;

    /**
     * Remove a listener previously registered via {@link onTelemetry}.
     */
    removeListener: (listenerId: string) => void;
}
