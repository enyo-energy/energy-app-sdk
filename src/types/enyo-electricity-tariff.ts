import {EnyoCurrencyEnum} from './enyo-currency.js';
import {ForecastResolutionEnum} from './enyo-forecasting.js';
import {EnyoPriceAppliesToEnum, EnyoPriceSchedule} from './enyo-price-schedule.js';

/**
 * Which direction of energy flow a tariff prices.
 *
 * A site has exactly one tariff per direction: what it pays for energy drawn
 * from the grid, and what it earns for energy fed back. These are the two slots
 * the whole tariff API is built around — a tariff is not registered into a list
 * and later marked default, it is set into one of these two places.
 *
 * Deliberately not {@link EnyoPriceAppliesToEnum}, which carries a third member
 * (`Both`) that a slot cannot be.
 */
export enum EnyoTariffDirectionEnum {
    /** Energy drawn from the grid — what the customer pays. */
    Consumption = 'consumption',
    /** Energy fed into the grid — what the customer earns. */
    FeedIn = 'feed-in',
}

/**
 * The pricing model a tariff follows.
 */
export enum EnyoTariffPricingTypeEnum {
    /** One price that does not change over time. */
    Static = 'static',
    /** Price varies by time of day, weekday or season (e.g. peak/off-peak). */
    TimeVariable = 'time-variable',
    /** Price changes with the market and is published as a dated series. */
    Dynamic = 'dynamic',
}

/**
 * A fixed price per kWh, unchanged around the clock.
 */
export interface EnyoStaticTariffPricing {
    type: EnyoTariffPricingTypeEnum.Static;
    /** The price per kWh, in the tariff's currency. */
    pricePerKwh: number;
}

/**
 * A price that follows a calendar schedule — HT/NT, weekend rates, seasonal
 * bands.
 *
 * Uses the same {@link EnyoPriceSchedule} as grid fees and bonuses, so it gets
 * the shared resolver and validator, and so the SDK has one schedule concept
 * rather than one per feature.
 */
export interface EnyoTimeVariableTariffPricing {
    type: EnyoTariffPricingTypeEnum.TimeVariable;
    /** When each price applies. Amounts are the price per kWh. */
    schedule: EnyoPriceSchedule;
    /**
     * IANA time zone the schedule's wall-clock times are expressed in, e.g.
     * `'Europe/Berlin'`. Required — price windows are quoted in local time and
     * must survive daylight-saving transitions.
     */
    timezone: string;
}

/**
 * A market-following price, carried by the published series rather than by the
 * tariff.
 *
 * Has no fields of its own on purpose: everything about a dynamic price is in
 * the series the owning app publishes with
 * {@link EnergyAppElectricityTariff.publishPrices}, and there is nothing
 * meaningful to state up front.
 */
export interface EnyoDynamicTariffPricing {
    type: EnyoTariffPricingTypeEnum.Dynamic;
}

/**
 * How a tariff prices energy.
 *
 * A discriminated union on {@link EnyoTariffPricingTypeEnum}, so the payload a
 * pricing model needs is the payload it carries — a `Static` tariff without a
 * price, or a `Dynamic` one carrying a schedule, does not compile. Narrow it
 * with `switch (tariff.pricing.type)`.
 */
export type EnyoTariffPricing =
    | EnyoStaticTariffPricing
    | EnyoTimeVariableTariffPricing
    | EnyoDynamicTariffPricing;

/**
 * A cost component that may or may not already be contained in a published
 * price.
 *
 * Provider APIs differ: some return all-in prices with network charges, levies
 * and discounts baked in, others return the pure energy price. A consumer must
 * never add a component that is already there, so the publishing app declares
 * what its prices contain — see {@link EnyoTariffPriceSeries.includes}.
 */
export enum EnyoPriceComponentEnum {
    /** The grid operator's network charge. */
    GridFee = 'grid-fee',
    /** Taxes and statutory levies. */
    TaxesAndLevies = 'taxes-and-levies',
    /** Discounts granted on top of the tariff. */
    Bonuses = 'bonuses',
}

/**
 * A time-dependent discount granted on top of a tariff, expressed in currency
 * per kWh — for example "5 ct/kWh cheaper between 22:00 and 06:00" or a
 * promotional rebate that runs for a fixed number of months.
 *
 * Not carried by the tariff itself: the app that owns a tariff knows its own
 * bonuses and either applies them before publishing prices — declaring
 * {@link EnyoPriceComponentEnum.Bonuses} in
 * {@link EnyoTariffPriceSeries.includes} — or passes them to
 * `composeElectricityPrices()` to have them applied and reported separately.
 *
 * Amounts in {@link schedule} are positive magnitudes and are **subtracted**
 * from the price.
 *
 * Consumption-quota bonuses ("the first 100 kWh each month are free") are not
 * expressible here — they require consumption accounting that this model
 * deliberately does not carry.
 */
export interface EnyoTariffBonus {
    /** Unique identifier of the bonus within its tariff. */
    id: string;
    /** Human-readable name shown to the user, e.g. `'Nachtbonus'`. */
    name: string;
    /**
     * When and how much the discount is. Amounts are positive and subtracted
     * from the price.
     */
    schedule: EnyoPriceSchedule;
    /**
     * IANA time zone the schedule's wall-clock times are expressed in, e.g.
     * `'Europe/Berlin'`.
     */
    timezone: string;
    /** Whether the bonus applies to consumption, feed-in, or both. */
    appliesTo: EnyoPriceAppliesToEnum;
    /** Optional start of the bonus's validity in ISO format (inclusive). */
    validFromIso?: string;
    /** Optional end of the bonus's validity in ISO format (exclusive). */
    validUntilIso?: string;
    /**
     * When `true`, this bonus suppresses every lower-priority bonus in the
     * intervals it covers instead of stacking with them.
     */
    exclusive?: boolean;
    /**
     * Ranking used to pick between competing exclusive bonuses — higher wins.
     * Defaults to `0`.
     */
    priority?: number;
}

/**
 * An electricity tariff filling one of the site's two direction slots.
 *
 * Carries no identifier: a tariff is addressed by the direction it prices, and
 * setting one replaces whatever was in that slot. It also carries no grid fee —
 * a network charge belongs to the site's grid connection and is read from
 * `useGridFee()` — and no default flag, because occupying a slot *is* being the
 * tariff in force.
 */
export interface EnyoElectricityTariff {
    /** Human-readable name of the tariff, e.g. `'Tibber Stromvertrag'`. */
    name: string;
    /** Name of the energy vendor/provider. */
    vendorName: string;
    /** Currency of every amount in this tariff and in the prices published for it. */
    currency: EnyoCurrencyEnum;
    /** How the tariff prices energy. */
    pricing: EnyoTariffPricing;
    /**
     * The owning app's own identifier for this tariff — a contract id, a
     * product code.
     *
     * Optional for the host, which never interprets it, but it is the stable key
     * an app should compare against to notice that the tariff behind a slot is
     * no longer the one it published prices for.
     */
    externalTariffId?: string;
}

/**
 * A single priced interval.
 */
export interface EnyoTariffPriceEntry {
    /** Start of the interval in ISO format. */
    timestampIso: string;
    /** Price per kWh for this interval, in the tariff's currency. */
    pricePerKwh: number;
}

/**
 * Prices for one direction over a requested range.
 *
 * {@link includes} travels with the series rather than with the tariff because
 * what a price contains is a fact about *that series*: an app may publish pure
 * energy prices today and all-in prices tomorrow, and a consumer composing a
 * price must go by what it was actually handed.
 */
export interface EnyoTariffPriceSeries {
    /** Which direction these prices are for. */
    direction: EnyoTariffDirectionEnum;
    /** Currency of every amount in {@link entries}. */
    currency: EnyoCurrencyEnum;
    /** Always {@link ForecastResolutionEnum.FifteenMinutes} — matches the grid fee and spot price series. */
    resolution: ForecastResolutionEnum;
    /**
     * Cost components already contained in {@link entries}. Empty means the
     * pure energy price; a component listed here must not be added again.
     */
    includes: EnyoPriceComponentEnum[];
    /** Entries sorted ascending by `timestampIso`. */
    entries: EnyoTariffPriceEntry[];
}

/**
 * What an app publishes with
 * {@link EnergyAppElectricityTariff.publishPrices}.
 *
 * Carries no currency or resolution: both come from the tariff occupying the
 * slot, so they cannot disagree with it.
 */
export interface EnyoTariffPricePublication {
    /**
     * Cost components already applied to {@link entries}. Omitted means the
     * pure energy price.
     */
    includes?: EnyoPriceComponentEnum[];
    /** The priced intervals. Replaces any previously published interval with the same timestamp. */
    entries: EnyoTariffPriceEntry[];
}

/**
 * The outcome of a user choosing a tariff.
 */
export enum EnyoTariffActivationStatusEnum {
    /** The tariff is set and usable; prices can be published. */
    Success = 'success',
    /** The user must authenticate with the provider before the tariff works. */
    AuthenticationRequired = 'authentication-required',
    /** The user must complete an onboarding guide before the tariff works. */
    OnboardingRequired = 'onboarding-required',
    /** The tariff could not be activated. */
    Failed = 'failed',
}

/**
 * What an app reports back when the user picks its tariff.
 *
 * The three non-success states are not failures to be retried — they are
 * requests for the host to send the user somewhere. Carry the pointer that makes
 * each actionable, or the host knows only that something is needed and not what.
 *
 * When a flow finishes later (an OAuth redirect returns, an onboarding guide
 * completes), the app calls
 * {@link EnergyAppElectricityTariff.setTariff} — setting the tariff *is* the
 * activation signal, so there is nothing else to report.
 */
export interface EnyoTariffActivationResult {
    /** The outcome. */
    status: EnyoTariffActivationStatusEnum;
    /**
     * Where to send the user, when the status is
     * {@link EnyoTariffActivationStatusEnum.AuthenticationRequired}.
     */
    authenticationUrl?: string;
    /**
     * Which onboarding guide to run, when the status is
     * {@link EnyoTariffActivationStatusEnum.OnboardingRequired}. An onboarding
     * v2 guide id registered by this app.
     */
    onboardingGuideId?: string;
    /**
     * Human-readable detail, shown to the user on
     * {@link EnyoTariffActivationStatusEnum.Failed}.
     */
    message?: string;
}

/**
 * What happened to a direction slot.
 */
export enum EnyoTariffChangeTypeEnum {
    /** A tariff was set into a slot that was empty, or replaced the one in it. */
    Set = 'set',
    /** The slot was emptied. */
    Cleared = 'cleared',
}

/**
 * Event delivered to listeners registered via
 * {@link EnergyAppElectricityTariff.onTariffChanged}.
 */
export interface EnyoTariffChangeEvent {
    /** What happened. */
    changeType: EnyoTariffChangeTypeEnum;
    /** Which slot changed. */
    direction: EnyoTariffDirectionEnum;
    /** The tariff now in the slot, or `null` when it was cleared. */
    tariff: EnyoElectricityTariff | null;
}
