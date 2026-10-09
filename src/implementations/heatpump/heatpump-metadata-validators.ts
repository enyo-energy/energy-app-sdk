/**
 * Client-side validation for the advanced heatpump metadata an integration
 * publishes: heating curves ({@link EnyoHeatpumpApplianceHeatingCurve}), time
 * programs ({@link EnyoHeatpumpTimeProgram}) and the room-temperature wiring of
 * heating circuits.
 *
 * None of these shapes can be checked at the type level — a curve with one
 * point, an unsorted curve, `'25:00'` as a switching time or a period on day
 * `7` all compile — yet every consumer interpolating the curve or projecting
 * the program onto a timeline depends on them being well-formed.
 *
 * `errors` mean the value is malformed; `warnings` are advisory. Use the
 * `validate*` functions for the non-throwing result, or the `assertValid*`
 * variants to throw a {@link HeatpumpMetadataValidationError}.
 */

import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum,
    EnyoHeatpumpRoomTemperatureSourceEnum,
    EnyoHeatpumpTimeProgramLevelEnum,
} from '../../types/enyo-heatpump-appliance.js';
import type {
    EnyoHeatpumpApplianceHeatingCurve,
    EnyoHeatpumpApplianceHeatingCurvePoint,
    EnyoHeatpumpApplianceMetadata,
    EnyoHeatpumpTimeProgram,
} from '../../types/enyo-heatpump-appliance.js';

/**
 * Thrown by the `assertValid*` heatpump metadata validators when a value fails
 * validation. The message lists every blocking error so callers can surface
 * them directly.
 */
export class HeatpumpMetadataValidationError extends Error {
    /** The individual blocking errors that caused the failure. */
    public readonly errors: string[];

    /**
     * @param subject - What was validated (e.g. `heating curve`), used in the message.
     * @param errors - The blocking validation errors.
     */
    constructor(subject: string, errors: string[]) {
        super(`Invalid ${subject}:\n- ${errors.join('\n- ')}`);
        this.name = 'HeatpumpMetadataValidationError';
        this.errors = errors;
    }
}

/** The outcome of validating a piece of heatpump metadata. */
export interface HeatpumpMetadataValidationResult {
    /** True when there are no blocking errors. */
    ok: boolean;
    /** Blocking problems — the value is malformed. */
    errors: string[];
    /** Advisory problems — the value is usable but probably not what was meant. */
    warnings: string[];
}

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;
const TIME_OF_DAY = /^([01]\d|2[0-3]):([0-5]\d)$/;
const LEVELS = new Set<string>(Object.values(EnyoHeatpumpTimeProgramLevelEnum));

/**
 * Parses an `HH:mm` time of day into minutes since midnight.
 *
 * @param value - The time of day.
 * @param allowEndOfDay - Whether `'24:00'` (end of day) is accepted.
 * @returns Minutes since midnight, or `undefined` when malformed.
 */
function parseTimeOfDay(value: unknown, allowEndOfDay: boolean): number | undefined {
    if (typeof value !== 'string') return undefined;
    if (allowEndOfDay && value === '24:00') return MINUTES_PER_DAY;
    const match = TIME_OF_DAY.exec(value);
    if (!match) return undefined;
    return Number(match[1]) * 60 + Number(match[2]);
}

/** Whether `value` is a finite number. */
function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validates one list of curve points (heating or cooling) and appends the
 * problems to `errors` / `warnings`.
 */
function checkCurvePoints(
    points: EnyoHeatpumpApplianceHeatingCurvePoint[] | undefined,
    field: string,
    errors: string[],
): void {
    if (!Array.isArray(points) || points.length < 2) {
        errors.push(`${field} must contain at least 2 points`);
        return;
    }
    points.forEach((point, i) => {
        if (!isFiniteNumber(point?.outdoorTemperatureC) || !isFiniteNumber(point?.flowTemperatureC)) {
            errors.push(`${field}[${i}] must have finite outdoorTemperatureC and flowTemperatureC`);
        }
    });
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1]?.outdoorTemperatureC;
        const curr = points[i]?.outdoorTemperatureC;
        if (isFiniteNumber(prev) && isFiniteNumber(curr) && curr <= prev) {
            errors.push(
                `${field} must be sorted by strictly increasing outdoorTemperatureC ` +
                `(${field}[${i}] = ${curr} °C follows ${prev} °C)`,
            );
        }
    }
}

/**
 * Validates a heating curve.
 *
 * Errors: fewer than two points, non-finite values, points not sorted by
 * strictly increasing outdoor temperature (same rules for `coolingPoints`),
 * `minFlowTemperatureC` above `maxFlowTemperatureC`.
 *
 * Warnings: a heating curve whose flow temperature rises with the outdoor
 * temperature (almost certainly swapped axes), points outside the declared
 * min / max flow temperature.
 *
 * @param curve - The heating curve to validate.
 * @returns The validation result.
 */
export function validateHeatpumpHeatingCurve(
    curve: EnyoHeatpumpApplianceHeatingCurve,
): HeatpumpMetadataValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    checkCurvePoints(curve.points, 'points', errors);
    if (curve.coolingPoints !== undefined) {
        checkCurvePoints(curve.coolingPoints, 'coolingPoints', errors);
    }

    const {minFlowTemperatureC: min, maxFlowTemperatureC: max} = curve;
    if (min !== undefined && !isFiniteNumber(min)) errors.push('minFlowTemperatureC must be a finite number');
    if (max !== undefined && !isFiniteNumber(max)) errors.push('maxFlowTemperatureC must be a finite number');
    if (isFiniteNumber(min) && isFiniteNumber(max) && min > max) {
        errors.push(`minFlowTemperatureC (${min} °C) must not exceed maxFlowTemperatureC (${max} °C)`);
    }

    if (errors.length === 0) {
        const points = curve.points;
        for (let i = 1; i < points.length; i++) {
            if (points[i].flowTemperatureC > points[i - 1].flowTemperatureC) {
                warnings.push(
                    'points: flow temperature rises with outdoor temperature — a heating curve ' +
                    'should fall as it gets warmer outside',
                );
                break;
            }
        }
        const outside = points.filter(p =>
            (isFiniteNumber(min) && p.flowTemperatureC < min) ||
            (isFiniteNumber(max) && p.flowTemperatureC > max));
        if (outside.length > 0) {
            warnings.push(
                `points: ${outside.length} point(s) lie outside minFlowTemperatureC / maxFlowTemperatureC — ` +
                'report the clamped flow temperatures the heatpump actually targets',
            );
        }
    }

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Validates a heating curve and throws when it is malformed.
 *
 * @param curve - The heating curve to validate.
 * @returns The warnings of a successful validation.
 * @throws {HeatpumpMetadataValidationError} when there are blocking errors.
 */
export function assertValidHeatpumpHeatingCurve(curve: EnyoHeatpumpApplianceHeatingCurve): string[] {
    const result = validateHeatpumpHeatingCurve(curve);
    if (!result.ok) throw new HeatpumpMetadataValidationError('heating curve', result.errors);
    return result.warnings;
}

/**
 * Validates a time program.
 *
 * Errors: an unknown `defaultLevel` or period `level`, an empty or out-of-range
 * `daysOfWeek` (`0` = Sunday … `6` = Saturday), a start / end time that is not
 * `HH:mm` (end may be `'24:00'`), a period whose start equals its end,
 * non-finite setpoints.
 *
 * Warnings: duplicate days within one period, periods overlapping each other
 * (consumers then let the later entry win), a level used by a period that has
 * neither an explicit `targetTemperatureC` nor an entry in
 * `levelTemperaturesC` (except `Off`).
 *
 * @param program - The time program to validate.
 * @returns The validation result.
 */
export function validateHeatpumpTimeProgram(program: EnyoHeatpumpTimeProgram): HeatpumpMetadataValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!LEVELS.has(program.defaultLevel)) {
        errors.push(`defaultLevel '${String(program.defaultLevel)}' is not a known level`);
    }
    if (!Array.isArray(program.periods)) {
        errors.push('periods must be an array');
        return {ok: false, errors, warnings};
    }
    for (const [level, temperature] of Object.entries(program.levelTemperaturesC ?? {})) {
        if (!LEVELS.has(level)) errors.push(`levelTemperaturesC: '${level}' is not a known level`);
        if (!isFiniteNumber(temperature)) errors.push(`levelTemperaturesC.${level} must be a finite number`);
    }

    /** Week-relative minute intervals per period, for the overlap check. */
    const intervals: { index: number; from: number; to: number }[] = [];
    const levelsWithoutSetpoint = new Set<string>();

    program.periods.forEach((period, i) => {
        const field = `periods[${i}]`;
        if (!LEVELS.has(period.level)) {
            errors.push(`${field}.level '${String(period.level)}' is not a known level`);
        }
        if (period.targetTemperatureC !== undefined && !isFiniteNumber(period.targetTemperatureC)) {
            errors.push(`${field}.targetTemperatureC must be a finite number`);
        }

        const days = period.daysOfWeek;
        if (!Array.isArray(days) || days.length === 0) {
            errors.push(`${field}.daysOfWeek must contain at least one day`);
        } else {
            const invalid = days.filter(d => !Number.isInteger(d) || d < 0 || d > 6);
            if (invalid.length > 0) {
                errors.push(`${field}.daysOfWeek must only contain 0 (Sunday) … 6 (Saturday), got ${invalid.join(', ')}`);
            }
            if (new Set(days).size !== days.length) {
                warnings.push(`${field}.daysOfWeek contains duplicate days`);
            }
        }

        const start = parseTimeOfDay(period.startTimeOfDay, false);
        const end = parseTimeOfDay(period.endTimeOfDay, true);
        if (start === undefined) errors.push(`${field}.startTimeOfDay '${String(period.startTimeOfDay)}' is not HH:mm`);
        if (end === undefined) errors.push(`${field}.endTimeOfDay '${String(period.endTimeOfDay)}' is not HH:mm or '24:00'`);
        if (start !== undefined && end !== undefined && start === end % MINUTES_PER_DAY) {
            errors.push(`${field} starts and ends at the same time`);
        }

        if (
            period.targetTemperatureC === undefined &&
            period.level !== EnyoHeatpumpTimeProgramLevelEnum.Off &&
            program.levelTemperaturesC?.[period.level] === undefined
        ) {
            levelsWithoutSetpoint.add(period.level);
        }

        if (start !== undefined && end !== undefined && start !== end % MINUTES_PER_DAY && Array.isArray(days)) {
            const duration = (end - start + MINUTES_PER_DAY) % MINUTES_PER_DAY || MINUTES_PER_DAY;
            for (const day of new Set(days)) {
                if (!Number.isInteger(day) || day < 0 || day > 6) continue;
                const from = day * MINUTES_PER_DAY + start;
                intervals.push({index: i, from, to: from + duration});
            }
        }
    });

    for (const level of levelsWithoutSetpoint) {
        warnings.push(
            `level '${level}' is used without a targetTemperatureC on the period ` +
            'or an entry in levelTemperaturesC — its setpoint is unknown',
        );
    }

    const overlapping = new Set<string>();
    for (let a = 0; a < intervals.length; a++) {
        for (let b = a + 1; b < intervals.length; b++) {
            const x = intervals[a];
            const y = intervals[b];
            if (x.index === y.index) continue;
            // Compare in the week and shifted by one week, so a Saturday period
            // wrapping into Sunday is caught against Sunday's periods.
            const overlaps = [-MINUTES_PER_WEEK, 0, MINUTES_PER_WEEK]
                .some(shift => x.from < y.to + shift && y.from + shift < x.to);
            if (overlaps) {
                overlapping.add(`periods[${Math.min(x.index, y.index)}] and periods[${Math.max(x.index, y.index)}]`);
            }
        }
    }
    for (const pair of overlapping) {
        warnings.push(`${pair} overlap — the later entry wins`);
    }

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Validates a time program and throws when it is malformed.
 *
 * @param program - The time program to validate.
 * @returns The warnings of a successful validation.
 * @throws {HeatpumpMetadataValidationError} when there are blocking errors.
 */
export function assertValidHeatpumpTimeProgram(program: EnyoHeatpumpTimeProgram): string[] {
    const result = validateHeatpumpTimeProgram(program);
    if (!result.ok) throw new HeatpumpMetadataValidationError('time program', result.errors);
    return result.warnings;
}

/**
 * Validates the advanced parts of a heatpump's metadata in one go: every
 * heating circuit's heating curve, time program and room-temperature wiring,
 * and every DHW zone's time program. Problems are prefixed with their path
 * (e.g. `heatingCircuits[index=1].heatingCurve: …`).
 *
 * Additional rules:
 *  - Error: duplicate `index` values among heating circuits or DHW zones.
 *  - Warning: `roomTemperatureSource` is `External` but no
 *    `roomTemperatureSensor` is linked, or a sensor is linked while the source
 *    is not `External`.
 *  - Warning: a circuit links an external sensor but the heatpump does not
 *    declare `RoomTemperatureInput` — the readings cannot be forwarded.
 *
 * @param metadata - The heatpump metadata to validate.
 * @returns The validation result.
 */
export function validateHeatpumpAdvancedMetadata(
    metadata: Pick<EnyoHeatpumpApplianceMetadata, 'availableFeatures' | 'heatingCircuits' | 'domesticHotWater'>,
): HeatpumpMetadataValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const merge = (prefix: string, result: HeatpumpMetadataValidationResult) => {
        errors.push(...result.errors.map(e => `${prefix}: ${e}`));
        warnings.push(...result.warnings.map(w => `${prefix}: ${w}`));
    };
    const checkUniqueIndexes = (field: string, indexes: number[]) => {
        const duplicates = indexes.filter((index, i) => indexes.indexOf(index) !== i);
        if (duplicates.length > 0) {
            errors.push(`${field} contains duplicate index ${[...new Set(duplicates)].join(', ')}`);
        }
    };

    const circuits = metadata.heatingCircuits ?? [];
    const dhwZones = metadata.domesticHotWater ?? [];
    checkUniqueIndexes('heatingCircuits', circuits.map(c => c.index));
    checkUniqueIndexes('domesticHotWater', dhwZones.map(z => z.index));

    const acceptsRoomTemperature = (metadata.availableFeatures ?? []).includes(
        EnyoHeatpumpApplianceAvailableFeaturesEnum.RoomTemperatureInput,
    );

    for (const circuit of circuits) {
        const prefix = `heatingCircuits[index=${circuit.index}]`;
        if (circuit.heatingCurve) merge(`${prefix}.heatingCurve`, validateHeatpumpHeatingCurve(circuit.heatingCurve));
        if (circuit.timeProgram) merge(`${prefix}.timeProgram`, validateHeatpumpTimeProgram(circuit.timeProgram));

        const isExternal = circuit.roomTemperatureSource === EnyoHeatpumpRoomTemperatureSourceEnum.External;
        if (isExternal && !circuit.roomTemperatureSensor) {
            warnings.push(`${prefix}: roomTemperatureSource is External but no roomTemperatureSensor is linked`);
        }
        if (circuit.roomTemperatureSensor && !isExternal) {
            warnings.push(`${prefix}: roomTemperatureSensor is linked but roomTemperatureSource is not External`);
        }
        if (circuit.roomTemperatureSensor && !acceptsRoomTemperature) {
            warnings.push(
                `${prefix}: an external room sensor is linked but the heatpump does not declare ` +
                'RoomTemperatureInput — its readings cannot be forwarded',
            );
        }
    }
    for (const zone of dhwZones) {
        if (zone.timeProgram) {
            merge(`domesticHotWater[index=${zone.index}].timeProgram`, validateHeatpumpTimeProgram(zone.timeProgram));
        }
    }

    return {ok: errors.length === 0, errors, warnings};
}
