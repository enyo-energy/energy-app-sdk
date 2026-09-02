import {describe, expect, it} from 'vitest';
import {
    floorToInterval,
    getZonedDateParts,
    parseTimeOfDay,
    resolvePriceSchedule,
} from '../price-schedule-resolver.js';
import {EnyoPriceSchedule, EnyoPriceScheduleTypeEnum} from '../../../types/enyo-price-schedule.js';

const BERLIN = 'Europe/Berlin';

function amountAt(entries: {timestampIso: string; amountPerKwh: number}[], timestampIso: string): number | undefined {
    return entries.find(entry => entry.timestampIso === timestampIso)?.amountPerKwh;
}

describe('parseTimeOfDay', () => {
    it('parses valid HH:mm times', () => {
        expect(parseTimeOfDay('00:00')).toBe(0);
        expect(parseTimeOfDay('22:15')).toBe(1335);
        expect(parseTimeOfDay('23:59')).toBe(1439);
    });

    it('rejects malformed times', () => {
        expect(parseTimeOfDay('24:00')).toBeNull();
        expect(parseTimeOfDay('7:00')).toBeNull();
        expect(parseTimeOfDay('22:60')).toBeNull();
        expect(parseTimeOfDay('')).toBeNull();
    });
});

describe('floorToInterval', () => {
    it('rounds down to the enclosing 15-minute interval', () => {
        const base = Date.parse('2026-09-02T10:14:59Z');
        expect(new Date(floorToInterval(base)).toISOString()).toBe('2026-09-02T10:00:00.000Z');
    });
});

describe('getZonedDateParts', () => {
    it('projects an instant onto local wall-clock time', () => {
        // 2026-09-02 is CEST (UTC+2)
        const parts = getZonedDateParts(new Date('2026-09-02T20:30:00Z'), BERLIN);
        expect(parts).toMatchObject({year: 2026, month: 9, day: 2, hour: 22, minute: 30, minutesOfDay: 1350});
        expect(parts.weekday).toBe(3); // Wednesday
    });

    it('follows the winter offset', () => {
        // 2026-01-15 is CET (UTC+1)
        expect(getZonedDateParts(new Date('2026-01-15T20:30:00Z'), BERLIN).hour).toBe(21);
    });
});

describe('resolvePriceSchedule', () => {
    it('returns the same amount for every interval of a constant schedule', () => {
        const entries = resolvePriceSchedule(
            {type: EnyoPriceScheduleTypeEnum.Constant, amountPerKwh: 0.0912},
            {fromIso: '2026-09-02T00:00:00Z', untilIso: '2026-09-02T02:00:00Z', timezone: BERLIN},
        );
        expect(entries).toHaveLength(8);
        expect(entries.every(entry => entry.amountPerKwh === 0.0912)).toBe(true);
    });

    it('aligns the range start to the enclosing interval', () => {
        const entries = resolvePriceSchedule(
            {type: EnyoPriceScheduleTypeEnum.Constant, amountPerKwh: 1},
            {fromIso: '2026-09-02T00:07:00Z', untilIso: '2026-09-02T00:30:00Z', timezone: BERLIN},
        );
        expect(entries[0].timestampIso).toBe('2026-09-02T00:00:00.000Z');
        expect(entries).toHaveLength(2);
    });

    it('resolves a plain recurring window in local time', () => {
        const schedule: EnyoPriceSchedule = {
            type: EnyoPriceScheduleTypeEnum.Recurring,
            windows: [{startTimeOfDay: '06:00', endTimeOfDay: '22:00', amountPerKwh: 0.09}],
        };
        const entries = resolvePriceSchedule(schedule, {
            fromIso: '2026-09-02T00:00:00Z',
            untilIso: '2026-09-03T00:00:00Z',
            timezone: BERLIN,
        });
        // Local 06:00 CEST === 04:00 UTC, local 22:00 CEST === 20:00 UTC
        expect(amountAt(entries, '2026-09-02T03:45:00.000Z')).toBe(0);
        expect(amountAt(entries, '2026-09-02T04:00:00.000Z')).toBe(0.09);
        expect(amountAt(entries, '2026-09-02T19:45:00.000Z')).toBe(0.09);
        expect(amountAt(entries, '2026-09-02T20:00:00.000Z')).toBe(0);
    });

    it('resolves a window that wraps past midnight on both legs', () => {
        const schedule: EnyoPriceSchedule = {
            type: EnyoPriceScheduleTypeEnum.Recurring,
            windows: [{startTimeOfDay: '22:00', endTimeOfDay: '06:00', amountPerKwh: 0.043}],
        };
        const entries = resolvePriceSchedule(schedule, {
            fromIso: '2026-09-02T00:00:00Z',
            untilIso: '2026-09-04T00:00:00Z',
            timezone: BERLIN,
        });
        expect(amountAt(entries, '2026-09-02T00:00:00.000Z')).toBe(0.043); // local 02:00, morning leg
        expect(amountAt(entries, '2026-09-02T04:00:00.000Z')).toBe(0); // local 06:00, window ended
        expect(amountAt(entries, '2026-09-02T20:00:00.000Z')).toBe(0.043); // local 22:00, evening leg
    });

    it('anchors a wrapping window to the day it starts', () => {
        // Monday-only night window: covers Monday evening and Tuesday early morning.
        const schedule: EnyoPriceSchedule = {
            type: EnyoPriceScheduleTypeEnum.Recurring,
            windows: [{startTimeOfDay: '22:00', endTimeOfDay: '06:00', daysOfWeek: [1], amountPerKwh: 0.05}],
        };
        const entries = resolvePriceSchedule(schedule, {
            fromIso: '2026-08-31T00:00:00Z', // Monday
            untilIso: '2026-09-02T00:00:00Z',
            timezone: BERLIN,
        });
        expect(amountAt(entries, '2026-08-31T20:00:00.000Z')).toBe(0.05); // Mon 22:00 local
        expect(amountAt(entries, '2026-09-01T02:00:00.000Z')).toBe(0.05); // Tue 04:00 local, still Monday's window
        expect(amountAt(entries, '2026-09-01T20:00:00.000Z')).toBe(0); // Tue 22:00 local, not covered
        expect(amountAt(entries, '2026-08-31T02:00:00.000Z')).toBe(0); // Mon 04:00 local belongs to Sunday's window
    });

    it('keeps wall-clock windows stable across the spring-forward transition', () => {
        // Europe/Berlin springs forward 2026-03-29: local 02:00 -> 03:00.
        const schedule: EnyoPriceSchedule = {
            type: EnyoPriceScheduleTypeEnum.Recurring,
            windows: [{startTimeOfDay: '22:00', endTimeOfDay: '06:00', amountPerKwh: 0.043}],
        };
        const entries = resolvePriceSchedule(schedule, {
            fromIso: '2026-03-28T20:00:00Z',
            untilIso: '2026-03-29T08:00:00Z',
            timezone: BERLIN,
        });
        expect(amountAt(entries, '2026-03-28T21:00:00.000Z')).toBe(0.043); // local 22:00 CET
        expect(amountAt(entries, '2026-03-29T00:45:00.000Z')).toBe(0.043); // local 01:45 CET, still night
        expect(amountAt(entries, '2026-03-29T03:45:00.000Z')).toBe(0.043); // local 05:45 CEST, last covered interval
        expect(amountAt(entries, '2026-03-29T04:00:00.000Z')).toBe(0); // local 06:00 CEST, window ended
    });

    it('keeps wall-clock windows stable across the fall-back transition', () => {
        // Europe/Berlin falls back 2026-10-25: local 03:00 -> 02:00.
        const schedule: EnyoPriceSchedule = {
            type: EnyoPriceScheduleTypeEnum.Recurring,
            windows: [{startTimeOfDay: '06:00', endTimeOfDay: '22:00', amountPerKwh: 0.09}],
        };
        const entries = resolvePriceSchedule(schedule, {
            fromIso: '2026-10-25T00:00:00Z',
            untilIso: '2026-10-25T23:00:00Z',
            timezone: BERLIN,
        });
        expect(amountAt(entries, '2026-10-25T04:45:00.000Z')).toBe(0); // local 05:45 CET
        expect(amountAt(entries, '2026-10-25T05:00:00.000Z')).toBe(0.09); // local 06:00 CET
        expect(amountAt(entries, '2026-10-25T21:00:00.000Z')).toBe(0); // local 22:00 CET
    });

    it('honours month restrictions', () => {
        const schedule: EnyoPriceSchedule = {
            type: EnyoPriceScheduleTypeEnum.Recurring,
            windows: [{startTimeOfDay: '06:00', endTimeOfDay: '22:00', months: [1, 2, 12], amountPerKwh: 0.11}],
        };
        const september = resolvePriceSchedule(schedule, {
            fromIso: '2026-09-02T08:00:00Z',
            untilIso: '2026-09-02T09:00:00Z',
            timezone: BERLIN,
        });
        const january = resolvePriceSchedule(schedule, {
            fromIso: '2026-01-15T08:00:00Z',
            untilIso: '2026-01-15T09:00:00Z',
            timezone: BERLIN,
        });
        expect(september.every(entry => entry.amountPerKwh === 0)).toBe(true);
        expect(january.every(entry => entry.amountPerKwh === 0.11)).toBe(true);
    });

    it('resolves absolute windows and leaves uncovered intervals at zero', () => {
        const schedule: EnyoPriceSchedule = {
            type: EnyoPriceScheduleTypeEnum.Absolute,
            windows: [
                {startIso: '2026-09-02T10:00:00Z', endIso: '2026-09-02T11:00:00Z', amountPerKwh: 0.07},
                {startIso: '2026-09-02T12:00:00Z', endIso: '2026-09-02T13:00:00Z', amountPerKwh: 0.12},
            ],
        };
        const entries = resolvePriceSchedule(schedule, {
            fromIso: '2026-09-02T09:00:00Z',
            untilIso: '2026-09-02T14:00:00Z',
            timezone: BERLIN,
        });
        expect(amountAt(entries, '2026-09-02T10:45:00.000Z')).toBe(0.07);
        expect(amountAt(entries, '2026-09-02T11:00:00.000Z')).toBe(0);
        expect(amountAt(entries, '2026-09-02T12:00:00.000Z')).toBe(0.12);
    });

    it('omits intervals outside the validity window', () => {
        const entries = resolvePriceSchedule(
            {type: EnyoPriceScheduleTypeEnum.Constant, amountPerKwh: 0.05},
            {
                fromIso: '2026-09-02T00:00:00Z',
                untilIso: '2026-09-02T04:00:00Z',
                timezone: BERLIN,
                validFromIso: '2026-09-02T01:00:00Z',
                validUntilIso: '2026-09-02T02:00:00Z',
            },
        );
        expect(entries).toHaveLength(4);
        expect(entries[0].timestampIso).toBe('2026-09-02T01:00:00.000Z');
        expect(entries[entries.length - 1].timestampIso).toBe('2026-09-02T01:45:00.000Z');
    });
});
