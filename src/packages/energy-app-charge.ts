import {
    EnyoCharge,
    EnyoChargeFilter,
    EnyoChargeStatus,
    EnyoDefaultChargeMode,
    EnyoStartChargeRequest,
    EnyoStopChargeRequest
} from "../types/enyo-charge.js";

/**
 * Interface for managing charging sessions in enyo packages.
 * Provides operations for charge session tracking and management.
 */
export interface EnergyAppCharge {
    /**
     * Opens a charging session for an appliance and returns it.
     *
     * Use this to start a session — not {@link save}. `save` writes whatever
     * object it is given and offers no uniqueness guarantee, so two
     * StartTransactions arriving a few milliseconds apart both pass an app-side
     * "is one already active?" check and create two sessions for one plug-in.
     * This call is handled by the host, which holds the invariant that an
     * appliance has at most one active charge.
     *
     * **Idempotent.** When a session is already active for the same
     * `applianceId` + `transactionId`, that session is returned unchanged
     * rather than a second one being created — a repeated StartTransaction is
     * safe. A session that is active on the appliance under a *different*
     * transaction ID is treated as over: the host finalises it with best-effort
     * end values before opening this one. If it is really the same physical
     * session continuing under a new transaction ID (a reconnect, a
     * re-authorization), use {@link addTransactionIdToActiveCharge} instead.
     *
     * The returned charge carries its `id`, so the session can be updated and
     * later stopped without a {@link findActiveCharge} round-trip first.
     *
     * **Required permission:** `Charge`.
     *
     * @param request - What is known at plug-in time.
     * @returns Promise resolving to the started session — or the session that
     *          was already running for this appliance and transaction.
     *
     * @example
     * ```typescript
     * const charge = await energyApp.useCharge().startCharge({
     *     applianceId,
     *     transactionId: ocppTransactionId,
     *     meterStartValueWh: meterValue,
     *     connectorId: 1,
     * });
     * ```
     */
    startCharge: (request: EnyoStartChargeRequest) => Promise<EnyoCharge>;
    /**
     * Closes a charging session and returns the final record.
     *
     * The host does the arithmetic, and that is the point of this call: it
     * derives {@link EnyoCharge.totalEnergyKwh} and
     * {@link EnyoCharge.paidPriceEuroCent} from the session's meter readings
     * and the electricity tariff in force while the energy flowed, then moves
     * the session to a terminal status and notifies
     * {@link listenForChargeStopped}. An app must not price a session itself —
     * totals computed app-side would differ between apps, and a customer's bill
     * would depend on which app happened to close the charge.
     *
     * Supply readings, not totals: `meterEndValueWh` and, when the charger
     * reports it, `energyDeliveredWh`. Anything an app writes into
     * `paidPriceEuroCent` via {@link save} is overwritten here.
     *
     * Stopping a session that is already in a terminal status is a no-op and
     * returns the stored record — a duplicate StopTransaction will not re-price
     * a finished charge.
     *
     * **Required permission:** `Charge`.
     *
     * @param chargeId - The session to close, as returned by
     *   {@link startCharge} or {@link findActiveCharge}.
     * @param request - How the session ended.
     * @returns Promise resolving to the final charge record, totals included.
     *
     * @example
     * ```typescript
     * const finished = await energyApp.useCharge().stopCharge(charge.id, {
     *     meterEndValueWh: meterValue,
     *     energyDeliveredWh: stopTransaction.energyWh,
     * });
     * console.log(`${finished.totalEnergyKwh} kWh for ${finished.paidPriceEuroCent} ct`);
     * ```
     */
    stopCharge: (chargeId: string, request: EnyoStopChargeRequest) => Promise<EnyoCharge>;
    /**
     * Save or update a charging session in the system.
     *
     * This is a whole-object write for a session that already exists — a
     * changed vehicle, a corrected reading. Use {@link startCharge} to open a
     * session and {@link stopCharge} to close one: calling this without a
     * `chargeId` creates a row with no uniqueness guarantee, and writing
     * terminal values by hand skips the host's energy and cost calculation.
     */
    save: (charge: Omit<EnyoCharge, 'id'>, chargeId?: string) => Promise<void>;
    /** Get a list of charging sessions with optional filtering */
    list: (filter?: EnyoChargeFilter) => Promise<EnyoCharge[]>;
    /** Get a specific charging session by its ID */
    getById: (id: string) => Promise<EnyoCharge | null>;
    /** to find the currently active charge */
    findActiveCharge: (applianceId: string) => Promise<EnyoCharge | null>;
    /** Find the currently active charge by appliance ID and transaction ID */
    findActiveChargeByTransactionId: (applianceId: string, transactionId: string) => Promise<EnyoCharge | null>;
    /**
     * Adds an additional transaction ID to the currently active charging
     * session of an appliance.
     *
     * A single physical charging session can span multiple OCPP
     * transactions (e.g. after a short interruption or re-authorization).
     * Use this to associate a newly started transaction with the charge
     * that is already active for the given appliance. The transaction ID is
     * appended to {@link EnyoCharge.additionalTransactionIds}.
     *
     * **Required permission:** `EnergyManager`.
     *
     * @param applianceId - The appliance (charger) whose active charge should be updated.
     * @param transactionId - The additional transaction ID to associate with the active charge.
     * @returns Promise that resolves once the transaction ID has been added.
     *          Resolves without effect if no active charge exists for the appliance.
     */
    addTransactionIdToActiveCharge: (applianceId: string, transactionId: string) => Promise<void>;
    /**
     * Sets the default charging mode for a specific appliance, optionally
     * with a target completion time and its timezone.
     *
     * **Required permission:** `EnergyManager`.
     *
     * @param applianceId - The appliance (charger) the default charge mode applies to.
     * @param defaultChargeMode - The default charge mode configuration to apply.
     * @returns Promise that resolves once the default charge mode is stored.
     */
    setDefaultChargeMode: (applianceId: string, defaultChargeMode: EnyoDefaultChargeMode) => Promise<void>;
    /**
     * Retrieves the currently configured default charging mode for a specific appliance.
     *
     * No permission is required to read the default charge mode.
     *
     * @param applianceId - The appliance (charger) to read the default charge mode for.
     * @returns Promise resolving to the configured default charge mode
     */
    getDefaultChargeMode: (applianceId: string) => Promise<EnyoDefaultChargeMode>;
    /**
     * Listen for charging sessions that have just started.
     *
     * Fires once per session, when the charge is first created and enters
     * {@link EnyoChargeStatus.Charging} — not on subsequent meter updates (use
     * {@link listenForChargeUpdated} for those). The delivered charge carries the
     * data known at start: `applianceId`, `transactionId`, `startTime` and
     * `meterStartValueWh`; the totals are only meaningful once the session ends.
     *
     * Listeners receive sessions of every appliance the package can see — filter
     * on {@link EnyoCharge.applianceId} when only one charger is of interest.
     *
     * @param listener - Callback invoked with the started charging session
     * @returns A unique listener ID that can be used to remove the listener
     *
     * @example
     * ```typescript
     * const charge = energyApp.useCharge();
     * const listenerId = charge.listenForChargeStarted(async (session) => {
     *     console.log(`charging started on ${session.applianceId}`);
     * });
     * ```
     */
    listenForChargeStarted: (listener: (charge: EnyoCharge) => void | Promise<void>) => string;
    /**
     * Listen for charging sessions that have ended.
     *
     * Fires once per session, when it leaves {@link EnyoChargeStatus.Charging}
     * for a terminal status. Check {@link EnyoCharge.status} to tell a session
     * that {@link EnyoChargeStatus.Completed completed} from one that
     * {@link EnyoChargeStatus.Failed failed} — both end a charge, and a listener
     * that assumes success will mis-report faulted sessions.
     *
     * The delivered charge is the final record, including `endTime`,
     * `meterEndValueWh` and `totalEnergyKwh`.
     *
     * @param listener - Callback invoked with the ended charging session
     * @returns A unique listener ID that can be used to remove the listener
     *
     * @example
     * ```typescript
     * charge.listenForChargeStopped(async (session) => {
     *     if (session.status === EnyoChargeStatus.Completed) {
     *         console.log(`delivered ${session.totalEnergyKwh} kWh`);
     *     }
     * });
     * ```
     */
    listenForChargeStopped: (listener: (charge: EnyoCharge) => void | Promise<void>) => string;
    /**
     * Listen for changes to a running charging session.
     *
     * Fires whenever an active charge is modified — new meter values, a changed
     * {@link EnyoCharge.chargeMode}, an updated smart-charging
     * {@link EnyoCharge.schedule}, or an additional transaction ID. It does NOT
     * fire for the start and the end of a session; those have their own
     * listeners, so a handler registered here never sees the same event twice.
     *
     * Meter updates can arrive at the charger's reporting interval (often every
     * few seconds), so keep the callback cheap and do not persist on every call.
     *
     * @param listener - Callback invoked with the updated charging session
     * @returns A unique listener ID that can be used to remove the listener
     *
     * @example
     * ```typescript
     * charge.listenForChargeUpdated(async (session) => {
     *     const latest = session.meterValues?.at(-1);
     *     console.log(`now at ${latest?.valueWh} Wh`);
     * });
     * ```
     */
    listenForChargeUpdated: (listener: (charge: EnyoCharge) => void | Promise<void>) => string;
    /**
     * Removes a previously registered listener.
     *
     * @param listenerId - The ID returned by {@link listenForChargeStarted},
     *   {@link listenForChargeStopped} or {@link listenForChargeUpdated}
     */
    removeListener: (listenerId: string) => void;
}