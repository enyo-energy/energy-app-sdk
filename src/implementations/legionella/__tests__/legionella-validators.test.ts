import {describe, expect, it} from 'vitest';
import {EnyoCommandAcknowledgeAnswerEnum, EnyoDataBusSetLegionellaScheduleV1} from '../../../types/enyo-data-bus-value.js';
import {EnyoHeatpumpApplianceAvailableFeaturesEnum, EnyoHeatpumpApplianceMetadata} from '../../../types/enyo-heatpump-appliance.js';
import {
    EnyoHeatingRodApplianceAvailableFeaturesEnum,
    EnyoHeatingRodApplianceMetadata,
} from '../../../types/enyo-heating-rod-appliance.js';
import {
    EnyoLegionellaProgramMetadata,
    EnyoLegionellaSlotAdjustableEnum,
    LEGIONELLA_PROGRAM_MAX_GAP_HOURS,
} from '../../../types/enyo-legionella.js';
import {
    legionellaSlotErrors,
    validateHeatingRodLegionellaSchedule,
    validateHeatpumpLegionellaSchedule,
    validateLegionellaProgramMetadata,
    validateLegionellaSchedule,
} from '../legionella-validators.js';

const {Accepted, Rejected, NotSupported} = EnyoCommandAcknowledgeAnswerEnum;
const NOW = Date.parse('2026-11-27T18:00:00.000Z');
const HOUR = 3_600_000;

const PROGRAM: EnyoLegionellaProgramMetadata = {
    ownerSlot: {dayOfWeek: 6, timeOfDay: '01:00'},
    adjustable: EnyoLegionellaSlotAdjustableEnum.DayAndTime,
    granularityMinutes: 15,
    targetTemperatureC: 60,
    lastCompletedIso: '2026-11-21T00:00:00.000Z',
};

type Data = EnyoDataBusSetLegionellaScheduleV1['data'];
const data = (overrides: Partial<Data> = {}): Data => ({
    slot: {dayOfWeek: 6, timeOfDay: '13:00'},
    nextRunIso: '2026-11-28T12:00:00.000Z',
    ownerRunIso: '2026-11-28T00:00:00.000Z',
    ...overrides,
});

describe('legionellaSlotErrors', () => {
    it('accepts a well-formed slot', () => {
        expect(legionellaSlotErrors({dayOfWeek: 0, timeOfDay: '00:00'}, 'slot')).toEqual([]);
        expect(legionellaSlotErrors({dayOfWeek: 6, timeOfDay: '23:59'}, 'slot')).toEqual([]);
    });

    it('reports a bad weekday, a bad time and a missing slot', () => {
        expect(legionellaSlotErrors({dayOfWeek: 7, timeOfDay: '24:00'}, 'slot')).toHaveLength(2);
        expect(legionellaSlotErrors({dayOfWeek: 1.5, timeOfDay: '1:00'}, 'slot')).toHaveLength(2);
        expect(legionellaSlotErrors(undefined, 'slot')).toEqual(['slot must be an object']);
    });
});

describe('validateLegionellaProgramMetadata', () => {
    it('accepts a complete program', () => {
        expect(validateLegionellaProgramMetadata(PROGRAM, true)).toEqual({ok: true, errors: [], warnings: []});
    });

    it('requires adjustable with the feature and warns about it without', () => {
        const {adjustable: _adjustable, ...withoutAdjustable} = PROGRAM;
        expect(validateLegionellaProgramMetadata(withoutAdjustable, true).ok).toBe(false);
        expect(validateLegionellaProgramMetadata(withoutAdjustable, false).ok).toBe(true);
        expect(validateLegionellaProgramMetadata(PROGRAM, false).warnings).toHaveLength(1);
    });

    it('rejects malformed fields and warns below 60 °C', () => {
        const bad = validateLegionellaProgramMetadata({
            ownerSlot: {dayOfWeek: 6, timeOfDay: '1 am'},
            granularityMinutes: 7,
            estimatedDurationMinutes: 0,
            lastCompletedIso: 'last week',
        }, false);
        expect(bad.errors).toHaveLength(4);
        expect(validateLegionellaProgramMetadata({...PROGRAM, targetTemperatureC: 55}, true).warnings).toHaveLength(1);
    });
});

describe('validateLegionellaSchedule', () => {
    const check = (d: Data, program: EnyoLegionellaProgramMetadata | undefined = PROGRAM, declared = true) =>
        validateLegionellaSchedule(d, program, declared, NOW).answer;

    it('accepts a moved slot and the restored owner slot', () => {
        expect(check(data())).toBe(Accepted);
        expect(check(data({
            slot: PROGRAM.ownerSlot, nextRunIso: '2026-12-05T00:00:00.000Z', ownerRunIso: '2026-12-05T00:00:00.000Z', restored: true,
        }))).toBe(Accepted);
    });

    it('rejects malformed data', () => {
        expect(check(data({slot: {dayOfWeek: 6, timeOfDay: '25:00'}}))).toBe(Rejected);
        expect(check(data({nextRunIso: 'tomorrow'}))).toBe(Rejected);
        expect(check(data({ownerRunIso: undefined as unknown as string}))).toBe(Rejected);
        expect(check(data({restored: 'yes' as unknown as boolean}))).toBe(Rejected);
        expect(check(data({domesticHotWaterIndex: -1}))).toBe(Rejected);
    });

    it('answers NotSupported without the feature, the program or adjustable', () => {
        expect(check(data(), PROGRAM, false)).toBe(NotSupported);
        expect(validateLegionellaSchedule(data(), undefined, true, NOW).answer).toBe(NotSupported);
        expect(check(data(), {...PROGRAM, adjustable: undefined})).toBe(NotSupported);
    });

    it('keeps the weekday for TimeOnly and the time on the grid', () => {
        const timeOnly = {...PROGRAM, adjustable: EnyoLegionellaSlotAdjustableEnum.TimeOnly};
        expect(check(data(), timeOnly)).toBe(Accepted);
        expect(check(data({slot: {dayOfWeek: 5, timeOfDay: '13:00'}, nextRunIso: '2026-11-28T10:00:00.000Z'}), timeOnly))
            .toBe(NotSupported);
        expect(check(data({slot: {dayOfWeek: 6, timeOfDay: '13:10'}}))).toBe(NotSupported);
    });

    it('rejects restored with a slot other than the owner slot', () => {
        expect(check(data({restored: true}))).toBe(Rejected);
    });

    it('rejects a move too close to or after the owner run, but not a restore', () => {
        const ownerSoon = new Date(NOW + 30 * 60_000).toISOString();
        expect(check(data({ownerRunIso: ownerSoon}))).toBe(Rejected);
        expect(check(data({ownerRunIso: new Date(NOW - HOUR).toISOString()}))).toBe(Rejected);
        expect(check(data({ownerRunIso: new Date(NOW + 2 * HOUR).toISOString()}))).toBe(Accepted);
        expect(check(data({slot: PROGRAM.ownerSlot, nextRunIso: ownerSoon, ownerRunIso: ownerSoon, restored: true}))).toBe(Accepted);
    });

    it('rejects a next run in the past or one that skips a week', () => {
        expect(check(data({nextRunIso: new Date(NOW).toISOString()}))).toBe(Rejected);
        const deadline = Date.parse(PROGRAM.lastCompletedIso!) + LEGIONELLA_PROGRAM_MAX_GAP_HOURS * HOUR;
        expect(check(data({slot: {dayOfWeek: 0, timeOfDay: '12:00'}, nextRunIso: new Date(deadline).toISOString()})))
            .toBe(Accepted);
        expect(check(data({slot: {dayOfWeek: 0, timeOfDay: '12:00'}, nextRunIso: new Date(deadline + HOUR).toISOString()})))
            .toBe(Rejected);
        // Without lastCompletedIso the gap cannot be checked.
        expect(check(data({nextRunIso: new Date(deadline + HOUR).toISOString()}), {...PROGRAM, lastCompletedIso: undefined}))
            .toBe(Accepted);
    });
});

describe('appliance variants', () => {
    it('finds the heat pump zone by index, the first zone by default', () => {
        const metadata: EnyoHeatpumpApplianceMetadata = {
            availableFeatures: [EnyoHeatpumpApplianceAvailableFeaturesEnum.LegionellaSchedule],
            domesticHotWater: [
                {index: 0, targetTemperatureC: 50},
                {index: 1, targetTemperatureC: 50, legionella: PROGRAM},
            ],
        };
        expect(validateHeatpumpLegionellaSchedule(data({domesticHotWaterIndex: 1}), metadata, NOW).answer).toBe(Accepted);
        expect(validateHeatpumpLegionellaSchedule(data(), metadata, NOW).answer).toBe(NotSupported);
        expect(validateHeatpumpLegionellaSchedule(data({domesticHotWaterIndex: 2}), metadata, NOW).answer).toBe(NotSupported);
        expect(validateHeatpumpLegionellaSchedule(data(), undefined, NOW).answer).toBe(NotSupported);
    });

    it('checks a heating rod by its own feature and program', () => {
        const rod: EnyoHeatingRodApplianceMetadata = {
            availableFeatures: [EnyoHeatingRodApplianceAvailableFeaturesEnum.LegionellaSchedule],
            targetTemperatureC: 60,
            legionella: PROGRAM,
        };
        expect(validateHeatingRodLegionellaSchedule(data(), rod, NOW).answer).toBe(Accepted);
        expect(validateHeatingRodLegionellaSchedule(data(), {...rod, availableFeatures: []}, NOW).answer).toBe(NotSupported);
    });
});
