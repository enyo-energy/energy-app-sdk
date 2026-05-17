import {
    EebusOhpcfFlexibility,
    EebusOhpcfIncentiveTable,
    EebusOhpcfPlanState,
} from '../../types/enyo-eebus-use-cases.js';

/**
 * Client for the EEBUS **Optimization of Self Consumption by Heat Pump
 * Compressor Flexibility (OHPCF)** use case.
 *
 * OHPCF is an *incentive-driven* use case — the CEM (Customer Energy Manager)
 * sends a time-varying price/cost table; the heat pump schedules its
 * compressor to favour cheap or green windows without further coordination.
 * This is structurally different from LPC/LPP (which use LoadControl). The
 * CEM does not command the heat pump — it informs.
 *
 * The client exposes both actor roles on a single interface:
 * - **CEM role:** {@link sendIncentiveTable}, {@link getCurrentPlanState},
 *   {@link onFlexibilityUpdate}
 * - **Heat Pump role:** {@link provideFlexibility}, {@link providePlanState},
 *   {@link onIncentiveTableReceived}
 *
 * @see https://techdocs.wago.com/Software/EEBUS_Connector/en-US/3657311371.html
 * @see https://github.com/enbility/eebus-go/pull/122
 */
export interface EebusOhpcfClient {
    // ─── CEM role ────────────────────────────────────────────────────

    /**
     * Send an incentive table to the heat pump. The heat pump will use
     * the table to plan its compressor operation over the covered horizon.
     * @param table The incentive table to send
     */
    sendIncentiveTable: (table: EebusOhpcfIncentiveTable) => Promise<void>;

    /**
     * Read the heat pump's current operational plan, generated in response
     * to the most recent incentive table.
     */
    getCurrentPlanState: () => Promise<EebusOhpcfPlanState>;

    /**
     * Subscribe to compressor flexibility updates from the heat pump.
     * Allows the CEM to track the operating band it can shift consumption within.
     * @param listener Callback invoked with each new flexibility report
     * @returns Listener ID that can be passed to {@link removeListener} to cancel
     */
    onFlexibilityUpdate: (
        listener: (flexibility: EebusOhpcfFlexibility) => void
    ) => string;

    // ─── Heat Pump role ──────────────────────────────────────────────

    /**
     * Register a provider that reports the heat pump's current compressor
     * flexibility when a remote CEM reads it.
     * @param provider Async callback returning the current flexibility report
     */
    provideFlexibility: (provider: () => Promise<EebusOhpcfFlexibility>) => void;

    /**
     * Register a provider that reports the heat pump's current operational
     * plan state when a remote CEM reads it.
     * @param provider Async callback returning the current plan state
     */
    providePlanState: (provider: () => Promise<EebusOhpcfPlanState>) => void;

    /**
     * Register a handler invoked when a remote CEM sends a new incentive table
     * to the heat pump.
     * @param handler Async callback invoked with the incoming incentive table
     * @returns Listener ID that can be passed to {@link removeListener} to deregister
     */
    onIncentiveTableReceived: (
        handler: (table: EebusOhpcfIncentiveTable) => Promise<void>
    ) => string;

    /**
     * Remove a listener or handler previously registered on this client.
     * @param listenerId The ID returned by the registration method
     */
    removeListener: (listenerId: string) => void;
}
