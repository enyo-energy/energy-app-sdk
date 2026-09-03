import {EnyoPriceComponentEnum, EnyoTariffBonus} from './enyo-electricity-tariff.js';
import {EnyoPriceAppliesToEnum} from './enyo-price-schedule.js';

/**
 * Where a price component in a composed entry came from.
 */
export enum EnyoPriceComponentOriginEnum {
    /** The component was already contained in the energy price series. */
    Included = 'included',
    /** The component was added by the composer on top of the energy price. */
    Added = 'added',
    /** No such component applies to this interval. */
    NotApplicable = 'not-applicable',
}

/**
 * A single energy price point fed into
 * {@link composeElectricityPrices}.
 *
 * Deliberately minimal so any source can be used — spot prices from
 * `useEpexSpotPrices()`, tariff prices from `useElectricityPrices()`, or a
 * series fetched from the provider's own API. Use
 * `fromEnergyPriceEntries()` / `fromEpexSpotEntries()` to adapt the SDK's own
 * shapes.
 */
export interface EnyoComposableEnergyPriceEntry {
    /** Start of the interval in ISO format. */
    timestampIso: string;
    /** Energy price per kWh for this interval, in the composition's currency. */
    pricePerKwh: number;
}

/**
 * A grid fee series expressed in the unit the composer works in — whole currency
 * units per kWh, matching the energy prices it is added to.
 *
 * Deliberately *not* the shape `useGridFee().getGridFeeValues()` returns, which
 * is in gross cent. Run that through `fromGridFeeEntries()`, which performs the
 * conversion in one visible place rather than leaving a factor of 100 to each
 * call site.
 */
export interface EnyoComposableGridFeeSeries {
    /** Direction the fee applies to; entries are skipped when it does not match. */
    appliesTo: EnyoPriceAppliesToEnum;
    /** Fee per kWh in currency units, keyed to the interval it applies to. */
    entries: {timestampIso: string; feePerKwh: number}[];
}

/**
 * Input for {@link composeElectricityPrices}.
 */
export interface EnyoComposeElectricityPricesInput {
    /**
     * The energy price series to compose on top of. Entries are matched to the
     * grid fee and bonus series by `timestampIso`, so all inputs should cover
     * the same range at 15-minute resolution.
     */
    energyPrices: EnyoComposableEnergyPriceEntry[];
    /**
     * What the {@link energyPrices} already contain, taken from the series'
     * {@link EnyoTariffPriceSeries.includes}. Components listed here are
     * reported in the result but **not added again**. Omitted or empty means
     * "energy price only".
     */
    energyPriceComposition?: EnyoPriceComponentEnum[];
    /**
     * The resolved grid fee series, adapted from
     * `useGridFee().getGridFeeValues()` with `fromGridFeeEntries()` — which also
     * converts it from gross cent to currency units. Ignored when the energy
     * prices already include the grid fee, and may be `null` or omitted when no
     * grid fee applies to the site.
     */
    gridFees?: EnyoComposableGridFeeSeries | null;
    /**
     * A constant grid fee in currency units per kWh, for callers that have a
     * single figure rather than a series — e.g. `getGridFee()` reporting a
     * {@link EnyoGridFeeTypeEnum.Static} fee, divided by 100 to leave cent.
     * Ignored when {@link gridFees} is given or when the energy prices already
     * include the grid fee.
     */
    constantGridFeePerKwh?: number;
    /**
     * The tariff's bonuses. Overlapping bonuses stack additively unless one is
     * {@link EnyoTariffBonus.exclusive}. Ignored when the energy prices already
     * have bonuses applied.
     */
    bonuses?: EnyoTariffBonus[];
    /**
     * Which direction to compose for. Components whose `appliesTo` does not
     * match are skipped. Defaults to {@link EnyoPriceAppliesToEnum.Consumption}.
     */
    appliesTo?: EnyoPriceAppliesToEnum;
    /**
     * Optional lower bound for {@link EnyoComposedElectricityPriceEntry.effectivePricePerKwh}.
     * Left unset by default — effective prices may legitimately go negative,
     * because wholesale prices do.
     */
    minEffectivePricePerKwh?: number;
    /** Currency code carried through to the result, e.g. `'EUR'`. */
    currency?: string;
}

/**
 * One fully composed 15-minute price interval, with every component reported
 * separately so a UI can explain the number and an optimizer can reason about
 * its parts.
 */
export interface EnyoComposedElectricityPriceEntry {
    /** Start of the interval in ISO format. */
    timestampIso: string;
    /**
     * The price taken from the source series for this interval. When the source
     * was all-in, it already contains the components whose origin is
     * `included`.
     */
    energyPricePerKwh: number;
    /**
     * Grid fee per kWh attributable to this interval; `0` when none applies.
     *
     * Reported even when {@link gridFeeOrigin} is
     * {@link EnyoPriceComponentOriginEnum.Included} — provided a fee series was
     * passed in — so a UI can break down an all-in price without the composer
     * adding the amount a second time.
     */
    gridFeePerKwh: number;
    /**
     * Whether {@link gridFeePerKwh} was added by the composer, was already part
     * of the energy price, or does not apply.
     */
    gridFeeOrigin: EnyoPriceComponentOriginEnum;
    /** Total discount per kWh applied to this interval; `0` when none applies. */
    bonusPerKwh: number;
    /**
     * Whether {@link bonusPerKwh} was applied by the composer, was already part
     * of the energy price, or does not apply.
     */
    bonusOrigin: EnyoPriceComponentOriginEnum;
    /** Ids of the bonuses that contributed to {@link bonusPerKwh}. */
    appliedBonusIds: string[];
    /**
     * The final price per kWh for this interval:
     * `energyPricePerKwh + gridFeePerKwh - bonusPerKwh`, with components whose
     * origin is `included` already contained in `energyPricePerKwh` and
     * therefore not counted twice.
     */
    effectivePricePerKwh: number;
    /** Currency of every amount in this entry, when known. */
    currency?: string;
}
