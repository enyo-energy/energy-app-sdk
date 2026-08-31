import {describe, expect, it} from 'vitest';
import {
    ENERGY_MANAGER_SETTING_DEPENDENCIES,
    ENERGY_MANAGER_SETTING_VALUE_KEYS,
    EnergyManagerBatteryChargingModeEnum,
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
                batteryDischargeWhileChargingWh: 2000,
                blockBatteryDischargeWhileEvCharging: false,
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

describe('validateEnergyManagerSettingsState — battery discharge budget (Wh)', () => {
    const budgetState = (batteryDischargeWhileChargingWh: number | null) =>
        state({batteryControl: true, batteryDischargeWhileChargingWh});

    it('accepts a plausible Wh budget', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(budgetState(5000));
        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });

    it('accepts `null` as "disabled"', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(budgetState(null));
        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });

    it('accepts `0`, which means the same as disabled', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(budgetState(0));
        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });

    it('rejects a negative budget', () => {
        const {ok, errors} = validateEnergyManagerSettingsState(budgetState(-500));
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('cannot be'))).toBe(true);
        expect(errors.some((e) => e.includes('disable the transfer'))).toBe(true);
    });

    it('rejects a non-finite budget', () => {
        const {ok, errors} = validateEnergyManagerSettingsState(budgetState(Number.POSITIVE_INFINITY));
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('finite number or `null`'))).toBe(true);
    });

    it('warns on a negligible positive figure, catching a kWh value in a Wh field', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(budgetState(10));
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('watt-hours, not kilowatt-hours'))).toBe(true);
    });

    it('treats `null` as a stored value for gate and support checks', () => {
        const offGate = validateEnergyManagerSettingsState(
            state({batteryControl: false, batteryDischargeWhileChargingWh: null}, [
                EnergyManagerSettingEnum.BatteryControl,
                EnergyManagerSettingEnum.BatteryDischargeWhileChargingWh,
            ]),
        );
        expect(offGate.warnings.some((w) => w.includes('it currently cannot'))).toBe(true);

        const unsupported = validateEnergyManagerSettingsState(
            state({batteryControl: true, batteryDischargeWhileChargingWh: null}, [
                EnergyManagerSettingEnum.BatteryControl,
            ]),
        );
        expect(unsupported.warnings.some((w) => w.includes('will ignore it'))).toBe(true);
    });
});

describe('validateEnergyManagerSettingsState — hard block during EV charging', () => {
    it('accepts either boolean under an active battery gate', () => {
        for (const blocked of [true, false]) {
            const {ok, warnings} = validateEnergyManagerSettingsState(
                state({batteryControl: true, blockBatteryDischargeWhileEvCharging: blocked}),
            );
            expect(ok, String(blocked)).toBe(true);
            expect(warnings, String(blocked)).toEqual([]);
        }
    });

    it('rejects a non-boolean value', () => {
        const {ok, errors} = validateEnergyManagerSettingsState(
            state({
                batteryControl: true,
                blockBatteryDischargeWhileEvCharging: 1 as unknown as boolean,
            }),
        );
        expect(ok).toBe(false);
        expect(
            errors.some((e) => e.includes('`blockBatteryDischargeWhileEvCharging` must be a boolean')),
        ).toBe(true);
    });

    it('warns when set while battery control is off', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(
            state({batteryControl: false, blockBatteryDischargeWhileEvCharging: true}, [
                EnergyManagerSettingEnum.BatteryControl,
                EnergyManagerSettingEnum.BlockBatteryDischargeWhileEvCharging,
            ]),
        );
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('it currently cannot'))).toBe(true);
    });

    it('warns when the block sits alongside a budget it would override', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(
            state({
                batteryControl: true,
                blockBatteryDischargeWhileEvCharging: true,
                batteryDischargeWhileChargingWh: 5000,
            }),
        );

        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('can never be spent'))).toBe(true);
    });

    it('stays quiet when the block is off and a budget is set', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(
            state({
                batteryControl: true,
                blockBatteryDischargeWhileEvCharging: false,
                batteryDischargeWhileChargingWh: 5000,
            }),
        );

        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });

    it('stays quiet when the block is on and no budget is stored', () => {
        const {ok, warnings} = validateEnergyManagerSettingsState(
            state({
                batteryControl: true,
                blockBatteryDischargeWhileEvCharging: true,
                batteryDischargeWhileChargingWh: null,
            }),
        );

        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
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
