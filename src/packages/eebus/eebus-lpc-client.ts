import {EebusLpcAck, EebusLpcFailsafe, EebusLpcLimit} from '../../types/enyo-eebus-use-cases.js';

/**
 * Client for the EEBUS **Limitation of Power Consumption (LPC)** use case.
 *
 * LPC is an *obligation*: when an Energy Management System (EMS) sends a limit,
 * the receiving Controllable System (CS) MUST respect it. Compare with
 * {@link EebusLppClient} which is a recommendation.
 *
 * The client exposes both actor roles on a single interface:
 * - **EMS role (outbound):** {@link setConsumptionLimit}, {@link getActiveConsumptionLimit},
 *   {@link getFailsafeLimit}
 * - **CS role (inbound):** {@link onConsumptionLimitReceived}, {@link provideFailsafeLimit}
 *
 * Consumers that only act in one role simply never call the other half — there is
 * no `asManager` / `asAppliance` split.
 */
export interface EebusLpcClient {
    // ─── EMS role (outbound) ─────────────────────────────────────────

    /**
     * Send a consumption limit to the controllable system. The remote is
     * obligated to respect the limit until it expires, is replaced, or is
     * cleared by sending a limit with `isActive: false`.
     * @param limit The consumption limit to apply
     */
    setConsumptionLimit: (limit: EebusLpcLimit) => Promise<void>;

    /**
     * Read the consumption limit currently active on the controllable system,
     * if any. Useful for verifying that a previously-sent limit was applied,
     * or for synchronising on reconnect.
     * @returns The active limit, or `undefined` if no limit is currently active
     */
    getActiveConsumptionLimit: () => Promise<EebusLpcLimit | undefined>;

    /**
     * Read the failsafe limit the controllable system will fall back to if
     * it loses the connection to this EMS.
     */
    getFailsafeLimit: () => Promise<EebusLpcFailsafe>;

    // ─── CS role (inbound) ───────────────────────────────────────────

    /**
     * Register a handler invoked when a remote EMS sends a consumption limit
     * to this device. The handler MUST return an acknowledgement.
     * @param handler Callback invoked with the incoming limit; returns the ack
     * @returns Listener ID that can be passed to {@link removeListener} to deregister
     */
    onConsumptionLimitReceived: (
        handler: (limit: EebusLpcLimit) => Promise<EebusLpcAck>
    ) => string;

    /**
     * Register a provider that supplies this device's current failsafe limit
     * when a remote EMS reads it.
     * @param provider Async callback returning the current failsafe configuration
     */
    provideFailsafeLimit: (provider: () => Promise<EebusLpcFailsafe>) => void;

    /**
     * Remove a handler previously registered via {@link onConsumptionLimitReceived}.
     * @param listenerId The ID returned by the registration method
     */
    removeListener: (listenerId: string) => void;
}
