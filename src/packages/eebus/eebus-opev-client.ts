import {SpineRemoteTarget} from '../../types/enyo-eebus.js';
import {EebusOpevAck, EebusOpevLimit} from '../../types/enyo-eebus-use-cases.js';
import {SpineEntityType} from '../../types/enyo-spine.js';
import {EebusUseCaseClient} from './eebus-use-case-client.js';

/**
 * Per-call configuration for {@link EebusUseCaseRegistry.opev}.
 */
export interface OpevClientOptions {
    address?: SpineRemoteTarget;
    /**
     * Resolution hint when {@link address} is omitted. Pin to
     * {@link SpineEntityType.EV} or {@link SpineEntityType.EVSE}
     * depending on which entity the wallbox hosts `LoadControl` on
     * (usually EVSE).
     */
    prefer?: SpineEntityType | 'auto';
    descriptionReadTimeoutMs?: number;
}

/**
 * Client for the EEBUS **Overload Protection by EV Charging Curtailment
 * (OPEV)** use case.
 *
 * OPEV is an *obligation*: the EVSE MUST respect the per-phase current
 * limit the EMS sends. Used to enforce a grid-side or §14a EnWG
 * cap — distinct from {@link EebusOscevClient} (which is a
 * recommendation, optimisation-driven).
 *
 * The client exposes both actor roles on a single interface:
 * - **EMS role:** {@link setChargingCurrentLimitsPerPhase},
 *   {@link getActiveChargingLimits}.
 * - **EVSE role:** {@link onLimitReceived}, {@link onLimitNack}.
 *
 * Backed by `LoadControl` + `ElectricalConnection` on the lib side.
 */
export interface EebusOpevClient extends EebusUseCaseClient {
    // ─── EMS role ────────────────────────────────────────────────────

    /**
     * Send a per-phase current limit to the EVSE. The EVSE MUST respect
     * the limit; ack is the EVSE's accept / reject decision.
     */
    setChargingCurrentLimitsPerPhase: (limit: EebusOpevLimit) => Promise<EebusOpevAck>;

    /**
     * Read the per-phase current limits currently active on the EVSE,
     * if any.
     */
    getActiveChargingLimits: () => Promise<EebusOpevLimit | undefined>;

    // ─── EVSE role ───────────────────────────────────────────────────

    /**
     * Register a handler invoked when a remote EMS sends an OPEV limit
     * to this EVSE. The handler MUST return an ack.
     */
    onLimitReceived: (
        handler: (limit: EebusOpevLimit) => Promise<EebusOpevAck>,
    ) => string;

    /**
     * Subscribe to NACKs from the EVSE — fires when the EVSE rejects a
     * limit (e.g. unsupported phase count) so the EMS can renegotiate.
     */
    onLimitNack: (handler: (reason: string) => void) => string;

    /**
     * Remove a listener or handler previously registered on this client.
     */
    removeListener: (listenerId: string) => void;
}
