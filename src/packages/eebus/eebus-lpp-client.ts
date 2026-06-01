import {EebusLppAck, EebusLppFailsafe, EebusLppLimit, EebusLppNack} from '../../types/enyo-eebus-use-cases.js';
import {EebusUseCaseClient} from './eebus-use-case-client.js';

/**
 * Client for the EEBUS **Limitation of Power Production (LPP)** use case.
 *
 * LPP is a *recommendation*: when an Energy Management System (EMS) sends a
 * production limit, the producing Controllable System (CS) SHOULD respect it
 * but is not contractually obligated. Compare with {@link EebusLpcClient} which
 * is an obligation.
 *
 * The client exposes both actor roles on a single interface:
 * - **EMS role (outbound):** {@link setProductionLimit}, {@link setFailsafeLimit},
 *   {@link getActiveProductionLimit}, {@link getFailsafeLimit}
 * - **EMS role (inbound):** {@link onActiveProductionLimitChanged},
 *   {@link onProductionLimitNack}, {@link onFailsafeChanged}
 * - **CS role (inbound):** {@link onProductionLimitReceived},
 *   {@link provideFailsafeLimit}
 *
 * **Acknowledgement semantics.** {@link setProductionLimit} resolves once
 * the SPINE write-ack lands — the CS has accepted the message into its
 * queue. That is *not* the same as the CS having applied the
 * recommendation; for the latter, subscribe to
 * {@link onActiveProductionLimitChanged}. Because LPP is advisory, a
 * producer is free to decline; explicit declines arrive via
 * {@link onProductionLimitNack}.
 */
export interface EebusLppClient extends EebusUseCaseClient {
    // ─── EMS role (outbound) ─────────────────────────────────────────

    /**
     * Send a production limit recommendation to the producing controllable system.
     *
     * Resolves on the SPINE write-ack. See the class-level note for the
     * difference between "accepted" and "applied"; subscribe to
     * {@link onActiveProductionLimitChanged} and
     * {@link onProductionLimitNack} to observe the producer's downstream
     * decision.
     *
     * @param limit The production limit recommendation to apply
     */
    setProductionLimit: (limit: EebusLppLimit) => Promise<void>;

    /**
     * Configure the producing controllable system's failsafe limit — the
     * value it falls back to when the SHIP connection to this EMS drops.
     * Used to enforce a feed-in cap (e.g. 70 % of nameplate) that
     * survives transient disconnects even when LPP itself is advisory.
     *
     * Resolves on the SPINE write-ack. To learn about subsequent
     * CS-side revisions, subscribe to {@link onFailsafeChanged}.
     *
     * @param failsafe The failsafe configuration to apply on the producer
     */
    setFailsafeLimit: (failsafe: EebusLppFailsafe) => Promise<void>;

    /**
     * Read the production limit currently active on the controllable system,
     * if any.
     * @returns The active limit, or `undefined` if no limit is currently active
     */
    getActiveProductionLimit: () => Promise<EebusLppLimit | undefined>;

    /**
     * Read the failsafe limit the controllable system will fall back to if
     * it loses the connection to this EMS.
     */
    getFailsafeLimit: () => Promise<EebusLppFailsafe>;

    // ─── EMS role (inbound) ──────────────────────────────────────────

    /**
     * Subscribe to changes in the *active* production limit reported by
     * the producer — fires on every inbound `loadControlLimitListData`
     * notify. The handler receives the new active limit, or `undefined`
     * when the producer clears the active limit.
     *
     * Use this instead of polling {@link getActiveProductionLimit} after
     * a {@link setProductionLimit} call: the SPINE write-ack resolves
     * before the producer publishes its updated active state, so the
     * polling pattern races against the notify.
     *
     * @param handler Callback invoked with the new active limit (or `undefined`)
     * @returns Listener ID that can be passed to {@link removeListener}
     */
    onActiveProductionLimitChanged: (
        handler: (limit: EebusLppLimit | undefined) => void
    ) => string;

    /**
     * Subscribe to explicit declines from the producer — fires when the
     * producer rejects a previously-sent recommendation with a reason.
     * LPP being advisory, a NACK does not breach the use case; it just
     * tells the EMS that the producer chose not to honour the value
     * (e.g. self-consumption priority is engaged on the inverter).
     *
     * Distinct from the SPINE write-ack that
     * {@link setProductionLimit} resolves on.
     *
     * @param handler Callback invoked with the NACK payload
     * @returns Listener ID that can be passed to {@link removeListener}
     */
    onProductionLimitNack: (
        handler: (nack: EebusLppNack) => void
    ) => string;

    /**
     * Subscribe to producer-published failsafe revisions — fires on every
     * inbound `deviceConfigurationKeyValueListData` notify carrying
     * a new failsafe value or duration. Allowed by the LPP UC TS as a
     * mid-session signal; consumers that only read the failsafe at
     * warm-up time will otherwise miss it.
     *
     * @param handler Callback invoked with the revised failsafe
     * @returns Listener ID that can be passed to {@link removeListener}
     */
    onFailsafeChanged: (
        handler: (failsafe: EebusLppFailsafe) => void
    ) => string;

    // ─── CS role (inbound) ───────────────────────────────────────────

    /**
     * Register a handler invoked when a remote EMS sends a production limit
     * recommendation to this device.
     * @param handler Callback invoked with the incoming limit; returns the ack
     * @returns Listener ID that can be passed to {@link removeListener} to deregister
     */
    onProductionLimitReceived: (
        handler: (limit: EebusLppLimit) => Promise<EebusLppAck>
    ) => string;

    /**
     * Register a provider that supplies this device's current failsafe limit
     * when a remote EMS reads it.
     * @param provider Async callback returning the current failsafe configuration
     */
    provideFailsafeLimit: (provider: () => Promise<EebusLppFailsafe>) => void;

    /**
     * Remove a handler previously registered via {@link onProductionLimitReceived}.
     * @param listenerId The ID returned by the registration method
     */
    removeListener: (listenerId: string) => void;
}
