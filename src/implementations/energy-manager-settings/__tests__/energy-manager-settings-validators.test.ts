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
import {EnyoChargeModeEnum, EnyoPriceLimitModeEnum} from '../../../types/enyo-data-bus-value.js';
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
            defaultChargeMode: EnyoChargeModeEnum.CostOptimized,
            priceLimitMode: EnyoPriceLimitModeEnum.CtPerKwh,
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

describe('validateEnergyManagerSettingsState — price limit (share of day)', () => {
    const shareState = (priceLimitSharePercent: number) =>
        validateEnergyManagerSettingsState(state({
            chargerControl: true,
            defaultChargeMode: EnyoChargeModeEnum.CostOptimized,
            priceLimitMode: EnyoPriceLimitModeEnum.CheapestShare,
            priceLimitSharePercent,
        }));

    it('accepts the common cheapest-quarter setting', () => {
        const {ok, warnings} = shareState(25);
        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });

    it('rejects a fractional share — a share of the day is a whole percentage', () => {
        const {ok, errors} = shareState(25.5);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('integer'))).toBe(true);
    });

    it('rejects 0, which selects no hours at all rather than capping a price', () => {
        const {ok, errors} = shareState(0);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('priceLimitSharePercent'))).toBe(true);
    });

    it('rejects a share above 100', () => {
        expect(shareState(101).ok).toBe(false);
    });

    it('warns at 100, which is indistinguishable from having no ceiling', () => {
        const {ok, warnings} = shareState(100);
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('no ceiling at all'))).toBe(true);
    });

    it('rejects a mode that is not an EnyoPriceLimitModeEnum member', () => {
        const {ok, errors} = validateEnergyManagerSettingsState(state({
            chargerControl: true,
            defaultChargeMode: EnyoChargeModeEnum.CostOptimized,
            priceLimitMode: 'cheapest' as EnyoPriceLimitModeEnum,
        }));
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('EnyoPriceLimitModeEnum'))).toBe(true);
    });

    it('warns when the ceiling stored is not the one the mode reads', () => {
        const {warnings} = validateEnergyManagerSettingsState(state({
            chargerControl: true,
            defaultChargeMode: EnyoChargeModeEnum.CostOptimized,
            priceLimitMode: EnyoPriceLimitModeEnum.CheapestShare,
            priceLimitCtPerKwh: 7,
        }));
        expect(warnings.some((w) => w.includes(EnergyManagerSettingEnum.PriceLimitCtPerKwh)))
            .toBe(true);
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
            requires: EnergyManagerSettingEnum.PriceLimitMode,
            equals: EnyoPriceLimitModeEnum.CtPerKwh,
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

describe('validateEnergyManagerSettingsState — battery PV priority target', () => {
    const target = (batteryPvPriorityTargetSocPercent: number | null, batteryControl = true) =>
        validateEnergyManagerSettingsState(state({batteryControl, batteryPvPriorityTargetSocPercent}));

    it('accepts a target inside 1…99 without warnings', () => {
        for (const value of [1, 40, 80, 99]) {
            const {ok, warnings} = target(value);
            expect(ok, String(value)).toBe(true);
            expect(warnings, String(value)).toEqual([]);
        }
    });

    it('rejects a value outside 0…100', () => {
        for (const value of [-1, 101]) {
            const {ok, errors} = target(value);
            expect(ok, String(value)).toBe(false);
            expect(errors.some((e) => e.includes('between 0 and 100'))).toBe(true);
        }
    });

    it('rejects a non-finite target', () => {
        const {ok, errors} = target(Number.POSITIVE_INFINITY);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('finite number'))).toBe(true);
    });

    it('accepts null as disabled, without warnings even while battery control is off', () => {
        for (const control of [true, false]) {
            const {ok, warnings} = target(null, control);
            expect(ok).toBe(true);
            expect(warnings).toEqual([]);
        }
    });

    it('warns that 0 gives no priority and suggests null', () => {
        const {ok, warnings} = target(0);
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('write `null`'))).toBe(true);
    });

    it('warns that 100 can hold surplus consumers back for hours', () => {
        const {ok, warnings} = target(100);
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('held back for hours'))).toBe(true);
    });

    it('warns when set while battery control is off', () => {
        const {ok, warnings} = target(40, false);
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('battery-pv-priority-target-soc-percent'))).toBe(true);
    });

    it('is gated directly on battery control', () => {
        expect(getEnergyManagerSettingDependency(EnergyManagerSettingEnum.BatteryPvPriorityTargetSocPercent))
            .toEqual({requires: EnergyManagerSettingEnum.BatteryControl, equals: true});
        expect(isEnergyManagerSettingActive(EnergyManagerSettingEnum.BatteryPvPriorityTargetSocPercent, {
            batteryControl: true,
        })).toBe(true);
        expect(isEnergyManagerSettingActive(EnergyManagerSettingEnum.BatteryPvPriorityTargetSocPercent, {
            batteryControl: false,
        })).toBe(false);
    });

    it('maps to its value key', () => {
        expect(ENERGY_MANAGER_SETTING_VALUE_KEYS[EnergyManagerSettingEnum.BatteryPvPriorityTargetSocPercent])
            .toEqual(['batteryPvPriorityTargetSocPercent']);
    });
});

describe('validateEnergyManagerSettingsState — heating rod battery floor', () => {
    const floor = (
        heatingRodBatteryDischargeSocLimitPercent: number | null,
        extra: EnergyManagerSettingValues = {},
    ) => validateEnergyManagerSettingsState(state({
        batteryControl: true,
        heatingRodControl: true,
        heatingRodBatteryDischargeSocLimitPercent,
        ...extra,
    }));

    it('accepts a floor inside 0…99 without warnings', () => {
        for (const value of [0, 50, 80, 99]) {
            const {ok, warnings} = floor(value);
            expect(ok, String(value)).toBe(true);
            expect(warnings, String(value)).toEqual([]);
        }
    });

    it('accepts null as disabled, without warnings even while its gates are closed', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(state({
            batteryControl: false,
            heatingRodControl: false,
            heatingRodBatteryDischargeSocLimitPercent: null,
        }));
        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });

    it('rejects a value outside 0…100', () => {
        for (const value of [-5, 120]) {
            const {ok, errors} = floor(value);
            expect(ok, String(value)).toBe(false);
            expect(errors.some((e) => e.includes('between 0 and 100'))).toBe(true);
        }
    });

    it('rejects a non-finite floor', () => {
        const {ok, errors} = floor(Number.NaN);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('finite number'))).toBe(true);
    });

    it('warns that a floor of 100 can never discharge', () => {
        const {ok, warnings} = floor(100);
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('can never draw from it'))).toBe(true);
    });

    it('warns when battery control is not on', () => {
        const {ok, warnings} = floor(80, {batteryControl: false});
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('cannot hold the battery at the floor'))).toBe(true);
    });

    it('warns when the floor lies below the PV priority target', () => {
        const {warnings} = floor(30, {batteryPvPriorityTargetSocPercent: 50});
        expect(warnings.some((w) => w.includes('PV priority then refills'))).toBe(true);

        expect(floor(80, {batteryPvPriorityTargetSocPercent: 50}).warnings).toEqual([]);
        expect(floor(30, {batteryPvPriorityTargetSocPercent: null}).warnings).toEqual([]);
    });

    it('warns when set while heating rod control is off', () => {
        const {warnings} = floor(80, {heatingRodControl: false});
        expect(warnings.some((w) => w.includes('heating-rod-battery-discharge-soc-limit-percent'))).toBe(true);
    });

    it('is gated directly on heating rod control', () => {
        expect(getEnergyManagerSettingDependency(EnergyManagerSettingEnum.HeatingRodBatteryDischargeSocLimitPercent))
            .toEqual({requires: EnergyManagerSettingEnum.HeatingRodControl, equals: true});
        expect(isEnergyManagerSettingActive(EnergyManagerSettingEnum.HeatingRodBatteryDischargeSocLimitPercent, {
            heatingRodControl: true,
        })).toBe(true);
        expect(isEnergyManagerSettingActive(EnergyManagerSettingEnum.HeatingRodBatteryDischargeSocLimitPercent, {}))
            .toBe(false);
    });

    it('maps to its value key', () => {
        expect(ENERGY_MANAGER_SETTING_VALUE_KEYS[EnergyManagerSettingEnum.HeatingRodBatteryDischargeSocLimitPercent])
            .toEqual(['heatingRodBatteryDischargeSocLimitPercent']);
    });
});

describe('validateEnergyManagerSettingsState — battery discharge block above home consumption', () => {
    const block = (batteryDischargeBlockAboveHomeConsumptionW: number | null, batteryControl = true) =>
        validateEnergyManagerSettingsState(state({batteryControl, batteryDischargeBlockAboveHomeConsumptionW}));

    it('accepts a plausible threshold in watts without warnings', () => {
        for (const value of [100, 4000, 11000, 30000]) {
            const {ok, warnings} = block(value);
            expect(ok, String(value)).toBe(true);
            expect(warnings, String(value)).toEqual([]);
        }
    });

    it('accepts null as disabled, without warnings even while battery control is off', () => {
        for (const control of [true, false]) {
            const {ok, warnings} = block(null, control);
            expect(ok).toBe(true);
            expect(warnings).toEqual([]);
        }
    });

    it('rejects a negative or non-finite threshold', () => {
        expect(block(-1).errors.some((e) => e.includes('cannot be negative'))).toBe(true);
        expect(block(Number.NaN).errors.some((e) => e.includes('finite number'))).toBe(true);
    });

    it('warns on a figure that looks like kW in a W field', () => {
        for (const value of [0, 11, 99]) {
            const {ok, warnings} = block(value);
            expect(ok, String(value)).toBe(true);
            expect(warnings.some((w) => w.includes('watts, not kilowatts')), String(value)).toBe(true);
        }
    });

    it('warns when set while battery control is off', () => {
        const {warnings} = block(11000, false);
        expect(warnings.some((w) => w.includes('battery-discharge-block-above-home-consumption-w'))).toBe(true);
    });

    it('is gated directly on battery control', () => {
        expect(getEnergyManagerSettingDependency(EnergyManagerSettingEnum.BatteryDischargeBlockAboveHomeConsumptionW))
            .toEqual({requires: EnergyManagerSettingEnum.BatteryControl, equals: true});
        expect(ENERGY_MANAGER_SETTING_VALUE_KEYS[EnergyManagerSettingEnum.BatteryDischargeBlockAboveHomeConsumptionW])
            .toEqual(['batteryDischargeBlockAboveHomeConsumptionW']);
    });
});

describe('validateEnergyManagerSettingsState — grid-optimised EV charging', () => {
    it('accepts true and false under charger control without warnings', () => {
        for (const value of [true, false]) {
            const {ok, warnings} = validateEnergyManagerSettingsState(
                state({chargerControl: true, gridOptimizedEvCharging: value}),
            );
            expect(ok, String(value)).toBe(true);
            expect(warnings, String(value)).toEqual([]);
        }
    });

    it('rejects a non-boolean value', () => {
        const {ok, errors} = validateEnergyManagerSettingsState(state({
            chargerControl: true,
            gridOptimizedEvCharging: 'yes' as unknown as boolean,
        }));
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('`gridOptimizedEvCharging` must be a boolean'))).toBe(true);
    });

    it('warns when set while charger control is off', () => {
        const {warnings} = validateEnergyManagerSettingsState(
            state({chargerControl: false, gridOptimizedEvCharging: true}),
        );
        expect(warnings.some((w) => w.includes('grid-optimized-ev-charging'))).toBe(true);
    });

    it('is gated directly on charger control', () => {
        expect(getEnergyManagerSettingDependency(EnergyManagerSettingEnum.GridOptimizedEvCharging))
            .toEqual({requires: EnergyManagerSettingEnum.ChargerControl, equals: true});
        expect(isEnergyManagerSettingActive(EnergyManagerSettingEnum.GridOptimizedEvCharging, {
            chargerControl: true,
        })).toBe(true);
        expect(ENERGY_MANAGER_SETTING_VALUE_KEYS[EnergyManagerSettingEnum.GridOptimizedEvCharging])
            .toEqual(['gridOptimizedEvCharging']);
    });
});
