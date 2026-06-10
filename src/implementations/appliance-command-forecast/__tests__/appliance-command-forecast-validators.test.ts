import {describe, expect, it} from 'vitest';
import {
    ApplianceForecastResolutionEnum,
    BatteryCommandForecast,
    BatteryCommandForecastDirectionEnum,
    BatteryCommandForecastModeEnum,
    BatteryCommandForecastScheduleEntry,
    ChargerForecast,
    ChargerForecastScheduleEntry,
    HeatpumpForecast,
    HeatpumpForecastScheduleEntry,
} from '../../../types/enyo-appliance-command-forecast.js';
import {
    ApplianceCommandForecastValidationError,
    validateBatteryCommandForecast,
    validateBatterySchedule,
    validateChargerForecast,
    validateChargerSchedule,
    validateHeatpumpForecast,
    validateHeatpumpSchedule,
    validateHeatpumpScheduleEntry,
} from '../appliance-command-forecast-validators.js';

function chargerEntry(
    overrides: Partial<ChargerForecastScheduleEntry> = {},
): ChargerForecastScheduleEntry {
    return {seconds: 0, powerW: 11_000, numberOfPhases: 3, ...overrides};
}

function batteryEntry(
    overrides: Partial<BatteryCommandForecastScheduleEntry> = {},
): BatteryCommandForecastScheduleEntry {
    return {
        seconds: 0,
        direction: BatteryCommandForecastDirectionEnum.Charge,
        powerW: 3000,
        ...overrides,
    };
}

function heatpumpEntry(
    overrides: Partial<HeatpumpForecastScheduleEntry> = {},
): HeatpumpForecastScheduleEntry {
    return {seconds: 0, ...overrides};
}

describe('validateChargerSchedule', () => {
    it('rejects an empty schedule', () => {
        expect(() =>
            validateChargerSchedule([], ApplianceForecastResolutionEnum.FifteenMinutes),
        ).toThrow(ApplianceCommandForecastValidationError);
    });

    it('rejects when first entry does not start at seconds=0', () => {
        expect(() =>
            validateChargerSchedule(
                [chargerEntry({seconds: 60})],
                ApplianceForecastResolutionEnum.OneMinute,
            ),
        ).toThrow(/seconds must be 0/);
    });

    it('rejects entries that are not spaced by the declared resolution (15min)', () => {
        expect(() =>
            validateChargerSchedule(
                [
                    chargerEntry({seconds: 0}),
                    chargerEntry({seconds: 300}),
                ],
                ApplianceForecastResolutionEnum.FifteenMinutes,
            ),
        ).toThrow(/exactly 900s/);
    });

    it('rejects negative powerW', () => {
        expect(() =>
            validateChargerSchedule(
                [chargerEntry({powerW: -1})],
                ApplianceForecastResolutionEnum.OneMinute,
            ),
        ).toThrow(/powerW/);
    });

    it('rejects invalid numberOfPhases', () => {
        expect(() =>
            validateChargerSchedule(
                [chargerEntry({numberOfPhases: 4 as unknown as 1 | 2 | 3})],
                ApplianceForecastResolutionEnum.OneMinute,
            ),
        ).toThrow(/numberOfPhases/);
    });

    it('accepts a valid 15min-resolution schedule', () => {
        expect(() =>
            validateChargerSchedule(
                [
                    chargerEntry({seconds: 0, powerW: 11_000, numberOfPhases: 3}),
                    chargerEntry({seconds: 900, powerW: 3700, numberOfPhases: 1}),
                    {seconds: 1800, powerW: 0},
                ],
                ApplianceForecastResolutionEnum.FifteenMinutes,
            ),
        ).not.toThrow();
    });

    it('accepts a valid 1min-resolution schedule', () => {
        expect(() =>
            validateChargerSchedule(
                [
                    chargerEntry({seconds: 0, powerW: 11_000}),
                    chargerEntry({seconds: 60, powerW: 3700}),
                ],
                ApplianceForecastResolutionEnum.OneMinute,
            ),
        ).not.toThrow();
    });
});

describe('validateBatterySchedule', () => {
    it('rejects unknown direction', () => {
        expect(() =>
            validateBatterySchedule(
                [
                    batteryEntry({
                        direction: 'unknown' as unknown as BatteryCommandForecastDirectionEnum,
                    }),
                ],
                ApplianceForecastResolutionEnum.OneMinute,
            ),
        ).toThrow(/direction/);
    });

    it('rejects negative powerW', () => {
        expect(() =>
            validateBatterySchedule(
                [batteryEntry({powerW: -10})],
                ApplianceForecastResolutionEnum.OneMinute,
            ),
        ).toThrow(/powerW/);
    });

    it('accepts a charge → discharge chain at 15min resolution', () => {
        expect(() =>
            validateBatterySchedule(
                [
                    batteryEntry({
                        seconds: 0,
                        direction: BatteryCommandForecastDirectionEnum.Charge,
                        powerW: 3000,
                    }),
                    batteryEntry({
                        seconds: 900,
                        direction: BatteryCommandForecastDirectionEnum.Discharge,
                        powerW: 2500,
                    }),
                    batteryEntry({
                        seconds: 1800,
                        direction: BatteryCommandForecastDirectionEnum.Discharge,
                        powerW: 0,
                    }),
                ],
                ApplianceForecastResolutionEnum.FifteenMinutes,
            ),
        ).not.toThrow();
    });
});

describe('validateHeatpumpSchedule', () => {
    it('rejects an empty schedule', () => {
        expect(() =>
            validateHeatpumpSchedule([], ApplianceForecastResolutionEnum.FifteenMinutes),
        ).toThrow(ApplianceCommandForecastValidationError);
    });

    it('rejects when first entry does not start at seconds=0', () => {
        expect(() =>
            validateHeatpumpSchedule(
                [heatpumpEntry({seconds: 60})],
                ApplianceForecastResolutionEnum.OneMinute,
            ),
        ).toThrow(/seconds must be 0/);
    });

    it('rejects entries whose spacing does not match the resolution', () => {
        expect(() =>
            validateHeatpumpSchedule(
                [
                    heatpumpEntry({seconds: 0}),
                    heatpumpEntry({seconds: 900}),
                    heatpumpEntry({seconds: 1500}),
                ],
                ApplianceForecastResolutionEnum.FifteenMinutes,
            ),
        ).toThrow(/exactly 900s/);
    });

    it('accepts a temperature-only schedule at 1min resolution', () => {
        expect(() =>
            validateHeatpumpSchedule(
                [
                    heatpumpEntry({seconds: 0, dhwTemperatureC: 48, roomTemperatureC: 21}),
                    heatpumpEntry({seconds: 60, dhwTemperatureC: 52, roomTemperatureC: 22}),
                ],
                ApplianceForecastResolutionEnum.OneMinute,
            ),
        ).not.toThrow();
    });

    it('accepts a fully-populated schedule at 15min resolution', () => {
        expect(() =>
            validateHeatpumpSchedule(
                [
                    heatpumpEntry({
                        seconds: 0,
                        powerW: 1500,
                        dhwTemperatureC: 48,
                        roomTemperatureC: 21,
                        bufferTankTemperatureC: 38,
                        dhwBoostActive: true,
                        roomPreHeatingActive: false,
                        bufferTankBoostActive: false,
                    }),
                    heatpumpEntry({
                        seconds: 900,
                        powerW: 3000,
                        dhwTemperatureC: 55,
                        roomTemperatureC: 22,
                        bufferTankTemperatureC: 45,
                        dhwBoostActive: false,
                        roomPreHeatingActive: true,
                        bufferTankBoostActive: true,
                    }),
                ],
                ApplianceForecastResolutionEnum.FifteenMinutes,
            ),
        ).not.toThrow();
    });
});

describe('validateHeatpumpScheduleEntry', () => {
    it('rejects out-of-range dhwTemperatureC', () => {
        expect(() =>
            validateHeatpumpScheduleEntry(
                {seconds: 0, dhwTemperatureC: 999},
                'relativeSchedule[0]',
            ),
        ).toThrow(/dhwTemperatureC/);
    });

    it('rejects out-of-range roomTemperatureC', () => {
        expect(() =>
            validateHeatpumpScheduleEntry(
                {seconds: 0, roomTemperatureC: -100},
                'relativeSchedule[0]',
            ),
        ).toThrow(/roomTemperatureC/);
    });

    it('rejects negative powerW', () => {
        expect(() =>
            validateHeatpumpScheduleEntry(
                {seconds: 0, powerW: -1},
                'relativeSchedule[0]',
            ),
        ).toThrow(/powerW/);
    });

    it('rejects non-boolean dhwBoostActive', () => {
        expect(() =>
            validateHeatpumpScheduleEntry(
                {
                    seconds: 0,
                    dhwBoostActive: 'true' as unknown as boolean,
                },
                'relativeSchedule[0]',
            ),
        ).toThrow(/dhwBoostActive/);
    });
});

describe('validateChargerForecast', () => {
    it('rejects an unknown resolution', () => {
        const forecast = {
            resolution: '5min' as unknown as ApplianceForecastResolutionEnum,
            relativeSchedule: [chargerEntry()],
        } as ChargerForecast;
        expect(() => validateChargerForecast(forecast)).toThrow(/resolution is invalid/);
    });

    it('validates estimatedSavings metadata', () => {
        const forecast: ChargerForecast = {
            resolution: ApplianceForecastResolutionEnum.FifteenMinutes,
            relativeSchedule: [chargerEntry()],
            estimatedSavings: {costSavings: Number.NaN, currency: 'EUR'},
        };
        expect(() => validateChargerForecast(forecast)).toThrow(/costSavings/);
    });

    it('rejects empty currency on estimatedSavings', () => {
        const forecast: ChargerForecast = {
            resolution: ApplianceForecastResolutionEnum.FifteenMinutes,
            relativeSchedule: [chargerEntry()],
            estimatedSavings: {costSavings: 0.5, currency: ''},
        };
        expect(() => validateChargerForecast(forecast)).toThrow(/currency/);
    });

    it('accepts a complete charger forecast', () => {
        const forecast: ChargerForecast = {
            resolution: ApplianceForecastResolutionEnum.FifteenMinutes,
            relativeSchedule: [
                chargerEntry({seconds: 0, powerW: 11_000, numberOfPhases: 3}),
                chargerEntry({seconds: 900, powerW: 3700, numberOfPhases: 1}),
            ],
            estimatedSavings: {costSavings: 0.42, currency: 'EUR', co2SavingsGrams: 120},
        };
        expect(() => validateChargerForecast(forecast)).not.toThrow();
    });
});

describe('validateBatteryCommandForecast', () => {
    it('accepts an auto-mode forecast with no schedule', () => {
        const forecast: BatteryCommandForecast = {
            resolution: ApplianceForecastResolutionEnum.OneMinute,
            mode: BatteryCommandForecastModeEnum.Auto,
        };
        expect(() => validateBatteryCommandForecast(forecast)).not.toThrow();
    });

    it('still validates resolution on auto-mode forecasts', () => {
        const forecast = {
            resolution: 'hourly' as unknown as ApplianceForecastResolutionEnum,
            mode: BatteryCommandForecastModeEnum.Auto,
        } as BatteryCommandForecast;
        expect(() => validateBatteryCommandForecast(forecast)).toThrow(/resolution is invalid/);
    });

    it('rejects an auto-mode forecast that also carries a relativeSchedule', () => {
        const forecast = {
            resolution: ApplianceForecastResolutionEnum.OneMinute,
            mode: BatteryCommandForecastModeEnum.Auto,
            relativeSchedule: [batteryEntry()],
        } as unknown as BatteryCommandForecast;
        expect(() => validateBatteryCommandForecast(forecast)).toThrow(
            /must not carry a relativeSchedule/,
        );
    });

    it('rejects an empty schedule in schedule-mode', () => {
        const forecast: BatteryCommandForecast = {
            resolution: ApplianceForecastResolutionEnum.FifteenMinutes,
            mode: BatteryCommandForecastModeEnum.Schedule,
            relativeSchedule: [],
        };
        expect(() => validateBatteryCommandForecast(forecast)).toThrow(
            ApplianceCommandForecastValidationError,
        );
    });

    it('rejects an unknown top-level mode', () => {
        const forecast = {
            resolution: ApplianceForecastResolutionEnum.OneMinute,
            mode: 'sometimes' as unknown as BatteryCommandForecastModeEnum,
        } as BatteryCommandForecast;
        expect(() => validateBatteryCommandForecast(forecast)).toThrow(/mode is invalid/);
    });

    it('rejects schedule entries spaced wrong for the declared resolution', () => {
        const forecast: BatteryCommandForecast = {
            resolution: ApplianceForecastResolutionEnum.OneMinute,
            mode: BatteryCommandForecastModeEnum.Schedule,
            relativeSchedule: [
                batteryEntry({seconds: 0}),
                batteryEntry({seconds: 900}),
            ],
        };
        expect(() => validateBatteryCommandForecast(forecast)).toThrow(/exactly 60s/);
    });

    it('accepts a well-formed schedule-mode forecast with savings metadata', () => {
        const forecast: BatteryCommandForecast = {
            resolution: ApplianceForecastResolutionEnum.FifteenMinutes,
            mode: BatteryCommandForecastModeEnum.Schedule,
            relativeSchedule: [
                batteryEntry({
                    direction: BatteryCommandForecastDirectionEnum.Charge,
                    powerW: 3000,
                }),
                batteryEntry({
                    seconds: 900,
                    direction: BatteryCommandForecastDirectionEnum.Discharge,
                    powerW: 2500,
                }),
            ],
            estimatedSavings: {costSavings: 0.18, currency: 'EUR'},
        };
        expect(() => validateBatteryCommandForecast(forecast)).not.toThrow();
    });
});

describe('validateHeatpumpForecast', () => {
    it('rejects a forecast with no schedule', () => {
        const forecast = {
            resolution: ApplianceForecastResolutionEnum.OneMinute,
        } as HeatpumpForecast;
        expect(() => validateHeatpumpForecast(forecast)).toThrow(
            /must contain at least one entry/,
        );
    });

    it('accepts a forecast that carries only forecasted temperatures', () => {
        const forecast: HeatpumpForecast = {
            resolution: ApplianceForecastResolutionEnum.OneMinute,
            relativeSchedule: [
                heatpumpEntry({seconds: 0, dhwTemperatureC: 48}),
                heatpumpEntry({seconds: 60, dhwTemperatureC: 52}),
            ],
        };
        expect(() => validateHeatpumpForecast(forecast)).not.toThrow();
    });

    it('accepts a forecast that mixes temperatures, boost flags, and power', () => {
        const forecast: HeatpumpForecast = {
            resolution: ApplianceForecastResolutionEnum.FifteenMinutes,
            relativeSchedule: [
                heatpumpEntry({
                    seconds: 0,
                    powerW: 1500,
                    dhwTemperatureC: 48,
                    roomTemperatureC: 21,
                    bufferTankTemperatureC: 38,
                    dhwBoostActive: true,
                }),
                heatpumpEntry({
                    seconds: 900,
                    powerW: 3000,
                    dhwTemperatureC: 55,
                    bufferTankBoostActive: true,
                }),
            ],
            estimatedSavings: {costSavings: 1.05, currency: 'EUR', co2SavingsGrams: 320},
        };
        expect(() => validateHeatpumpForecast(forecast)).not.toThrow();
    });

    it('propagates per-entry temperature range errors', () => {
        const forecast: HeatpumpForecast = {
            resolution: ApplianceForecastResolutionEnum.OneMinute,
            relativeSchedule: [
                heatpumpEntry({seconds: 0, dhwTemperatureC: 9999}),
            ],
        };
        expect(() => validateHeatpumpForecast(forecast)).toThrow(/dhwTemperatureC/);
    });
});
