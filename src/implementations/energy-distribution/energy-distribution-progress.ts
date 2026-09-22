import {
    EnyoDistributionProgress,
    EnyoDistributionProgressUnitEnum,
} from '../../types/enyo-energy-distribution.js';
import {EnyoFlexibilityProgress} from '../../types/enyo-flexibility-announcement.js';

/**
 * The facts a caller states about a goal — the same triple a manager puts on
 * {@link EnyoFlexibilityAnnouncementContext.progress}, minus the derived percentage.
 */
export interface EnergyDistributionProgressInput {
    /** The unit {@link start}, {@link current} and {@link target} are expressed in. */
    unit: EnyoDistributionProgressUnitEnum;
    /**
     * Where the run began — the bar's zero. Defaults to `0`, which is right for an
     * energy target and wrong for a tank that started at 20 °C: state it whenever
     * the run did not start from nothing.
     */
    start?: number;
    /** Where the run stands now, measured. */
    current: number;
    /** The goal it is driving to. */
    target: number;
}

/**
 * Builds an {@link EnyoDistributionProgress} with its {@link EnyoDistributionProgress.percent}
 * computed — the single definition of how full a bar is.
 *
 * The percentage is `(current − start) / (target − start)`, clamped to 0–100 and rounded to one
 * decimal. It is carried on the wire rather than left to each consumer so the cockpit, the app
 * and a third-party display cannot disagree with one another by a rounding or clamping rule of
 * their own.
 *
 * Both clamps matter and neither is cosmetic:
 *
 * - **Above 100.** A measured delivery routinely overshoots a target that was revised
 *   mid-session, and a bar that renders 104 % reads as a bug rather than as a finished job.
 * - **Below 0.** A tank cooling below the temperature it started at, or a battery discharged
 *   under its starting state of charge, is at the beginning of its run, not at a negative
 *   fraction of it.
 *
 * A full bar is NOT the same as a finished run: completion is stated with
 * {@link EnyoDataBusCommandReasonTypeEnum.SessionComplete}, never inferred from this number.
 *
 * @param input - The stated facts: unit, optional start, current and target.
 * @returns The progress object, ready to put on a participant.
 * @throws {RangeError} When `target` equals `start`, or when any value is not finite — a bar
 *   with no distance to travel has no meaningful fill, and silently reporting `0` or `100` for
 *   it would hide a mis-stated goal.
 *
 * @example
 * ```typescript
 * // 8.4 kWh delivered of a 22 kWh session → 38.2 %
 * makeProgress({unit: EnyoDistributionProgressUnitEnum.Energy, current: 8400, target: 22000});
 *
 * // A tank at 31 °C that started at 20 °C and is heading for 48 °C → 39.3 %, not 64.6 %
 * makeProgress({
 *     unit: EnyoDistributionProgressUnitEnum.Temperature,
 *     start: 20,
 *     current: 31,
 *     target: 48,
 * });
 * ```
 */
export function makeProgress(input: EnergyDistributionProgressInput): EnyoDistributionProgress {
    const start = input.start ?? 0;
    assertFinite(start, 'start');
    assertFinite(input.current, 'current');
    assertFinite(input.target, 'target');
    if (input.target === start) {
        throw new RangeError(
            `Progress target (${input.target}) must differ from start (${start}) — a bar with no distance to travel cannot be filled.`,
        );
    }
    const progress: EnyoDistributionProgress = {
        unit: input.unit,
        current: input.current,
        target: input.target,
        percent: progressPercent(input),
    };
    if (input.start !== undefined) progress.start = input.start;
    return progress;
}

/**
 * The fill of the bar for `input`, 0–100 — the arithmetic behind {@link makeProgress}, exposed
 * on its own for consumers that hold a stated triple (an
 * {@link EnyoFlexibilityProgress} off an announcement, say) and want the percentage without
 * building a whole progress object.
 *
 * @param input - The stated facts: unit, optional start, current and target.
 * @returns The clamped percentage, rounded to one decimal.
 * @throws {RangeError} When `target` equals `start`, or when any value is not finite.
 */
export function progressPercent(input: EnergyDistributionProgressInput): number {
    const start = input.start ?? 0;
    assertFinite(start, 'start');
    assertFinite(input.current, 'current');
    assertFinite(input.target, 'target');
    const span = input.target - start;
    if (span === 0) {
        throw new RangeError(
            `Progress target (${input.target}) must differ from start (${start}) — a bar with no distance to travel cannot be filled.`,
        );
    }
    const fraction = (input.current - start) / span;
    return Math.round(Math.min(1, Math.max(0, fraction)) * 1000) / 10;
}

/**
 * Turns the goal a manager stated on an announcement
 * ({@link EnyoFlexibilityAnnouncementContext.progress}) into the progress a participant carries,
 * adding nothing but the percentage.
 *
 * This is the whole of what a publisher is allowed to do with a stated goal. Anything more —
 * remembering an earlier `requiredWh` to reconstruct the original target, inferring a target from
 * granted watts — is the consumer re-deriving what the producer already knew, and it is how a
 * nearly-finished session ends up drawing a flat bar.
 *
 * @param stated - The goal as the owning manager announced it.
 * @returns The same facts with {@link EnyoDistributionProgress.percent} filled in.
 * @throws {RangeError} When the stated target equals the stated start, or a value is not finite.
 *
 * @example
 * ```typescript
 * const stated = announcement.context?.progress;
 * const progress = stated ? progressFromAnnouncement(stated) : undefined;
 * ```
 */
export function progressFromAnnouncement(stated: EnyoFlexibilityProgress): EnyoDistributionProgress {
    return makeProgress(stated);
}

/**
 * Guards one field of a progress triple.
 *
 * @param value - The number to check.
 * @param field - The field name, so the thrown message names the offender.
 * @throws {RangeError} When `value` is not a finite number.
 */
function assertFinite(value: number, field: string): void {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new RangeError(`Progress ${field} must be a finite number, got ${String(value)}.`);
    }
}
