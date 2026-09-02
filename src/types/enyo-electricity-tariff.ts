import {EnyoPriceAppliesToEnum, EnyoPriceSchedule} from './enyo-price-schedule.js';

/**
 * Enum representing the type of electricity tariff pricing model
 */
export enum ElectricityTariffTypeEnum {
    /** Fixed price that doesn't change over time */
    Static = 'static',
    /** Price varies based on time of day (e.g., peak/off-peak) */
    TimeVariable = 'time-variable',
    /** Price changes dynamically based on market conditions */
    Dynamic = 'dynamic'
}

/**
 * How the grid fee (network charge) of a tariff is determined.
 */
export enum GridFeeModeEnum {
    /**
     * A single constant fee per kWh, carried by the tariff itself
     * (see {@link DynamicTariffData.gridFeePerKwh}).
     */
    Static = 'static',
    /**
     * A time-dependent fee, read from the grid fee API with
     * `useGridFee().getDynamicGridFees()`. The tariff only declares *that* the
     * fee is time-dependent — which fee applies is a property of the site's grid
     * connection, not of the tariff.
     */
    Dynamic = 'dynamic'
}

/**
 * Declares how the grid fee (network charge) that applies alongside a tariff is
 * determined.
 *
 * Mixed into every tariff pricing shape: a fixed energy price combined with
 * time-variable network charges (e.g. §14a EnWG module 3) is just as real a
 * product as a spot-market tariff, so the declaration is not exclusive to
 * dynamic tariffs.
 *
 * A grid fee itself is **not** bound to a tariff — it belongs to the site's grid
 * connection and is registered and resolved through `useGridFee()` independently.
 * The tariff only says whether its grid fee is a constant it carries itself or a
 * time-dependent one to be read from that API.
 *
 * The grid fee is never applied automatically. Energy apps read the fee and
 * compose the effective price themselves — see `composeElectricityPrices()`.
 */
export interface TariffGridFeeConfig {
    /**
     * How the grid fee is determined. Defaults to {@link GridFeeModeEnum.Static}
     * when omitted, so tariffs registered before this field existed keep their
     * previous behaviour.
     *
     * {@link GridFeeModeEnum.Dynamic} must not be combined with
     * `priceComposition.includesGridFee === true` — a fee already contained in
     * the tariff's prices must not be added again.
     */
    gridFeeMode?: GridFeeModeEnum;
}

/**
 * Declares which cost components are **already contained** in the prices this
 * tariff yields.
 *
 * Provider APIs differ: some return all-in prices with network charges, levies
 * and taxes baked in, others return the pure energy price. Consumers must never
 * add a component that is already included — this declaration is what makes the
 * difference machine-readable instead of tribal knowledge.
 *
 * When omitted, prices are treated as **energy price only**.
 */
export interface TariffPriceCompositionInfo {
    /** `true` when the tariff's prices already contain the grid fee. */
    includesGridFee: boolean;
    /** `true` when the tariff's prices already contain taxes and levies. */
    includesTaxesAndLevies?: boolean;
    /** `true` when the tariff's prices already have its bonuses applied. */
    includesBonuses?: boolean;
}

/**
 * A time-dependent discount granted on top of a tariff, expressed in currency
 * per kWh — for example "5 ct/kWh cheaper between 22:00 and 06:00" or a
 * promotional rebate that runs for a fixed number of months.
 *
 * A tariff may carry several bonuses. Amounts in {@link schedule} are positive
 * magnitudes and are **subtracted** from the price.
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
 * Pricing data for a static (fixed-price) electricity tariff
 */
export interface StaticTariffData extends TariffGridFeeConfig {
    /** Price per kWh for consumption */
    pricePerKwh: number;
    /** Currency code (ISO 4217, e.g., 'EUR', 'USD') */
    currency: string;
}

/**
 * Pricing data for a dynamic electricity tariff
 */
export interface DynamicTariffData extends TariffGridFeeConfig {
    /**
     * Constant price per kWh for grid fees.
     *
     * @deprecated Set {@link TariffGridFeeConfig.gridFeeMode} to
     * {@link GridFeeModeEnum.Dynamic} and read the fee from
     * `useGridFee().getDynamicGridFees()` instead. Still honoured as the
     * constant fallback while `gridFeeMode` is Static or omitted.
     */
    gridFeePerKwh?: number;
    /** Currency code (ISO 4217, e.g., 'EUR', 'USD') */
    currency: string;
}

/**
 * A single entry in a time-variable tariff schedule
 */
export interface TimeVariableScheduleEntry {
    /** Relative start offset (e.g., minutes from start of day) */
    start: number;
    /** Price per kWh during this period */
    pricePerKwh: number;
}

/**
 * Pricing data for a time-variable electricity tariff
 */
export interface TimeVariableTariffData extends TariffGridFeeConfig {
    /** Schedule of time-based price entries */
    schedule: TimeVariableScheduleEntry[];
    /** Currency code (ISO 4217, e.g., 'EUR', 'USD') */
    currency: string;
}

/**
 * Input data for registering or updating an electricity tariff
 */
export interface EnyoElectricityTariff {
    /** Unique identifier for the tariff */
    id: string;
    /** The pricing model type of this tariff */
    tariffType: ElectricityTariffTypeEnum;
    /** Human-readable name of the tariff */
    tariffName: string;
    /** Name of the energy vendor/provider */
    vendorName: string;
    /** Optional ID of the primary meter appliance associated with this tariff */
    primaryMeterApplianceId?: string;
    /** Optional static pricing data (relevant when tariffType is Static) */
    staticTariffData?: StaticTariffData;
    /** Optional time-variable pricing data (relevant when tariffType is TimeVariable) */
    timeVariableTariffData?: TimeVariableTariffData;
    /** Optional dynamic pricing data*/
    dynamicTariffData?: DynamicTariffData;
    /** Optional external tariff id for easy identification */
    externalTariffId?: string;
    /**
     * Optional declaration of which cost components the tariff's prices already
     * contain. Omitted means "energy price only".
     */
    priceComposition?: TariffPriceCompositionInfo;
    /**
     * Optional discounts granted on top of this tariff. Several bonuses may
     * apply at the same time — overlapping bonuses stack additively unless one
     * of them is {@link EnyoTariffBonus.exclusive}.
     */
    bonuses?: EnyoTariffBonus[];
}

/**
 * Tariff registration data extended with default indicator.
 * Used in list responses to indicate which tariff is the system default.
 */
export interface EnyoElectricityTariffWithDefault extends EnyoElectricityTariff {
    /** Indicates whether this tariff is the system default */
    defaultTariff: boolean;
}

/**
 * What happened to a tariff registration.
 */
export enum EnyoTariffChangeTypeEnum {
    /** A new tariff was registered. */
    Registered = 'registered',
    /** An existing tariff's attributes, grid fee link or bonuses changed. */
    Updated = 'updated',
    /** A tariff was removed. */
    Removed = 'removed',
    /** A different tariff became the system default. */
    DefaultChanged = 'default-changed',
}

/**
 * Event delivered to listeners registered via
 * {@link EnergyAppElectricityTariff.onTariffChanged}.
 */
export interface EnyoTariffChangeEvent {
    /** What happened. */
    changeType: EnyoTariffChangeTypeEnum;
    /** Identifier of the affected tariff. */
    tariffId: string;
    /**
     * The tariff after the change, or `null` when it was removed. For
     * {@link EnyoTariffChangeTypeEnum.DefaultChanged} this is the tariff that
     * became the new default.
     */
    tariff: EnyoElectricityTariffWithDefault | null;
}
