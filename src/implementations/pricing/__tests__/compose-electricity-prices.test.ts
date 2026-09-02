import {describe, expect, it} from 'vitest';
import {
    composeElectricityPrices,
    fromEnergyPriceEntries,
    fromEpexSpotEntries,
    resolveTariffBonuses,
} from '../compose-electricity-prices.js';
import {EnyoTariffBonus} from '../../../types/enyo-electricity-tariff.js';
import {EnyoDynamicGridFeeSeries} from '../../../types/enyo-grid-fee.js';
import {EnyoPriceComponentOriginEnum} from '../../../types/enyo-price-composition.js';
import {EnyoPriceAppliesToEnum, EnyoPriceScheduleTypeEnum} from '../../../types/enyo-price-schedule.js';
import {EnyoCurrencyEnum} from '../../../types/enyo-currency.js';
import {ForecastResolutionEnum} from '../../../types/enyo-forecasting.js';

const BERLIN = 'Europe/Berlin';

const ENERGY_PRICES = [
    {timestampIso: '2026-09-02T10:00:00.000Z', pricePerKwh: 0.20},
    {timestampIso: '2026-09-02T10:15:00.000Z', pricePerKwh: 0.10},
];

function gridFeeSeries(feePerKwh: number, appliesTo = EnyoPriceAppliesToEnum.Consumption): EnyoDynamicGridFeeSeries {
    return {
        gridFeeId: 'dso-1',
        currency: EnyoCurrencyEnum.EUR,
        resolution: ForecastResolutionEnum.FifteenMinutes,
        timezone: BERLIN,
        appliesTo,
        entries: ENERGY_PRICES.map(entry => ({timestampIso: entry.timestampIso, feePerKwh})),
    };
}

function constantBonus(id: string, amountPerKwh: number, extra: Partial<EnyoTariffBonus> = {}): EnyoTariffBonus {
    return {
        id,
        name: id,
        timezone: BERLIN,
        appliesTo: EnyoPriceAppliesToEnum.Consumption,
        schedule: {type: EnyoPriceScheduleTypeEnum.Constant, amountPerKwh},
        ...extra,
    };
}

describe('composeElectricityPrices', () => {
    it('adds the grid fee when the energy prices do not include it', () => {
        const composed = composeElectricityPrices({
            energyPrices: ENERGY_PRICES,
            energyPriceComposition: {includesGridFee: false},
            gridFees: gridFeeSeries(0.09),
        });
        expect(composed[0].gridFeeOrigin).toBe(EnyoPriceComponentOriginEnum.Added);
        expect(composed[0].effectivePricePerKwh).toBeCloseTo(0.29, 10);
        expect(composed[1].effectivePricePerKwh).toBeCloseTo(0.19, 10);
    });

    it('reports but never adds a grid fee the provider already includes', () => {
        const composed = composeElectricityPrices({
            energyPrices: ENERGY_PRICES,
            energyPriceComposition: {includesGridFee: true},
            gridFees: gridFeeSeries(0.09),
        });
        expect(composed[0].gridFeeOrigin).toBe(EnyoPriceComponentOriginEnum.Included);
        expect(composed[0].gridFeePerKwh).toBe(0.09);
        expect(composed[0].effectivePricePerKwh).toBe(0.20);
    });

    it('treats a missing composition declaration as energy price only', () => {
        const composed = composeElectricityPrices({
            energyPrices: ENERGY_PRICES,
            gridFees: gridFeeSeries(0.09),
        });
        expect(composed[0].gridFeeOrigin).toBe(EnyoPriceComponentOriginEnum.Added);
        expect(composed[0].effectivePricePerKwh).toBeCloseTo(0.29, 10);
    });

    it('falls back to a constant grid fee when no series is given', () => {
        const composed = composeElectricityPrices({
            energyPrices: ENERGY_PRICES,
            constantGridFeePerKwh: 0.08,
        });
        expect(composed[0].gridFeePerKwh).toBe(0.08);
        expect(composed[0].effectivePricePerKwh).toBeCloseTo(0.28, 10);
    });

    it('marks the grid fee as not applicable when there is no source at all', () => {
        const composed = composeElectricityPrices({energyPrices: ENERGY_PRICES});
        expect(composed[0].gridFeeOrigin).toBe(EnyoPriceComponentOriginEnum.NotApplicable);
        expect(composed[0].gridFeePerKwh).toBe(0);
        expect(composed[0].effectivePricePerKwh).toBe(0.20);
    });

    it('ignores a grid fee registered for the other direction', () => {
        const composed = composeElectricityPrices({
            energyPrices: ENERGY_PRICES,
            gridFees: gridFeeSeries(0.09, EnyoPriceAppliesToEnum.FeedIn),
        });
        expect(composed[0].gridFeeOrigin).toBe(EnyoPriceComponentOriginEnum.NotApplicable);
        expect(composed[0].effectivePricePerKwh).toBe(0.20);
    });

    it('subtracts stacked bonuses and lists every contributor', () => {
        const composed = composeElectricityPrices({
            energyPrices: ENERGY_PRICES,
            bonuses: [constantBonus('night', 0.03), constantBonus('promo', 0.02)],
        });
        expect(composed[0].bonusPerKwh).toBeCloseTo(0.05, 10);
        expect(composed[0].appliedBonusIds.sort()).toEqual(['night', 'promo']);
        expect(composed[0].effectivePricePerKwh).toBeCloseTo(0.15, 10);
    });

    it('lets the highest-priority exclusive bonus win alone', () => {
        const composed = composeElectricityPrices({
            energyPrices: ENERGY_PRICES,
            bonuses: [
                constantBonus('stackable', 0.03),
                constantBonus('weak-exclusive', 0.04, {exclusive: true, priority: 1}),
                constantBonus('strong-exclusive', 0.06, {exclusive: true, priority: 5}),
            ],
        });
        expect(composed[0].appliedBonusIds).toEqual(['strong-exclusive']);
        expect(composed[0].bonusPerKwh).toBe(0.06);
        expect(composed[0].effectivePricePerKwh).toBeCloseTo(0.14, 10);
    });

    it('reports but never applies bonuses the provider already applied', () => {
        const composed = composeElectricityPrices({
            energyPrices: ENERGY_PRICES,
            energyPriceComposition: {includesGridFee: false, includesBonuses: true},
            bonuses: [constantBonus('night', 0.03)],
        });
        expect(composed[0].bonusOrigin).toBe(EnyoPriceComponentOriginEnum.Included);
        expect(composed[0].bonusPerKwh).toBe(0.03);
        expect(composed[0].effectivePricePerKwh).toBe(0.20);
    });

    it('applies grid fee and bonus together', () => {
        const composed = composeElectricityPrices({
            energyPrices: ENERGY_PRICES,
            gridFees: gridFeeSeries(0.09),
            bonuses: [constantBonus('night', 0.05)],
            currency: 'EUR',
        });
        expect(composed[0].effectivePricePerKwh).toBeCloseTo(0.24, 10);
        expect(composed[0].currency).toBe('EUR');
    });

    it('clamps to the configured floor when one is given', () => {
        const composed = composeElectricityPrices({
            energyPrices: ENERGY_PRICES,
            bonuses: [constantBonus('huge', 0.5)],
            minEffectivePricePerKwh: 0,
        });
        expect(composed[0].effectivePricePerKwh).toBe(0);
    });

    it('allows negative effective prices when no floor is given', () => {
        const composed = composeElectricityPrices({
            energyPrices: ENERGY_PRICES,
            bonuses: [constantBonus('huge', 0.5)],
        });
        expect(composed[0].effectivePricePerKwh).toBeCloseTo(-0.30, 10);
    });

    it('returns an empty result for an empty price series', () => {
        expect(composeElectricityPrices({energyPrices: [], bonuses: [constantBonus('night', 0.05)]})).toEqual([]);
    });

    it('covers the final interval of the series when resolving bonuses', () => {
        const composed = composeElectricityPrices({
            energyPrices: ENERGY_PRICES,
            bonuses: [constantBonus('night', 0.05)],
        });
        expect(composed[composed.length - 1].bonusPerKwh).toBe(0.05);
    });
});

describe('resolveTariffBonuses', () => {
    it('skips bonuses registered for the other direction', () => {
        const resolved = resolveTariffBonuses(
            [constantBonus('feed-in-only', 0.05, {appliesTo: EnyoPriceAppliesToEnum.FeedIn})],
            {fromIso: '2026-09-02T10:00:00Z', untilIso: '2026-09-02T11:00:00Z'},
        );
        expect(resolved.size).toBe(0);
    });

    it('includes bonuses registered for both directions', () => {
        const resolved = resolveTariffBonuses(
            [constantBonus('always', 0.05, {appliesTo: EnyoPriceAppliesToEnum.Both})],
            {fromIso: '2026-09-02T10:00:00Z', untilIso: '2026-09-02T11:00:00Z', appliesTo: EnyoPriceAppliesToEnum.FeedIn},
        );
        expect(resolved.get('2026-09-02T10:00:00.000Z')?.bonusPerKwh).toBe(0.05);
    });

    it('honours a bonus validity window', () => {
        const resolved = resolveTariffBonuses(
            [constantBonus('promo', 0.05, {validUntilIso: '2026-09-02T10:30:00Z'})],
            {fromIso: '2026-09-02T10:00:00Z', untilIso: '2026-09-02T11:00:00Z'},
        );
        expect(resolved.has('2026-09-02T10:15:00.000Z')).toBe(true);
        expect(resolved.has('2026-09-02T10:30:00.000Z')).toBe(false);
    });
});

describe('energy price adapters', () => {
    it('maps consumption prices by default', () => {
        expect(fromEnergyPriceEntries([
            {timestampIso: '2026-09-02T10:00:00.000Z', consumptionPricePerKwh: 0.3, feedInPricePerKwh: 0.08, currency: 'EUR'},
        ])).toEqual([{timestampIso: '2026-09-02T10:00:00.000Z', pricePerKwh: 0.3}]);
    });

    it('maps feed-in prices and skips entries without one', () => {
        expect(fromEnergyPriceEntries([
            {timestampIso: '2026-09-02T10:00:00.000Z', consumptionPricePerKwh: 0.3, currency: 'EUR'},
            {timestampIso: '2026-09-02T10:15:00.000Z', consumptionPricePerKwh: 0.3, feedInPricePerKwh: 0.08, currency: 'EUR'},
        ], EnyoPriceAppliesToEnum.FeedIn)).toEqual([{timestampIso: '2026-09-02T10:15:00.000Z', pricePerKwh: 0.08}]);
    });

    it('maps EPEX spot entries to their per-kWh price', () => {
        expect(fromEpexSpotEntries([
            {
                timestampIso: '2026-09-02T10:00:00.000Z',
                endTimestampIso: '2026-09-02T10:15:00.000Z',
                pricePerMwh: -14.2,
                pricePerKwh: -0.0142,
            },
        ])).toEqual([{timestampIso: '2026-09-02T10:00:00.000Z', pricePerKwh: -0.0142}]);
    });
});
