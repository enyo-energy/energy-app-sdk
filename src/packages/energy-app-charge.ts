import {EnyoCharge, EnyoChargeFilter, EnyoDefaultChargeMode} from "../types/enyo-charge.js";

/**
 * Interface for managing charging sessions in enyo packages.
 * Provides operations for charge session tracking and management.
 */
export interface EnergyAppCharge {
    /** Save or update a charging session in the system */
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
}