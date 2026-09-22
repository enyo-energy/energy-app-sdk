/**
 * Client-side validation for {@link EnyoCalibrationRun} — the record an app
 * publishes to say what an appliance was proven to do.
 *
 * Two classes of problem live here:
 *
 * 1. **States that contradict themselves.** Confirmed features on a failed run,
 *    a failure reason on a successful one, a run closed before it started.
 *    Nothing rejects these at the type level — every field that distinguishes
 *    the statuses is optional, because no single status uses all of them — so a
 *    run can claim to have succeeded and to have timed out at once.
 * 2. **Features belonging to another device class.** The flat
 *    {@link EnyoCalibratedFeatureEnum} lets a charger run report
 *    `HeatpumpSgReady`. That compiles, reaches the cockpit, and tells a user
 *    their wallbox supports SG Ready.
 *
 * `errors` mean the run is malformed; `warnings` are advisory. Use
 * {@link validateCalibrationRun} for the non-throwing result, or
 * {@link assertValidCalibrationRun} to throw.
 */

import {
    EnyoCalibratedFeatureEnum,
    EnyoCalibrationFailureReasonEnum,
    EnyoCalibrationStatusEnum,
} from '../../types/enyo-calibration.js';
import type {
    EnyoCalibrationRequirement,
    EnyoCalibrationRun,
} from '../../types/enyo-calibration.js';
import {EnyoApplianceTypeEnum} from '../../types/enyo-appliance.js';

/**
 * Thrown by {@link assertValidCalibrationRun} when a run fails validation. The
 * message lists every blocking error so callers can surface them directly.
 */
export class CalibrationRunValidationError extends Error {
    /** The individual blocking errors that caused the failure. */
    public readonly errors: string[];

    /**
     * @param errors - The blocking validation errors.
     */
    constructor(errors: string[]) {
        super(`Invalid calibration run:\n- ${errors.join('\n- ')}`);
        this.name = 'CalibrationRunValidationError';
        this.errors = errors;
    }
}

/** The outcome of validating a calibration run. */
export interface CalibrationRunValidationResult {
    /** True when there are no blocking errors. */
    ok: boolean;
    /** Blocking problems — the run is malformed. */
    errors: string[];
    /** Advisory problems — the run is usable but probably not what was meant. */
    warnings: string[];
}

/**
 * Which appliance category each {@link EnyoCalibratedFeatureEnum} member
 * belongs to.
 *
 * The enum is flat by design, so this map is the only thing standing between a
 * charger run and a heat pump feature. Every member must appear exactly once;
 * the exhaustive `Record` makes a new member a compile error until it is
 * classified.
 */
export const CALIBRATED_FEATURE_APPLIANCE_TYPE: Readonly<
    Record<EnyoCalibratedFeatureEnum, EnyoApplianceTypeEnum>
> = {
    [EnyoCalibratedFeatureEnum.BatteryGridCharging]: EnyoApplianceTypeEnum.Storage,
    [EnyoCalibratedFeatureEnum.BatteryGridDischarging]: EnyoApplianceTypeEnum.Storage,
    [EnyoCalibratedFeatureEnum.BatteryChargePowerLimitation]: EnyoApplianceTypeEnum.Storage,
    [EnyoCalibratedFeatureEnum.BatteryDischargePowerLimitation]: EnyoApplianceTypeEnum.Storage,
    [EnyoCalibratedFeatureEnum.BatterySocAccuracy]: EnyoApplianceTypeEnum.Storage,
    [EnyoCalibratedFeatureEnum.BatteryUsableCapacity]: EnyoApplianceTypeEnum.Storage,

    [EnyoCalibratedFeatureEnum.ChargerStartStop]: EnyoApplianceTypeEnum.Charger,
    [EnyoCalibratedFeatureEnum.ChargerPowerLimitation]: EnyoApplianceTypeEnum.Charger,
    [EnyoCalibratedFeatureEnum.ChargerPhaseSwitching]: EnyoApplianceTypeEnum.Charger,
    [EnyoCalibratedFeatureEnum.ChargerMeterAccuracy]: EnyoApplianceTypeEnum.Charger,
    [EnyoCalibratedFeatureEnum.ChargerVehicleIdentification]: EnyoApplianceTypeEnum.Charger,
    [EnyoCalibratedFeatureEnum.ChargerVehicleSocReadout]: EnyoApplianceTypeEnum.Charger,

    [EnyoCalibratedFeatureEnum.InverterPowerLimitation]: EnyoApplianceTypeEnum.Inverter,
    [EnyoCalibratedFeatureEnum.InverterFeedInLimitation]: EnyoApplianceTypeEnum.Inverter,
    [EnyoCalibratedFeatureEnum.InverterDcStringReadout]: EnyoApplianceTypeEnum.Inverter,
    [EnyoCalibratedFeatureEnum.InverterReactivePowerControl]: EnyoApplianceTypeEnum.Inverter,

    [EnyoCalibratedFeatureEnum.HeatpumpSgReady]: EnyoApplianceTypeEnum.Heatpump,
    [EnyoCalibratedFeatureEnum.HeatpumpTemperatureSetpoint]: EnyoApplianceTypeEnum.Heatpump,
    [EnyoCalibratedFeatureEnum.HeatpumpPowerModulation]: EnyoApplianceTypeEnum.Heatpump,
    [EnyoCalibratedFeatureEnum.HeatpumpDhwBoost]: EnyoApplianceTypeEnum.Heatpump,
    [EnyoCalibratedFeatureEnum.HeatpumpPowerLimitation]: EnyoApplianceTypeEnum.Heatpump,
    [EnyoCalibratedFeatureEnum.HeatpumpTemperatureReadout]: EnyoApplianceTypeEnum.Heatpump,

    [EnyoCalibratedFeatureEnum.HeatingRodSwitching]: EnyoApplianceTypeEnum.HeatingRod,
    [EnyoCalibratedFeatureEnum.HeatingRodPowerModulation]: EnyoApplianceTypeEnum.HeatingRod,
    [EnyoCalibratedFeatureEnum.HeatingRodStepControl]: EnyoApplianceTypeEnum.HeatingRod,
    [EnyoCalibratedFeatureEnum.HeatingRodAvailablePowerAnnouncement]: EnyoApplianceTypeEnum.HeatingRod,
    [EnyoCalibratedFeatureEnum.HeatingRodDhwSensor]: EnyoApplianceTypeEnum.HeatingRod,
} as const;

/** The appliance categories a calibration run can be reported for. */
export const CALIBRATABLE_APPLIANCE_TYPES: ReadonlySet<EnyoApplianceTypeEnum> = new Set([
    EnyoApplianceTypeEnum.Storage,
    EnyoApplianceTypeEnum.Charger,
    EnyoApplianceTypeEnum.Inverter,
    EnyoApplianceTypeEnum.Heatpump,
    EnyoApplianceTypeEnum.HeatingRod,
]);

/** The statuses a run has finished in. */
const TERMINAL_STATUSES: ReadonlySet<EnyoCalibrationStatusEnum> = new Set([
    EnyoCalibrationStatusEnum.Succeeded,
    EnyoCalibrationStatusEnum.Failed,
    EnyoCalibrationStatusEnum.Stale,
]);

/** The statuses that may carry {@link EnyoCalibrationRun.confirmedFeatures}. */
const FEATURE_BEARING_STATUSES: ReadonlySet<EnyoCalibrationStatusEnum> = new Set([
    EnyoCalibrationStatusEnum.Succeeded,
    EnyoCalibrationStatusEnum.Stale,
]);

const STATUSES: ReadonlySet<string> = new Set(Object.values(EnyoCalibrationStatusEnum));
const FAILURE_REASONS: ReadonlySet<string> = new Set(Object.values(EnyoCalibrationFailureReasonEnum));

/**
 * True when `value` parses as an ISO 8601 timestamp this runtime accepts.
 *
 * @param value - The candidate timestamp.
 * @returns True when it parses to a real instant.
 */
function isIsoTimestamp(value: unknown): boolean {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/**
 * Validates one requirement entry.
 *
 * @param requirement - The entry to check.
 * @param index - Its position, for error messages.
 * @param errors - Collector for blocking problems.
 */
function validateRequirement(
    requirement: EnyoCalibrationRequirement,
    index: number,
    errors: string[],
): void {
    if (typeof requirement?.key !== 'string' || requirement.key.length === 0) {
        errors.push(`\`requirements[${index}].key\` must be a non-empty string.`);
    }
    if (typeof requirement?.satisfied !== 'boolean') {
        errors.push(`\`requirements[${index}].satisfied\` must be a boolean.`);
    }
    if (!Array.isArray(requirement?.description) || requirement.description.length === 0) {
        errors.push(
            `\`requirements[${index}].description\` must carry at least one translation — ` +
                'it is the only thing a user is shown about what is missing.',
        );
    }
}

/**
 * Validates a calibration run: its status, the fields that status may carry,
 * and whether its confirmed features belong to its appliance category.
 *
 * Checks applied:
 *
 * - `id`, `applianceId` are non-empty strings and `status` is an enum member (**error**).
 * - `applianceType` is a category that can be calibrated (**error**).
 * - `startedAtIso` / `updatedAtIso` parse, and `completedAtIso` is present exactly
 *   on the terminal statuses (**error**), and not before `startedAtIso` (**error**).
 * - `confirmedFeatures` appears only on `succeeded` / `stale` (**error**), holds
 *   enum members (**error**), each belonging to `applianceType` (**error**), and
 *   without duplicates (**warning**).
 * - `failureReason` appears exactly on `failed` (**error**) and is an enum member (**error**).
 * - `progressPercent` is a number in 0…100 (**error**) and appears only while
 *   `running` (**warning**).
 * - `requirements` entries are well-formed (**error**); a `ready` run has none
 *   unsatisfied and a `not-calibrated` run has at least one (**warning** —
 *   otherwise a user is told something is missing without being told what).
 *
 * @param run - The run to validate.
 * @returns The {@link CalibrationRunValidationResult}.
 *
 * @example
 * ```typescript
 * const {ok, errors} = validateCalibrationRun(run);
 * if (!ok) console.error(errors);
 * ```
 */
export function validateCalibrationRun(run: EnyoCalibrationRun): CalibrationRunValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof run?.id !== 'string' || run.id.length === 0) {
        errors.push('`id` must be a non-empty string.');
    }
    if (typeof run?.applianceId !== 'string' || run.applianceId.length === 0) {
        errors.push('`applianceId` must be a non-empty string.');
    }
    if (!STATUSES.has(run?.status)) {
        errors.push(`\`status\` "${run?.status}" is not an EnyoCalibrationStatusEnum member.`);
        return {ok: false, errors, warnings};
    }
    if (!CALIBRATABLE_APPLIANCE_TYPES.has(run.applianceType)) {
        errors.push(
            `\`applianceType\` "${run.applianceType}" cannot be calibrated. Supported: ` +
                `${[...CALIBRATABLE_APPLIANCE_TYPES].join(', ')}.`,
        );
    }

    // ── timestamps ─────────────────────────────────────────────────────────
    if (!isIsoTimestamp(run.startedAtIso)) {
        errors.push('`startedAtIso` must be an ISO 8601 timestamp.');
    }
    if (!isIsoTimestamp(run.updatedAtIso)) {
        errors.push('`updatedAtIso` must be an ISO 8601 timestamp.');
    }

    const isTerminal = TERMINAL_STATUSES.has(run.status);
    if (run.completedAtIso !== undefined) {
        if (!isIsoTimestamp(run.completedAtIso)) {
            errors.push('`completedAtIso` must be an ISO 8601 timestamp when set.');
        } else if (isIsoTimestamp(run.startedAtIso)
            && Date.parse(run.completedAtIso) < Date.parse(run.startedAtIso)) {
            errors.push('`completedAtIso` is before `startedAtIso` — a run cannot end before it began.');
        }
        if (!isTerminal) {
            errors.push(
                `\`completedAtIso\` is set but the run is "${run.status}", which has not finished.`,
            );
        }
    } else if (isTerminal) {
        errors.push(`\`completedAtIso\` is required on a "${run.status}" run.`);
    }

    // ── confirmed features ─────────────────────────────────────────────────
    if (run.confirmedFeatures !== undefined) {
        if (!FEATURE_BEARING_STATUSES.has(run.status)) {
            errors.push(
                `\`confirmedFeatures\` is set but the run is "${run.status}" — only a succeeded ` +
                    'or stale run has proven anything.',
            );
        }
        if (!Array.isArray(run.confirmedFeatures)) {
            errors.push('`confirmedFeatures` must be an array when set.');
        } else {
            const seen = new Set<EnyoCalibratedFeatureEnum>();
            for (const feature of run.confirmedFeatures) {
                const owner = CALIBRATED_FEATURE_APPLIANCE_TYPE[feature];
                if (owner === undefined) {
                    errors.push(
                        `\`confirmedFeatures\` holds "${feature}", which is not an ` +
                            'EnyoCalibratedFeatureEnum member.',
                    );
                    continue;
                }
                if (owner !== run.applianceType) {
                    errors.push(
                        `\`confirmedFeatures\` holds "${feature}", which belongs to ${owner}, but ` +
                            `this run is for a ${run.applianceType}.`,
                    );
                }
                if (seen.has(feature)) {
                    warnings.push(`\`confirmedFeatures\` lists "${feature}" more than once.`);
                }
                seen.add(feature);
            }
        }
    }

    // ── failure reason ─────────────────────────────────────────────────────
    if (run.failureReason !== undefined) {
        if (!FAILURE_REASONS.has(run.failureReason)) {
            errors.push(
                `\`failureReason\` "${run.failureReason}" is not an ` +
                    'EnyoCalibrationFailureReasonEnum member.',
            );
        }
        if (run.status !== EnyoCalibrationStatusEnum.Failed) {
            errors.push(
                `\`failureReason\` is set but the run is "${run.status}", not failed.`,
            );
        }
    } else if (run.status === EnyoCalibrationStatusEnum.Failed) {
        errors.push(
            '`failureReason` is required on a failed run — without it a consumer cannot tell a ' +
                'retryable failure from a permanent one.',
        );
    }

    // ── progress ───────────────────────────────────────────────────────────
    if (run.progressPercent !== undefined) {
        if (typeof run.progressPercent !== 'number' || !Number.isFinite(run.progressPercent)) {
            errors.push('`progressPercent` must be a finite number when set.');
        } else if (run.progressPercent < 0 || run.progressPercent > 100) {
            errors.push(
                `\`progressPercent\` is ${run.progressPercent}; it is a percentage and must lie ` +
                    'between 0 and 100.',
            );
        }
        if (run.status !== EnyoCalibrationStatusEnum.Running) {
            warnings.push(
                `\`progressPercent\` is set but the run is "${run.status}" — progress through a ` +
                    'run that is not running is not meaningful.',
            );
        }
    }

    // ── requirements ───────────────────────────────────────────────────────
    if (run.requirements !== undefined) {
        if (!Array.isArray(run.requirements)) {
            errors.push('`requirements` must be an array when set.');
        } else {
            run.requirements.forEach((r, i) => validateRequirement(r, i, errors));
            const unsatisfied = run.requirements.filter((r) => r?.satisfied === false);
            if (run.status === EnyoCalibrationStatusEnum.Ready && unsatisfied.length) {
                warnings.push(
                    `the run is "ready" but ${unsatisfied.length} requirement(s) are unsatisfied — ` +
                        'a control offered on this status can only fail.',
                );
            }
        }
    } else if (run.status === EnyoCalibrationStatusEnum.NotCalibrated) {
        warnings.push(
            'a "not-calibrated" run carries no `requirements`, so a user is told something is ' +
                'missing without being told what.',
        );
    }

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Like {@link validateCalibrationRun}, but throws
 * {@link CalibrationRunValidationError} when there are blocking errors.
 * Warnings never throw; the validated run is returned on success for chaining.
 *
 * @param run - The run to validate.
 * @returns The same run when it has no blocking errors.
 * @throws {CalibrationRunValidationError} When validation produces any error.
 */
export function assertValidCalibrationRun(run: EnyoCalibrationRun): EnyoCalibrationRun {
    const {ok, errors} = validateCalibrationRun(run);
    if (!ok) throw new CalibrationRunValidationError(errors);
    return run;
}
