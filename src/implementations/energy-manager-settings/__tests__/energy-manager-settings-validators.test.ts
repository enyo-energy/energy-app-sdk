import {describe, expect, it} from 'vitest';
import {
    ENERGY_MANAGER_SETTING_DEPENDENCIES,
    ENERGY_MANAGER_SETTING_VALUE_KEYS,
    EnergyManagerBatteryChargingModeEnum,
    EnergyManagerBatteryEvDischargeModeEnum,
    EnergyManagerHeatingRodModeEnum,
    EnergyManagerSettingEnum,
    type EnergyManagerSettingValues,
    type EnergyManagerSettingsState,
} from '../../../types/enyo-energy-manager-settings.js';
import {EnyoChargeModeEnum} from '../../../types/enyo-data-bus-value.js';
import {
    assertValidEnergyManagerSettingsState,
    EnergyManagerSettingsValidationError,
    validateEnergyManagerSettingsState,
} from '../energy-manager-settings-validators.js';
import {
    getEnergyManagerSettingDependency,
    isEnergyManagerSettingActive,
} from '../energy-manager-settings-utils.js';

const ALL_SETTINGS = Object.values(EnergyManagerSettingEnum);

/** A state supporting everything, so a test isolates the rule it is about. */
const state = (
    values: EnergyManagerSettingValues,
    supported: EnergyManagerSettingEnum[] = ALL_SETTINGS,
): EnergyManagerSettingsState => ({supported, values});

describe('validateEnergyManagerSettingsState — supported list', () => {
    it('accepts a coherent, fully wired state without warnings', () => {
        const {ok, errors, warnings} = validateEnergyManagerSettingsState(
            state({
                batteryControl: true,
                batteryChargingMode: EnergyManagerBatteryChargingModeEnum.Paced,
                batteryChargeFromGrid: false,
                batteryEvDischargeMode: EnergyManagerBatteryEvDischargeModeEnum.FixedWh,
                batteryEvDischargeFixedWh: 2000,
                heatpumpControl: true,
                heatingRodControl: true,
                heatingRodMode: EnergyManagerHeatingRodModeEnum.PvSurplusOnly,
                chargerControl: true,
                defaultChargeMode: EnyoChargeModeEnum.CostOptimized,
                costOptimizedTargetTime: '07:30',
                costOptimizedTimezone: 'Europe/Berlin',
            }),
        );

        expect(ok).toBe(true);
        expect(errors).toEqual([]);
        expect(warnings).toEqual([]);
    });

    it('rejects a non-enum member and a duplicate in `supported`', () => {
        const bogus = validateEnergyManagerSettingsState({
            supported: ['solar-control' as EnergyManagerSettingEnum],
            values: {},
        });
        expect(bogus.ok).toBe(false);
        expect(bogus.errors.some((e) => e.includes('not an EnergyManagerSettingEnum member'))).toBe(true);

        const dupe = validateEnergyManagerSettingsState({
            supported: [EnergyManagerSettingEnum.BatteryControl, EnergyManagerSettingEnum.BatteryControl],
            values: {},
        });
        expect(dupe.ok).toBe(false);
        expect(dupe.errors.some((e) => e.includes('more than once'))).toBe(true);
    });

    it('rejects a non-array `supported`', () => {
        const {ok, errors} = validateEnergyManagerSettingsState(
            {values: {}} as unknown as EnergyManagerSettingsState,
        );
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('must be an array'))).toBe(true);
    });

    it('warns when a value is stored for an unsupported setting', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(
            state({heatpumpControl: true}, [EnergyManagerSettingEnum.BatteryControl]),
        );

        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('will ignore it'))).toBe(true);
    });
});

describe('validateEnergyManagerSettingsState — value formats', () => {
    it('rejects a non-boolean gate', () => {
        const {ok, errors} = validateEnergyManagerSettingsState(
            state({batteryControl: 'yes' as unknown as boolean}),
        );
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('`batteryControl` must be a boolean'))).toBe(true);
    });

    it('rejects values outside their enums', () => {
        const {ok, errors} = validateEnergyManagerSettingsState(
            state({
                batteryControl: true,
                batteryChargingMode: 'turbo' as EnergyManagerBatteryChargingModeEnum,
                heatingRodControl: true,
                heatingRodMode: 'blast' as EnergyManagerHeatingRodModeEnum,
                chargerControl: true,
                defaultChargeMode: 'whenever' as EnyoChargeModeEnum,
            }),
        );

        expect(ok).toBe(false);
        expect(errors.filter((e) => e.includes('is not an')).length).toBe(3);
    });

    it('accepts `false` as a deliberate choice, distinct from absent', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(
            state({batteryControl: false}, [EnergyManagerSettingEnum.BatteryControl]),
        );

        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });
});

describe('validateEnergyManagerSettingsState — price limit (ct/kWh)', () => {
    const priceState = (priceLimitCtPerKwh: number) =>
        state({
            chargerControl: true,
            defaultChargeMode: EnyoChargeModeEnum.PriceLimit,
            priceLimitCtPerKwh,
        });

    it('accepts a normal ct/kWh limit', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(priceState(7));
        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });

    it('accepts a negative limit — negative wholesale prices are real', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(priceState(-5));
        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });

    it('rejects a non-finite number', () => {
        const {ok, errors} = validateEnergyManagerSettingsState(priceState(Number.NaN));
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('finite number'))).toBe(true);
    });

    it('warns on a value outside the plausible band, catching a EUR/kWh mix-up', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(priceState(700));
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('cents per kWh, not EUR per kWh'))).toBe(true);
    });
});

describe('validateEnergyManagerSettingsState — battery-to-EV discharge mode', () => {
    const modeState = (values: Partial<EnergyManagerSettingValues>) =>
        validateEnergyManagerSettingsState(state({batteryControl: true, ...values}));

    it('accepts each parameterised mode with its own parameter', () => {
        expect(modeState({
            batteryEvDischargeMode: EnergyManagerBatteryEvDischargeModeEnum.FixedWh,
            batteryEvDischargeFixedWh: 5000,
        }).warnings).toEqual([]);

        expect(modeState({
            batteryEvDischargeMode: EnergyManagerBatteryEvDischargeModeEnum.SocLimit,
            batteryEvDischargeSocLimitPercent: 50,
        }).warnings).toEqual([]);
    });

    it('accepts the parameterless modes', () => {
        for (const mode of [
            EnergyManagerBatteryEvDischargeModeEnum.Intelligent,
            EnergyManagerBatteryEvDischargeModeEnum.BlockDischarge,
            EnergyManagerBatteryEvDischargeModeEnum.Unmanaged,
        ]) {
            const {ok, warnings} = modeState({batteryEvDischargeMode: mode});
            expect(ok, mode).toBe(true);
            expect(warnings, mode).toEqual([]);
        }
    });

    it('rejects a mode outside the enum', () => {
        const {ok, errors} = modeState({
            batteryEvDischargeMode: 'whatever' as EnergyManagerBatteryEvDischargeModeEnum,
        });
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('EnergyManagerBatteryEvDischargeModeEnum'))).toBe(true);
    });

    it('warns when a parameter belongs to a mode that is not selected', () => {
        const {ok, warnings} = modeState({
            batteryEvDischargeMode: EnergyManagerBatteryEvDischargeModeEnum.SocLimit,
            batteryEvDischargeSocLimitPercent: 50,
            batteryEvDischargeFixedWh: 5000,          // belongs to fixed-wh
        });

        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('battery-ev-discharge-fixed-wh'))).toBe(true);
    });

    it('warns when a parameter is stored with no mode selected at all', () => {
        const {warnings} = modeState({batteryEvDischargeFixedWh: 5000});
        expect(warnings.some((w) => w.includes('it currently cannot'))).toBe(true);
    });
});

describe('validateEnergyManagerSettingsState — fixed Wh budget', () => {
    const budget = (batteryEvDischargeFixedWh: number) =>
        validateEnergyManagerSettingsState(state({
            batteryControl: true,
            batteryEvDischargeMode: EnergyManagerBatteryEvDischargeModeEnum.FixedWh,
            batteryEvDischargeFixedWh,
        }));

    it('accepts a plausible Wh budget', () => {
        const {ok, warnings} = budget(5000);
        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });

    it('rejects a negative budget and points at the block-discharge mode', () => {
        const {ok, errors} = budget(-500);
        expect(ok).toBe(false);
        expect(
            errors.some((e) => e.includes('cannot be negative') && e.includes('block-discharge')),
        ).toBe(true);
    });

    it('rejects a non-finite budget', () => {
        const {ok, errors} = budget(Number.POSITIVE_INFINITY);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('finite number'))).toBe(true);
    });

    it('warns that 0 duplicates the block-discharge mode', () => {
        const {ok, warnings} = budget(0);
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('says the same as mode'))).toBe(true);
    });

    it('warns on a negligible figure, catching a kWh value in a Wh field', () => {
        const {ok, warnings} = budget(10);
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('watt-hours, not kilowatt-hours'))).toBe(true);
    });
});

describe('validateEnergyManagerSettingsState — SoC floor', () => {
    const soc = (batteryEvDischargeSocLimitPercent: number) =>
        validateEnergyManagerSettingsState(state({
            batteryControl: true,
            batteryEvDischargeMode: EnergyManagerBatteryEvDischargeModeEnum.SocLimit,
            batteryEvDischargeSocLimitPercent,
        }));

    it('accepts a floor inside 0…100', () => {
        for (const value of [0, 20, 50, 99]) {
            const {ok, warnings} = soc(value);
            expect(ok, String(value)).toBe(true);
            expect(warnings, String(value)).toEqual([]);
        }
    });

    it('rejects a value outside 0…100', () => {
        for (const value of [-1, 101]) {
            const {ok, errors} = soc(value);
            expect(ok, String(value)).toBe(false);
            expect(errors.some((e) => e.includes('between 0 and 100'))).toBe(true);
        }
    });

    it('rejects a non-finite floor', () => {
        const {ok, errors} = soc(Number.NaN);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('finite number'))).toBe(true);
    });

    it('warns that a floor of 100 can never discharge', () => {
        const {ok, warnings} = soc(100);
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('nothing can ever be discharged'))).toBe(true);
    });
});

describe('validateEnergyManagerSettingsState — cost-optimized target', () => {
    const targetState = (values: Partial<EnergyManagerSettingValues>) =>
        state({
            chargerControl: true,
            defaultChargeMode: EnyoChargeModeEnum.CostOptimized,
            ...values,
        });

    it('accepts a wall-clock time with an IANA timezone', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(
            targetState({costOptimizedTargetTime: '07:30', costOptimizedTimezone: 'Europe/Berlin'}),
        );
        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });

    it('rejects a malformed time', () => {
        for (const bad of ['7:30', '25:00', '07:60', 'morning']) {
            const {ok, errors} = validateEnergyManagerSettingsState(
                targetState({costOptimizedTargetTime: bad, costOptimizedTimezone: 'Europe/Berlin'}),
            );
            expect(ok, bad).toBe(false);
            expect(errors.some((e) => e.includes('24-hour HH:mm'))).toBe(true);
        }
    });

    it('rejects a timezone the runtime cannot resolve', () => {
        const {ok, errors} = validateEnergyManagerSettingsState(
            targetState({costOptimizedTargetTime: '07:30', costOptimizedTimezone: 'Europe/Berln'}),
        );
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('not an IANA timezone'))).toBe(true);
    });

    it('warns when a time is set without a timezone', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(
            targetState({costOptimizedTargetTime: '07:30'}),
        );
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('DST boundary'))).toBe(true);
    });
});

describe('validateEnergyManagerSettingsState — gate tree', () => {
    it('warns when a dependent value is stored while its gate is off', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(
            state({
                heatingRodControl: false,
                heatingRodMode: EnergyManagerHeatingRodModeEnum.Boost,
            }, [EnergyManagerSettingEnum.HeatingRodControl, EnergyManagerSettingEnum.HeatingRodMode]),
        );

        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('it currently cannot'))).toBe(true);
    });

    it('warns when a price limit is stored under a non-price-limit charge mode', () => {
        const {warnings} = validateEnergyManagerSettingsState(
            state({
                chargerControl: true,
                defaultChargeMode: EnyoChargeModeEnum.Immediate,
                priceLimitCtPerKwh: 7,
            }),
        );

        expect(warnings.some((w) => w.includes('price-limit-ct-per-kwh'))).toBe(true);
    });

    it('warns when an active gate is supported but its dependant is not', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(
            state({chargerControl: true}, [EnergyManagerSettingEnum.ChargerControl]),
        );

        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('nothing behind it'))).toBe(true);
    });

    it('stays quiet when the gate is off, since nothing behind it is expected', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(
            state({chargerControl: false}, [EnergyManagerSettingEnum.ChargerControl]),
        );

        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });
});

describe('setting metadata tables', () => {
    it('maps every setting to at least one value key', () => {
        for (const setting of ALL_SETTINGS) {
            expect(ENERGY_MANAGER_SETTING_VALUE_KEYS[setting]?.length, setting).toBeGreaterThan(0);
        }
    });

    it('carries the cost-optimized target as one setting over two fields', () => {
        expect(ENERGY_MANAGER_SETTING_VALUE_KEYS[EnergyManagerSettingEnum.CostOptimizedTarget])
            .toEqual(['costOptimizedTargetTime', 'costOptimizedTimezone']);
    });

    it('only ever gates on a setting that exists', () => {
        for (const dependency of Object.values(ENERGY_MANAGER_SETTING_DEPENDENCIES)) {
            expect(ALL_SETTINGS).toContain(dependency!.requires);
        }
    });
});

describe('assertValidEnergyManagerSettingsState', () => {
    it('returns the state unchanged when it is valid', () => {
        const valid = state({batteryControl: true}, [EnergyManagerSettingEnum.BatteryControl]);
        expect(assertValidEnergyManagerSettingsState(valid)).toBe(valid);
    });

    it('throws with every blocking error attached', () => {
        try {
            assertValidEnergyManagerSettingsState(state({priceLimitCtPerKwh: Number.NaN}));
            expect.unreachable('should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(EnergyManagerSettingsValidationError);
            expect((error as EnergyManagerSettingsValidationError).errors.length).toBeGreaterThan(0);
        }
    });

    it('does not throw on warnings alone', () => {
        expect(() =>
            assertValidEnergyManagerSettingsState(
                state({chargerControl: true}, [EnergyManagerSettingEnum.ChargerControl]),
            ),
        ).not.toThrow();
    });
});

describe('getEnergyManagerSettingDependency', () => {
    it('returns null for the ungated roots of the tree', () => {
        for (const root of [
            EnergyManagerSettingEnum.BatteryControl,
            EnergyManagerSettingEnum.HeatpumpControl,
            EnergyManagerSettingEnum.HeatingRodControl,
            EnergyManagerSettingEnum.ChargerControl,
        ]) {
            expect(getEnergyManagerSettingDependency(root), root).toBeNull();
        }
    });

    it('returns the gate and the value it must hold', () => {
        expect(getEnergyManagerSettingDependency(EnergyManagerSettingEnum.HeatingRodMode)).toEqual({
            requires: EnergyManagerSettingEnum.HeatingRodControl,
            equals: true,
        });
        expect(getEnergyManagerSettingDependency(EnergyManagerSettingEnum.PriceLimitCtPerKwh)).toEqual({
            requires: EnergyManagerSettingEnum.DefaultChargeMode,
            equals: EnyoChargeModeEnum.PriceLimit,
        });
        expect(getEnergyManagerSettingDependency(EnergyManagerSettingEnum.BatteryEvDischargeFixedWh)).toEqual({
            requires: EnergyManagerSettingEnum.BatteryEvDischargeMode,
            equals: EnergyManagerBatteryEvDischargeModeEnum.FixedWh,
        });
    });

    it('returns only the direct gate, not the whole chain', () => {
        expect(getEnergyManagerSettingDependency(EnergyManagerSettingEnum.BatteryEvDischargeFixedWh)?.requires)
            .toBe(EnergyManagerSettingEnum.BatteryEvDischargeMode);
    });
});

describe('isEnergyManagerSettingActive', () => {
    it('treats an ungated setting as always active', () => {
        expect(isEnergyManagerSettingActive(EnergyManagerSettingEnum.BatteryControl, {})).toBe(true);
    });

    it('walks the full chain rather than the direct gate alone', () => {
        const values = {
            batteryControl: true,
            batteryEvDischargeMode: EnergyManagerBatteryEvDischargeModeEnum.FixedWh,
        };
        expect(isEnergyManagerSettingActive(EnergyManagerSettingEnum.BatteryEvDischargeFixedWh, values))
            .toBe(true);

        // Direct gate still holds, but the gate above it does not.
        expect(isEnergyManagerSettingActive(EnergyManagerSettingEnum.BatteryEvDischargeFixedWh, {
            ...values,
            batteryControl: false,
        })).toBe(false);
    });

    it('separates the two parameterised modes', () => {
        const values = {
            batteryControl: true,
            batteryEvDischargeMode: EnergyManagerBatteryEvDischargeModeEnum.SocLimit,
        };
        expect(isEnergyManagerSettingActive(EnergyManagerSettingEnum.BatteryEvDischargeSocLimitPercent, values))
            .toBe(true);
        expect(isEnergyManagerSettingActive(EnergyManagerSettingEnum.BatteryEvDischargeFixedWh, values))
            .toBe(false);
    });

    it('treats an unset gate as not holding', () => {
        expect(isEnergyManagerSettingActive(EnergyManagerSettingEnum.HeatingRodMode, {})).toBe(false);
        expect(isEnergyManagerSettingActive(EnergyManagerSettingEnum.PriceLimitCtPerKwh, {
            chargerControl: true,
        })).toBe(false);
    });

    it('agrees with the validator about which values can take effect', () => {
        const values = {
            batteryControl: true,
            batteryEvDischargeMode: EnergyManagerBatteryEvDischargeModeEnum.SocLimit,
            batteryEvDischargeSocLimitPercent: 50,
            batteryEvDischargeFixedWh: 5000,
        };
        const {warnings} = validateEnergyManagerSettingsState(state(values));

        expect(isEnergyManagerSettingActive(EnergyManagerSettingEnum.BatteryEvDischargeFixedWh, values))
            .toBe(false);
        expect(warnings.some((w) => w.includes('battery-ev-discharge-fixed-wh'))).toBe(true);
    });
});
