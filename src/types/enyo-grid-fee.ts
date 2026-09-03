import {EnyoCurrencyEnum} from './enyo-currency.js';
import {ForecastResolutionEnum} from './enyo-forecasting.js';
import {EnyoPriceAppliesToEnum, EnyoPriceSchedule} from './enyo-price-schedule.js';

/**
 * A registered dynamic grid fee (network charge).
 *
 * A grid fee is the component of the electricity price the grid operator (DSO)
 * charges for transporting the energy. Historically it was a single constant
 * ct/kWh value; with time-variable network charges (e.g. §14a EnWG module 3 in
 * Germany) it varies by time of day, weekday and season, and grid operators
 * increasingly publish it as a dated series.
 *
 * A fee registered here is **not** automatically applied to any price. It is
 * published so that energy apps can read it via
 * {@link EnergyAppGridFee.getGridFee} and compose the effective electricity
 * price themselves — see `composeElectricityPrices()`. This is deliberate: some
 * tariff providers already return grid-fee-inclusive prices from their own API
 * and must not add the fee a second time.
 *
 * Constant and time-dependent fees are the same shape: a flat ct/kWh charge is
 * a {@link schedule} with one all-day window. There is no mode to declare and
 * nothing on the tariff side that has to agree with it.
 */
export interface EnyoDynamicGridFee {
    /** Human-readable name, e.g. `'Netzentgelt HT/NT 2026'`. */
    name: string;
    /** Name of the grid operator (DSO) that publishes this fee. */
    gridOperator: string;
    /** Currency of every amount in {@link schedule}. */
    currency: EnyoCurrencyEnum;
    /**
     * IANA time zone the schedule's wall-clock times are expressed in, e.g.
     * `'Europe/Berlin'`. Required — network charge windows are published in
     * local time and must survive daylight-saving transitions.
     */
    timezone: string;
    /** Whether the fee applies to consumption, feed-in, or both. */
    appliesTo: EnyoPriceAppliesToEnum;
    /** When and how much the fee is. Amounts are positive and **added** to the energy price. */
    schedule: EnyoPriceSchedule;
    /** Optional start of the fee's validity in ISO format (inclusive). */
    validFromIso?: string;
    /** Optional end of the fee's validity in ISO format (exclusive). */
    validUntilIso?: string;
    /**
     * Optional metering point this fee was published for (e.g. a German
     * Marktlokations-ID). Informational only — a site has exactly one grid fee,
     * so this never selects between fees; it records which metering point the
     * grid operator quoted it for.
     */
    meteringPointId?: string;
    /**
     * Fixed charges billed alongside the network charge itself — metering point
     * operation, concession levy and the like — as a **gross** amount in cent
     * per kWh.
     *
     * Kept separate from {@link schedule} rather than folded into it because it
     * is a different kind of number: the schedule varies by time of day, this
     * does not. Consumers decide per call whether to include it — see
     * `getGridFeeValues()`'s `includeAdditionalFees`.
     *
     * Omit when the schedule already accounts for everything the customer pays.
     */
    additionalFeesGrossCentPerKwh?: number;
    /**
     * Marks the fee as a time-variable network charge under §14a EnWG module 3.
     * Purely informational — it does not change how the fee is resolved.
     */
    moduleThreeCompliant?: boolean;
    /** When the fee was last registered or updated, in ISO format. Set by the host. */
    publishedAtIso?: string;
}

/**
 * Registration payload for {@link EnergyAppGridFee.registerGridFee}.
 *
 * `publishedAtIso` is assigned by the host and therefore not part of the input.
 * There is no identifier: a site has exactly one grid fee, and registering
 * replaces it.
 */
export type EnyoDynamicGridFeeRegistration = Omit<EnyoDynamicGridFee, 'publishedAtIso'>;

/**
 * Whether the grid fee that applies to a site is one number or a time-dependent
 * series.
 */
export enum EnyoGridFeeTypeEnum {
    /** One constant charge that applies around the clock. */
    Static = 'static',
    /** The charge varies by time of day, weekday or season (e.g. HT/NT). */
    Dynamic = 'dynamic',
}

/**
 * The grid fee that applies to a site, in the form most callers actually want:
 * "is it one number or a series, and if it is one number, which?"
 *
 * Returned by `getGridFee()`. Read {@link type} first — it decides which of the
 * two remaining questions is worth asking:
 *
 * - {@link EnyoGridFeeTypeEnum.Static}: {@link grossCentPerKwh} holds the whole
 *   answer. No range query needed.
 * - {@link EnyoGridFeeTypeEnum.Dynamic}: {@link grossCentPerKwh} is `undefined`
 *   on purpose — there is no single honest value for an HT/NT charge. Fetch the
 *   intervals with `getGridFeeValues()`.
 *
 * {@link additionalFeesGrossCentPerKwh} applies to both and is reported
 * separately so a caller can show "network charge" and "other charges" as
 * distinct lines, or add them together.
 *
 * **All amounts here are gross cent per kWh** — VAT included, cent not euro.
 * This differs from {@link EnyoDynamicGridFee.schedule}, whose `amountPerKwh` is
 * in whole currency units, because this shape is what gets displayed and
 * configured while the schedule is what gets registered.
 */
export interface EnyoGridFeeInfo {
    /** Human-readable name, e.g. `'Netzentgelt HT/NT 2026'`. */
    name: string;
    /** Name of the grid operator (DSO) that publishes this fee. */
    gridOperator: string;
    /** Currency of every amount in this object. */
    currency: EnyoCurrencyEnum;
    /** IANA time zone the underlying schedule is expressed in. */
    timezone: string;
    /** Whether the fee applies to consumption, feed-in, or both. */
    appliesTo: EnyoPriceAppliesToEnum;
    /**
     * Whether the fee is one constant number or a time-dependent series.
     * Derived by the host from the registered schedule: a constant schedule, or
     * one whose windows all carry the same amount and cover the whole day, is
     * {@link EnyoGridFeeTypeEnum.Static}; anything else is
     * {@link EnyoGridFeeTypeEnum.Dynamic}.
     */
    type: EnyoGridFeeTypeEnum;
    /**
     * The network charge as a gross amount in cent per kWh — set when
     * {@link type} is {@link EnyoGridFeeTypeEnum.Static}, `undefined` when it is
     * {@link EnyoGridFeeTypeEnum.Dynamic}.
     *
     * Excludes {@link additionalFeesGrossCentPerKwh}; add them for the total the
     * customer pays per kWh.
     */
    grossCentPerKwh?: number;
    /**
     * Fixed charges billed alongside the network charge — metering point
     * operation, concession levy and the like — as a gross amount in cent per
     * kWh. `undefined` when the fee declares none.
     */
    additionalFeesGrossCentPerKwh?: number;
    /** Metering point the grid operator quoted this fee for, when known. */
    meteringPointId?: string;
    /** Whether the fee is a §14a EnWG module 3 time-variable network charge. */
    moduleThreeCompliant?: boolean;
    /** Start of the fee's validity in ISO format (inclusive), when limited. */
    validFromIso?: string;
    /** End of the fee's validity in ISO format (exclusive), when limited. */
    validUntilIso?: string;
    /** When the fee was last registered or updated, in ISO format. */
    publishedAtIso?: string;
}

/**
 * One resolved 15-minute interval of a grid fee.
 */
export interface EnyoGridFeeEntry {
    /** Start of the 15-minute interval in ISO format. */
    timestampIso: string;
    /**
     * The grid fee for this interval as a **gross amount in cent per kWh**,
     * always `>= 0` and `0` for intervals no window covers.
     *
     * Whether this includes the fee's additional charges depends on the
     * `includeAdditionalFees` flag of the request — see
     * {@link EnyoGridFeeSeries.includesAdditionalFees}, which reports what was
     * actually done rather than what was asked for.
     */
    grossCentPerKwh: number;
}

/**
 * A grid fee resolved to a flat 15-minute series over a requested range.
 *
 * The resolution matches {@link EnergyAppEnergyPrices.getPrices}, so entries can
 * be zipped with a price series index-by-index once both cover the same range —
 * but mind the unit: this series is in **gross cent** per kWh while price series
 * are in whole currency units. `fromGridFeeEntries()` converts.
 */
export interface EnyoGridFeeSeries {
    /** Currency of every amount in {@link entries}. */
    currency: EnyoCurrencyEnum;
    /** Always {@link ForecastResolutionEnum.FifteenMinutes} — present for symmetry with other price APIs. */
    resolution: ForecastResolutionEnum;
    /** IANA time zone the underlying schedule was resolved in. */
    timezone: string;
    /** Direction the fee applies to. */
    appliesTo: EnyoPriceAppliesToEnum;
    /**
     * Whether {@link EnyoGridFeeEntry.grossCentPerKwh} has the fee's additional
     * charges baked in.
     *
     * Reports what happened, not what was requested: asking for additional fees
     * on a grid fee that declares none yields `false`, so a caller never has to
     * guess whether a flat total is missing a component.
     */
    includesAdditionalFees: boolean;
    /** Resolved entries sorted ascending by `timestampIso`, without gaps. */
    entries: EnyoGridFeeEntry[];
}

/**
 * The range to resolve the site's grid fee over, and whether the fee's
 * additional charges are folded into the resolved amounts.
 *
 * Carries no selector: a site has exactly one grid fee, belonging to its grid
 * connection rather than to a supplier contract, so there is nothing to choose
 * between.
 */
export interface EnyoGridFeeValuesFilter {
    /** Start of the requested range in ISO format (inclusive). */
    fromIso: string;
    /** End of the requested range in ISO format (exclusive). */
    untilIso: string;
    /**
     * When `true`, {@link EnyoGridFeeInfo.additionalFeesGrossCentPerKwh} is
     * added to every resolved interval, so each amount is the full gross charge
     * per kWh. Defaults to `false` — the network charge alone.
     *
     * The result reports what was actually applied in
     * {@link EnyoGridFeeSeries.includesAdditionalFees}.
     */
    includeAdditionalFees?: boolean;
}

/**
 * What happened to a grid fee registration.
 */
export enum EnyoGridFeeChangeTypeEnum {
    /** A grid fee was registered where the site had none. */
    Registered = 'registered',
    /** The site's existing grid fee was replaced. */
    Updated = 'updated',
    /** A grid fee was removed. */
    Removed = 'removed',
}

/**
 * Event delivered to listeners registered via
 * {@link EnergyAppGridFee.onGridFeeChanged}.
 */
export interface EnyoGridFeeChangeEvent {
    /** What happened. */
    changeType: EnyoGridFeeChangeTypeEnum;
    /** The grid fee after the change, or `null` when it was removed. */
    gridFee: EnyoDynamicGridFee | null;
}
