import {EnyoHeatpumpControlAreaEnum, HEATPUMP_CURVE_OPTIMIZATION_MAX_LOWERING_K} from '../../types/enyo-heatpump-appliance.js';
import {
    EnyoHeatpumpPreHeatTargetEnum,
    EnyoHeatpumpRecommendation,
    EnyoHeatpumpRecommendationAnswerEnum,
    EnyoHeatpumpRecommendationBenefitKindEnum,
    EnyoHeatpumpRecommendationCauseEnum,
    EnyoHeatpumpRecommendationExecutionEnum,
    EnyoHeatpumpRecommendationStateEnum,
    EnyoHeatpumpRecommendationStopReasonEnum,
    EnyoHeatpumpRecommendationTypeEnum,
} from '../../types/enyo-heatpump-recommendation.js';
import {
    EnyoDataBusHeatpumpRecommendationAnswerV1,
    EnyoDataBusHeatpumpRecommendationStatusV1,
    EnyoDataBusHeatpumpRecommendationsV1,
    EnyoDataBusMessageEnum,
    EnyoDataBusResetHeatpumpRecommendationV1,
} from '../../types/enyo-data-bus-value.js';
import {legionellaSlotErrors, legionellaSlotsEqual} from '../legionella/legionella-validators.js';
import type {EnyoLegionellaSlot} from '../../types/enyo-legionella.js';

/**
 * Result of {@link validateHeatpumpRecommendation},
 * {@link validateHeatpumpRecommendationsMessage},
 * {@link validateHeatpumpRecommendationStatusMessage} and
 * {@link validateHeatpumpRecommendationRequestMessage}: `ok` is `false` when
 * there are errors.
 */
export interface HeatpumpRecommendationValidationResult {
    /** `true` when there are no errors. */
    ok: boolean;
    /** Problems that make the recommendation wrong. */
    errors: string[];
}

const {OneTime, Permanent, Manual} = EnyoHeatpumpRecommendationExecutionEnum;

/** The area each recommendation type belongs to. */
const AREA_OF_TYPE: Record<EnyoHeatpumpRecommendationTypeEnum, EnyoHeatpumpControlAreaEnum> = {
    [EnyoHeatpumpRecommendationTypeEnum.SolarHotWaterBoost]: EnyoHeatpumpControlAreaEnum.SolarHotWater,
    [EnyoHeatpumpRecommendationTypeEnum.PreHeat]: EnyoHeatpumpControlAreaEnum.CostOptimizedHeating,
    [EnyoHeatpumpRecommendationTypeEnum.HeatingCurveLowering]: EnyoHeatpumpControlAreaEnum.HeatingCurve,
    [EnyoHeatpumpRecommendationTypeEnum.LegionellaProgramShift]: EnyoHeatpumpControlAreaEnum.LegionellaProgram,
};

/** The executions each recommendation type allows. */
const EXECUTIONS_OF_TYPE: Record<EnyoHeatpumpRecommendationTypeEnum, EnyoHeatpumpRecommendationExecutionEnum[]> = {
    [EnyoHeatpumpRecommendationTypeEnum.SolarHotWaterBoost]: [OneTime],
    [EnyoHeatpumpRecommendationTypeEnum.PreHeat]: [OneTime],
    [EnyoHeatpumpRecommendationTypeEnum.HeatingCurveLowering]: [Permanent, Manual],
    [EnyoHeatpumpRecommendationTypeEnum.LegionellaProgramShift]: [OneTime, Permanent, Manual],
};

const CAUSES = new Set<string>(Object.values(EnyoHeatpumpRecommendationCauseEnum));
const BENEFIT_KINDS = new Set<string>(Object.values(EnyoHeatpumpRecommendationBenefitKindEnum));
const PRE_HEAT_TARGETS = new Set<string>(Object.values(EnyoHeatpumpPreHeatTargetEnum));

/**
 * Whether a value is a parseable ISO 8601 timestamp.
 *
 * @param value - The value to check.
 * @returns `true` when it is a string `Date.parse` understands.
 */
function isIsoTimestamp(value: unknown): value is string {
    return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

/**
 * Whether a value is a finite number.
 *
 * @param value - The value to check.
 * @returns `true` when it is a finite number.
 */
function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Checks a time window — both ends valid ISO 8601, start before end — and
 * appends the problems to `errors`.
 *
 * @param window - The window.
 * @param path - Path of the window for the messages, e.g. `window`.
 * @param errors - Receives the problems.
 */
function checkWindow(window: unknown, path: string, errors: string[]): void {
    const {startIso, endIso} = (window ?? {}) as {startIso?: unknown; endIso?: unknown};
    if (!isIsoTimestamp(startIso) || !isIsoTimestamp(endIso)) {
        errors.push(`${path}: startIso and endIso must be ISO 8601 timestamps`);
    } else if (Date.parse(startIso) >= Date.parse(endIso)) {
        errors.push(`${path}: startIso ${startIso} must be before endIso ${endIso}`);
    }
}

/**
 * Checks that an optional field is a finite number when it is set, and
 * appends the problem to `errors`.
 *
 * @param value - The field's value.
 * @param path - Path of the field for the message.
 * @param errors - Receives the problem.
 */
function checkOptionalFinite(value: unknown, path: string, errors: string[]): void {
    if (value !== undefined && !isFiniteNumber(value)) {
        errors.push(`${path} must be a finite number`);
    }
}

/**
 * Checks the `params` of a recommendation against its type and appends the
 * problems to `errors`.
 *
 * @param type - The recommendation's type (already known to be valid).
 * @param params - The recommendation's `params`.
 * @param errors - Receives the problems.
 */
function checkParams(type: EnyoHeatpumpRecommendationTypeEnum, params: unknown, errors: string[]): void {
    if (typeof params !== 'object' || params === null) {
        errors.push(`params must be an object for type "${type}"`);
        return;
    }
    const p = params as Record<string, unknown>;
    switch (type) {
        case EnyoHeatpumpRecommendationTypeEnum.SolarHotWaterBoost:
            if (!isFiniteNumber(p.targetTemperatureC)) {
                errors.push('params.targetTemperatureC must be a finite number');
            }
            break;
        case EnyoHeatpumpRecommendationTypeEnum.PreHeat:
            if (typeof p.target !== 'string' || !PRE_HEAT_TARGETS.has(p.target)) {
                errors.push(`params.target "${String(p.target)}" is not a valid pre-heat target`);
            }
            if (!isIsoTimestamp(p.heatingOnsetIso)) {
                errors.push('params.heatingOnsetIso must be an ISO 8601 timestamp');
            }
            checkOptionalFinite(p.targetTemperatureC, 'params.targetTemperatureC', errors);
            checkOptionalFinite(p.deltaK, 'params.deltaK', errors);
            checkOptionalFinite(p.outdoorTemperatureC, 'params.outdoorTemperatureC', errors);
            break;
        case EnyoHeatpumpRecommendationTypeEnum.HeatingCurveLowering:
            if (!Number.isInteger(p.heatingCircuitIndex) || (p.heatingCircuitIndex as number) < 0) {
                errors.push('params.heatingCircuitIndex must be a non-negative integer');
            }
            if (!isFiniteNumber(p.offsetK)) {
                errors.push('params.offsetK must be a finite number');
            } else if (p.offsetK >= 0 || p.offsetK < -HEATPUMP_CURVE_OPTIMIZATION_MAX_LOWERING_K) {
                errors.push(
                    `params.offsetK ${p.offsetK} K must be negative and at least -${HEATPUMP_CURVE_OPTIMIZATION_MAX_LOWERING_K} K`,
                );
            }
            if (!isFiniteNumber(p.currentOffsetK)) {
                errors.push('params.currentOffsetK must be a finite number');
            }
            break;
        case EnyoHeatpumpRecommendationTypeEnum.LegionellaProgramShift: {
            if (p.domesticHotWaterIndex !== undefined
                && (!Number.isInteger(p.domesticHotWaterIndex) || (p.domesticHotWaterIndex as number) < 0)) {
                errors.push('params.domesticHotWaterIndex must be a non-negative integer');
            }
            const slotErrors = [
                ...legionellaSlotErrors(p.currentSlot, 'params.currentSlot'),
                ...legionellaSlotErrors(p.proposedSlot, 'params.proposedSlot'),
            ];
            errors.push(...slotErrors);
            if (slotErrors.length === 0
                && legionellaSlotsEqual(p.currentSlot as EnyoLegionellaSlot, p.proposedSlot as EnyoLegionellaSlot)) {
                errors.push('params.proposedSlot must differ from params.currentSlot');
            }
            if (!isIsoTimestamp(p.nextRunIso)) {
                errors.push('params.nextRunIso must be an ISO 8601 timestamp');
            }
            checkOptionalFinite(p.targetTemperatureC, 'params.targetTemperatureC', errors);
            break;
        }
    }
}

/**
 * Validates one {@link EnyoHeatpumpRecommendation} before an energy manager
 * sends it in `HeatpumpRecommendationsV1`, or when the host receives it.
 *
 * Errors:
 * - `id` is empty.
 * - `type`, `cause` or `benefit.kind` is not a known value.
 * - `area` does not match `type`: `SolarHotWaterBoost` → `SolarHotWater`,
 *   `PreHeat` → `CostOptimizedHeating`, `HeatingCurveLowering` → `HeatingCurve`,
 *   `LegionellaProgramShift` → `LegionellaProgram`.
 * - `execution` does not match `type`: `HeatingCurveLowering` only
 *   `Permanent` or `Manual`, `LegionellaProgramShift` any, the others only
 *   `OneTime`.
 * - `window` is missing for `OneTime`, or a window (also in `timeline`) is
 *   not two ISO 8601 timestamps with start before end.
 * - `validUntilIso` (or `params.heatingOnsetIso`) is not an ISO 8601 timestamp.
 * - `benefit.value` is not finite and greater than `0`, or above `100` for
 *   `LessElectricityPercent`.
 * - The `params` the type requires are missing or not finite; for
 *   `HeatingCurveLowering`, `offsetK` is not negative or below
 *   `-`{@link HEATPUMP_CURVE_OPTIMIZATION_MAX_LOWERING_K}.
 * - For `LegionellaProgramShift`: a slot is malformed, `proposedSlot` equals
 *   `currentSlot`, `nextRunIso` is not an ISO 8601 timestamp or, for
 *   `OneTime`, lies outside `window`.
 * - `floorTemperatureC` is set but not finite.
 *
 * Whether the heat pump offers the area, or `Permanent` (which needs
 * `HeatingCurveOffset`, or `LegionellaSchedule` for the legionella program),
 * or a `TimeOnly` device can take the proposed slot, is not checked here — that needs the metadata, see
 * {@link availableHeatpumpControlModes}.
 *
 * @param recommendation - The recommendation to validate.
 * @returns The validation result; `ok` is `false` when there are errors.
 */
export function validateHeatpumpRecommendation(
    recommendation: EnyoHeatpumpRecommendation,
): HeatpumpRecommendationValidationResult {
    const errors: string[] = [];
    if (typeof recommendation !== 'object' || recommendation === null) {
        return {ok: false, errors: ['recommendation must be an object']};
    }
    // Validated as received: the union's narrowing does not hold for data off the bus.
    const r = recommendation as unknown as Record<string, unknown>;

    if (typeof r.id !== 'string' || r.id.trim().length === 0) {
        errors.push('id must be a non-empty string');
    }

    const type = r.type as EnyoHeatpumpRecommendationTypeEnum;
    const knownType = Object.prototype.hasOwnProperty.call(AREA_OF_TYPE, type);
    if (!knownType) {
        errors.push(`type "${String(r.type)}" is not a valid recommendation type`);
    } else {
        if (r.area !== AREA_OF_TYPE[type]) {
            errors.push(`area "${String(r.area)}" does not match type "${type}", expected "${AREA_OF_TYPE[type]}"`);
        }
        if (!EXECUTIONS_OF_TYPE[type].includes(r.execution as EnyoHeatpumpRecommendationExecutionEnum)) {
            errors.push(
                `execution "${String(r.execution)}" does not match type "${type}", expected ${EXECUTIONS_OF_TYPE[type].join(' or ')}`,
            );
        }
        checkParams(type, r.params, errors);
    }

    if (typeof r.cause !== 'string' || !CAUSES.has(r.cause)) {
        errors.push(`cause "${String(r.cause)}" is not a valid recommendation cause`);
    }

    if (r.window === undefined) {
        if (r.execution === OneTime) errors.push('window is required for execution "one-time"');
    } else {
        checkWindow(r.window, 'window', errors);
        const nextRunIso = (r.params as {nextRunIso?: unknown} | undefined)?.nextRunIso;
        const {startIso, endIso} = r.window as {startIso?: unknown; endIso?: unknown};
        if (type === EnyoHeatpumpRecommendationTypeEnum.LegionellaProgramShift && r.execution === OneTime
            && isIsoTimestamp(nextRunIso) && isIsoTimestamp(startIso) && isIsoTimestamp(endIso)
            && (Date.parse(nextRunIso) < Date.parse(startIso) || Date.parse(nextRunIso) >= Date.parse(endIso))) {
            errors.push(`params.nextRunIso ${nextRunIso} must lie inside window`);
        }
    }

    if (!isIsoTimestamp(r.validUntilIso)) {
        errors.push('validUntilIso must be an ISO 8601 timestamp');
    }

    const benefit = (r.benefit ?? {}) as {kind?: unknown; value?: unknown};
    if (typeof benefit.kind !== 'string' || !BENEFIT_KINDS.has(benefit.kind)) {
        errors.push(`benefit.kind "${String(benefit.kind)}" is not a valid benefit kind`);
    }
    if (!isFiniteNumber(benefit.value) || benefit.value <= 0) {
        errors.push('benefit.value must be a finite number greater than 0');
    } else if (benefit.kind === EnyoHeatpumpRecommendationBenefitKindEnum.LessElectricityPercent && benefit.value > 100) {
        errors.push(`benefit.value ${benefit.value} % must be at most 100`);
    }

    if (r.timeline !== undefined) {
        const timeline = r.timeline as {baseline?: unknown; solar?: unknown; proposed?: unknown};
        if (!Array.isArray(timeline.proposed)) {
            errors.push('timeline.proposed must be an array');
        } else {
            timeline.proposed.forEach((w, i) => checkWindow(w, `timeline.proposed[${i}]`, errors));
        }
        if (timeline.baseline !== undefined) {
            if (!Array.isArray(timeline.baseline)) {
                errors.push('timeline.baseline must be an array');
            } else {
                timeline.baseline.forEach((w, i) => checkWindow(w, `timeline.baseline[${i}]`, errors));
            }
        }
        if (timeline.solar !== undefined) checkWindow(timeline.solar, 'timeline.solar', errors);
    }

    checkOptionalFinite(r.floorTemperatureC, 'floorTemperatureC', errors);

    return {ok: errors.length === 0, errors};
}

/**
 * Validates the data of a `HeatpumpRecommendationsV1`: `evaluatedAtIso` is an
 * ISO 8601 timestamp, no two recommendations share an `id`, and every
 * recommendation passes {@link validateHeatpumpRecommendation}. Each error of a
 * recommendation is prefixed with its position and id, e.g.
 * `recommendations[1] (id=dhw-2026-11-24): window is required …`.
 *
 * An empty list is valid — it is what the energy manager sends when it has
 * nothing to recommend.
 *
 * @param message - The message to validate.
 * @returns The validation result; `ok` is `false` when there are errors.
 */
export function validateHeatpumpRecommendationsMessage(
    message: EnyoDataBusHeatpumpRecommendationsV1,
): HeatpumpRecommendationValidationResult {
    const errors: string[] = [];
    const {evaluatedAtIso, recommendations} = message.data ?? ({} as Partial<EnyoDataBusHeatpumpRecommendationsV1['data']>);

    if (!isIsoTimestamp(evaluatedAtIso)) {
        errors.push('evaluatedAtIso must be an ISO 8601 timestamp');
    }
    if (!Array.isArray(recommendations)) {
        errors.push('recommendations must be an array');
        return {ok: false, errors};
    }

    const ids = recommendations.map((recommendation) => recommendation?.id);
    const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    if (duplicates.length > 0) {
        errors.push(`recommendations contain duplicate id ${duplicates.map((id) => `"${String(id)}"`).join(', ')}`);
    }

    recommendations.forEach((recommendation, i) => {
        const prefix = `recommendations[${i}] (id=${String(recommendation?.id)})`;
        errors.push(...validateHeatpumpRecommendation(recommendation).errors.map((error) => `${prefix}: ${error}`));
    });

    return {ok: errors.length === 0, errors};
}

const STATES = new Set<string>(Object.values(EnyoHeatpumpRecommendationStateEnum));
const STOP_REASONS = new Set<string>(Object.values(EnyoHeatpumpRecommendationStopReasonEnum));
const ANSWERS = new Set<string>(Object.values(EnyoHeatpumpRecommendationAnswerEnum));
/** The states that end a recommendation early and therefore carry a `stopReason`. */
const STOPPED_STATES = new Set<string>([
    EnyoHeatpumpRecommendationStateEnum.Rejected,
    EnyoHeatpumpRecommendationStateEnum.Aborted,
]);

/**
 * Checks a {@link EnyoDataBusHeatpumpRecommendationStatusV1} before the host
 * shows it: a non-empty `recommendationId`, a known `state`, a `stopReason`
 * exactly with `Rejected` / `Aborted` (and a known one), and `activeUntilIso`
 * only with `Active` and as an ISO 8601 timestamp.
 *
 * @param message - The status message to validate.
 * @returns The validation result; `ok` is `false` when there are errors.
 */
export function validateHeatpumpRecommendationStatusMessage(
    message: EnyoDataBusHeatpumpRecommendationStatusV1,
): HeatpumpRecommendationValidationResult {
    const errors = recommendationIdErrors(message);
    const {state, stopReason, activeUntilIso} = message.data ?? ({} as Partial<EnyoDataBusHeatpumpRecommendationStatusV1['data']>);

    if (typeof state !== 'string' || !STATES.has(state)) {
        errors.push(`state must be an EnyoHeatpumpRecommendationStateEnum value, got ${String(state)}`);
    } else if (STOPPED_STATES.has(state)) {
        if (stopReason === undefined) errors.push(`stopReason is required when state is ${state}`);
    } else if (stopReason !== undefined) {
        errors.push(`stopReason is only allowed when state is rejected or aborted, got state ${state}`);
    }
    if (stopReason !== undefined && !STOP_REASONS.has(stopReason)) {
        errors.push(`stopReason must be an EnyoHeatpumpRecommendationStopReasonEnum value, got ${String(stopReason)}`);
    }
    if (activeUntilIso !== undefined) {
        if (state !== EnyoHeatpumpRecommendationStateEnum.Active) {
            errors.push(`activeUntilIso is only allowed when state is active, got state ${String(state)}`);
        } else if (!isIsoTimestamp(activeUntilIso)) {
            errors.push('activeUntilIso must be an ISO 8601 timestamp');
        }
    }
    return {ok: errors.length === 0, errors};
}

/**
 * Checks an {@link EnyoDataBusHeatpumpRecommendationAnswerV1} or
 * {@link EnyoDataBusResetHeatpumpRecommendationV1} before the energy manager
 * acts on it: it names the heat pump (`applianceId`) and a non-empty
 * `recommendationId`, and an answer carries a known `answer`.
 *
 * @param message - The answer or reset message to validate.
 * @returns The validation result; `ok` is `false` when there are errors.
 */
export function validateHeatpumpRecommendationRequestMessage(
    message: EnyoDataBusHeatpumpRecommendationAnswerV1 | EnyoDataBusResetHeatpumpRecommendationV1,
): HeatpumpRecommendationValidationResult {
    const errors = recommendationIdErrors(message);
    if (message?.message === EnyoDataBusMessageEnum.HeatpumpRecommendationAnswerV1) {
        const answer = message.data?.answer;
        if (typeof answer !== 'string' || !ANSWERS.has(answer)) {
            errors.push(`answer must be an EnyoHeatpumpRecommendationAnswerEnum value, got ${String(answer)}`);
        }
    }
    return {ok: errors.length === 0, errors};
}

/**
 * The errors shared by the messages about one recommendation: a missing heat
 * pump or recommendation id.
 *
 * @param message - A message carrying `applianceId` and `data.recommendationId`.
 * @returns The errors found; empty when both are present.
 */
function recommendationIdErrors(message: {applianceId?: string; data?: {recommendationId?: string}}): string[] {
    const errors: string[] = [];
    if (typeof message?.applianceId !== 'string' || message.applianceId.length === 0) {
        errors.push('applianceId must be a non-empty string');
    }
    if (typeof message?.data?.recommendationId !== 'string' || message.data.recommendationId.length === 0) {
        errors.push('recommendationId must be a non-empty string');
    }
    return errors;
}
