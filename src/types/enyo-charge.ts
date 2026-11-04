import {EnyoChargeModeEnum, EnyoPriceLimitModeEnum} from "./enyo-data-bus-value.js";

/**
 * Where the vehicle on a charging session came from.
 *
 * Kept apart from "is {@link EnyoCharge.vehicleId} set" because the two answer
 * different questions: a manually assigned session and a recognised one both
 * carry an id, but only the recognised one says anything about the wallbox's
 * ability to identify cars.
 */
export enum EnyoChargeVehicleAssignmentEnum {
    /** The charger or an integration recognised the car on its own. */
    Detected = 'detected',
    /** A user picked the car, either at plug-in or afterwards in the history. */
    Manual = 'manual',
    /**
     * No car is assigned. A normal outcome rather than a fault — plenty of
     * wallboxes cannot identify a vehicle, and the history offers this as
     * something to fix rather than reporting it as an error.
     */
    Unknown = 'unknown',
}

/**
 * Where the price ceiling that governed a charging session was configured.
 *
 * A session's ceiling is resolved from the most specific place that has one,
 * and the history needs to say which one won — "why did my car wait?" has a
 * different fix depending on whether the limit sits on the session, the car or
 * the wallbox. There is no house-wide energy manager ceiling.
 */
export enum EnyoChargePriceLimitSourceEnum {
    /**
     * The ceiling set for this one session — at start
     * ({@link EnyoDataBusStartChargeV1.data.priceLimitMode} and its values) or
     * changed mid-session ({@link EnyoDataBusChangeChargeModeV1}).
     */
    Session = 'session',
    /** The ceiling configured on the vehicle (`EnyoVehicle.priceLimitMode` and its values). */
    Vehicle = 'vehicle',
    /**
     * The ceiling configured on the wallbox (charger appliance) handling the
     * session (`EnyoChargerApplianceMetadata.priceLimitMode` and its values).
     */
    Wallbox = 'wallbox',
}

/**
 * Where the deadline that a {@link EnyoChargeModeEnum.CostOptimized} session
 * planned against was configured — the counterpart of
 * {@link EnyoChargePriceLimitSourceEnum} for {@link EnyoCharge.completeAtIsoTimestamp}.
 *
 * The deadline is resolved from the most specific place that has one, and the
 * history needs to say which one won — "why was my car only ready at 9?" has a
 * different fix depending on whether the time sits on the session, the car or
 * the wallbox. There is no house-wide energy manager deadline.
 */
export enum EnyoChargeCompleteAtSourceEnum {
    /**
     * The deadline set for this one session — at start
     * ({@link EnyoDataBusStartChargeV1.data.completeChargeAtIso}) or changed
     * mid-session ({@link EnyoDataBusChangeChargeModeV1.data.completeChargeAtIso}).
     */
    Session = 'session',
    /** The departure time configured on the vehicle (`EnyoVehicle.departureTimeHHmm`). */
    Vehicle = 'vehicle',
    /**
     * The deadline configured on the wallbox (charger appliance) handling the
     * session (`EnyoChargerApplianceMetadata.departureTimeHHmm`).
     */
    Wallbox = 'wallbox',
}

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
    /**
     * Where the deadline in {@link completeAtIsoTimestamp} came from — the
     * session itself, the vehicle or the wallbox. See
     * {@link EnyoChargeCompleteAtSourceEnum}.
     *
     * Only meaningful under {@link EnyoChargeModeEnum.CostOptimized}. Omitted
     * when there was no deadline, and on sessions recorded before the source
     * was tracked.
     */
    completeAtSource?: EnyoChargeCompleteAtSourceEnum;
    /**
     * State of charge at plug-in, in percent (0-100) — the host's estimate as
     * the user corrected it.
     *
     * Fixed for the session, because it describes a moment and not a
     * preference. The charging screen draws its progress bar from here to
     * {@link targetSocPercent}.
     *
     * This is the recorded counterpart of
     * {@link EnyoDataBusStartChargeV1.data.startSocPercent}: the command says
     * what the session was asked for, the charge says what it ran with.
     */
    startSocPercent?: number;
    /**
     * State of charge this session was to reach, in percent (0-100). The
     * vehicle's standing charge limit unless the user overrode it for this one
     * session.
     */
    targetSocPercent?: number;
    /**
     * How the grid price ceiling that governed this session was expressed, or
     * omitted when there was **no ceiling** — recorded so the history can say
     * why a session waited instead of charging.
     *
     * Decides which of {@link priceLimitCtPerKwh} and
     * {@link priceLimitSharePercent} applied; the other was ignored.
     */
    priceLimitMode?: EnyoPriceLimitModeEnum;
    /**
     * The absolute ceiling that applied, in **cents per kWh** (`25` is
     * 25 ct/kWh). Only meaningful while {@link priceLimitMode} is
     * {@link EnyoPriceLimitModeEnum.CtPerKwh}.
     */
    priceLimitCtPerKwh?: number;
    /**
     * The relative ceiling that applied — the cheapest share of the day the
     * session was allowed to import in, in percent. Only meaningful while
     * {@link priceLimitMode} is {@link EnyoPriceLimitModeEnum.CheapestShare}.
     *
     * Note this records the *setting*, not the price threshold it resolved to;
     * that threshold is {@link effectivePriceLimitCtPerKwh}.
     */
    priceLimitSharePercent?: number;
    /**
     * Where the ceiling described by {@link priceLimitMode} came from — the
     * session itself, the vehicle or the wallbox. See
     * {@link EnyoChargePriceLimitSourceEnum}.
     *
     * Omitted when there was no ceiling, and on sessions recorded before the
     * source was tracked.
     */
    priceLimitSource?: EnyoChargePriceLimitSourceEnum;
    /**
     * The price ceiling actually applied, in **cents per kWh** (`25` is
     * 25 ct/kWh) — the absolute threshold above which the session did not
     * import, whichever way the ceiling was expressed.
     *
     * Under {@link EnyoPriceLimitModeEnum.CtPerKwh} it equals
     * {@link priceLimitCtPerKwh}. Under
     * {@link EnyoPriceLimitModeEnum.CheapestShare} it is the threshold the
     * share resolved to against the known prices; that threshold moves as
     * later prices publish, so on a running session this is the latest
     * resolution and may change with each update.
     *
     * Cents, like the other ceiling fields — divide by 100 before comparing it
     * with EUR/kWh price fields such as
     * {@link EnyoDiagnosticsActionReason.electricityPricePerKwh}. Negative
     * values are legal. Omitted when there was no ceiling.
     */
    effectivePriceLimitCtPerKwh?: number;
    /**
     * How this session found its vehicle — see
     * {@link EnyoChargeVehicleAssignmentEnum}. Absent on sessions recorded
     * before the distinction existed; treat that as
     * {@link EnyoChargeVehicleAssignmentEnum.Unknown} only when
     * {@link vehicleId} is unset too.
     */
    vehicleAssignment?: EnyoChargeVehicleAssignmentEnum;
    /**
     * Charging power the user dialled for this session, in **Watts**.
     *
     * Only meaningful under {@link EnyoChargeModeEnum.Immediate}, where how
     * fast to charge is the customer's call rather than the energy manager's.
     * Recorded on the session so reopening it shows the figure actually in
     * force.
     *
     * Watts, matching
     * {@link EnyoAvailablePowerCommandData.powerW} — note the SDK's other
     * charging ceilings do not agree on a unit:
     * {@link EnyoChargeScheduleEntry.limitAmpere} is in Amperes and the
     * superseded {@link EnyoDataBusChangeChargingPowerV1} is in kW.
     *
     * **Not a second limit.** The energy manager's power envelope
     * ({@link EnyoDataBusSetChargerAvailablePowerV2}) still bounds the session;
     * this is what the user asked for within it.
     */
    maxChargingPowerW?: number;
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
    /**
     * Filter by how the session found its vehicle. Mainly useful for
     * {@link EnyoChargeVehicleAssignmentEnum.Unknown} — the sessions a user
     * can still be asked to assign a car to.
     */
    vehicleAssignment?: EnyoChargeVehicleAssignmentEnum;
}