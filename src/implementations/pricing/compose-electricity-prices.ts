import {EnyoPriceComponentEnum, EnyoTariffBonus} from '../../types/enyo-electricity-tariff.js';
import {EnyoEnergyPriceEntry} from '../../types/enyo-energy-prices.js';
import {EnyoEpexSpotPriceEntry} from '../../types/enyo-epex-spot-price.js';
import {EnyoGridFeeSeries} from '../../types/enyo-grid-fee.js';
import {
    EnyoComposableEnergyPriceEntry,
    EnyoComposableGridFeeSeries,
    EnyoComposeElectricityPricesInput,
    EnyoComposedElectricityPriceEntry,
    EnyoPriceComponentOriginEnum,
} from '../../types/enyo-price-composition.js';
import {EnyoPriceAppliesToEnum} from '../../types/enyo-price-schedule.js';
import {resolvePriceSchedule} from './price-schedule-resolver.js';

/**
 * Adapts a tariff price series from `useElectricityPrices().getPrices()` into
 * composer input.
 *
 * @param entries - Price entries as returned by the electricity prices API
 * @param direction - Which price to take; defaults to consumption. Feed-in
 *   entries without a `feedInPricePerKwh` are skipped.
 * @returns Composable energy price entries
 */
export function fromEnergyPriceEntries(
    entries: EnyoEnergyPriceEntry[],
    direction: EnyoPriceAppliesToEnum = EnyoPriceAppliesToEnum.Consumption,
): EnyoComposableEnergyPriceEntry[] {
    if (direction === EnyoPriceAppliesToEnum.FeedIn) {
        return entries
            .filter(entry => entry.feedInPricePerKwh !== undefined)
            .map(entry => ({timestampIso: entry.timestampIso, pricePerKwh: entry.feedInPricePerKwh as number}));
    }
    return entries.map(entry => ({
        timestampIso: entry.timestampIso,
        pricePerKwh: entry.consumptionPricePerKwh,
    }));
}

/**
 * Converts a grid fee series from `useGridFee().getGridFeeValues()` into the
 * unit the composer works in.
 *
 * This is the **only** place cent meets currency in the pricing path, and it
 * exists so the conversion happens once, visibly, instead of at every call site.
 * Grid fees are published and read as gross **cent** per kWh because that is how
 * they are quoted and configured; energy prices are in whole currency units
 * (EUR/kWh), so a fee added to a price without dividing by 100 overstates it by
 * a factor of 100 — a mistake that survives review because both numbers look
 * plausible.
 *
 * Pass the result as {@link EnyoComposeElectricityPricesInput.gridFees}. Whether
 * the amounts include the fee's additional charges is decided when the series is
 * fetched, not here.
 *
 * @param series - The series returned by `getGridFeeValues()`, or `null`
 * @returns The same series with amounts in currency per kWh, or `null` when the input was
 */
export function fromGridFeeEntries(series: EnyoGridFeeSeries | null | undefined): EnyoComposableGridFeeSeries | null {
    if (series == null) {
        return null;
    }
    return {
        appliesTo: series.appliesTo,
        entries: series.entries.map(entry => ({
            timestampIso: entry.timestampIso,
            feePerKwh: entry.grossCentPerKwh / 100,
        })),
    };
}

/**
 * Adapts an EPEX SPOT day-ahead series into composer input.
 *
 * Spot prices are the raw exchange result and contain neither grid fees nor
 * levies, taxes or supplier margin — so a series built from them should declare
 * no included components at all.
 *
 * @param entries - Spot price entries as returned by the EPEX SPOT price API
 * @returns Composable energy price entries
 */
export function fromEpexSpotEntries(entries: EnyoEpexSpotPriceEntry[]): EnyoComposableEnergyPriceEntry[] {
    return entries.map(entry => ({timestampIso: entry.timestampIso, pricePerKwh: entry.pricePerKwh}));
}

/** One bonus resolved to the intervals it covers. */
interface ResolvedBonus {
    bonus: EnyoTariffBonus;
    amountByTimestamp: Map<string, number>;
}

function appliesToDirection(componentAppliesTo: EnyoPriceAppliesToEnum, direction: EnyoPriceAppliesToEnum): boolean {
    return componentAppliesTo === EnyoPriceAppliesToEnum.Both || componentAppliesTo === direction;
}

/**
 * Resolves a tariff's bonuses over a time range and combines them per interval
 * according to the SDK's stacking rule.
 *
 * **Stacking rule:** overlapping bonuses add up, unless at least one bonus
 * covering the interval is {@link EnyoTariffBonus.exclusive} — then the
 * exclusive bonus with the highest `priority` applies alone (ties are broken by
 * array order). Bonuses whose `appliesTo` does not match the requested
 * direction, and intervals outside a bonus's validity window, contribute
 * nothing.
 *
 * @param bonuses - The tariff's bonuses
 * @param options - Range and direction to resolve for
 * @returns A map from interval start (ISO) to the total discount and the contributing bonus ids
 *
 * @example
 * ```typescript
 * const resolved = resolveTariffBonuses(tariff.bonuses ?? [], {
 *     fromIso: '2026-09-02T00:00:00Z',
 *     untilIso: '2026-09-03T00:00:00Z',
 * });
 * ```
 */
export function resolveTariffBonuses(
    bonuses: EnyoTariffBonus[],
    options: {
        /** Start of the range in ISO format (inclusive). */
        fromIso: string;
        /** End of the range in ISO format (exclusive). */
        untilIso: string;
        /** Direction to resolve for; defaults to consumption. */
        appliesTo?: EnyoPriceAppliesToEnum;
    },
): Map<string, {bonusPerKwh: number; appliedBonusIds: string[]}> {
    const direction = options.appliesTo ?? EnyoPriceAppliesToEnum.Consumption;

    const resolved: ResolvedBonus[] = bonuses
        .filter(bonus => appliesToDirection(bonus.appliesTo, direction))
        .map(bonus => {
            const entries = resolvePriceSchedule(bonus.schedule, {
                fromIso: options.fromIso,
                untilIso: options.untilIso,
                timezone: bonus.timezone,
                validFromIso: bonus.validFromIso,
                validUntilIso: bonus.validUntilIso,
            });
            const amountByTimestamp = new Map<string, number>();
            for (const entry of entries) {
                if (entry.amountPerKwh > 0) {
                    amountByTimestamp.set(entry.timestampIso, entry.amountPerKwh);
                }
            }
            return {bonus, amountByTimestamp};
        });

    const timestamps = new Set<string>();
    for (const candidate of resolved) {
        for (const timestampIso of candidate.amountByTimestamp.keys()) {
            timestamps.add(timestampIso);
        }
    }

    const combined = new Map<string, {bonusPerKwh: number; appliedBonusIds: string[]}>();
    for (const timestampIso of timestamps) {
        const active = resolved.filter(candidate => candidate.amountByTimestamp.has(timestampIso));
        const exclusive = active.filter(candidate => candidate.bonus.exclusive === true);

        if (exclusive.length > 0) {
            const winner = exclusive.reduce((best, candidate) =>
                (candidate.bonus.priority ?? 0) > (best.bonus.priority ?? 0) ? candidate : best,
            );
            combined.set(timestampIso, {
                bonusPerKwh: winner.amountByTimestamp.get(timestampIso) as number,
                appliedBonusIds: [winner.bonus.id],
            });
            continue;
        }

        combined.set(timestampIso, {
            bonusPerKwh: active.reduce((sum, candidate) => sum + (candidate.amountByTimestamp.get(timestampIso) as number), 0),
            appliedBonusIds: active.map(candidate => candidate.bonus.id),
        });
    }
    return combined;
}

function gridFeeByTimestamp(series: EnyoComposableGridFeeSeries | null | undefined): Map<string, number> {
    const map = new Map<string, number>();
    for (const entry of series?.entries ?? []) {
        map.set(entry.timestampIso, entry.feePerKwh);
    }
    return map;
}

/**
 * Composes the effective electricity price per 15-minute interval from an energy
 * price series, a grid fee and a tariff's bonuses.
 *
 * The three inputs come from three independent sources and are deliberately not
 * coupled: energy prices from the tariff or the spot market, the grid fee from
 * `useGridFee()`, the bonuses from the tariff. Pass whichever apply.
 *
 * This runs **in the energy app**, never in the host, because only the app knows
 * what its provider's API already returns: some providers deliver all-in prices
 * with the network charge baked in, others deliver the pure energy price. Pass
 * the price series' `includes` as `energyPriceComposition` and the composer
 * reports each component without adding one that is already included.
 *
 * Every component is reported separately — `gridFeePerKwh` with its
 * {@link EnyoPriceComponentOriginEnum}, the total `bonusPerKwh` and the
 * `appliedBonusIds` behind it — so a UI can explain the number and an optimizer
 * can reason about the parts.
 *
 * Entries are produced for the intervals present in `energyPrices`; grid fee and
 * bonus values are matched by `timestampIso`, and an interval without a matching
 * fee or bonus simply contributes `0`.
 *
 * @param input - Energy prices, what they already include, the grid fee and the bonuses
 * @returns Composed entries in the order of the input energy prices
 *
 * @example
 * ```typescript
 * const series = await energyApp.useElectricityTariff().getPrices(direction, {fromIso, untilIso});
 * const fees = await energyApp.useGridFee().getGridFeeValues({fromIso, untilIso});
 * const spot = await energyApp.useEpexSpotPrices().getPrices({fromIso, untilIso});
 *
 * const prices = composeElectricityPrices({
 *     energyPrices: fromEpexSpotEntries(spot.entries),
 *     energyPriceComposition: series?.includes,
 *     gridFees: fees,
 *     bonuses: myBonuses,
 *     currency: 'EUR',
 * });
 *
 * const cheapest = prices.reduce((a, b) => (b.effectivePricePerKwh < a.effectivePricePerKwh ? b : a));
 * ```
 */
export function composeElectricityPrices(
    input: EnyoComposeElectricityPricesInput,
): EnyoComposedElectricityPriceEntry[] {
    const direction = input.appliesTo ?? EnyoPriceAppliesToEnum.Consumption;
    const gridFeeIncluded = input.energyPriceComposition?.includes(EnyoPriceComponentEnum.GridFee) === true;
    const bonusesIncluded = input.energyPriceComposition?.includes(EnyoPriceComponentEnum.Bonuses) === true;

    const gridFeeSeriesApplies =
        input.gridFees != null && appliesToDirection(input.gridFees.appliesTo, direction);
    const resolvedGridFees = gridFeeSeriesApplies ? gridFeeByTimestamp(input.gridFees) : new Map<string, number>();
    const constantGridFee =
        !gridFeeSeriesApplies && input.constantGridFeePerKwh !== undefined ? input.constantGridFeePerKwh : undefined;
    const hasGridFeeSource = gridFeeSeriesApplies || constantGridFee !== undefined;

    const range = {
        fromIso: input.energyPrices[0]?.timestampIso,
        untilIso: input.energyPrices[input.energyPrices.length - 1]?.timestampIso,
    };
    const resolvedBonuses =
        input.bonuses === undefined || input.bonuses.length === 0 || range.fromIso === undefined
            ? new Map<string, {bonusPerKwh: number; appliedBonusIds: string[]}>()
            : resolveTariffBonuses(input.bonuses, {
                fromIso: range.fromIso,
                // The last entry starts the final interval, so extend past it.
                untilIso: new Date(Date.parse(range.untilIso as string) + 1).toISOString(),
                appliesTo: direction,
            });

    return input.energyPrices.map(entry => {
        const gridFeePerKwh = hasGridFeeSource
            ? constantGridFee ?? resolvedGridFees.get(entry.timestampIso) ?? 0
            : 0;
        const gridFeeOrigin = !hasGridFeeSource
            ? EnyoPriceComponentOriginEnum.NotApplicable
            : gridFeeIncluded
                ? EnyoPriceComponentOriginEnum.Included
                : EnyoPriceComponentOriginEnum.Added;

        const bonus = resolvedBonuses.get(entry.timestampIso);
        const bonusPerKwh = bonus?.bonusPerKwh ?? 0;
        const bonusOrigin = bonus === undefined
            ? EnyoPriceComponentOriginEnum.NotApplicable
            : bonusesIncluded
                ? EnyoPriceComponentOriginEnum.Included
                : EnyoPriceComponentOriginEnum.Added;

        let effectivePricePerKwh = entry.pricePerKwh;
        if (gridFeeOrigin === EnyoPriceComponentOriginEnum.Added) {
            effectivePricePerKwh += gridFeePerKwh;
        }
        if (bonusOrigin === EnyoPriceComponentOriginEnum.Added) {
            effectivePricePerKwh -= bonusPerKwh;
        }
        if (input.minEffectivePricePerKwh !== undefined) {
            effectivePricePerKwh = Math.max(effectivePricePerKwh, input.minEffectivePricePerKwh);
        }

        return {
            timestampIso: entry.timestampIso,
            energyPricePerKwh: entry.pricePerKwh,
            gridFeePerKwh,
            gridFeeOrigin,
            bonusPerKwh,
            bonusOrigin,
            appliedBonusIds: bonus?.appliedBonusIds ?? [],
            effectivePricePerKwh,
            currency: input.currency,
        };
    });
}
