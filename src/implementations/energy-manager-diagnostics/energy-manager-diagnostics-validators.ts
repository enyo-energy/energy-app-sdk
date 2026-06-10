import {EnyoApplianceTypeEnum} from '../../types/enyo-appliance.js';
import {EnyoDataBusMessageEnum} from '../../types/enyo-data-bus-value.js';
import {
    EnyoEnergyManagerApplianceCount,
    EnyoEnergyManagerCommandAcknowledgement,
    EnyoEnergyManagerCommandCount,
    EnyoEnergyManagerCycleDiagnostics,
    EnyoEnergyManagerCycleOutcomeEnum,
    EnyoEnergyManagerCyclePhaseEnum,
    EnyoEnergyManagerForecastTypeEnum,
    EnyoEnergyManagerForecastUsage,
    EnyoEnergyManagerIssue,
    EnyoEnergyManagerIssueSeverityEnum,
    EnyoEnergyManagerPhaseDuration,
} from '../../types/enyo-diagnostics.js';

/**
 * Thrown when a payload passed to
 * {@link validateEnergyManagerCycleDiagnostics} (or a publisher that
 * calls into it) violates an invariant documented on
 * {@link EnyoEnergyManagerCycleDiagnostics}.
 *
 * The message names the offending field / index so callers can surface
 * it directly to the user.
 */
export class EnergyManagerDiagnosticsValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EnergyManagerDiagnosticsValidationError';
    }
}

const KEBAB_CASE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Validates an {@link EnyoEnergyManagerCycleDiagnostics} payload.
 * Throws the first violation encountered — the error message names the
 * offending field / index.
 *
 * Enforced invariants (in addition to per-field type checks):
 *  - `cycleCompletedAtIso` is ≥ `cycleStartedAtIso` and both parse as ISO 8601.
 *  - `outcomeReason` is required when `outcome` is `Skipped` or `Failed`.
 *  - The sum of `phaseDurations[].durationMs` ≤ `totalDurationMs`.
 *  - Every count / duration field is a non-negative finite number; counts are integers.
 *  - `issues[].code` is non-empty kebab-case (e.g. `'forecast-fetch-failed'`).
 */
export function validateEnergyManagerCycleDiagnostics(
    cycle: EnyoEnergyManagerCycleDiagnostics,
): void {
    if (!cycle || typeof cycle !== 'object') {
        throw new EnergyManagerDiagnosticsValidationError(
            'EnyoEnergyManagerCycleDiagnostics must be an object.',
        );
    }

    const startMs = parseIsoOrThrow(cycle.cycleStartedAtIso, 'cycleStartedAtIso');
    const endMs = parseIsoOrThrow(cycle.cycleCompletedAtIso, 'cycleCompletedAtIso');
    if (endMs < startMs) {
        throw new EnergyManagerDiagnosticsValidationError(
            `cycleCompletedAtIso (${cycle.cycleCompletedAtIso}) must be at or after cycleStartedAtIso (${cycle.cycleStartedAtIso}).`,
        );
    }

    validateEnumValue(
        cycle.outcome,
        EnyoEnergyManagerCycleOutcomeEnum,
        'outcome',
    );
    if (cycle.outcome !== EnyoEnergyManagerCycleOutcomeEnum.Completed) {
        if (
            typeof cycle.outcomeReason !== 'string' ||
            cycle.outcomeReason.length === 0
        ) {
            throw new EnergyManagerDiagnosticsValidationError(
                `outcomeReason is required (non-empty string) when outcome='${cycle.outcome}'.`,
            );
        }
    } else if (
        cycle.outcomeReason !== undefined &&
        typeof cycle.outcomeReason !== 'string'
    ) {
        throw new EnergyManagerDiagnosticsValidationError(
            'outcomeReason must be a string when provided.',
        );
    }

    validateNonNegativeFiniteNumber(cycle.totalDurationMs, 'totalDurationMs');

    validateArray(cycle.phaseDurations, 'phaseDurations');
    let phaseSumMs = 0;
    const phasesSeen = new Set<EnyoEnergyManagerCyclePhaseEnum>();
    for (let i = 0; i < cycle.phaseDurations.length; i++) {
        const entry = cycle.phaseDurations[i]!;
        validatePhaseDuration(entry, `phaseDurations[${i}]`);
        if (phasesSeen.has(entry.phase)) {
            throw new EnergyManagerDiagnosticsValidationError(
                `phaseDurations[${i}].phase='${entry.phase}' is duplicated; each phase may appear at most once.`,
            );
        }
        phasesSeen.add(entry.phase);
        phaseSumMs += entry.durationMs;
    }
    if (phaseSumMs > cycle.totalDurationMs) {
        throw new EnergyManagerDiagnosticsValidationError(
            `sum of phaseDurations[].durationMs (${phaseSumMs}) must not exceed totalDurationMs (${cycle.totalDurationMs}).`,
        );
    }

    validateArray(cycle.forecastsConsumed, 'forecastsConsumed');
    for (let i = 0; i < cycle.forecastsConsumed.length; i++) {
        validateForecastUsage(cycle.forecastsConsumed[i]!, `forecastsConsumed[${i}]`);
    }

    validateArray(cycle.commandsIssued, 'commandsIssued');
    for (let i = 0; i < cycle.commandsIssued.length; i++) {
        validateCommandCount(cycle.commandsIssued[i]!, `commandsIssued[${i}]`);
    }

    validateArray(cycle.commandAcknowledgements, 'commandAcknowledgements');
    for (let i = 0; i < cycle.commandAcknowledgements.length; i++) {
        validateCommandAcknowledgement(
            cycle.commandAcknowledgements[i]!,
            `commandAcknowledgements[${i}]`,
        );
    }

    validateArray(cycle.appliancesManaged, 'appliancesManaged');
    for (let i = 0; i < cycle.appliancesManaged.length; i++) {
        validateApplianceCount(cycle.appliancesManaged[i]!, `appliancesManaged[${i}]`);
    }

    validateNonNegativeFiniteInteger(
        cycle.plannedHorizonMinutes,
        'plannedHorizonMinutes',
    );

    validateArray(cycle.issues, 'issues');
    for (let i = 0; i < cycle.issues.length; i++) {
        validateIssue(cycle.issues[i]!, `issues[${i}]`);
    }
}

function validatePhaseDuration(
    entry: EnyoEnergyManagerPhaseDuration,
    fieldName: string,
): void {
    validateEnumValue(entry.phase, EnyoEnergyManagerCyclePhaseEnum, `${fieldName}.phase`);
    validateNonNegativeFiniteNumber(entry.durationMs, `${fieldName}.durationMs`);
}

function validateForecastUsage(
    entry: EnyoEnergyManagerForecastUsage,
    fieldName: string,
): void {
    validateEnumValue(
        entry.forecastType,
        EnyoEnergyManagerForecastTypeEnum,
        `${fieldName}.forecastType`,
    );
    if (entry.applianceId !== undefined) {
        if (typeof entry.applianceId !== 'string' || entry.applianceId.length === 0) {
            throw new EnergyManagerDiagnosticsValidationError(
                `${fieldName}.applianceId must be a non-empty string when provided.`,
            );
        }
    }
    validateNonNegativeFiniteNumber(entry.durationMs, `${fieldName}.durationMs`);
    if (typeof entry.ok !== 'boolean') {
        throw new EnergyManagerDiagnosticsValidationError(
            `${fieldName}.ok must be a boolean.`,
        );
    }
}

function validateCommandCount(
    entry: EnyoEnergyManagerCommandCount,
    fieldName: string,
): void {
    validateEnumValue(
        entry.messageType,
        EnyoDataBusMessageEnum,
        `${fieldName}.messageType`,
    );
    validateNonNegativeFiniteInteger(entry.count, `${fieldName}.count`);
}

function validateCommandAcknowledgement(
    entry: EnyoEnergyManagerCommandAcknowledgement,
    fieldName: string,
): void {
    validateEnumValue(
        entry.messageType,
        EnyoDataBusMessageEnum,
        `${fieldName}.messageType`,
    );
    validateNonNegativeFiniteInteger(entry.accepted, `${fieldName}.accepted`);
    validateNonNegativeFiniteInteger(entry.rejected, `${fieldName}.rejected`);
    validateNonNegativeFiniteInteger(entry.notSupported, `${fieldName}.notSupported`);
}

function validateApplianceCount(
    entry: EnyoEnergyManagerApplianceCount,
    fieldName: string,
): void {
    validateEnumValue(
        entry.applianceType,
        EnyoApplianceTypeEnum,
        `${fieldName}.applianceType`,
    );
    validateNonNegativeFiniteInteger(entry.count, `${fieldName}.count`);
}

function validateIssue(entry: EnyoEnergyManagerIssue, fieldName: string): void {
    validateEnumValue(
        entry.severity,
        EnyoEnergyManagerIssueSeverityEnum,
        `${fieldName}.severity`,
    );
    if (typeof entry.code !== 'string' || !KEBAB_CASE_RE.test(entry.code)) {
        throw new EnergyManagerDiagnosticsValidationError(
            `${fieldName}.code must be a non-empty kebab-case string (e.g. 'forecast-fetch-failed'); got ${JSON.stringify(entry.code)}.`,
        );
    }
    if (typeof entry.message !== 'string' || entry.message.length === 0) {
        throw new EnergyManagerDiagnosticsValidationError(
            `${fieldName}.message must be a non-empty string.`,
        );
    }
    if (entry.applianceId !== undefined) {
        if (typeof entry.applianceId !== 'string' || entry.applianceId.length === 0) {
            throw new EnergyManagerDiagnosticsValidationError(
                `${fieldName}.applianceId must be a non-empty string when provided.`,
            );
        }
    }
}

function validateArray(value: unknown, fieldName: string): asserts value is unknown[] {
    if (!Array.isArray(value)) {
        throw new EnergyManagerDiagnosticsValidationError(
            `${fieldName} must be an array.`,
        );
    }
}

function validateNonNegativeFiniteNumber(value: number, fieldName: string): void {
    if (!Number.isFinite(value) || value < 0) {
        throw new EnergyManagerDiagnosticsValidationError(
            `${fieldName}=${value} must be a finite non-negative number.`,
        );
    }
}

function validateNonNegativeFiniteInteger(value: number, fieldName: string): void {
    if (!Number.isInteger(value) || value < 0) {
        throw new EnergyManagerDiagnosticsValidationError(
            `${fieldName}=${value} must be a non-negative integer.`,
        );
    }
}

function validateEnumValue<E extends Record<string, string>>(
    value: unknown,
    enumObject: E,
    fieldName: string,
): void {
    const allowed = new Set<string>(Object.values(enumObject));
    if (typeof value !== 'string' || !allowed.has(value)) {
        throw new EnergyManagerDiagnosticsValidationError(
            `${fieldName} is invalid: ${JSON.stringify(value)}. Allowed values: ${Array.from(
                allowed,
            ).join(', ')}.`,
        );
    }
}

function parseIsoOrThrow(iso: string, fieldName: string): number {
    if (typeof iso !== 'string') {
        throw new EnergyManagerDiagnosticsValidationError(
            `${fieldName} must be an ISO 8601 string.`,
        );
    }
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) {
        throw new EnergyManagerDiagnosticsValidationError(
            `${fieldName} is not a valid ISO 8601 timestamp: ${iso}`,
        );
    }
    return ms;
}
