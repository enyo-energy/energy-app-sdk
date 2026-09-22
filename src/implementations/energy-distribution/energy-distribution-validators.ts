import {EnyoApplianceTypeEnum} from '../../types/enyo-appliance.js';
import {EnyoDataBusCommandReasonTypeEnum} from '../../types/enyo-data-bus-value.js';
import {
    EnyoDistributionParticipantKindEnum,
    EnyoDistributionParticipantStateEnum,
    EnyoDistributionProgress,
    EnyoDistributionProgressUnitEnum,
    EnyoEnergyDistributionParticipant,
    EnyoEnergyDistributionSnapshot,
} from '../../types/enyo-energy-distribution.js';
import {progressPercent} from './energy-distribution-progress.js';

/**
 * Thrown when a payload passed to {@link validateEnergyDistributionSnapshot} (or a publisher
 * that calls into it) violates an invariant documented on
 * {@link EnyoEnergyDistributionSnapshot}.
 *
 * The message names the offending field / index so callers can surface it directly.
 */
export class EnergyDistributionValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EnergyDistributionValidationError';
    }
}

/** How far {@link EnyoDistributionProgress.percent} may drift from the recomputed value. */
const PERCENT_TOLERANCE = 0.2;

/**
 * Validates an {@link EnyoEnergyDistributionSnapshot}. Throws the first violation encountered.
 *
 * The invariants are not style rules — each one is a way the card has been able to tell an owner
 * something untrue:
 *
 *  - `generatedAtIso` and `slotStartIso` parse as ISO 8601, and the snapshot is not generated
 *    before the slot it describes begins.
 *  - Ranks are unique: two rows claiming the same position leave the order to a sort that is not
 *    the one the allocation used.
 *  - Only {@link EnyoDistributionParticipantKindEnum.Appliance} rows carry `applianceId` /
 *    `applianceType` — and they carry both, since a row that can be pointed at must be
 *    identifiable.
 *  - Measured rows (household, feed-in, grid import) carry no `progress`: they have no goal, and
 *    a bar on them is a claim about a plan that does not exist.
 *  - {@link EnyoDistributionParticipantStateEnum.Complete} requires a stated
 *    {@link EnyoDataBusCommandReasonTypeEnum.SessionComplete}. This is the load-bearing one: a
 *    publisher that reads "done" off a full bar reports a session finished while its target is
 *    merely overshot, and reports one unfinished when the meter lags.
 *  - The sign of `powerW` agrees with the state: `Drawing` is not negative, `Supplying` is not
 *    positive, and a row that is `Skipped`, `NotAsking` or `Complete` draws nothing.
 *  - `progress.percent` agrees with `start` / `current` / `target` within
 *    {@link PERCENT_TOLERANCE}, so a hand-built bar cannot disagree with its own numbers.
 *  - Every `reason` carries a `type`, and every participant a non-empty `name`.
 *
 * @param snapshot - The payload to check.
 * @throws {EnergyDistributionValidationError} On the first violated invariant.
 *
 * @example
 * ```typescript
 * // In a test, before trusting a manager's snapshot:
 * validateEnergyDistributionSnapshot(builder.build({slotStartMs}));
 * ```
 */
export function validateEnergyDistributionSnapshot(
    snapshot: EnyoEnergyDistributionSnapshot,
): void {
    if (!snapshot || typeof snapshot !== 'object') {
        throw new EnergyDistributionValidationError(
            'EnyoEnergyDistributionSnapshot must be an object.',
        );
    }

    const generatedAtMs = parseIsoOrThrow(snapshot.generatedAtIso, 'generatedAtIso');
    const slotStartMs = parseIsoOrThrow(snapshot.slotStartIso, 'slotStartIso');
    if (generatedAtMs < slotStartMs) {
        throw new EnergyDistributionValidationError(
            `generatedAtIso (${snapshot.generatedAtIso}) must be at or after slotStartIso (${snapshot.slotStartIso}).`,
        );
    }

    if (!Array.isArray(snapshot.participants)) {
        throw new EnergyDistributionValidationError('participants must be an array.');
    }

    const ranksSeen = new Set<number>();
    for (let i = 0; i < snapshot.participants.length; i++) {
        const participant = snapshot.participants[i]!;
        const path = `participants[${i}]`;
        validateParticipant(participant, path);
        if (ranksSeen.has(participant.rank)) {
            throw new EnergyDistributionValidationError(
                `${path}.rank=${participant.rank} is duplicated; each participant needs its own position.`,
            );
        }
        ranksSeen.add(participant.rank);
    }
}

/**
 * Validates one row of the snapshot.
 *
 * @param participant - The row to check.
 * @param path - Where it sits in the payload, for the error message.
 * @throws {EnergyDistributionValidationError} On the first violated invariant.
 */
function validateParticipant(
    participant: EnyoEnergyDistributionParticipant,
    path: string,
): void {
    if (!participant || typeof participant !== 'object') {
        throw new EnergyDistributionValidationError(`${path} must be an object.`);
    }

    validateEnumValue(
        participant.kind,
        EnyoDistributionParticipantKindEnum,
        `${path}.kind`,
    );
    validateEnumValue(
        participant.state,
        EnyoDistributionParticipantStateEnum,
        `${path}.state`,
    );

    if (!Number.isInteger(participant.rank) || participant.rank < 0) {
        throw new EnergyDistributionValidationError(
            `${path}.rank must be a non-negative integer, got ${String(participant.rank)}.`,
        );
    }
    if (typeof participant.name !== 'string' || participant.name.length === 0) {
        throw new EnergyDistributionValidationError(
            `${path}.name must be a non-empty string — the owner has to be able to tell the rows apart.`,
        );
    }
    if (typeof participant.powerW !== 'number' || !Number.isFinite(participant.powerW)) {
        throw new EnergyDistributionValidationError(
            `${path}.powerW must be a finite number, got ${String(participant.powerW)}.`,
        );
    }

    validateIdentity(participant, path);
    validateReason(participant, path);
    validatePowerSign(participant, path);
    validateProgressOf(participant, path);
}

/**
 * Checks that appliance rows are identifiable and measured rows are not pretending to be
 * appliances.
 *
 * @param participant - The row to check.
 * @param path - Where it sits in the payload, for the error message.
 * @throws {EnergyDistributionValidationError} On mismatched identity fields.
 */
function validateIdentity(
    participant: EnyoEnergyDistributionParticipant,
    path: string,
): void {
    const isAppliance = participant.kind === EnyoDistributionParticipantKindEnum.Appliance;
    if (isAppliance) {
        if (typeof participant.applianceId !== 'string' || participant.applianceId.length === 0) {
            throw new EnergyDistributionValidationError(
                `${path}.applianceId is required (non-empty string) on an appliance participant.`,
            );
        }
        validateEnumValue(
            participant.applianceType,
            EnyoApplianceTypeEnum,
            `${path}.applianceType`,
        );
        return;
    }
    if (participant.applianceId !== undefined || participant.applianceType !== undefined) {
        throw new EnergyDistributionValidationError(
            `${path} is kind='${participant.kind}' and must not carry applianceId / applianceType — it speaks for no appliance.`,
        );
    }
}

/**
 * Checks the row's reason, and the one rule that keeps "done" honest: only a stated
 * {@link EnyoDataBusCommandReasonTypeEnum.SessionComplete} may put a row into
 * {@link EnyoDistributionParticipantStateEnum.Complete}.
 *
 * @param participant - The row to check.
 * @param path - Where it sits in the payload, for the error message.
 * @throws {EnergyDistributionValidationError} On a missing reason or an unfounded `Complete`.
 */
function validateReason(
    participant: EnyoEnergyDistributionParticipant,
    path: string,
): void {
    const reason = participant.reason;
    if (!reason || typeof reason !== 'object') {
        throw new EnergyDistributionValidationError(
            `${path}.reason is required — a row the owner cannot be told the reason for is the thing this snapshot exists to avoid.`,
        );
    }
    validateEnumValue(reason.type, EnyoDataBusCommandReasonTypeEnum, `${path}.reason.type`);

    const isComplete = participant.state === EnyoDistributionParticipantStateEnum.Complete;
    const saysComplete = reason.type === EnyoDataBusCommandReasonTypeEnum.SessionComplete;
    if (isComplete && !saysComplete) {
        throw new EnergyDistributionValidationError(
            `${path}.state='complete' requires reason.type='${EnyoDataBusCommandReasonTypeEnum.SessionComplete}' — completion is stated by whoever owns the goal, never inferred from a full progress bar.`,
        );
    }
}

/**
 * Checks that the signed power agrees with the state, so a row cannot say it is idle while
 * drawing kilowatts.
 *
 * @param participant - The row to check.
 * @param path - Where it sits in the payload, for the error message.
 * @throws {EnergyDistributionValidationError} When sign and state contradict each other.
 */
function validatePowerSign(
    participant: EnyoEnergyDistributionParticipant,
    path: string,
): void {
    const {state, powerW} = participant;
    if (state === EnyoDistributionParticipantStateEnum.Drawing && powerW < 0) {
        throw new EnergyDistributionValidationError(
            `${path}.state='drawing' but powerW=${powerW} is negative (that is supplying).`,
        );
    }
    if (state === EnyoDistributionParticipantStateEnum.Supplying && powerW > 0) {
        throw new EnergyDistributionValidationError(
            `${path}.state='supplying' but powerW=${powerW} is positive (that is drawing).`,
        );
    }
    const isIdle = state === EnyoDistributionParticipantStateEnum.Skipped
        || state === EnyoDistributionParticipantStateEnum.NotAsking
        || state === EnyoDistributionParticipantStateEnum.Complete;
    if (isIdle && powerW !== 0) {
        throw new EnergyDistributionValidationError(
            `${path}.state='${state}' must carry powerW=0, got ${powerW}.`,
        );
    }
}

/**
 * Checks the row's progress: measured rows have none, and a stated bar agrees with its own
 * numbers.
 *
 * @param participant - The row to check.
 * @param path - Where it sits in the payload, for the error message.
 * @throws {EnergyDistributionValidationError} On a bar that should not be there, or one whose
 *   percentage does not follow from its values.
 */
function validateProgressOf(
    participant: EnyoEnergyDistributionParticipant,
    path: string,
): void {
    const progress = participant.progress;
    if (progress === undefined) return;

    if (participant.kind !== EnyoDistributionParticipantKindEnum.Appliance) {
        throw new EnergyDistributionValidationError(
            `${path} is kind='${participant.kind}' and must not carry progress — household draw and feed-in are measured, not goals.`,
        );
    }
    validateProgress(progress, `${path}.progress`);
}

/**
 * Validates a progress triple and its derived percentage.
 *
 * @param progress - The progress to check.
 * @param path - Where it sits in the payload, for the error message.
 * @throws {EnergyDistributionValidationError} On a malformed triple or a disagreeing percentage.
 */
function validateProgress(progress: EnyoDistributionProgress, path: string): void {
    validateEnumValue(progress.unit, EnyoDistributionProgressUnitEnum, `${path}.unit`);
    validateFiniteNumber(progress.current, `${path}.current`);
    validateFiniteNumber(progress.target, `${path}.target`);
    if (progress.start !== undefined) validateFiniteNumber(progress.start, `${path}.start`);
    validateFiniteNumber(progress.percent, `${path}.percent`);

    const start = progress.start ?? 0;
    if (progress.target === start) {
        throw new EnergyDistributionValidationError(
            `${path}.target (${progress.target}) must differ from start (${start}) — a bar with no distance to travel cannot be filled.`,
        );
    }
    if (progress.percent < 0 || progress.percent > 100) {
        throw new EnergyDistributionValidationError(
            `${path}.percent must be within 0–100, got ${progress.percent}.`,
        );
    }

    const expected = progressPercent(progress);
    if (Math.abs(expected - progress.percent) > PERCENT_TOLERANCE) {
        throw new EnergyDistributionValidationError(
            `${path}.percent=${progress.percent} does not follow from start=${start}, current=${progress.current}, target=${progress.target} (expected ${expected}). Build it with makeProgress().`,
        );
    }
}

/**
 * Parses an ISO 8601 timestamp.
 *
 * @param value - The value to parse.
 * @param field - The field name, for the error message.
 * @returns The timestamp in epoch milliseconds.
 * @throws {EnergyDistributionValidationError} When the value is not a parseable ISO string.
 */
function parseIsoOrThrow(value: unknown, field: string): number {
    if (typeof value !== 'string' || value.length === 0) {
        throw new EnergyDistributionValidationError(
            `${field} must be a non-empty ISO 8601 string.`,
        );
    }
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) {
        throw new EnergyDistributionValidationError(
            `${field}='${value}' is not a valid ISO 8601 timestamp.`,
        );
    }
    return ms;
}

/**
 * Checks that a value is a finite number.
 *
 * @param value - The value to check.
 * @param field - The field name, for the error message.
 * @throws {EnergyDistributionValidationError} When it is not.
 */
function validateFiniteNumber(value: unknown, field: string): void {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new EnergyDistributionValidationError(
            `${field} must be a finite number, got ${String(value)}.`,
        );
    }
}

/**
 * Checks that a value is a member of an enum.
 *
 * @param value - The value to check.
 * @param enumObject - The enum it must belong to.
 * @param field - The field name, for the error message.
 * @throws {EnergyDistributionValidationError} When the value is not a member.
 */
function validateEnumValue(
    value: unknown,
    enumObject: Record<string, string>,
    field: string,
): void {
    const allowed = Object.values(enumObject);
    if (typeof value !== 'string' || !allowed.includes(value)) {
        throw new EnergyDistributionValidationError(
            `${field} must be one of: ${allowed.join(', ')}. Got: ${String(value)}.`,
        );
    }
}
