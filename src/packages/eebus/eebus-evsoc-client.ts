import {SpineRemoteTarget} from '../../types/enyo-eebus.js';
import {EebusEvSocReading} from '../../types/enyo-eebus-use-cases.js';
import {SpineEntityType} from '../../types/enyo-spine.js';
import {EebusUseCaseClient} from './eebus-use-case-client.js';

/**
 * Per-call configuration for {@link EebusUseCaseRegistry.evsoc}.
 */
export interface EvsocClientOptions {
    address?: SpineRemoteTarget;
    /**
     * Resolution hint when {@link address} is omitted. Pin to
     * {@link SpineEntityType.EV}.
     */
    prefer?: SpineEntityType | 'auto';
    descriptionReadTimeoutMs?: number;
}

/**
 * Client for the EEBUS **EV State of Charge (EVSOC)** use case.
 *
 * EVSOC is read-only and *optional* on the EV — many vehicles do not
 * publish their SoC over EEBUS. Consumers should handle the "SoC never
 * arrives" case (e.g. by falling back to a vehicle-side service or by
 * estimating from charged energy + claimed battery capacity).
 *
 * Backed by `ElectricalConnection` + `Measurement` on the lib side.
 */
export interface EebusEvsocClient extends EebusUseCaseClient {
    /**
     * Read the most recent SoC sample, in percent (0–100).
     */
    getStateOfChargePercent: () => Promise<number>;

    /**
     * Subscribe to SoC updates.
     *
     * @param handler Callback invoked with each new SoC reading.
     * @returns Listener ID that can be passed to {@link removeListener}.
     */
    onStateOfChargeUpdated: (handler: (reading: EebusEvSocReading) => void) => string;

    /**
     * Remove a listener previously registered via
     * {@link onStateOfChargeUpdated}.
     */
    removeListener: (listenerId: string) => void;
}
