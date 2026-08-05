import {EnyoCurrencyEnum} from "./enyo-currency.js";
import {EnergyAppApplianceTypeEnum} from "../energy-app-appliance-type.enum.js";

/**
 * How the figures in an {@link EnyoDailySavingsReport} were produced.
 */
export enum EnyoSavingsMethodEnum {
    /**
     * Measured day replayed against an uncontrolled simulation, after the fact.
     *
     * The environment (PV generation, base load, EV sessions, prices, ...) is
     * taken from what was actually measured; only the control decisions are
     * simulated away. This is the authoritative method and the only one that
     * should feed customer-facing totals.
     */
    Settled = 'Settled',
    /**
     * Forward-looking estimate for a day that has not finished yet.
     *
     * Both worlds rest on forecasts, so the figure will change until the day is
     * settled. Consumers should treat a `Projected` report as provisional and
     * expect it to be replaced by a `Settled` one.
     */
    Projected = 'Projected',
}

/**
 * How much trust a consumer may place in a published report.
 *
 * Rollups (month, year, lifetime) MUST exclude {@link EnyoSavingsConfidenceEnum.Low}
 * days. Keeping that rule on the platform side — rather than in every consumer —
 * is the reason confidence is a first-class field rather than something derived
 * from {@link EnyoDailySavingsReport.coverage}.
 */
export enum EnyoSavingsConfidenceEnum {
    /** All inputs were complete and the two worlds balanced; safe to aggregate. */
    High = 'High',
    /** At least one {@link EnyoSavingsIssue} applies; exclude from rollups. */
    Low = 'Low',
}

/**
 * Machine-readable reason why a report's confidence is not
 * {@link EnyoSavingsConfidenceEnum.High}.
 */
export enum EnyoSavingsIssueCodeEnum {
    /** An input series did not cover the whole day. */
    IncompleteData = 'IncompleteData',
    /** The two worlds did not move the same energy — the comparison is not valid. */
    EnergyImbalance = 'EnergyImbalance',
    /** No tariff for (part of) the day; a default price was substituted. */
    TariffUnavailable = 'TariffUnavailable',
    /** PV was curtailed by control, so measured generation understates the roof. */
    GenerationCurtailed = 'GenerationCurtailed',
    /** The day was only partially observed (e.g. commissioning day). */
    PartialDay = 'PartialDay',
}

/**
 * Origin of one input series used by the calculation, as reported in
 * {@link EnyoSavingsSeriesCoverage}.
 */
export enum EnyoSavingsDataSourceEnum {
    /** Real measured values from the device / platform timeseries. */
    Measured = 'Measured',
    /** Substituted values (defaults, interpolation, a standard load profile). */
    Fallback = 'Fallback',
    /** Nothing available — the series contributed no data at all. */
    Missing = 'Missing',
}

/**
 * A single reason the confidence of a report was downgraded.
 */
export interface EnyoSavingsIssue {
    /** Machine-readable issue category, used for filtering and alerting. */
    code: EnyoSavingsIssueCodeEnum;
    /**
     * Human-readable detail for support and debugging — e.g.
     * `"pv series covered 84/96 buckets"`. Not intended for the end user and
     * therefore not translated.
     */
    detail: string;
}

/**
 * The monetary result of the day: what it cost, what it would have cost
 * uncontrolled, and the difference broken down by mechanism.
 *
 * Both worlds are published — never only the delta — so that the platform can
 * verify, re-derive and roll up the figures without asking the device again.
 */
export interface EnyoSavingsCosts {
    /** Currency all monetary fields in this report are denominated in. */
    currency: EnyoCurrencyEnum;
    /** What the day actually cost: grid import priced, feed-in credited. */
    optimizedCost: number;
    /** What the same day would have cost uncontrolled. */
    baselineCost: number;
    /** `baselineCost - optimizedCost`. Positive = the customer saved money. */
    savings: number;
    /**
     * Portion of {@link savings} attributable to consuming own generation
     * instead of importing. Together with {@link savingsFromArbitrage} this sums
     * to {@link savings}.
     */
    savingsFromSelfConsumption: number;
    /**
     * Portion of {@link savings} attributable to shifting grid import/export in
     * time against a varying price. Together with
     * {@link savingsFromSelfConsumption} this sums to {@link savings}.
     */
    savingsFromArbitrage: number;
}

/**
 * The energy terms behind the costs, for both the optimized (measured) and the
 * baseline (uncontrolled) world.
 *
 * The shared terms at the top move identically in both worlds — that is exactly
 * what makes the two costs comparable. All values are in watt-hours (Wh), per
 * the platform-wide unit convention.
 */
export interface EnyoSavingsEnergy {
    /** Total PV generation over the day. Identical in both worlds. */
    pvGenerationWh: number;
    /** Uncontrollable household base load over the day. Identical in both worlds. */
    baseLoadWh: number;
    /** Energy delivered to vehicles. Identical in both worlds, only shifted in time. */
    evChargingWh: number;
    /** Electrical energy consumed for heating / DHW. Identical in both worlds. */
    heatingWh: number;

    /** Grid import in the optimized (measured) world. */
    optimizedGridImportWh: number;
    /** Grid feed-in in the optimized (measured) world. */
    optimizedGridFeedInWh: number;
    /** Grid import in the baseline (uncontrolled) world. */
    baselineGridImportWh: number;
    /** Grid feed-in in the baseline (uncontrolled) world. */
    baselineGridFeedInWh: number;

    /** Energy charged into battery storage in the optimized world. */
    optimizedBatteryChargeWh: number;
    /** Energy discharged from battery storage in the optimized world. */
    optimizedBatteryDischargeWh: number;
    /** Energy charged into battery storage in the baseline world. */
    baselineBatteryChargeWh: number;
    /** Energy discharged from battery storage in the baseline world. */
    baselineBatteryDischargeWh: number;

    /**
     * Stored energy at day end minus day start, optimized world.
     *
     * A day-scoped cost ignores what is still in the battery at midnight, so the
     * two worlds must be corrected by their respective deltas before their costs
     * are compared — otherwise a control strategy that simply ends the day with a
     * fuller battery looks like a saving.
     */
    optimizedStoredEnergyDeltaWh: number;
    /**
     * Stored energy at day end minus day start, baseline world. See
     * {@link optimizedStoredEnergyDeltaWh}.
     */
    baselineStoredEnergyDeltaWh: number;
}

/**
 * Derived key figures for the day, reported for both worlds so a consumer can
 * show "with vs. without energy management" without recomputing anything.
 */
export interface EnyoSavingsMetrics {
    /** Share of generation used on site in the optimized world, `0`–`1`. */
    optimizedSelfConsumptionRatio: number;
    /** Share of generation used on site in the baseline world, `0`–`1`. */
    baselineSelfConsumptionRatio: number;
    /** Share of consumption covered without the grid, optimized world, `0`–`1`. */
    optimizedSelfSufficiencyRatio: number;
    /** Share of consumption covered without the grid, baseline world, `0`–`1`. */
    baselineSelfSufficiencyRatio: number;
    /**
     * Volume-weighted average price actually paid per imported kWh, in
     * {@link EnyoSavingsCosts.currency}.
     */
    optimizedAverageImportPricePerKwh: number;
    /**
     * Volume-weighted average price that would have been paid per imported kWh
     * uncontrolled, in {@link EnyoSavingsCosts.currency}.
     */
    baselineAverageImportPricePerKwh: number;
    /**
     * Avoided emissions in grams of CO₂ versus the baseline world. Optional —
     * only set when the grid mix for the day is known.
     */
    avoidedCo2G?: number;
    /** Number of distinct EV charging sessions observed on this day. */
    evChargingSessions: number;
    /** Number of slots in which generation was curtailed by control. */
    curtailedSlots: number;
}

/**
 * Which appliance category contributed how much of the day's saving.
 *
 * The {@link savings} values across all entries should sum to
 * {@link EnyoSavingsCosts.savings}.
 */
export interface EnyoSavingsAttribution {
    /** The appliance category this entry accounts for. */
    applianceType: EnergyAppApplianceTypeEnum;
    /**
     * This category's share of {@link EnyoSavingsCosts.savings}, in the report's
     * currency. May be negative if a category cost money on this day.
     */
    savings: number;
    /**
     * Energy this category shifted in time relative to the uncontrolled run, in
     * watt-hours. Same total energy, different moment — this quantifies "how
     * much was moved", not "how much extra was used".
     */
    shiftedEnergyWh: number;
}

/**
 * Completeness of one input series the calculation rested on.
 *
 * Published for every series so that a support case can tell a genuinely small
 * saving apart from a saving that is small because half the data was missing.
 */
export interface EnyoSavingsSeriesCoverage {
    /**
     * Identifier of the series, e.g. `pv`, `baseLoad`, `gridImport`, `heatpump`,
     * `prices`, `evSessions`. Free-form so an app can report series the SDK does
     * not know about; keep the value stable across days.
     */
    series: string;
    /** Where the values for this series came from. */
    source: EnyoSavingsDataSourceEnum;
    /**
     * How many buckets the day should have had for this series. Derive it from
     * {@link EnyoDailySavingsReport.dayStartUtcMs} / `dayEndUtcMs` — a DST day
     * has 92 or 100 quarter-hour buckets, never 96.
     */
    expectedBuckets: number;
    /** How many buckets actually carried a value. */
    presentBuckets: number;
}

/**
 * One assumption the counterfactual rested on, stored alongside the result.
 *
 * The uncontrolled world cannot be measured, only modelled, and the model has
 * knobs (battery efficiencies, uncontrolled charge rate, thermostat shape). A
 * single one of them can move a day's figure noticeably, so the values are
 * published with the report: without them, changing a default silently rewrites
 * history and no support case can be reconstructed afterwards.
 */
export interface EnyoSavingsAssumption {
    /** Dotted key identifying the assumption, e.g. `battery.dischargeEfficiency`. */
    key: string;
    /** The value that was used for this day's calculation. */
    value: number | string | boolean;
}

/**
 * Optional per-slot detail behind a daily report.
 *
 * Omitted by default: 96 rows per day per site is meaningful storage for data
 * the app can regenerate on demand, since settlement is stateless. Publish it
 * only for days under investigation.
 */
export interface EnyoDailySavingsSlot {
    /** Start of the slot as an ISO-8601 timestamp with offset. */
    timestampIso: string;
    /** Start of the slot as Unix epoch milliseconds (UTC). */
    timestampUtcMs: number;
    /** Grid import during this slot, optimized world, in watt-hours. */
    optimizedGridImportWh: number;
    /** Grid feed-in during this slot, optimized world, in watt-hours. */
    optimizedGridFeedInWh: number;
    /** Grid import during this slot, baseline world, in watt-hours. */
    baselineGridImportWh: number;
    /** Grid feed-in during this slot, baseline world, in watt-hours. */
    baselineGridFeedInWh: number;
    /** Import price that applied in this slot, per kWh, in the report's currency. */
    consumptionPricePerKwh: number;
    /** Feed-in remuneration in this slot, per kWh, in the report's currency. */
    feedInPricePerKwh: number;
    /** Cost of this slot in the optimized world. */
    optimizedCost: number;
    /** Cost of this slot in the baseline world. */
    baselineCost: number;
}

/**
 * A complete, self-contained savings report for one local calendar day.
 *
 * Produced by replaying a day's measured environment through a simulation of the
 * same house running uncontrolled and pricing both worlds against the tariff that
 * actually applied. The difference is what the energy management saved the
 * customer that day.
 *
 * The payload deliberately carries both worlds, the energy terms behind them,
 * the completeness of every input and the assumptions of the counterfactual —
 * enough for the platform to verify, re-derive and roll the figures up without
 * querying the device again, and enough for a stored figure to stay reproducible
 * after the calculator changes.
 *
 * Units follow the platform convention: energy in Wh, power in W, prices per
 * kWh, currency as {@link EnyoCurrencyEnum}.
 */
export interface EnyoDailySavingsReport {
    /**
     * Schema version of this payload. Bump on any breaking field change so the
     * platform can tell old records apart from new ones.
     */
    schemaVersion: number;

    /**
     * The LOCAL calendar day this report is for, formatted `YYYY-MM-DD`.
     * Together with {@link method} this forms the upsert key of
     * {@link EnergyAppSavings.publishDailySavings}.
     */
    dayIso: string;
    /** IANA zone the local day was derived in, e.g. `Europe/Berlin`. */
    timeZone: string;
    /**
     * Inclusive start of the day as Unix epoch milliseconds (UTC).
     * Published explicitly because a DST day is 23 or 25 hours long — never
     * assume 24 h or 96 quarter-hour buckets.
     */
    dayStartUtcMs: number;
    /** Exclusive end of the day as Unix epoch milliseconds (UTC). */
    dayEndUtcMs: number;

    /**
     * How the figures were produced. `Settled` means the measured day was
     * replayed after the fact; `Projected` means the day had not finished yet.
     */
    method: EnyoSavingsMethodEnum;
    /** When this report was computed, ISO-8601 with offset. */
    computedAtIso: string;
    /**
     * Version of the algorithm that produced this report. Lets the platform spot
     * reports that predate a model change and ask for a recompute.
     */
    calculatorVersion: string;

    /** Whether this day may be included in month/year rollups. */
    confidence: EnyoSavingsConfidenceEnum;
    /**
     * Why {@link confidence} is not {@link EnyoSavingsConfidenceEnum.High}.
     * Empty when it is.
     */
    confidenceIssues: EnyoSavingsIssue[];

    /** The monetary result: both worlds and the split of the difference. */
    costs: EnyoSavingsCosts;
    /** The energy terms behind the costs, for both worlds. */
    energy: EnyoSavingsEnergy;
    /** Derived key figures for the day, for both worlds. */
    metrics: EnyoSavingsMetrics;
    /** Which appliance category contributed how much of the saving. */
    attribution: EnyoSavingsAttribution[];
    /** Completeness of every input series the calculation rested on. */
    coverage: EnyoSavingsSeriesCoverage[];
    /** The counterfactual's assumptions, so a stored figure stays reproducible. */
    assumptions: EnyoSavingsAssumption[];

    /**
     * Optional per-slot detail. Omit by default — the app can regenerate it on
     * demand from timeseries, since settlement is stateless.
     */
    slots?: EnyoDailySavingsSlot[];
}

/**
 * Query for previously published daily savings reports.
 *
 * The typical use is boot-time backfill: ask for the retention window, and use
 * {@link EnyoDailySavingsResponse.missingDayIsos} to decide which days still
 * need to be settled.
 */
export interface EnyoDailySavingsRequest {
    /** Inclusive local start day, formatted `YYYY-MM-DD`. */
    startDayIso: string;
    /** Inclusive local end day, formatted `YYYY-MM-DD`. */
    endDayIso: string;
    /**
     * Restrict the result to a single method. When omitted, reports of every
     * method are returned — a day may carry both a `Projected` and a `Settled`
     * report.
     */
    method?: EnyoSavingsMethodEnum;
    /**
     * Include the per-slot detail if it was published. Defaults to `false`,
     * because slots are large and rarely needed.
     */
    includeSlots?: boolean;
}

/**
 * Result of {@link EnergyAppSavings.getDailySavings}.
 */
export interface EnyoDailySavingsResponse {
    /**
     * The reports found in the requested range, ascending by
     * {@link EnyoDailySavingsReport.dayIso}. Per-slot detail is only present when
     * it was published AND {@link EnyoDailySavingsRequest.includeSlots} was set.
     */
    reports: EnyoDailySavingsReport[];
    /**
     * Days in the requested range that carry no report — exactly the set the app
     * must backfill. When {@link EnyoDailySavingsRequest.method} is set, a day
     * counts as missing if it has no report for that method.
     */
    missingDayIsos: string[];
}
