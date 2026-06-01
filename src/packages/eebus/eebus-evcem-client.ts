import {SpineRemoteTarget} from '../../types/enyo-eebus.js';
import {EebusEvcemReading} from '../../types/enyo-eebus-use-cases.js';
import {SpineEntityType} from '../../types/enyo-spine.js';

/**
 * Per-call configuration for {@link EebusUseCaseRegistry.evcem}.
 */
export interface EvcemClientOptions {
    address?: SpineRemoteTarget;
    /**
     * Resolution hint when {@link address} is omitted. Pin to
     * {@link SpineEntityType.EV} on multi-EV peers.
     */
    prefer?: SpineEntityType | 'auto';
    descriptionReadTimeoutMs?: number;
}

/**
 * Client for the EEBUS **Measurement of Electricity During EV Charging
 * (EVCEM)** use case.
 *
 * EVCEM is read-only EV-side telemetry: active power, per-phase
 * current/voltage, and the running energy delivered since the session
 * started. Surfaces the same per-phase view as MGCP / MPC do for the
 * grid / appliance, but rooted on the EV entity.
 *
 * **Library status.** Methods throw
 * {@link EebusFeatureUnavailableError} from the `connect-core` runtime
 * until `ElectricalConnectionClient` lands in `@enyo-energy/eebus`.
 */
export interface EebusEvcemClient {
    /**
     * Read the most recent telemetry sample from the EV charging session.
     *
     * @throws {EebusFeatureUnavailableError} Until
     *          `ElectricalConnectionClient` lands in
     *          `@enyo-energy/eebus`.
     */
    getCurrentMeasurement: () => Promise<EebusEvcemReading>;

    /**
     * Subscribe to per-update telemetry samples.
     *
     * @param handler Callback invoked with each new reading.
     * @returns Listener ID that can be passed to {@link removeListener}.
     * @throws {EebusFeatureUnavailableError} Until
     *          `ElectricalConnectionClient` lands in
     *          `@enyo-energy/eebus`.
     */
    onMeasurementUpdate: (handler: (reading: EebusEvcemReading) => void) => string;

    /**
     * Remove a listener previously registered via
     * {@link onMeasurementUpdate}.
     */
    removeListener: (listenerId: string) => void;
}
