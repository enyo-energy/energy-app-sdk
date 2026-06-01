import {SpineRemoteTarget} from '../../types/enyo-eebus.js';
import {EebusOscevAck, EebusOscevLimit} from '../../types/enyo-eebus-use-cases.js';
import {SpineEntityType} from '../../types/enyo-spine.js';
import {EebusUseCaseClient} from './eebus-use-case-client.js';

/**
 * Per-call configuration for {@link EebusUseCaseRegistry.oscev}.
 */
export interface OscevClientOptions {
    address?: SpineRemoteTarget;
    prefer?: SpineEntityType | 'auto';
    descriptionReadTimeoutMs?: number;
}

/**
 * Client for the EEBUS **Optimization of Self-Consumption During EV
 * Charging (OSCEV)** use case.
 *
 * OSCEV is a *recommendation*: the EVSE SHOULD respect the per-phase
 * limit to follow PV surplus, but is not contractually bound (and may
 * still draw more if the user has pressed "charge now"). Compare with
 * {@link EebusOpevClient}, which is the obligation flavour.
 *
 * Backed by `LoadControl` + `ElectricalConnection` on the lib side.
 */
export interface EebusOscevClient extends EebusUseCaseClient {
    // ─── EMS role ────────────────────────────────────────────────────

    /**
     * Send a per-phase current recommendation to the EVSE.
     */
    setSelfConsumptionLimit: (limit: EebusOscevLimit) => Promise<EebusOscevAck>;

    /**
     * Read the self-consumption recommendation currently active on the
     * EVSE, if any.
     */
    getCurrentSelfConsumptionLimit: () => Promise<EebusOscevLimit | undefined>;

    /**
     * Subscribe to limit-adjustment notifications from the EVSE — fires
     * when the EVSE chose to draw less than the recommendation (so the
     * EMS can update its forecast).
     */
    onLimitAdjusted: (handler: (limit: EebusOscevLimit) => void) => string;

    // ─── EVSE role ───────────────────────────────────────────────────

    /**
     * Register a handler invoked when a remote EMS sends an OSCEV
     * recommendation to this EVSE.
     */
    onLimitReceived: (
        handler: (limit: EebusOscevLimit) => Promise<EebusOscevAck>,
    ) => string;

    /**
     * Remove a listener or handler previously registered on this client.
     */
    removeListener: (listenerId: string) => void;
}
