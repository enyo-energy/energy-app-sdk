// Category flexibility-announcement model — the category-scoped counterpart to
// the per-appliance flexibility announcement. A category announcement states what
// a whole appliance *category* (e.g. all chargers) needs, aggregated across its
// appliances: the manager owns the per-appliance breakdown, the decision maker
// only sees the category demand.
//
// This surface is published through
// `EnergyAppDiagnostics.publishCategoryFlexibility`, alongside what the decision
// maker actually *granted* back — so a dashboard can put "what was asked for"
// and "what was allowed" side by side.
//
// The repo otherwise leans on string-literal unions, but this shared model
// deliberately uses TS enums — the values below are the exact on-the-wire
// strings, so the enums stay wire-compatible while giving callers named members.

import {EnyoApplianceTypeEnum} from './enyo-appliance.js';

/**
 * Point in time inside the flexibility model, as epoch milliseconds.
 *
 * Note this deviates from the `*Iso` string timestamps used elsewhere in the
 * diagnostics types: the flexibility model is exchanged verbatim between the
 * energy manager and the decision maker, so its numeric wire format is kept.
 * The envelope published to diagnostics ({@link EnyoCategoryFlexibilityDiagnostics})
 * does carry an ISO timestamp, matching the rest of the diagnostics surface.
 */
export type EnyoFlexibilityTimestamp = number;

// ─── Vocabulary enums ───────────────────────────────────────

/** Discriminant tag for the four flexibility-announcement variants. */
export enum EnyoFlexibilityAnnouncementTypeEnum {
    /** Non-negotiable energy by a deadline (immediate / required charging). */
    RequiredKwhTarget = 'requiredKwhTarget',
    /** Energy goal, but cost-/PV-optimized, earliest or latest. */
    FlexibleKwhTarget = 'flexibleKwhTarget',
    /** Open-ended run within a window per an optimization mode, no fixed energy. */
    Flexible = 'flexible',
    /** Battery offers discharge flexibility (up to `kwh`) within a window. */
    FlexibleDischarge = 'flexibleDischarge',
}

/**
 * What a heat pump's flexibility is aimed at — gives the decision maker extra
 * context on the demand behind a heat-pump announcement. `Cooling` is reserved
 * for a future cooling mode and is not emitted yet.
 */
export enum EnyoFlexibilityHeatpumpTargetTypeEnum {
    Heating = 'heating',
    Cooling = 'cooling',
    Dhw = 'dhw',
}

/**
 * What an air-conditioning unit's flexibility is aimed at — extra context for
 * the decision maker. Cooling-only today; a heating variant may follow.
 */
export enum EnyoFlexibilityAirConditioningTargetTypeEnum {
    Cooling = 'cooling',
}

/**
 * Reach the energy target as early, or as late, as possible within the window —
 * or spread it at a near-constant power (`Paced`) so the target is met by
 * `rangeEnd` rather than ASAP. For a paced demand the constant floor lives in
 * `power.minWatt`.
 */
export enum EnyoFlexibilityTimingTargetEnum {
    Earliest = 'earliest',
    Latest = 'latest',
    Paced = 'paced',
}

/**
 * How a run is optimized.
 *
 * `PriceLimit`'s value matches `EnyoChargeModeEnum.PriceLimit` (`"price-limit"`)
 * for wire compatibility with the SDK charge mode. The two pv-surplus modes are
 * net-new — no SDK charge-mode enum covers them.
 */
export enum EnyoFlexibilityOptimizationModeEnum {
    PvSurplus = 'pv-surplus',
    PvSurplusPreferred = 'pv-surplus-preferred',
    PriceLimit = 'price-limit',
}

// ─── Shared value objects ───────────────────────────────────

/** Discrete power band the solver may pick from: [minWatt, maxWatt] in stepWatt steps. */
export interface EnyoFlexibilityPowerBand {
    /** Lower bound of the band, in Watts. Non-negative. */
    minWatt: number;
    /** Upper bound of the band, in Watts. MUST be ≥ `minWatt`. */
    maxWatt: number;
    /** Granularity the solver must respect between the bounds, in Watts. */
    stepWatt: number;
}

/** A delivery window, inclusive of both ends. */
export interface EnyoFlexibilityTimeRange {
    /** Start of the window, epoch milliseconds. */
    rangeStart: EnyoFlexibilityTimestamp;
    /** End of the window, epoch milliseconds. MUST be ≥ `rangeStart`. */
    rangeEnd: EnyoFlexibilityTimestamp;
}

/** The two pv-surplus modes as a type — a subset of {@link EnyoFlexibilityOptimizationModeEnum}. */
export type EnyoFlexibilityPvSurplusMode =
    | EnyoFlexibilityOptimizationModeEnum.PvSurplus
    | EnyoFlexibilityOptimizationModeEnum.PvSurplusPreferred;

/** Optimize against PV surplus; carries no price threshold. */
export interface EnyoFlexibilityPvSurplusOptimization {
    /** Which of the two pv-surplus modes applies. */
    optimizationMode: EnyoFlexibilityPvSurplusMode;
}

/** Optimize against a price ceiling. */
export interface EnyoFlexibilityPriceLimitOptimization {
    /** Always `PriceLimit` for this variant. */
    optimizationMode: EnyoFlexibilityOptimizationModeEnum.PriceLimit;
    /** Only import below this price. */
    priceLimitEuroCent: number;
}

/** Strict: `price-limit` ⇒ `priceLimitEuroCent` required; pv-surplus modes ⇒ forbidden. */
export type EnyoFlexibilityOptimizationSpec =
    | EnyoFlexibilityPvSurplusOptimization
    | EnyoFlexibilityPriceLimitOptimization;

/** Minimum contiguous run (at `power` watts) still needed to hit the target. */
export interface EnyoFlexibilityMinDuration {
    /** Reference watt at which the floor is computed. */
    power: number;
    /** Minimum contiguous run, in minutes, to still hit the target. */
    durationMinutes: number;
}

/**
 * A weighted alternative window for an open-ended `flexible` run. A higher
 * `efficiencyFactor` means a more efficient window (e.g. a heat-pump COP is
 * better in warmer hours).
 */
export interface EnyoFlexibilityVariant extends EnyoFlexibilityTimeRange {
    /** Relative desirability of this window; higher is better. */
    efficiencyFactor: number;
}

/** Open-ended run spec: a window + power band + optimization intent, optional variants. */
export type EnyoFlexibilityFlexibleSpec = EnyoFlexibilityTimeRange & {
    /** Power band the run may be placed in. */
    power: EnyoFlexibilityPowerBand;
    /** Weighted alternative windows inside the range. */
    variants?: EnyoFlexibilityVariant[];
} & EnyoFlexibilityOptimizationSpec;

/**
 * Optional extra context a manager can attach to an announcement to help the
 * decision maker — nested so future context keys can be added without touching
 * the announcement base.
 */
export interface EnyoFlexibilityAnnouncementContext {
    /** For heat-pump announcements: what the flexibility is aimed at. */
    heatpumpTargetType?: EnyoFlexibilityHeatpumpTargetTypeEnum;
    /** For air-conditioning announcements: what the flexibility is aimed at. */
    airConditioningTargetType?: EnyoFlexibilityAirConditioningTargetTypeEnum;
    /**
     * For storage announcements: the round-trip cost of cycling the battery, in
     * EUR per kWh. The floor a discharge has to beat to be worth licensing.
     */
    storageCycleCostEurPerKwh?: number;
    /**
     * For storage announcements: the physical discharge floor, in Watts. Signed —
     * negative means discharge, so this is the most negative power the storage can
     * physically reach.
     */
    storageMinPowerW?: number;
    /** For storage announcements: the physical charge ceiling, in Watts. */
    storageMaxPowerW?: number;
    /** For storage announcements: usable capacity of the storage, in Wh. */
    storageCapacityWh?: number;
    /**
     * For storage announcements: the discharge power we will actually command, in
     * Watts. May be well inside {@link storageMinPowerW} — today it is `0`, i.e. we
     * license discharge without commanding it.
     */
    storageCommandableDischargeW?: number;
    /**
     * For storage announcements: whether the storage accepts an explicit
     * `Discharge 0` command, i.e. can be told to hold rather than only being left
     * alone.
     */
    storageCanHold?: boolean;
}

// ─── Category announcements ─────────────────────────────────

/** Fields shared by every category-scoped flexibility announcement. */
export interface EnyoCategoryFlexibilityAnnouncementBase {
    /**
     * What this announcement IS, stable across cycles — e.g. `storage:peak-requirement`.
     * A category speaks with several at once and (category, type) does not tell them
     * apart. REQUIRED: a positional identity changes whenever a neighbour appears.
     */
    id: string;
    /** The appliance category this demand aggregates (e.g. `Charger`). */
    category: EnyoApplianceTypeEnum;
    /**
     * The appliance this announcement speaks for, when a category announces per
     * appliance rather than as one aggregate. Absent = the whole category.
     */
    applianceId?: string;
    /** Optional extra context for the decision maker; absent for most announcements. */
    context?: EnyoFlexibilityAnnouncementContext;
}

/** Non-negotiable: deliver `kwh` within the window (aggregated immediate charging). */
export interface EnyoCategoryRequiredKwhTargetAnnouncement extends EnyoCategoryFlexibilityAnnouncementBase {
    /** Discriminant; always `RequiredKwhTarget`. */
    flexibilityAnnouncementType: EnyoFlexibilityAnnouncementTypeEnum.RequiredKwhTarget;
    /** The non-negotiable energy demand and the window it must land in. */
    requiredKwhTarget: EnyoFlexibilityTimeRange & {
        /** Energy that must be delivered, in kWh. */
        kwh: number;
        /** Power band the delivery may use. */
        power: EnyoFlexibilityPowerBand;
        /**
         * Price ceiling, when the requirement is economic rather than absolute.
         * Present on the wire today; without it every economic requirement looked
         * like a MUST-RUN in diagnostics.
         */
        priceLimitEuroCent?: number;
    };
}

/** Deliver `kwh` flexibly (cost-/PV-optimized), aggregated across the category. */
export interface EnyoCategoryFlexibleKwhTargetAnnouncement extends EnyoCategoryFlexibilityAnnouncementBase {
    /** Discriminant; always `FlexibleKwhTarget`. */
    flexibilityAnnouncementType: EnyoFlexibilityAnnouncementTypeEnum.FlexibleKwhTarget;
    /** The flexible energy demand, its window, and how it should be optimized. */
    flexibleKwhTarget: EnyoFlexibilityTimeRange & {
        /** Energy that should be delivered, in kWh. */
        kwh: number;
        /** Whether to hit the target as early / as late as possible, or pace it. */
        target: EnyoFlexibilityTimingTargetEnum;
        /** Minimum contiguous run still needed to hit the target. */
        minDuration?: EnyoFlexibilityMinDuration;
        /** PV-surplus optimization intent, when the demand is PV-driven. */
        optimizationMode?: EnyoFlexibilityPvSurplusMode;
        /** Price ceiling, when the demand is price-driven. */
        priceLimitEuroCent?: number;
        /** Power band the delivery may use. */
        power: EnyoFlexibilityPowerBand;
        /**
         * Weighted alternative windows within the range the target may be met in — a
         * higher {@link EnyoFlexibilityVariant.efficiencyFactor} marks a cheaper /
         * more-efficient window. Used e.g. by a battery grid-charging on a dynamic
         * tariff to rank the cheap-hour windows so a consumer prefers the cheapest ones.
         */
        variants?: EnyoFlexibilityVariant[];
    };
}

/** Open-ended: run within the window per `optimizationMode`, no fixed energy target. */
export interface EnyoCategoryFlexibleAnnouncement extends EnyoCategoryFlexibilityAnnouncementBase {
    /** Discriminant; always `Flexible`. */
    flexibilityAnnouncementType: EnyoFlexibilityAnnouncementTypeEnum.Flexible;
    /** The open-ended run spec. */
    flexible: EnyoFlexibilityFlexibleSpec;
}

/**
 * A category can *discharge* up to `kwh` (aggregated across its appliances, e.g. all
 * batteries) at `marginalCostEurPerKwh`. Direction is the discriminant, not a power
 * sign — `power` is non-negative. Used by the battery manager to offer stored energy
 * back to the merit order above the reserve floor.
 */
export interface EnyoCategoryFlexibleDischargeAnnouncement extends EnyoCategoryFlexibilityAnnouncementBase {
    /** Discriminant; always `FlexibleDischarge`. */
    flexibilityAnnouncementType: EnyoFlexibilityAnnouncementTypeEnum.FlexibleDischarge;
    /** The discharge offer and the window it is valid in. */
    flexibleDischarge: EnyoFlexibilityTimeRange & {
        /** Energy offered for discharge, in kWh. */
        kwh: number;
        /** Power band the discharge may use. Non-negative. */
        power: EnyoFlexibilityPowerBand;
        /** Marginal cost of discharging this energy, in EUR per kWh. */
        marginalCostEurPerKwh: number;
    };
}

/** The category-level flexibility announcements a manager broadcasts. */
export type EnyoCategoryFlexibilityAnnouncement =
    | EnyoCategoryRequiredKwhTargetAnnouncement
    | EnyoCategoryFlexibleKwhTargetAnnouncement
    | EnyoCategoryFlexibleAnnouncement
    | EnyoCategoryFlexibleDischargeAnnouncement;

// ─── Category grants ────────────────────────────────────────

/**
 * How much of an announcement the decision maker let through.
 *
 * - `Granted` — the announcement was honoured in full.
 * - `PartiallyGranted` — honoured, but narrowed (less energy, less power, or a
 *   shorter window). `reason` should explain what was cut.
 * - `Denied` — nothing was allocated to the category for this announcement.
 *   `reason` should explain why.
 */
export enum EnyoCategoryFlexibilityGrantStatusEnum {
    /** The announcement was honoured in full. */
    Granted = 'granted',
    /** The announcement was honoured but narrowed; `reason` explains. */
    PartiallyGranted = 'partially-granted',
    /** Nothing was allocated for this announcement; `reason` explains. */
    Denied = 'denied',
}

/**
 * What the decision maker actually granted a category, in answer to a
 * {@link EnyoCategoryFlexibilityAnnouncement}.
 *
 * A grant is deliberately flatter than the announcement it answers: the decision
 * maker replies with one allocation — a window, a power envelope, and (for the
 * energy-target and discharge variants) an amount of energy — regardless of which
 * announcement variant produced it. Pairing is by `announcementId` — the `id` of
 * the announcement being answered — which stays stable across cycles and tells
 * apart the several announcements one category may speak with at once.
 */
export interface EnyoCategoryFlexibilityGrant {
    /** The `id` of the announcement this answers. */
    announcementId: string;
    /** The appliance category this allocation is for (e.g. `Charger`). */
    category: EnyoApplianceTypeEnum;
    /** Which announcement variant this grant answers. */
    flexibilityAnnouncementType: EnyoFlexibilityAnnouncementTypeEnum;
    /** Whether the announcement was granted fully, narrowed, or denied. */
    status: EnyoCategoryFlexibilityGrantStatusEnum;
    /**
     * The window the category may use. Omitted when `status` is `Denied`.
     * MUST fall inside the announced window when present.
     */
    grantedRange?: EnyoFlexibilityTimeRange;
    /**
     * The power envelope the category may use. Omitted when `status` is `Denied`.
     * MUST fall inside the announced band when present.
     */
    grantedPower?: EnyoFlexibilityPowerBand;
    /**
     * Energy granted, in kWh. Present for the energy-target and discharge variants
     * (`RequiredKwhTarget`, `FlexibleKwhTarget`, `FlexibleDischarge`); absent for
     * open-ended `Flexible` grants, which carry no energy figure, and when `status`
     * is `Denied`.
     */
    grantedKwh?: number;
    /**
     * Required when `status` is `PartiallyGranted` or `Denied` — a short,
     * human-readable explanation of what was cut and why (e.g. `'grid connection
     * point limit'`).
     */
    reason?: string;
}

// ─── Diagnostics payload ────────────────────────────────────

/**
 * One snapshot of the category-level flexibility exchange: everything the
 * managers announced this round, and everything the decision maker granted back.
 *
 * Published via `EnergyAppDiagnostics.publishCategoryFlexibility`. Both lists are
 * complete snapshots, not deltas — a category that announced nothing simply has
 * no entry.
 */
export interface EnyoCategoryFlexibilityDiagnostics {
    /** ISO 8601 timestamp when this snapshot was taken. */
    generatedAtIso: string;
    /**
     * The flexibility the managers announced, one entry per announcement `id`.
     */
    announced: EnyoCategoryFlexibilityAnnouncement[];
    /**
     * What the decision maker granted in answer to `announced`. Every entry SHOULD
     * pair with an `announced` entry by `announcementId`; an announcement with no
     * matching grant means the decision had not been taken
     * yet when the snapshot was produced.
     */
    granted: EnyoCategoryFlexibilityGrant[];
}
