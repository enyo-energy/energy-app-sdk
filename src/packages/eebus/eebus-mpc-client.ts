import {EebusMpcReading} from '../../types/enyo-eebus-use-cases.js';

/**
 * Client for the EEBUS **Monitoring of Power Consumption (MPC)** use case.
 *
 * MPC is read-only telemetry from a controllable system reporting its own
 * power consumption to the EMS.
 *
 * The client exposes both actor roles on a single interface:
 * - **EMS role (consume):** {@link getReading}, {@link onReading}
 * - **CS role (provide):** {@link provideReading}
 */
export interface EebusMpcClient {
    // ─── EMS role (consume) ──────────────────────────────────────────

    /**
     * Read the latest consumption telemetry from the controllable system.
     */
    getReading: () => Promise<EebusMpcReading>;

    /**
     * Subscribe to updates whenever the controllable system publishes new telemetry.
     * @param listener Callback invoked with each new reading
     * @returns Listener ID that can be passed to {@link removeListener} to cancel
     */
    onReading: (listener: (reading: EebusMpcReading) => void) => string;

    // ─── CS role (provide) ───────────────────────────────────────────

    /**
     * Register a provider that supplies the current consumption reading
     * when a remote EMS reads it.
     * @param provider Async callback returning the current reading
     */
    provideReading: (provider: () => Promise<EebusMpcReading>) => void;

    /**
     * Remove a listener previously registered via {@link onReading}.
     * @param listenerId The ID returned by the registration method
     */
    removeListener: (listenerId: string) => void;
}
