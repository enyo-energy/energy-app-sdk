import {SpineRemoteTarget} from '../../types/enyo-eebus.js';
import {EebusEvcemReading} from '../../types/enyo-eebus-use-cases.js';
import {SpineEntityType} from '../../types/enyo-spine.js';
import {EebusUseCaseClient} from './eebus-use-case-client.js';

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
 * Backed by `Measurement` + `ElectricalConnection` on the lib side.
 */
export interface EebusEvcemClient extends EebusUseCaseClient {
    /**
     * Read the most recent telemetry sample from the EV charging session.
     */
    getCurrentMeasurement: () => Promise<EebusEvcemReading>;

    /**
     * Subscribe to per-update telemetry samples.
     *
     * @param handler Callback invoked with each new reading.
     * @returns Listener ID that can be passed to {@link removeListener}.
     */
    onMeasurementUpdate: (handler: (reading: EebusEvcemReading) => void) => string;

    /**
     * Remove a listener previously registered via
     * {@link onMeasurementUpdate}.
     */
    removeListener: (listenerId: string) => void;
}
