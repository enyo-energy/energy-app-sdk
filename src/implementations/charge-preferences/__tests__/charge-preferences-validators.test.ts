import {describe, expect, it} from 'vitest';
import {EnyoChargeModeEnum, EnyoPriceLimitModeEnum} from '../../../types/enyo-data-bus-value.js';
import type {EnyoChargePreferences} from '../../../types/enyo-charge-preferences.js';
import type {EnyoVehicle} from '../../../types/enyo-vehicle.js';
import {
    EnyoChargerApplianceAuthorizationModeEnum,
    type EnyoChargerApplianceMetadata,
    EnyoChargerApplianceStatusEnum,
} from '../../../types/enyo-charger-appliance.js';
import {
    assertValidChargePreferences,
    ChargePreferencesValidationError,
    validateChargePreferences,
} from '../charge-preferences-validators.js';

/** A complete, coherent set of preferences. */
const FULL: EnyoChargePreferences = {
    defaultChargeLimitPercent: 80,
    defaultChargeMode: EnyoChargeModeEnum.CostOptimized,
    priceLimitMode: EnyoPriceLimitModeEnum.CtPerKwh,
    priceLimitCtPerKwh: 25,
    immediateReserveKwh: 10,
    departureTimeHHmm: '07:30',
    departureTimezone: 'Europe/Berlin',
};

/** Validates {@link FULL} with overrides, so a test isolates the rule it is about. */
const validate = (overrides: Partial<EnyoChargePreferences> = {}) =>
    validateChargePreferences({...FULL, ...overrides});

describe('validateChargePreferences — vehicle and wallbox', () => {
    it('accepts a coherent vehicle without warnings', () => {
        const vehicle: EnyoVehicle = {id: 'v1', name: 'Family car', ...FULL};
        expect(validateChargePreferences(vehicle)).toEqual({ok: true, errors: [], warnings: []});
    });

    it('accepts a coherent wallbox without warnings', () => {
        const wallbox: EnyoChargerApplianceMetadata = {
            availableFeatures: [],
            status: EnyoChargerApplianceStatusEnum.Available,
            authorizationMode: EnyoChargerApplianceAuthorizationModeEnum.NoAuthorization,
            ...FULL,
        };
        expect(validateChargePreferences(wallbox)).toEqual({ok: true, errors: [], warnings: []});
    });

    it('accepts empty preferences — nothing set defers to the next place in the chain', () => {
        expect(validateChargePreferences({})).toEqual({ok: true, errors: [], warnings: []});
    });

    it('treats null as unset', () => {
        const {ok, warnings} = validateChargePreferences({
            priceLimitCtPerKwh: null as unknown as number,
            departureTimeHHmm: null as unknown as string,
        });
        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });

    it('does not flag a ceiling next to a non-cost-optimised default — a session may still switch', () => {
        const {ok, warnings} = validate({defaultChargeMode: EnyoChargeModeEnum.Immediate});
        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });
});

describe('validateChargePreferences — enums', () => {
    it('rejects values outside their enums', () => {
        const {ok, errors} = validate({
            defaultChargeMode: 'whenever' as EnyoChargeModeEnum,
            priceLimitMode: 'cheapest' as EnyoPriceLimitModeEnum,
        });
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('EnyoChargeModeEnum'))).toBe(true);
        expect(errors.some((e) => e.includes('EnyoPriceLimitModeEnum'))).toBe(true);
    });
});

describe('validateChargePreferences — charge limit', () => {
    it('rejects a value outside 0…100 or not a number', () => {
        for (const bad of [-1, 101, Number.NaN]) {
            const {ok, errors} = validate({defaultChargeLimitPercent: bad});
            expect(ok, String(bad)).toBe(false);
            expect(errors.some((e) => e.includes('defaultChargeLimitPercent')), String(bad)).toBe(true);
        }
    });

    it('warns at 0, which never charges', () => {
        const {ok, warnings} = validate({defaultChargeLimitPercent: 0});
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('would ever charge'))).toBe(true);
    });
});

describe('validateChargePreferences — price limit (ct/kWh)', () => {
    it('accepts a negative limit — negative wholesale prices are real', () => {
        expect(validate({priceLimitCtPerKwh: -5}).warnings).toEqual([]);
    });

    it('rejects a non-finite number', () => {
        const {ok, errors} = validate({priceLimitCtPerKwh: Number.NaN});
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('finite number'))).toBe(true);
    });

    it('warns on a value outside the plausible band, catching a EUR/kWh mix-up', () => {
        const {ok, warnings} = validate({priceLimitCtPerKwh: 700});
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('cents per kWh, not EUR per kWh'))).toBe(true);
    });
});

describe('validateChargePreferences — price limit (share of day)', () => {
    const share = (priceLimitSharePercent: number) => validate({
        priceLimitMode: EnyoPriceLimitModeEnum.CheapestShare,
        priceLimitCtPerKwh: undefined,
        priceLimitSharePercent,
    });

    it('accepts the cheapest quarter', () => {
        expect(share(25)).toEqual({ok: true, errors: [], warnings: []});
    });

    it('rejects a fractional share, 0 and anything above 100', () => {
        for (const bad of [25.5, 0, 101]) {
            const {ok, errors} = share(bad);
            expect(ok, String(bad)).toBe(false);
            expect(errors.some((e) => e.includes('priceLimitSharePercent')), String(bad)).toBe(true);
        }
    });

    it('warns at 100, which is indistinguishable from having no ceiling', () => {
        const {ok, warnings} = share(100);
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('no ceiling at all'))).toBe(true);
    });
});

describe('validateChargePreferences — ceiling mode and values', () => {
    it('warns when the ceiling stored is not the one the mode reads', () => {
        const {warnings} = validate({
            priceLimitMode: EnyoPriceLimitModeEnum.CheapestShare,
            priceLimitSharePercent: 25,
        });
        expect(warnings.some((w) => w.includes('`priceLimitCtPerKwh` is set'))).toBe(true);
    });

    it('warns when a ceiling value is stored without any mode', () => {
        const {warnings} = validate({priceLimitMode: undefined});
        expect(warnings.some((w) => w.includes('`priceLimitCtPerKwh` is set'))).toBe(true);
    });

    it('warns when a mode names a value that is missing', () => {
        expect(validate({priceLimitCtPerKwh: undefined}).warnings
            .some((w) => w.includes('no ceiling applies'))).toBe(true);
        expect(validate({priceLimitMode: EnyoPriceLimitModeEnum.CheapestShare, priceLimitCtPerKwh: undefined})
            .warnings.some((w) => w.includes('no ceiling applies'))).toBe(true);
    });
});

describe('validateChargePreferences — immediate reserve', () => {
    it('accepts 0, which means off', () => {
        expect(validate({immediateReserveKwh: 0}).warnings).toEqual([]);
    });

    it('rejects a negative or non-finite reserve', () => {
        for (const bad of [-1, Number.NaN]) {
            const {ok, errors} = validate({immediateReserveKwh: bad});
            expect(ok, String(bad)).toBe(false);
            expect(errors.some((e) => e.includes('immediateReserveKwh')), String(bad)).toBe(true);
        }
    });

    it('warns on an implausibly large reserve, catching a Wh value in a kWh field', () => {
        const {ok, warnings} = validate({immediateReserveKwh: 10000});
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('not watt-hours'))).toBe(true);
    });
});

describe('validateChargePreferences — departure time', () => {
    it('rejects a malformed time', () => {
        for (const bad of ['7:30', '25:00', '07:60', 'morning']) {
            const {ok, errors} = validate({departureTimeHHmm: bad});
            expect(ok, bad).toBe(false);
            expect(errors.some((e) => e.includes('24-hour HH:mm'))).toBe(true);
        }
    });

    it('rejects a timezone the runtime cannot resolve', () => {
        const {ok, errors} = validate({departureTimezone: 'Europe/Berln'});
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('not an IANA timezone'))).toBe(true);
    });

    it('warns when a time is set without a timezone', () => {
        const {ok, warnings} = validate({departureTimezone: undefined});
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('DST boundary'))).toBe(true);
    });
});

describe('assertValidChargePreferences', () => {
    it('returns the object unchanged when it is valid', () => {
        const vehicle: EnyoVehicle = {id: 'v1', name: 'Family car', ...FULL};
        expect(assertValidChargePreferences(vehicle)).toBe(vehicle);
    });

    it('throws with every blocking error attached', () => {
        try {
            assertValidChargePreferences({...FULL, priceLimitCtPerKwh: Number.NaN, departureTimeHHmm: 'morning'});
            expect.unreachable('should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(ChargePreferencesValidationError);
            expect((error as ChargePreferencesValidationError).errors).toHaveLength(2);
        }
    });

    it('does not throw on warnings alone', () => {
        expect(() => assertValidChargePreferences({priceLimitCtPerKwh: 7})).not.toThrow();
    });
});
