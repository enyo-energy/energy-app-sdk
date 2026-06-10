import {describe, expect, it} from 'vitest';
import {EnyoApplianceTypeEnum} from '../../../types/enyo-appliance.js';
import {EnyoDataBusMessageEnum} from '../../../types/enyo-data-bus-value.js';
import {
    EnyoEnergyManagerCycleDiagnostics,
    EnyoEnergyManagerCycleOutcomeEnum,
    EnyoEnergyManagerCyclePhaseEnum,
    EnyoEnergyManagerForecastTypeEnum,
    EnyoEnergyManagerIssueSeverityEnum,
} from '../../../types/enyo-diagnostics.js';
import {
    EnergyManagerDiagnosticsValidationError,
    validateEnergyManagerCycleDiagnostics,
} from '../energy-manager-diagnostics-validators.js';

function baseCycle(
    overrides: Partial<EnyoEnergyManagerCycleDiagnostics> = {},
): EnyoEnergyManagerCycleDiagnostics {
    return {
        cycleStartedAtIso: '2026-06-10T12:00:00.000Z',
        cycleCompletedAtIso: '2026-06-10T12:00:00.842Z',
        outcome: EnyoEnergyManagerCycleOutcomeEnum.Completed,
        totalDurationMs: 842,
        phaseDurations: [
            {phase: EnyoEnergyManagerCyclePhaseEnum.LoadCurrentState, durationMs: 32},
            {phase: EnyoEnergyManagerCyclePhaseEnum.FetchForecasts, durationMs: 411},
            {phase: EnyoEnergyManagerCyclePhaseEnum.Optimize, durationMs: 318},
            {phase: EnyoEnergyManagerCyclePhaseEnum.DispatchCommands, durationMs: 58},
            {phase: EnyoEnergyManagerCyclePhaseEnum.Publish, durationMs: 23},
        ],
        forecastsConsumed: [
            {
                forecastType: EnyoEnergyManagerForecastTypeEnum.PvProduction,
                durationMs: 120,
                ok: true,
            },
        ],
        commandsIssued: [
            {messageType: EnyoDataBusMessageEnum.SetStorageScheduleV1, count: 1},
        ],
        commandAcknowledgements: [
            {
                messageType: EnyoDataBusMessageEnum.SetStorageScheduleV1,
                accepted: 1,
                rejected: 0,
                notSupported: 0,
            },
        ],
        appliancesManaged: [{applianceType: EnyoApplianceTypeEnum.Storage, count: 1}],
        plannedHorizonMinutes: 360,
        issues: [],
        ...overrides,
    };
}

describe('validateEnergyManagerCycleDiagnostics', () => {
    it('accepts a well-formed cycle', () => {
        expect(() => validateEnergyManagerCycleDiagnostics(baseCycle())).not.toThrow();
    });

    it('rejects when cycleCompletedAtIso precedes cycleStartedAtIso', () => {
        expect(() =>
            validateEnergyManagerCycleDiagnostics(
                baseCycle({
                    cycleStartedAtIso: '2026-06-10T12:00:01.000Z',
                    cycleCompletedAtIso: '2026-06-10T12:00:00.000Z',
                }),
            ),
        ).toThrow(/must be at or after/);
    });

    it('rejects an invalid ISO timestamp', () => {
        expect(() =>
            validateEnergyManagerCycleDiagnostics(
                baseCycle({cycleStartedAtIso: 'not-a-date'}),
            ),
        ).toThrow(/cycleStartedAtIso/);
    });

    it('rejects an unknown outcome', () => {
        const bad = baseCycle({
            outcome: 'maybe' as unknown as EnyoEnergyManagerCycleOutcomeEnum,
        });
        expect(() => validateEnergyManagerCycleDiagnostics(bad)).toThrow(
            /outcome is invalid/,
        );
    });

    it('requires outcomeReason when outcome is Skipped', () => {
        expect(() =>
            validateEnergyManagerCycleDiagnostics(
                baseCycle({outcome: EnyoEnergyManagerCycleOutcomeEnum.Skipped}),
            ),
        ).toThrow(/outcomeReason is required/);
    });

    it('requires outcomeReason when outcome is Failed', () => {
        expect(() =>
            validateEnergyManagerCycleDiagnostics(
                baseCycle({outcome: EnyoEnergyManagerCycleOutcomeEnum.Failed}),
            ),
        ).toThrow(/outcomeReason is required/);
    });

    it('accepts a Failed cycle with a reason', () => {
        expect(() =>
            validateEnergyManagerCycleDiagnostics(
                baseCycle({
                    outcome: EnyoEnergyManagerCycleOutcomeEnum.Failed,
                    outcomeReason: 'optimizer threw',
                    plannedHorizonMinutes: 0,
                    commandsIssued: [],
                    commandAcknowledgements: [],
                    forecastsConsumed: [],
                }),
            ),
        ).not.toThrow();
    });

    it('rejects negative totalDurationMs', () => {
        expect(() =>
            validateEnergyManagerCycleDiagnostics(baseCycle({totalDurationMs: -1})),
        ).toThrow(/totalDurationMs/);
    });

    it('rejects phase duration sum exceeding totalDurationMs', () => {
        expect(() =>
            validateEnergyManagerCycleDiagnostics(
                baseCycle({
                    totalDurationMs: 100,
                    phaseDurations: [
                        {phase: EnyoEnergyManagerCyclePhaseEnum.Optimize, durationMs: 150},
                    ],
                }),
            ),
        ).toThrow(/must not exceed totalDurationMs/);
    });

    it('rejects duplicated phase entries', () => {
        expect(() =>
            validateEnergyManagerCycleDiagnostics(
                baseCycle({
                    phaseDurations: [
                        {phase: EnyoEnergyManagerCyclePhaseEnum.Optimize, durationMs: 10},
                        {phase: EnyoEnergyManagerCyclePhaseEnum.Optimize, durationMs: 20},
                    ],
                }),
            ),
        ).toThrow(/duplicated/);
    });

    it('rejects an unknown forecastType', () => {
        expect(() =>
            validateEnergyManagerCycleDiagnostics(
                baseCycle({
                    forecastsConsumed: [
                        {
                            forecastType:
                                'unknown' as unknown as EnyoEnergyManagerForecastTypeEnum,
                            durationMs: 10,
                            ok: true,
                        },
                    ],
                }),
            ),
        ).toThrow(/forecastType/);
    });

    it('rejects an empty applianceId on a forecast usage entry', () => {
        expect(() =>
            validateEnergyManagerCycleDiagnostics(
                baseCycle({
                    forecastsConsumed: [
                        {
                            forecastType: EnyoEnergyManagerForecastTypeEnum.Battery,
                            applianceId: '',
                            durationMs: 10,
                            ok: true,
                        },
                    ],
                }),
            ),
        ).toThrow(/applianceId/);
    });

    it('rejects a non-integer command count', () => {
        expect(() =>
            validateEnergyManagerCycleDiagnostics(
                baseCycle({
                    commandsIssued: [
                        {messageType: EnyoDataBusMessageEnum.SetStorageScheduleV1, count: 1.5},
                    ],
                }),
            ),
        ).toThrow(/commandsIssued\[0\]\.count/);
    });

    it('rejects negative acknowledgement counts', () => {
        expect(() =>
            validateEnergyManagerCycleDiagnostics(
                baseCycle({
                    commandAcknowledgements: [
                        {
                            messageType: EnyoDataBusMessageEnum.SetStorageScheduleV1,
                            accepted: 1,
                            rejected: -1,
                            notSupported: 0,
                        },
                    ],
                }),
            ),
        ).toThrow(/rejected/);
    });

    it('rejects an unknown messageType on commandsIssued', () => {
        expect(() =>
            validateEnergyManagerCycleDiagnostics(
                baseCycle({
                    commandsIssued: [
                        {
                            messageType: 'BogusV1' as unknown as EnyoDataBusMessageEnum,
                            count: 1,
                        },
                    ],
                }),
            ),
        ).toThrow(/messageType/);
    });

    it('rejects a non-kebab-case issue code', () => {
        expect(() =>
            validateEnergyManagerCycleDiagnostics(
                baseCycle({
                    issues: [
                        {
                            severity: EnyoEnergyManagerIssueSeverityEnum.Warning,
                            code: 'Forecast_Failed',
                            message: 'PV forecast threw',
                        },
                    ],
                }),
            ),
        ).toThrow(/code must be a non-empty kebab-case/);
    });

    it('rejects an empty issue message', () => {
        expect(() =>
            validateEnergyManagerCycleDiagnostics(
                baseCycle({
                    issues: [
                        {
                            severity: EnyoEnergyManagerIssueSeverityEnum.Error,
                            code: 'forecast-fetch-failed',
                            message: '',
                        },
                    ],
                }),
            ),
        ).toThrow(/message/);
    });

    it('accepts a populated issues list with kebab-case codes', () => {
        expect(() =>
            validateEnergyManagerCycleDiagnostics(
                baseCycle({
                    issues: [
                        {
                            severity: EnyoEnergyManagerIssueSeverityEnum.Warning,
                            code: 'forecast-fetch-failed',
                            message: 'PV forecast threw, fell back to last-known value',
                            applianceId: 'pv-1',
                        },
                        {
                            severity: EnyoEnergyManagerIssueSeverityEnum.Error,
                            code: 'no-storage-headroom',
                            message: 'storage at 100% SoC, could not plan PV-surplus charge',
                        },
                    ],
                }),
            ),
        ).not.toThrow();
    });

    it('throws EnergyManagerDiagnosticsValidationError specifically', () => {
        try {
            validateEnergyManagerCycleDiagnostics(baseCycle({totalDurationMs: -1}));
            expect.fail('expected to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(EnergyManagerDiagnosticsValidationError);
        }
    });
});
