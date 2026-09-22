import {describe, expect, it} from 'vitest';
import {
    CalibrationRunValidationError,
    assertValidCalibrationRun,
    validateCalibrationRun,
} from '../calibration-validators.js';
import {
    EnyoCalibratedFeatureEnum,
    EnyoCalibrationFailureReasonEnum,
    EnyoCalibrationStatusEnum,
} from '../../../types/enyo-calibration.js';
import type {EnyoCalibrationRun} from '../../../types/enyo-calibration.js';
import {EnyoApplianceTypeEnum} from '../../../types/enyo-appliance.js';

const STARTED = '2026-09-18T08:00:00.000Z';
const COMPLETED = '2026-09-18T11:00:00.000Z';

/** A minimal valid run, so a test isolates the rule it is about. */
const run = (overrides: Partial<EnyoCalibrationRun> = {}): EnyoCalibrationRun => ({
    id: 'run-1',
    applianceId: 'battery-1',
    applianceType: EnyoApplianceTypeEnum.Storage,
    status: EnyoCalibrationStatusEnum.Running,
    startedAtIso: STARTED,
    updatedAtIso: STARTED,
    ...overrides,
});

const succeeded = (features: EnyoCalibratedFeatureEnum[], overrides: Partial<EnyoCalibrationRun> = {}) =>
    run({
        status: EnyoCalibrationStatusEnum.Succeeded,
        completedAtIso: COMPLETED,
        confirmedFeatures: features,
        ...overrides,
    });

describe('validateCalibrationRun — shape', () => {
    it('accepts a running run without warnings', () => {
        const {ok, errors, warnings} = validateCalibrationRun(run());
        expect(ok).toBe(true);
        expect(errors).toEqual([]);
        expect(warnings).toEqual([]);
    });

    it('rejects a status that is not an enum member', () => {
        const {ok, errors} = validateCalibrationRun(run({status: 'calibrating' as EnyoCalibrationStatusEnum}));
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('EnyoCalibrationStatusEnum'))).toBe(true);
    });

    it('rejects an appliance category that cannot be calibrated', () => {
        const {ok, errors} = validateCalibrationRun(run({
            applianceType: EnyoApplianceTypeEnum.TemperatureSensor,
        }));
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('cannot be calibrated'))).toBe(true);
    });

    it('rejects a malformed timestamp', () => {
        expect(validateCalibrationRun(run({startedAtIso: 'yesterday'})).ok).toBe(false);
    });
});

describe('validateCalibrationRun — terminal statuses', () => {
    it('requires completedAtIso once a run has finished', () => {
        const {ok, errors} = validateCalibrationRun(run({
            status: EnyoCalibrationStatusEnum.Succeeded,
            confirmedFeatures: [],
        }));
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('completedAtIso'))).toBe(true);
    });

    it('rejects completedAtIso on a run that is still going', () => {
        const {ok, errors} = validateCalibrationRun(run({completedAtIso: COMPLETED}));
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('has not finished'))).toBe(true);
    });

    it('rejects a run that ended before it began', () => {
        const {ok, errors} = validateCalibrationRun(succeeded([], {
            completedAtIso: '2026-09-18T07:00:00.000Z',
        }));
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('cannot end before it began'))).toBe(true);
    });
});

describe('validateCalibrationRun — confirmed features', () => {
    it('accepts features belonging to the run’s appliance category', () => {
        const {ok, warnings} = validateCalibrationRun(succeeded([
            EnyoCalibratedFeatureEnum.BatteryGridCharging,
            EnyoCalibratedFeatureEnum.BatteryUsableCapacity,
        ]));
        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });

    it('accepts an empty list — a run that proved nothing is a real result', () => {
        expect(validateCalibrationRun(succeeded([])).ok).toBe(true);
    });

    it('rejects a feature belonging to another device class', () => {
        const {ok, errors} = validateCalibrationRun(succeeded([
            EnyoCalibratedFeatureEnum.HeatpumpSgReady,
        ]));
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('belongs to Heatpump'))).toBe(true);
    });

    it('rejects features on a failed run', () => {
        const {ok, errors} = validateCalibrationRun(run({
            status: EnyoCalibrationStatusEnum.Failed,
            completedAtIso: COMPLETED,
            failureReason: EnyoCalibrationFailureReasonEnum.TimedOut,
            confirmedFeatures: [EnyoCalibratedFeatureEnum.BatteryGridCharging],
        }));
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('only a succeeded'))).toBe(true);
    });

    it('keeps features on a stale run — what used to hold is still worth showing', () => {
        const {ok} = validateCalibrationRun(run({
            status: EnyoCalibrationStatusEnum.Stale,
            completedAtIso: COMPLETED,
            confirmedFeatures: [EnyoCalibratedFeatureEnum.BatteryGridCharging],
        }));
        expect(ok).toBe(true);
    });

    it('warns on a duplicate rather than rejecting it', () => {
        const {ok, warnings} = validateCalibrationRun(succeeded([
            EnyoCalibratedFeatureEnum.BatteryGridCharging,
            EnyoCalibratedFeatureEnum.BatteryGridCharging,
        ]));
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('more than once'))).toBe(true);
    });
});

describe('validateCalibrationRun — failure reason', () => {
    it('requires one on a failed run', () => {
        const {ok, errors} = validateCalibrationRun(run({
            status: EnyoCalibrationStatusEnum.Failed,
            completedAtIso: COMPLETED,
        }));
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('retryable failure'))).toBe(true);
    });

    it('rejects one on a run that did not fail', () => {
        const {ok, errors} = validateCalibrationRun(succeeded([], {
            failureReason: EnyoCalibrationFailureReasonEnum.TimedOut,
        }));
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('not failed'))).toBe(true);
    });
});

describe('validateCalibrationRun — progress and requirements', () => {
    it('rejects a progress outside 0…100', () => {
        expect(validateCalibrationRun(run({progressPercent: 140})).ok).toBe(false);
    });

    it('warns when progress is reported on a run that is not running', () => {
        const {ok, warnings} = validateCalibrationRun(succeeded([], {progressPercent: 100}));
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('not meaningful'))).toBe(true);
    });

    it('rejects a requirement without a translated description', () => {
        const {ok, errors} = validateCalibrationRun(run({
            status: EnyoCalibrationStatusEnum.NotCalibrated,
            requirements: [{key: 'min-soc', satisfied: false, description: []}],
        }));
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('at least one translation'))).toBe(true);
    });

    it('warns when a not-calibrated run says nothing about what is missing', () => {
        const {warnings} = validateCalibrationRun(run({
            status: EnyoCalibrationStatusEnum.NotCalibrated,
        }));
        expect(warnings.some((w) => w.includes('without being told what'))).toBe(true);
    });

    it('warns when a ready run still has an unsatisfied requirement', () => {
        const {ok, warnings} = validateCalibrationRun(run({
            status: EnyoCalibrationStatusEnum.Ready,
            requirements: [{
                key: 'min-soc',
                satisfied: false,
                description: [{language: 'en', value: 'Needs at least 30 % state of charge'}],
            }],
        }));
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('can only fail'))).toBe(true);
    });
});

describe('assertValidCalibrationRun', () => {
    it('returns the run when it is valid', () => {
        const valid = succeeded([EnyoCalibratedFeatureEnum.BatteryGridCharging]);
        expect(assertValidCalibrationRun(valid)).toBe(valid);
    });

    it('throws with every blocking error listed', () => {
        try {
            assertValidCalibrationRun(succeeded([EnyoCalibratedFeatureEnum.ChargerStartStop], {
                failureReason: EnyoCalibrationFailureReasonEnum.Unknown,
            }));
            expect.unreachable('should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(CalibrationRunValidationError);
            expect((error as CalibrationRunValidationError).errors.length).toBeGreaterThan(1);
        }
    });
});
