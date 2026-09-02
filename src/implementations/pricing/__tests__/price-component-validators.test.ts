import {describe, expect, it} from 'vitest';
import {
    PriceComponentValidationError,
    validateDynamicGridFee,
    validateElectricityTariffPricing,
    validatePriceSchedule,
    validateTariffBonus,
    validateTariffBonuses,
    validateTariffGridFeeConfig,
} from '../price-component-validators.js';
import {
    ElectricityTariffTypeEnum,
    EnyoElectricityTariff,
    EnyoTariffBonus,
    GridFeeModeEnum,
} from '../../../types/enyo-electricity-tariff.js';
import {EnyoDynamicGridFeeRegistration} from '../../../types/enyo-grid-fee.js';
import {EnyoPriceAppliesToEnum, EnyoPriceScheduleTypeEnum} from '../../../types/enyo-price-schedule.js';
import {EnyoCurrencyEnum} from '../../../types/enyo-currency.js';

const BERLIN = 'Europe/Berlin';

function gridFee(overrides: Partial<EnyoDynamicGridFeeRegistration> = {}): EnyoDynamicGridFeeRegistration {
    return {
        id: 'dso-1',
        name: 'Netzentgelt HT/NT 2026',
        gridOperator: 'Netze BW',
        currency: EnyoCurrencyEnum.EUR,
        timezone: BERLIN,
        appliesTo: EnyoPriceAppliesToEnum.Consumption,
        schedule: {
            type: EnyoPriceScheduleTypeEnum.Recurring,
            windows: [
                {startTimeOfDay: '06:00', endTimeOfDay: '22:00', amountPerKwh: 0.0912},
                {startTimeOfDay: '22:00', endTimeOfDay: '06:00', amountPerKwh: 0.0431},
            ],
        },
        ...overrides,
    };
}

function bonus(overrides: Partial<EnyoTariffBonus> = {}): EnyoTariffBonus {
    return {
        id: 'night',
        name: 'Nachtbonus',
        timezone: BERLIN,
        appliesTo: EnyoPriceAppliesToEnum.Consumption,
        schedule: {type: EnyoPriceScheduleTypeEnum.Constant, amountPerKwh: 0.05},
        ...overrides,
    };
}

describe('validatePriceSchedule', () => {
    it('accepts complementary recurring windows', () => {
        expect(() => validatePriceSchedule(gridFee().schedule)).not.toThrow();
    });

    it('rejects overlapping recurring windows', () => {
        expect(() => validatePriceSchedule({
            type: EnyoPriceScheduleTypeEnum.Recurring,
            windows: [
                {startTimeOfDay: '06:00', endTimeOfDay: '12:00', amountPerKwh: 0.09},
                {startTimeOfDay: '11:00', endTimeOfDay: '18:00', amountPerKwh: 0.04},
            ],
        })).toThrow(PriceComponentValidationError);
    });

    it('rejects a wrapping window that overlaps a morning window', () => {
        expect(() => validatePriceSchedule({
            type: EnyoPriceScheduleTypeEnum.Recurring,
            windows: [
                {startTimeOfDay: '22:00', endTimeOfDay: '06:00', amountPerKwh: 0.04},
                {startTimeOfDay: '05:00', endTimeOfDay: '12:00', amountPerKwh: 0.09},
            ],
        })).toThrow(/overlaps/);
    });

    it('allows same-time windows on disjoint weekdays', () => {
        expect(() => validatePriceSchedule({
            type: EnyoPriceScheduleTypeEnum.Recurring,
            windows: [
                {startTimeOfDay: '06:00', endTimeOfDay: '12:00', daysOfWeek: [1, 2, 3, 4, 5], amountPerKwh: 0.09},
                {startTimeOfDay: '06:00', endTimeOfDay: '12:00', daysOfWeek: [0, 6], amountPerKwh: 0.04},
            ],
        })).not.toThrow();
    });

    it('allows same-time windows in disjoint months', () => {
        expect(() => validatePriceSchedule({
            type: EnyoPriceScheduleTypeEnum.Recurring,
            windows: [
                {startTimeOfDay: '06:00', endTimeOfDay: '12:00', months: [12, 1, 2], amountPerKwh: 0.11},
                {startTimeOfDay: '06:00', endTimeOfDay: '12:00', months: [6, 7, 8], amountPerKwh: 0.07},
            ],
        })).not.toThrow();
    });

    it('rejects malformed times, empty selectors and identical bounds', () => {
        expect(() => validatePriceSchedule({
            type: EnyoPriceScheduleTypeEnum.Recurring,
            windows: [{startTimeOfDay: '6:00', endTimeOfDay: '12:00', amountPerKwh: 0.09}],
        })).toThrow(/HH:mm/);
        expect(() => validatePriceSchedule({
            type: EnyoPriceScheduleTypeEnum.Recurring,
            windows: [{startTimeOfDay: '06:00', endTimeOfDay: '06:00', amountPerKwh: 0.09}],
        })).toThrow(/same time of day/);
        expect(() => validatePriceSchedule({
            type: EnyoPriceScheduleTypeEnum.Recurring,
            windows: [{startTimeOfDay: '06:00', endTimeOfDay: '12:00', daysOfWeek: [], amountPerKwh: 0.09}],
        })).toThrow(/daysOfWeek/);
        expect(() => validatePriceSchedule({
            type: EnyoPriceScheduleTypeEnum.Recurring,
            windows: [{startTimeOfDay: '06:00', endTimeOfDay: '12:00', months: [13], amountPerKwh: 0.09}],
        })).toThrow(/months/);
    });

    it('rejects negative and non-finite amounts', () => {
        expect(() => validatePriceSchedule({
            type: EnyoPriceScheduleTypeEnum.Constant,
            amountPerKwh: -0.01,
        })).toThrow(/must not be negative/);
        expect(() => validatePriceSchedule({
            type: EnyoPriceScheduleTypeEnum.Constant,
            amountPerKwh: Number.NaN,
        })).toThrow(/finite/);
    });

    it('rejects overlapping and inverted absolute windows', () => {
        expect(() => validatePriceSchedule({
            type: EnyoPriceScheduleTypeEnum.Absolute,
            windows: [
                {startIso: '2026-09-02T10:00:00Z', endIso: '2026-09-02T12:00:00Z', amountPerKwh: 0.07},
                {startIso: '2026-09-02T11:00:00Z', endIso: '2026-09-02T13:00:00Z', amountPerKwh: 0.12},
            ],
        })).toThrow(/overlaps/);
        expect(() => validatePriceSchedule({
            type: EnyoPriceScheduleTypeEnum.Absolute,
            windows: [{startIso: '2026-09-02T12:00:00Z', endIso: '2026-09-02T10:00:00Z', amountPerKwh: 0.07}],
        })).toThrow(/after startIso/);
    });

    it('rejects empty window lists', () => {
        expect(() => validatePriceSchedule({type: EnyoPriceScheduleTypeEnum.Absolute, windows: []}))
            .toThrow(/at least one window/);
    });
});

describe('validateDynamicGridFee', () => {
    it('accepts a well-formed registration', () => {
        expect(() => validateDynamicGridFee(gridFee())).not.toThrow();
    });

    it('rejects an unknown time zone', () => {
        expect(() => validateDynamicGridFee(gridFee({timezone: 'Europe/Atlantis'}))).toThrow(/IANA/);
    });

    it('rejects blank identifying fields', () => {
        expect(() => validateDynamicGridFee(gridFee({id: '  '}))).toThrow(/gridFee.id/);
        expect(() => validateDynamicGridFee(gridFee({gridOperator: ''}))).toThrow(/gridOperator/);
    });

    it('rejects an inverted validity range', () => {
        expect(() => validateDynamicGridFee(gridFee({
            validFromIso: '2026-09-02T00:00:00Z',
            validUntilIso: '2026-09-01T00:00:00Z',
        }))).toThrow(/validUntilIso/);
    });
});

describe('validateTariffBonus', () => {
    it('accepts a well-formed bonus', () => {
        expect(() => validateTariffBonus(bonus())).not.toThrow();
    });

    it('rejects a negative discount', () => {
        expect(() => validateTariffBonus(bonus({
            schedule: {type: EnyoPriceScheduleTypeEnum.Constant, amountPerKwh: -0.05},
        }))).toThrow(/must not be negative/);
    });

    it('rejects duplicate bonus ids within one tariff', () => {
        expect(() => validateTariffBonuses([bonus(), bonus()])).toThrow(/used more than once/);
    });
});

describe('validateTariffGridFeeConfig', () => {
    it('accepts dynamic mode on its own — the fee is not bound to the tariff', () => {
        expect(() => validateTariffGridFeeConfig({gridFeeMode: GridFeeModeEnum.Dynamic}, undefined)).not.toThrow();
    });

    it('rejects declaring a dynamic fee that the prices already include', () => {
        expect(() => validateTariffGridFeeConfig(
            {gridFeeMode: GridFeeModeEnum.Dynamic},
            {includesGridFee: true},
        )).toThrow(/already contained/);
    });

    it('accepts a dynamic fee when the prices exclude it', () => {
        expect(() => validateTariffGridFeeConfig(
            {gridFeeMode: GridFeeModeEnum.Dynamic},
            {includesGridFee: false},
        )).not.toThrow();
    });

    it('treats an omitted mode as static', () => {
        expect(() => validateTariffGridFeeConfig({}, undefined)).not.toThrow();
        expect(() => validateTariffGridFeeConfig({}, {includesGridFee: true})).not.toThrow();
    });
});

describe('validateElectricityTariffPricing', () => {
    const tariff: EnyoElectricityTariff = {
        id: 'spot-2026',
        tariffType: ElectricityTariffTypeEnum.Dynamic,
        tariffName: 'Spot 2026',
        vendorName: 'enyo',
        priceComposition: {includesGridFee: false},
        dynamicTariffData: {
            currency: 'EUR',
            gridFeeMode: GridFeeModeEnum.Dynamic,
        },
        bonuses: [bonus()],
    };

    it('accepts a fully specified tariff', () => {
        expect(() => validateElectricityTariffPricing(tariff)).not.toThrow();
    });

    it('reports which pricing shape is misconfigured', () => {
        expect(() => validateElectricityTariffPricing({
            ...tariff,
            priceComposition: {includesGridFee: true},
        })).toThrow(/dynamicTariffData/);
    });

    it('validates the grid fee declaration of a static tariff too', () => {
        expect(() => validateElectricityTariffPricing({
            id: 'fixed',
            tariffType: ElectricityTariffTypeEnum.Static,
            tariffName: 'Fixed',
            vendorName: 'enyo',
            priceComposition: {includesGridFee: true},
            staticTariffData: {pricePerKwh: 0.28, currency: 'EUR', gridFeeMode: GridFeeModeEnum.Dynamic},
        })).toThrow(/staticTariffData/);
    });
});
