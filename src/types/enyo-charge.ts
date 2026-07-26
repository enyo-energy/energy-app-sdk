import {EnyoChargeModeEnum} from "./enyo-data-bus-value.js";

/**
 * Status of a charging session
 */
export enum EnyoChargeStatus {
    /** Charging session is active */
    Charging = 'Charging',
    /** Charging session completed successfully */
    Completed = 'Completed',
    /** Charging session ended due to fault */
    Failed = 'Failed'
}

/**
 * Meter values recorded during a charging session
 */
export interface ChargeMeterValue {
    /** Timestamp when the value was recorded */
    timestamp: Date;
    /** Energy value in Watt hours */
    valueWh: number;
    /** Price per kWh at the time of measurement */
    pricePerKwh?: number;
    /** Charging cost in Euro for this measurement */
    chargingCostEuro?: number;
    /** Current on phase 1 in Amperes */
    currentPhase1: number;
    /** Current on phase 2 in Amperes */
    currentPhase2?: number;
    /** Current on phase 3 in Amperes */
    currentPhase3?: number;
}

/**
 * Represents a charging session in the enyo system.
 * Contains all relevant information about an EV charging transaction.
 */
export interface EnyoCharge {
    /** Unique identifier for the charging session */
    id: string;
    /** Transaction ID for the charging session */
    transactionId: string;
    /**
     * Additional transaction IDs associated with this charging session.
     *
     * A single physical charging session can span multiple OCPP
     * transactions (e.g. after a short interruption or re-authorization).
     * These supplementary transaction IDs are tracked here in addition to
     * the primary {@link EnyoCharge.transactionId}.
     */
    additionalTransactionIds?: string[];
    /** ID of the appliance (charger) handling this session */
    applianceId: string;
    /** ID of the charging card used for this session */
    chargingCardId?: string;
    /** Connector ID on the charge point */
    connectorId?: number;
    /** ID of the vehicle being charged */
    vehicleId?: string;
    /** Current status of the charging session */
    status: EnyoChargeStatus;
    /** Meter reading at session start in Watt hours */
    meterStartValueWh?: number;
    /** Meter reading at session end in Watt hours */
    meterEndValueWh?: number;
    /** Paid price in Euro cents */
    paidPriceEuroCent?: number;
    /** Total energy delivered in kWh */
    totalEnergyKwh?: number;
    /** Timestamp when charging started */
    startTime?: Date;
    /** Timestamp when charging ended */
    endTime?: Date;
    /** Array of meter values recorded during the session */
    meterValues?: ChargeMeterValue[];
    /** Number of phases used for charging */
    numberOfPhases: number;
    /** Active charging schedule entries, if smart charging is in use */
    schedule?: EnyoChargeScheduleEntry[];
    /** Charging mode applied to this session (e.g. immediate, cost-optimized, price-limit) */
    chargeMode?: EnyoChargeModeEnum;
    /** Target completion time for the charging session as an ISO 8601 timestamp */
    completeAtIsoTimestamp?: string;
}

/**
 * Represents a single entry in a charging schedule.
 * Defines a time-bound current limit for smart charging.
 */
export interface EnyoChargeScheduleEntry {
    /** Start time in seconds relative to the charge session start */
    relativeStartSeconds: number;
    /** Absolute start time as an ISO 8601 timestamp */
    absoluteStartIso: string;
    /** Current limit in Ampere for this schedule period */
    limitAmpere: number;
}

/**
 * Default charging preference applied to charging sessions when no
 * per-session mode is explicitly provided.
 */
export interface EnyoDefaultChargeMode {
    /** The default charging mode (e.g. immediate, cost-optimized, price-limit) */
    chargeMode: EnyoChargeModeEnum;
    /**
     * Optional target completion time as a wall-clock time in the
     * accompanying {@link EnyoDefaultChargeMode.timezone} (e.g. `"07:30"`).
     * When set, optimized modes plan the session to finish by this time.
     */
    completeAtTime?: string;
    /**
     * IANA timezone the {@link EnyoDefaultChargeMode.completeAtTime} is
     * expressed in (e.g. `"Europe/Berlin"`). Should be provided whenever
     * `completeAtTime` is set so the wall-clock time can be resolved
     * unambiguously.
     */
    timezone?: string;
}

export interface EnyoChargeFilter {
    /** Filter by specific appliance ID */
    applianceId?: string;
    /** Filter by specific charge point ID */
    chargePointId?: string;
    /** Filter sessions starting after this ISO timestamp */
    startDate?: string;
    /** Filter sessions ending before this ISO timestamp */
    endDate?: string;
    /** Filter by charging session status */
    status?: EnyoChargeStatus;
    /** Filter by chargingCard */
    chargingCardId?: string;
    /** Filter by vehicle */
    vehicleId?: string;
}