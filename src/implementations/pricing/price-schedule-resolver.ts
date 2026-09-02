import {
    EnyoAbsolutePriceWindow,
    EnyoPriceSchedule,
    EnyoPriceScheduleTypeEnum,
    EnyoRecurringPriceWindow,
    EnyoResolvedPriceEntry,
} from '../../types/enyo-price-schedule.js';

/**
 * Length of one resolved interval, in minutes. Matches the resolution of
 * `useElectricityPrices().getPrices()` so resolved schedules can be combined
 * with a price series interval by interval.
 */
export const PRICE_SCHEDULE_INTERVAL_MINUTES = 15;

const INTERVAL_MS = PRICE_SCHEDULE_INTERVAL_MINUTES * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAY_INDEX: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/**
 * Wall-clock calendar fields of an instant, as seen in a specific time zone.
 */
export interface ZonedDateParts {
    /** Full year, e.g. `2026`. */
    year: number;
    /** Month, `1` = January … `12` = December. */
    month: number;
    /** Day of the month, starting at `1`. */
    day: number;
    /** Day of the week, `0` = Sunday … `6` = Saturday. */
    weekday: number;
    /** Hour in 24-hour notation, `0`–`23`. */
    hour: number;
    /** Minute, `0`–`59`. */
    minute: number;
    /** Minutes since local midnight (`hour * 60 + minute`). */
    minutesOfDay: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function zonedFormatter(timezone: string): Intl.DateTimeFormat {
    let formatter = formatterCache.get(timezone);
    if (formatter === undefined) {
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hourCycle: 'h23',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            weekday: 'short',
            hour: 'numeric',
            minute: 'numeric',
        });
        formatterCache.set(timezone, formatter);
    }
    return formatter;
}

/**
 * Projects an instant onto the wall clock of a time zone.
 *
 * Uses `Intl.DateTimeFormat`, so daylight-saving transitions are handled by the
 * platform's time zone database without pulling in a dependency.
 *
 * @param date - The instant to project
 * @param timezone - IANA time zone identifier, e.g. `'Europe/Berlin'`
 * @returns The wall-clock calendar fields of `date` in `timezone`
 * @throws {RangeError} If `timezone` is not a valid IANA identifier
 */
export function getZonedDateParts(date: Date, timezone: string): ZonedDateParts {
    const parts = zonedFormatter(timezone).formatToParts(date);
    const lookup: Record<string, string> = {};
    for (const part of parts) {
        lookup[part.type] = part.value;
    }
    const hour = Number(lookup.hour);
    const minute = Number(lookup.minute);
    return {
        year: Number(lookup.year),
        month: Number(lookup.month),
        day: Number(lookup.day),
        weekday: WEEKDAY_INDEX[lookup.weekday] ?? 0,
        hour,
        minute,
        minutesOfDay: hour * 60 + minute,
    };
}

/**
 * Parses an `HH:mm` wall-clock time into minutes since midnight.
 *
 * @param value - Time in 24-hour `HH:mm` notation, e.g. `'22:00'`
 * @returns Minutes since midnight, or `null` when the value is malformed
 */
export function parseTimeOfDay(value: string): number | null {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (match === null) {
        return null;
    }
    return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Rounds an instant down to the start of its 15-minute interval.
 *
 * @param timestampMs - Epoch milliseconds
 * @returns Epoch milliseconds of the interval start
 */
export function floorToInterval(timestampMs: number): number {
    return Math.floor(timestampMs / INTERVAL_MS) * INTERVAL_MS;
}

/**
 * Options for {@link resolvePriceSchedule}.
 */
export interface ResolvePriceScheduleOptions {
    /** Start of the range to resolve, in ISO format (inclusive). */
    fromIso: string;
    /** End of the range to resolve, in ISO format (exclusive). */
    untilIso: string;
    /** IANA time zone the schedule's wall-clock times are expressed in. */
    timezone: string;
    /** Optional start of the component's validity in ISO format (inclusive). */
    validFromIso?: string;
    /** Optional end of the component's validity in ISO format (exclusive). */
    validUntilIso?: string;
}

function matchesRecurringWindow(
    window: EnyoRecurringPriceWindow,
    timestampMs: number,
    timezone: string,
): boolean {
    const start = parseTimeOfDay(window.startTimeOfDay);
    const end = parseTimeOfDay(window.endTimeOfDay);
    if (start === null || end === null || start === end) {
        return false;
    }

    const parts = getZonedDateParts(new Date(timestampMs), timezone);
    let inWindow: boolean;
    let anchor: ZonedDateParts;

    if (start < end) {
        inWindow = parts.minutesOfDay >= start && parts.minutesOfDay < end;
        anchor = parts;
    } else if (parts.minutesOfDay >= start) {
        // Evening leg of a window that wraps past midnight.
        inWindow = true;
        anchor = parts;
    } else if (parts.minutesOfDay < end) {
        // Early-morning leg — the window belongs to the previous local day.
        inWindow = true;
        anchor = getZonedDateParts(new Date(timestampMs - DAY_MS), timezone);
    } else {
        return false;
    }

    if (!inWindow) {
        return false;
    }
    if (window.daysOfWeek !== undefined && !window.daysOfWeek.includes(anchor.weekday)) {
        return false;
    }
    return window.months === undefined || window.months.includes(anchor.month);
}

function matchesAbsoluteWindow(window: EnyoAbsolutePriceWindow, timestampMs: number): boolean {
    return timestampMs >= Date.parse(window.startIso) && timestampMs < Date.parse(window.endIso);
}

function amountAt(schedule: EnyoPriceSchedule, timestampMs: number, timezone: string): number {
    if (schedule.type === EnyoPriceScheduleTypeEnum.Constant) {
        return schedule.amountPerKwh;
    }
    if (schedule.type === EnyoPriceScheduleTypeEnum.Absolute) {
        const window = schedule.windows.find(candidate => matchesAbsoluteWindow(candidate, timestampMs));
        return window?.amountPerKwh ?? 0;
    }
    const window = schedule.windows.find(candidate => matchesRecurringWindow(candidate, timestampMs, timezone));
    return window?.amountPerKwh ?? 0;
}

/**
 * Expands a price schedule into a flat 15-minute series over a time range.
 *
 * The range start is rounded down to the enclosing 15-minute interval. Intervals
 * no window covers resolve to `amountPerKwh: 0`; intervals outside the
 * component's validity window are omitted entirely, so an empty result means
 * "this component does not apply here" rather than "it is free here".
 *
 * Windows are evaluated in array order and the first match wins — schedules are
 * expected to be overlap-free, which the validators enforce at registration
 * time.
 *
 * @param schedule - The schedule to expand
 * @param options - Range, time zone and optional validity bounds
 * @returns Resolved entries sorted ascending by `timestampIso`
 *
 * @example
 * ```typescript
 * const entries = resolvePriceSchedule(
 *     {
 *         type: EnyoPriceScheduleTypeEnum.Recurring,
 *         windows: [{ startTimeOfDay: '22:00', endTimeOfDay: '06:00', amountPerKwh: 0.05 }],
 *     },
 *     { fromIso: '2026-09-02T00:00:00Z', untilIso: '2026-09-03T00:00:00Z', timezone: 'Europe/Berlin' },
 * );
 * ```
 */
export function resolvePriceSchedule(
    schedule: EnyoPriceSchedule,
    options: ResolvePriceScheduleOptions,
): EnyoResolvedPriceEntry[] {
    const untilMs = Date.parse(options.untilIso);
    const validFromMs = options.validFromIso === undefined ? undefined : Date.parse(options.validFromIso);
    const validUntilMs = options.validUntilIso === undefined ? undefined : Date.parse(options.validUntilIso);

    const entries: EnyoResolvedPriceEntry[] = [];
    for (let cursor = floorToInterval(Date.parse(options.fromIso)); cursor < untilMs; cursor += INTERVAL_MS) {
        if (validFromMs !== undefined && cursor < validFromMs) {
            continue;
        }
        if (validUntilMs !== undefined && cursor >= validUntilMs) {
            break;
        }
        entries.push({
            timestampIso: new Date(cursor).toISOString(),
            amountPerKwh: amountAt(schedule, cursor, options.timezone),
        });
    }
    return entries;
}
