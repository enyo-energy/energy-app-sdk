/**
 * Validation for the weekly legionella program shared by heat pumps and
 * heating rods: the slot format ({@link EnyoLegionellaSlot}), the metadata an
 * integration reports ({@link EnyoLegionellaProgramMetadata}) and the
 * {@link EnyoDataBusSetLegionellaScheduleV1} command.
 */

import {EnyoCommandAcknowledgeAnswerEnum, EnyoDataBusMessageEnum} from '../../types/enyo-data-bus-value.js';
import type {EnyoDataBusLegionellaStatusV1, EnyoDataBusSetLegionellaScheduleV1} from '../../types/enyo-data-bus-value.js';
import type {EnyoSourceEnum} from '../../types/enyo-source.enum.js';
import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum,
} from '../../types/enyo-heatpump-appliance.js';
import type {EnyoHeatpumpApplianceMetadata} from '../../types/enyo-heatpump-appliance.js';
import {EnyoHeatingRodApplianceAvailableFeaturesEnum} from '../../types/enyo-heating-rod-appliance.js';
import type {EnyoHeatingRodApplianceMetadata} from '../../types/enyo-heating-rod-appliance.js';
import {
    EnyoLegionellaRunStateEnum,
    EnyoLegionellaSlotAdjustableEnum,
    LEGIONELLA_PROGRAM_MAX_GAP_HOURS,
    LEGIONELLA_PROGRAM_MIN_LEAD_MINUTES,
} from '../../types/enyo-legionella.js';
import type {EnyoLegionellaProgramMetadata, EnyoLegionellaSlot} from '../../types/enyo-legionella.js';

/** `HH:mm` from `00:00` to `23:59`. */
const TIME_OF_DAY = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ADJUSTABLE = new Set<string>(Object.values(EnyoLegionellaSlotAdjustableEnum));

/** The answer {@link validateLegionellaSchedule} and its appliance variants give. */
export interface LegionellaScheduleValidationResult {
    /** `Accepted` when every rule holds. */
    answer: EnyoCommandAcknowledgeAnswerEnum;
    /** Why the command was rejected or is not supported. */
    rejectionReason?: string;
}

/** The outcome of {@link validateLegionellaProgramMetadata}. */
export interface LegionellaProgramMetadataValidationResult {
    /** `true` when there are no errors. */
    ok: boolean;
    /** Problems that make the metadata wrong. */
    errors: string[];
    /** Advisory findings. */
    warnings: string[];
}

/**
 * Whether a value is a parsable ISO 8601 timestamp.
 *
 * @param value - The value to check.
 * @returns `true` for a string `Date.parse` understands.
 */
function isIsoTimestamp(value: unknown): value is string {
    return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

/**
 * Whether a value is a finite number greater than `0`.
 *
 * @param value - The value to check.
 * @returns `true` for a positive finite number.
 */
function isPositiveFinite(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * The problems of a {@link EnyoLegionellaSlot}: `dayOfWeek` must be an
 * integer `0` (Sunday) … `6` (Saturday), `timeOfDay` a `HH:mm` time from
 * `00:00` to `23:59`.
 *
 * @param slot - The slot to check.
 * @param path - Path of the slot for the messages, e.g. `slot`.
 * @returns The problems; empty when the slot is well-formed.
 *
 * @example
 * ```ts
 * legionellaSlotErrors({dayOfWeek: 6, timeOfDay: '01:00'}, 'slot'); // []
 * legionellaSlotErrors({dayOfWeek: 7, timeOfDay: '25:00'}, 'slot'); // two errors
 * ```
 */
export function legionellaSlotErrors(slot: unknown, path: string): string[] {
    if (typeof slot !== 'object' || slot === null) return [`${path} must be an object`];
    const {dayOfWeek, timeOfDay} = slot as Partial<EnyoLegionellaSlot>;
    const errors: string[] = [];
    if (!Number.isInteger(dayOfWeek) || (dayOfWeek as number) < 0 || (dayOfWeek as number) > 6) {
        errors.push(`${path}.dayOfWeek must be an integer 0 (Sunday) … 6 (Saturday); got ${String(dayOfWeek)}`);
    }
    if (typeof timeOfDay !== 'string' || !TIME_OF_DAY.test(timeOfDay)) {
        errors.push(`${path}.timeOfDay must be HH:mm between 00:00 and 23:59; got ${String(timeOfDay)}`);
    }
    return errors;
}

/**
 * Whether two legionella slots are the same weekday and time.
 *
 * @param a - The first slot.
 * @param b - The second slot.
 * @returns `true` when both name the same weekday and time of day.
 */
export function legionellaSlotsEqual(a: EnyoLegionellaSlot, b: EnyoLegionellaSlot): boolean {
    return a.dayOfWeek === b.dayOfWeek && a.timeOfDay === b.timeOfDay;
}

/**
 * Minutes since midnight of a well-formed `HH:mm` time.
 *
 * @param timeOfDay - The time, already known to be valid.
 * @returns The minutes since midnight.
 */
function minutesOfDay(timeOfDay: string): number {
    const [hours, minutes] = timeOfDay.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Validates the {@link EnyoLegionellaProgramMetadata} an integration reports
 * for a heat pump's hot water zone or a heating rod.
 *
 * - Error: `ownerSlot`, `activeSlot` or `energyManagerSlot` is malformed
 *   ({@link legionellaSlotErrors}).
 * - Error: `adjustable` is not an {@link EnyoLegionellaSlotAdjustableEnum}
 *   value; `granularityMinutes` is not a positive integer dividing a day;
 *   `targetTemperatureC` is not finite; `estimatedDurationMinutes` is not
 *   positive; `lastCompletedIso` is not an ISO 8601 timestamp.
 * - Error: the appliance declares `LegionellaSchedule` (`scheduleDeclared`)
 *   but `adjustable` is missing — nothing could be written.
 * - Warning: `adjustable` is set without `LegionellaSchedule` — it is
 *   ignored, the energy manager only recommends.
 * - Warning: `targetTemperatureC` is below 60 °C, which is not enough for
 *   thermal disinfection.
 *
 * @param program - The reported program.
 * @param scheduleDeclared - Whether the appliance declares the feature
 *   `LegionellaSchedule`.
 * @returns The validation result.
 */
export function validateLegionellaProgramMetadata(
    program: EnyoLegionellaProgramMetadata,
    scheduleDeclared: boolean,
): LegionellaProgramMetadataValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    errors.push(...legionellaSlotErrors(program.ownerSlot, 'ownerSlot'));
    if (program.activeSlot !== undefined) errors.push(...legionellaSlotErrors(program.activeSlot, 'activeSlot'));
    if (program.energyManagerSlot !== undefined) {
        errors.push(...legionellaSlotErrors(program.energyManagerSlot, 'energyManagerSlot'));
    }

    if (program.adjustable === undefined) {
        if (scheduleDeclared) errors.push('LegionellaSchedule is declared but adjustable is missing');
    } else if (!ADJUSTABLE.has(program.adjustable)) {
        errors.push(`adjustable "${String(program.adjustable)}" is not a valid value`);
    } else if (!scheduleDeclared) {
        warnings.push('adjustable is set but LegionellaSchedule is not declared — the slot is only recommended');
    }

    const granularity = program.granularityMinutes;
    if (granularity !== undefined && (!Number.isInteger(granularity) || granularity <= 0 || 1440 % granularity !== 0)) {
        errors.push(`granularityMinutes must be a positive integer that divides a day; got ${String(granularity)}`);
    }
    if (program.targetTemperatureC !== undefined) {
        if (typeof program.targetTemperatureC !== 'number' || !Number.isFinite(program.targetTemperatureC)) {
            errors.push('targetTemperatureC must be a finite number');
        } else if (program.targetTemperatureC < 60) {
            warnings.push(`targetTemperatureC ${program.targetTemperatureC} °C is below the 60 °C thermal disinfection needs`);
        }
    }
    if (program.estimatedDurationMinutes !== undefined && !isPositiveFinite(program.estimatedDurationMinutes)) {
        errors.push('estimatedDurationMinutes must be a finite number greater than 0');
    }
    if (program.lastCompletedIso !== undefined && !isIsoTimestamp(program.lastCompletedIso)) {
        errors.push('lastCompletedIso must be an ISO 8601 timestamp');
    }
    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Validates a {@link EnyoDataBusSetLegionellaScheduleV1} against the
 * legionella program it targets and returns the answer it deserves. Use the
 * appliance variants {@link validateHeatpumpLegionellaSchedule} and
 * {@link validateHeatingRodLegionellaSchedule}, which find the program and
 * the feature for you.
 *
 * Rules, in order — the first that fails decides:
 * 1. Malformed data (**Rejected**): `slot` is malformed, `nextRunIso` or
 *    `ownerRunIso` is not an ISO 8601 timestamp, `restored` is not a boolean, or
 *    `domesticHotWaterIndex` is not a non-negative integer.
 * 2. The feature `LegionellaSchedule` is not declared, the program is not
 *    reported, or `adjustable` is missing (**NotSupported**).
 * 3. `adjustable` is `TimeOnly` and the slot names another weekday than
 *    `ownerSlot` (**NotSupported**).
 * 4. The slot's time is not on the `granularityMinutes` grid (**NotSupported**).
 * 5. `restored` is set but the slot is not `ownerSlot` (**Rejected**).
 * 6. `nextRunIso` is not in the future (**Rejected**).
 * 7. Not `restored` and the owner's run (`ownerRunIso`) is less than
 *    {@link LEGIONELLA_PROGRAM_MIN_LEAD_MINUTES} away or already passed — the
 *    device may be heating already, and the week would run twice
 *    (**Rejected**).
 * 8. Not `restored`, the device reports `lastCompletedIso`, and `nextRunIso`
 *    lies more than {@link LEGIONELLA_PROGRAM_MAX_GAP_HOURS} after it — a week
 *    would be skipped (**Rejected**).
 *
 * @param data - The command's data.
 * @param program - The targeted program, `undefined` when not reported.
 * @param scheduleDeclared - Whether the appliance declares `LegionellaSchedule`.
 * @param nowMs - The current time in epoch milliseconds; defaults to now.
 * @returns `Accepted`, or the answer and reason of the first failing rule.
 */
export function validateLegionellaSchedule(
    data: EnyoDataBusSetLegionellaScheduleV1['data'],
    program: EnyoLegionellaProgramMetadata | undefined,
    scheduleDeclared: boolean,
    nowMs: number = Date.now(),
): LegionellaScheduleValidationResult {
    const rejected = (rejectionReason: string) => ({answer: EnyoCommandAcknowledgeAnswerEnum.Rejected, rejectionReason});
    const notSupported = (rejectionReason: string) => ({answer: EnyoCommandAcknowledgeAnswerEnum.NotSupported, rejectionReason});

    const slotErrors = legionellaSlotErrors(data?.slot, 'slot');
    if (slotErrors.length > 0) return rejected(slotErrors.join('; '));
    if (!isIsoTimestamp(data.nextRunIso)) return rejected(`nextRunIso must be an ISO 8601 timestamp; got ${String(data.nextRunIso)}`);
    if (!isIsoTimestamp(data.ownerRunIso)) return rejected(`ownerRunIso must be an ISO 8601 timestamp; got ${String(data.ownerRunIso)}`);
    if (data.restored !== undefined && typeof data.restored !== 'boolean') {
        return rejected(`restored must be a boolean; got ${String(data.restored)}`);
    }
    const index = data.domesticHotWaterIndex;
    if (index !== undefined && (!Number.isInteger(index) || index < 0)) {
        return rejected(`domesticHotWaterIndex must be a non-negative integer; got ${String(index)}`);
    }

    if (!scheduleDeclared) return notSupported('The appliance does not declare LegionellaSchedule');
    if (!program) return notSupported('The appliance reports no legionella program for this zone');
    if (program.adjustable === undefined) return notSupported('The legionella program does not state which parts are adjustable');

    if (program.adjustable === EnyoLegionellaSlotAdjustableEnum.TimeOnly && data.slot.dayOfWeek !== program.ownerSlot.dayOfWeek) {
        return notSupported(
            `Only the time can be changed; the weekday must stay ${program.ownerSlot.dayOfWeek}, got ${data.slot.dayOfWeek}`,
        );
    }
    const granularity = program.granularityMinutes;
    if (granularity !== undefined && granularity > 0 && minutesOfDay(data.slot.timeOfDay) % granularity !== 0) {
        return notSupported(`timeOfDay ${data.slot.timeOfDay} is not on the ${granularity}-minute grid of the device`);
    }

    if (data.restored === true && !legionellaSlotsEqual(data.slot, program.ownerSlot)) {
        return rejected(
            `restored is set but slot ${data.slot.dayOfWeek} ${data.slot.timeOfDay} is not the owner's slot ` +
            `${program.ownerSlot.dayOfWeek} ${program.ownerSlot.timeOfDay}`,
        );
    }
    const nextRunMs = Date.parse(data.nextRunIso);
    if (nextRunMs <= nowMs) return rejected(`nextRunIso ${data.nextRunIso} is not in the future`);
    if (data.restored !== true && Date.parse(data.ownerRunIso) - LEGIONELLA_PROGRAM_MIN_LEAD_MINUTES * 60_000 < nowMs) {
        return rejected(
            `The owner's run at ${data.ownerRunIso} is less than ${LEGIONELLA_PROGRAM_MIN_LEAD_MINUTES} min away or has ` +
            'passed — the device may already be heating',
        );
    }
    if (data.restored !== true && program.lastCompletedIso !== undefined && isIsoTimestamp(program.lastCompletedIso)) {
        const deadlineMs = Date.parse(program.lastCompletedIso) + LEGIONELLA_PROGRAM_MAX_GAP_HOURS * 3_600_000;
        if (nextRunMs > deadlineMs) {
            return rejected(
                `nextRunIso ${data.nextRunIso} is more than ${LEGIONELLA_PROGRAM_MAX_GAP_HOURS} h after the last run ` +
                `${program.lastCompletedIso} — a week would be skipped`,
            );
        }
    }
    return {answer: EnyoCommandAcknowledgeAnswerEnum.Accepted};
}

/**
 * Validates a {@link EnyoDataBusSetLegionellaScheduleV1} addressed to a heat
 * pump: finds the domestic-hot-water zone by `domesticHotWaterIndex` (the
 * first zone when omitted), checks the feature
 * {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.LegionellaSchedule} and
 * applies {@link validateLegionellaSchedule}.
 *
 * Used by `HeatpumpIntegrationEnergyApp` before it calls
 * `handleLegionellaSchedule`; the energy manager can use it before sending.
 *
 * @param data - The command's data.
 * @param metadata - The heat pump's metadata; `undefined` when unknown.
 * @param nowMs - The current time in epoch milliseconds; defaults to now.
 * @returns The answer the command deserves.
 *
 * @example
 * ```ts
 * const result = validateHeatpumpLegionellaSchedule(message.data, appliance.metadata.heatpump);
 * if (result.answer !== EnyoCommandAcknowledgeAnswerEnum.Accepted) console.warn(result.rejectionReason);
 * ```
 */
export function validateHeatpumpLegionellaSchedule(
    data: EnyoDataBusSetLegionellaScheduleV1['data'],
    metadata: EnyoHeatpumpApplianceMetadata | undefined,
    nowMs: number = Date.now(),
): LegionellaScheduleValidationResult {
    const declared = (metadata?.availableFeatures ?? []).includes(EnyoHeatpumpApplianceAvailableFeaturesEnum.LegionellaSchedule);
    const zones = metadata?.domesticHotWater ?? [];
    const index = data?.domesticHotWaterIndex;
    const zone = index === undefined ? zones[0] : zones.find((z) => z.index === index);
    return validateLegionellaSchedule(data, zone?.legionella, declared, nowMs);
}

/**
 * Validates a {@link EnyoDataBusSetLegionellaScheduleV1} addressed to a
 * heating rod: checks the feature
 * {@link EnyoHeatingRodApplianceAvailableFeaturesEnum.LegionellaSchedule} and
 * applies {@link validateLegionellaSchedule} to
 * {@link EnyoHeatingRodApplianceMetadata.legionella}.
 *
 * Heating rods have no integration base class: call it in your own data bus
 * listener and answer with the result when it is not `Accepted`.
 *
 * @param data - The command's data.
 * @param metadata - The heating rod's metadata; `undefined` when unknown.
 * @param nowMs - The current time in epoch milliseconds; defaults to now.
 * @returns The answer the command deserves.
 *
 * @example
 * ```ts
 * dataBus.listenForMessages([EnyoDataBusMessageEnum.SetLegionellaScheduleV1], async (msg) => {
 *     const message = msg as EnyoDataBusSetLegionellaScheduleV1;
 *     const result = validateHeatingRodLegionellaSchedule(message.data, rodMetadata);
 *     if (result.answer === EnyoCommandAcknowledgeAnswerEnum.Accepted) {
 *         await device.writeLegionellaStart(message.data.slot);
 *     }
 *     // … send the CommandAcknowledgeV1 with result.answer / result.rejectionReason
 * });
 * ```
 */
export function validateHeatingRodLegionellaSchedule(
    data: EnyoDataBusSetLegionellaScheduleV1['data'],
    metadata: EnyoHeatingRodApplianceMetadata | undefined,
    nowMs: number = Date.now(),
): LegionellaScheduleValidationResult {
    const declared = (metadata?.availableFeatures ?? []).includes(EnyoHeatingRodApplianceAvailableFeaturesEnum.LegionellaSchedule);
    return validateLegionellaSchedule(data, metadata?.legionella, declared, nowMs);
}

/**
 * The program after the integration accepted a
 * {@link EnyoDataBusSetLegionellaScheduleV1} and wrote its slot: `activeSlot`
 * is the written slot, `energyManagerSlot` is set to it — or cleared when the
 * command `restored` the owner's slot. `ownerSlot` never changes here.
 *
 * `HeatpumpIntegrationEnergyApp` applies it for you after an `Accepted`
 * answer; a heating rod app calls it and saves the result.
 *
 * @param program - The program before the command.
 * @param data - The accepted command's data.
 * @returns The updated program; the input is not modified.
 */
export function applyLegionellaSchedule(
    program: EnyoLegionellaProgramMetadata,
    data: EnyoDataBusSetLegionellaScheduleV1['data'],
): EnyoLegionellaProgramMetadata {
    const {energyManagerSlot: _previous, ...rest} = program;
    return data.restored === true
        ? {...rest, activeSlot: {...program.ownerSlot}}
        : {...rest, activeSlot: {...data.slot}, energyManagerSlot: {...data.slot}};
}

/** The outcome of {@link reconcileLegionellaProgram}. */
export interface LegionellaReconcileResult {
    /** The program to report from now on. */
    program: EnyoLegionellaProgramMetadata;
    /**
     * `true` when the owner set a slot on the device by hand: it became the
     * new `ownerSlot`, and a slot the energy manager wrote is forgotten.
     */
    ownerChanged: boolean;
}

/**
 * Brings the reported program in line with the slot read from the device, and
 * tells whether the owner changed it by hand. Call it every time the app
 * reads the legionella slot from the device, and save the returned program.
 *
 * - The device holds `energyManagerSlot` → the energy manager's slot is in
 *   effect; only `activeSlot` is updated.
 * - No `energyManagerSlot` and the device holds `ownerSlot` → nothing changed.
 * - Anything else → the owner changed it: `ownerSlot` and `activeSlot` become
 *   the device's slot, `energyManagerSlot` is cleared, `ownerChanged` is
 *   `true`. The energy manager then plans from the new slot and ends a running
 *   recommendation as `ChangedOnDevice`.
 *
 * @param program - The program as last reported.
 * @param deviceSlot - The slot read from the device now.
 * @returns The program to report and whether the owner changed it.
 *
 * @example
 * ```ts
 * const {program, ownerChanged} = reconcileLegionellaProgram(zone.legionella, await device.readLegionellaStart());
 * await applianceManager.updateHeatpumpDomesticHotWater(applianceId, 0, {legionella: program});
 * if (ownerChanged) logger.info('Owner moved the legionella program on the device');
 * ```
 */
export function reconcileLegionellaProgram(
    program: EnyoLegionellaProgramMetadata,
    deviceSlot: EnyoLegionellaSlot,
): LegionellaReconcileResult {
    const slot = {...deviceSlot};
    if (program.energyManagerSlot !== undefined && legionellaSlotsEqual(program.energyManagerSlot, deviceSlot)) {
        return {program: {...program, activeSlot: slot}, ownerChanged: false};
    }
    if (program.energyManagerSlot === undefined && legionellaSlotsEqual(program.ownerSlot, deviceSlot)) {
        return {program: {...program, activeSlot: slot}, ownerChanged: false};
    }
    const {energyManagerSlot: _forgotten, ...rest} = program;
    return {program: {...rest, ownerSlot: slot, activeSlot: {...slot}}, ownerChanged: true};
}

/**
 * The parts of an instant as wall-clock time in a timezone.
 *
 * @param ms - Epoch milliseconds.
 * @param timeZone - IANA timezone, e.g. `Europe/Berlin`.
 * @returns Year, month (1–12), day, hour and minute in that timezone.
 */
function zonedParts(ms: number, timeZone: string): {year: number; month: number; day: number; hour: number; minute: number} {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(ms));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return {year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute')};
}

/**
 * The epoch milliseconds of a wall-clock time in a timezone. A time skipped by
 * a DST change comes out shifted by the gap (02:30 → 03:30).
 *
 * @param year - Year.
 * @param month - Month, 1–12.
 * @param day - Day of the month.
 * @param minutes - Minutes since midnight.
 * @param timeZone - IANA timezone.
 * @returns Epoch milliseconds.
 */
function zonedToEpoch(year: number, month: number, day: number, minutes: number, timeZone: string): number {
    const asUtc = Date.UTC(year, month - 1, day, 0, minutes);
    const offsetAt = (ms: number) => {
        const p = zonedParts(ms, timeZone);
        return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(ms / 60_000) * 60_000;
    };
    const first = asUtc - offsetAt(asUtc);
    return asUtc - offsetAt(first);
}

/**
 * The next start of a weekly legionella slot after `now`, as an ISO 8601
 * timestamp (UTC). The slot is local wall-clock time in `timeZone`, so the
 * result follows DST changes.
 *
 * Use it for `nextRunIso` and `ownerRunIso` of
 * {@link EnyoDataBusSetLegionellaScheduleV1}, so the energy manager and the
 * integration compute the same instant. The owner's run of the week that a
 * moved slot replaces is `nextLegionellaRunIso(ownerSlot, …)` taken at the
 * time the energy manager plans.
 *
 * @param slot - The slot (weekday and local time).
 * @param timeZone - IANA timezone of the site, e.g. `Europe/Berlin`.
 * @param now - The reference time; defaults to now. A slot exactly at `now`
 *   counts as next week's.
 * @returns The next start, ISO 8601.
 * @throws {Error} When the slot is malformed or the timezone unknown.
 *
 * @example
 * ```ts
 * // Thursday 2026-11-26, 10:00 in Berlin → Saturday 01:00 local:
 * nextLegionellaRunIso({dayOfWeek: 6, timeOfDay: '01:00'}, 'Europe/Berlin', Date.parse('2026-11-26T09:00:00Z'));
 * // '2026-11-28T00:00:00.000Z'
 * ```
 */
export function nextLegionellaRunIso(slot: EnyoLegionellaSlot, timeZone: string, now: Date | number = Date.now()): string {
    const errors = legionellaSlotErrors(slot, 'slot');
    if (errors.length > 0) throw new Error(errors.join('; '));
    const nowMs = typeof now === 'number' ? now : now.getTime();
    const today = zonedParts(nowMs, timeZone);
    const minutes = minutesOfDay(slot.timeOfDay);
    for (let offset = 0; offset <= 8; offset++) {
        const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
        if (date.getUTCDay() !== slot.dayOfWeek) continue;
        const start = zonedToEpoch(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), minutes, timeZone);
        if (start > nowMs) return new Date(start).toISOString();
    }
    throw new Error(`No next run found for slot ${slot.dayOfWeek} ${slot.timeOfDay} in ${timeZone}`);
}

/** The outcome of {@link validateLegionellaStatusMessage}. */
export interface LegionellaStatusValidationResult {
    /** `true` when there are no errors. */
    ok: boolean;
    /** Problems that make the message wrong. */
    errors: string[];
}

const RUN_STATES = new Set<string>(Object.values(EnyoLegionellaRunStateEnum));

/**
 * Checks a {@link EnyoDataBusLegionellaStatusV1} before it is sent or shown:
 * - `applianceId` is non-empty, `state` is a known value, `slot` is
 *   well-formed, `movedByEnergyManager` is a boolean, `domesticHotWaterIndex`
 *   (when set) a non-negative integer, `reachedTemperatureC` (when set) finite;
 * - every timestamp that is set is ISO 8601;
 * - `Scheduled` has `nextRunIso`; `Running`, `Completed` and `Failed` have
 *   `startedIso`; `Completed` has `completedIso`; `Failed` has a non-empty
 *   `failureReason`, and only `Failed` has one.
 *
 * @param message - The status message.
 * @returns The validation result; `ok` is `false` when there are errors.
 */
export function validateLegionellaStatusMessage(message: EnyoDataBusLegionellaStatusV1): LegionellaStatusValidationResult {
    const errors: string[] = [];
    if (typeof message?.applianceId !== 'string' || message.applianceId.length === 0) {
        errors.push('applianceId must be a non-empty string');
    }
    const data = (message?.data ?? {}) as Partial<EnyoDataBusLegionellaStatusV1['data']>;
    const {state} = data;
    if (typeof state !== 'string' || !RUN_STATES.has(state)) {
        errors.push(`state must be an EnyoLegionellaRunStateEnum value, got ${String(state)}`);
    }
    errors.push(...legionellaSlotErrors(data.slot, 'slot'));
    if (typeof data.movedByEnergyManager !== 'boolean') errors.push('movedByEnergyManager must be a boolean');
    const index = data.domesticHotWaterIndex;
    if (index !== undefined && (!Number.isInteger(index) || index < 0)) {
        errors.push('domesticHotWaterIndex must be a non-negative integer');
    }
    if (data.reachedTemperatureC !== undefined
        && (typeof data.reachedTemperatureC !== 'number' || !Number.isFinite(data.reachedTemperatureC))) {
        errors.push('reachedTemperatureC must be a finite number');
    }
    for (const field of ['nextRunIso', 'startedIso', 'completedIso'] as const) {
        if (data[field] !== undefined && !isIsoTimestamp(data[field])) errors.push(`${field} must be an ISO 8601 timestamp`);
    }
    const {Scheduled, Running, Completed, Failed} = EnyoLegionellaRunStateEnum;
    if (state === Scheduled && data.nextRunIso === undefined) errors.push('nextRunIso is required when state is scheduled');
    if ((state === Running || state === Completed || state === Failed) && data.startedIso === undefined) {
        errors.push(`startedIso is required when state is ${state}`);
    }
    if (state === Completed && data.completedIso === undefined) errors.push('completedIso is required when state is completed');
    if (state === Failed) {
        if (typeof data.failureReason !== 'string' || data.failureReason.length === 0) {
            errors.push('failureReason is required when state is failed');
        }
    } else if (data.failureReason !== undefined) {
        errors.push(`failureReason is only allowed when state is failed, got state ${String(state)}`);
    }
    return {ok: errors.length === 0, errors};
}

/**
 * Builds a {@link EnyoDataBusLegionellaStatusV1}, validated with
 * {@link validateLegionellaStatusMessage}. For heating rod apps, which have no
 * integration base class; heat pump integrations use
 * `HeatpumpIntegrationEnergyApp.publishLegionellaStatus`.
 *
 * @param applianceId - The heat pump or heating rod.
 * @param data - The run's status.
 * @param source - The sender's source, usually `EnyoSourceEnum.Device`.
 * @returns The message, ready for `useDataBus().sendMessage([message])`.
 * @throws {Error} When the status is invalid.
 *
 * @example
 * ```ts
 * energyApp.useDataBus().sendMessage([buildLegionellaStatusMessage('rod-1', {
 *     state: EnyoLegionellaRunStateEnum.Running,
 *     slot: {dayOfWeek: 6, timeOfDay: '13:00'},
 *     movedByEnergyManager: true,
 *     startedIso: new Date().toISOString(),
 * }, EnyoSourceEnum.Device)]);
 * ```
 */
export function buildLegionellaStatusMessage(
    applianceId: string,
    data: EnyoDataBusLegionellaStatusV1['data'],
    source: EnyoSourceEnum,
): EnyoDataBusLegionellaStatusV1 {
    const message: EnyoDataBusLegionellaStatusV1 = {
        id: globalThis.crypto.randomUUID(),
        type: 'message',
        message: EnyoDataBusMessageEnum.LegionellaStatusV1,
        source,
        applianceId,
        timestampIso: new Date().toISOString(),
        data,
    };
    const validation = validateLegionellaStatusMessage(message);
    if (!validation.ok) throw new Error(`Invalid LegionellaStatusV1:\n- ${validation.errors.join('\n- ')}`);
    return message;
}
