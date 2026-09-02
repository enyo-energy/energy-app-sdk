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
 * {@link EnergyAppGridFee.getDynamicGridFees} and compose the effective
 * electricity price themselves — see `composeElectricityPrices()`. This is
 * deliberate: some tariff providers already return grid-fee-inclusive prices
 * from their own API and must not add the fee a second time.
 */
export interface EnyoDynamicGridFee {
    /** Unique identifier of this grid fee. */
    id: string;
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
    /** Optional metering point this fee is bound to (e.g. a German Marktlokations-ID). */
    meteringPointId?: string;
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
 * `publishedAtIso` is assigned by the host and therefore not part of the input.
 */
export type EnyoDynamicGridFeeRegistration = Omit<EnyoDynamicGridFee, 'publishedAtIso'>;

/**
 * One resolved 15-minute interval of a dynamic grid fee.
 */
export interface EnyoDynamicGridFeeEntry {
    /** Start of the 15-minute interval in ISO format. */
    timestampIso: string;
    /**
     * Grid fee per kWh for this interval, in the series' currency. Always
     * `>= 0`; `0` for intervals no window covers.
     */
    feePerKwh: number;
}

/**
 * A dynamic grid fee resolved to a flat 15-minute series over a requested range.
 *
 * The resolution matches {@link EnergyAppEnergyPrices.getPrices}, so entries can
 * be zipped with a price series index-by-index once both cover the same range.
 */
export interface EnyoDynamicGridFeeSeries {
    /** Identifier of the grid fee this series was resolved from. */
    gridFeeId: string;
    /** Currency of every amount in {@link entries}. */
    currency: EnyoCurrencyEnum;
    /** Always {@link ForecastResolutionEnum.FifteenMinutes} — present for symmetry with other price APIs. */
    resolution: ForecastResolutionEnum;
    /** IANA time zone the underlying schedule was resolved in. */
    timezone: string;
    /** Direction the fee applies to. */
    appliesTo: EnyoPriceAppliesToEnum;
    /** Resolved entries sorted ascending by `timestampIso`, without gaps. */
    entries: EnyoDynamicGridFeeEntry[];
}

/**
 * Selects which grid fee to resolve, and over which range.
 *
 * A grid fee belongs to the site's grid connection, not to a supplier contract —
 * so there is deliberately no tariff selector here. With no selector at all, the
 * grid fee that applies to this device is resolved.
 */
export interface EnyoDynamicGridFeeFilter {
    /** Start of the requested range in ISO format (inclusive). */
    fromIso: string;
    /** End of the requested range in ISO format (exclusive). */
    untilIso: string;
    /** Resolve this specific grid fee. */
    gridFeeId?: string;
    /** Resolve the grid fee registered for this metering point. */
    meteringPointId?: string;
}

/**
 * What happened to a grid fee registration.
 */
export enum EnyoGridFeeChangeTypeEnum {
    /** A new grid fee was registered. */
    Registered = 'registered',
    /** An existing grid fee's attributes or schedule changed. */
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
    /** Identifier of the affected grid fee. */
    gridFeeId: string;
    /** The grid fee after the change, or `null` when it was removed. */
    gridFee: EnyoDynamicGridFee | null;
}
