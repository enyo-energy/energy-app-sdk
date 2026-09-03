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
 * A single sample recorded during a charging session — the charger's meter
 * reading at one instant, plus whatever electrical detail it reported with it.
 *
 * `timestamp` and `valueWh` are the load-bearing pair: every energy total and
 * every cost in a charge is a delta between two samples' `valueWh`, walked in
 * timestamp order (see `calculateChargeCost()`). The rest is detail the charger
 * may or may not report.
 *
 * **Pricing fields are normally filled in by the host, not the app.** Leave
 * {@link pricePerKwh} and {@link chargingCostEuro} unset and the host resolves
 * the tariff for the sample's 15-minute slot and derives the incremental cost
 * itself; set them and your values are kept. Deriving them app-side means
 * reimplementing the tariff lookup, and getting the cent-native unit of
 * `pricePerKwh` wrong there is a silent factor-100 error in the customer's bill.
 */
export interface ChargeMeterValue {
    /** Timestamp when the value was recorded */
    timestamp: Date;
    /** Energy value in Watt hours */
    valueWh: number;
    /**
     * Price per kWh at the time of measurement, in **Euro cents** (ct/kWh) —
     * not Euro. Usually left unset for the host to resolve from the appliance's
     * electricity tariff; see the note on {@link ChargeMeterValue}.
     */
    pricePerKwh?: number;
    /**
     * Incremental charging cost in **Euro** for this sample — the energy
     * delivered since the previous sample priced at {@link pricePerKwh}, not a
     * running total. Usually left unset for the host to derive.
     */
    chargingCostEuro?: number;
    /** Current on phase 1 in Amperes */
    currentPhase1: number;
    /** Current on phase 2 in Amperes */
    currentPhase2?: number;
    /** Current on phase 3 in Amperes */
    currentPhase3?: number;
    /**
     * Active charging power in Watt at the moment of the sample.
     *
     * Optional because not every charger reports it and it is derivable from
     * the `valueWh` deltas — but only coarsely, at the sampling interval, which
     * is why a charger that does report it should write it here. When omitted,
     * the host keeps whatever power it already recorded for a sample with this
     * timestamp (its own meter-value stream may have seen one) rather than
     * overwriting it with a zero.
     */
    powerW?: number;
    /** Voltage on phase 1 in Volt, when the charger reports it. */
    voltageL1?: number;
    /** Voltage on phase 2 in Volt, when the charger reports it. */
    voltageL2?: number;
    /** Voltage on phase 3 in Volt, when the charger reports it. */
    voltageL3?: number;
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