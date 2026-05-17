import {EebusLppAck, EebusLppFailsafe, EebusLppLimit} from '../../types/enyo-eebus-use-cases.js';

/**
 * Client for the EEBUS **Limitation of Power Production (LPP)** use case.
 *
 * LPP is a *recommendation*: when an Energy Management System (EMS) sends a
 * production limit, the producing Controllable System (CS) SHOULD respect it
 * but is not contractually obligated. Compare with {@link EebusLpcClient} which
 * is an obligation.
 *
 * The client exposes both actor roles on a single interface:
 * - **EMS role (outbound):** {@link setProductionLimit}, {@link getActiveProductionLimit},
 *   {@link getFailsafeLimit}
 * - **CS role (inbound):** {@link onProductionLimitReceived}, {@link provideFailsafeLimit}
 */
export interface EebusLppClient {
    // ─── EMS role (outbound) ─────────────────────────────────────────

    /**
     * Send a production limit recommendation to the producing controllable system.
     * @param limit The production limit recommendation to apply
     */
    setProductionLimit: (limit: EebusLppLimit) => Promise<void>;

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
