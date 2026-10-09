import {describe, expect, it} from 'vitest';
import {
    HeatpumpMetadataValidationError,
    assertValidHeatpumpHeatingCurve,
    assertValidHeatpumpTimeProgram,
    validateHeatpumpAdvancedMetadata,
    validateHeatpumpHeatingCurve,
    validateHeatpumpTimeProgram,
} from '../heatpump-metadata-validators.js';
import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum,
    EnyoHeatpumpRoomTemperatureSourceEnum,
    EnyoHeatpumpTimeProgramLevelEnum,
} from '../../../types/enyo-heatpump-appliance.js';
import type {
    EnyoHeatpumpApplianceHeatingCurve,
    EnyoHeatpumpTimeProgram,
    EnyoHeatpumpTimeProgramPeriod,
} from '../../../types/enyo-heatpump-appliance.js';

const {Comfort, Reduced, Off} = EnyoHeatpumpTimeProgramLevelEnum;

/** A minimal valid curve, so a test isolates the rule it is about. */
const curve = (overrides: Partial<EnyoHeatpumpApplianceHeatingCurve> = {}): EnyoHeatpumpApplianceHeatingCurve => ({
    points: [
        {outdoorTemperatureC: -15, flowTemperatureC: 50},
        {outdoorTemperatureC: 0, flowTemperatureC: 40},
        {outdoorTemperatureC: 15, flowTemperatureC: 28},
    ],
    ...overrides,
});

const period = (overrides: Partial<EnyoHeatpumpTimeProgramPeriod> = {}): EnyoHeatpumpTimeProgramPeriod => ({
    daysOfWeek: [1, 2, 3, 4, 5],
    startTimeOfDay: '06:00',
    endTimeOfDay: '22:00',
    level: Comfort,
    ...overrides,
});

/** A minimal valid program, so a test isolates the rule it is about. */
const program = (overrides: Partial<EnyoHeatpumpTimeProgram> = {}): EnyoHeatpumpTimeProgram => ({
    defaultLevel: Reduced,
    periods: [period()],
    levelTemperaturesC: {[Comfort]: 21, [Reduced]: 18},
    ...overrides,
});

describe('validateHeatpumpHeatingCurve', () => {
    it('accepts a well-formed curve without warnings', () => {
        expect(validateHeatpumpHeatingCurve(curve({minFlowTemperatureC: 25, maxFlowTemperatureC: 55})))
            .toEqual({ok: true, errors: [], warnings: []});
    });

    it('requires at least two points', () => {
        const result = validateHeatpumpHeatingCurve(curve({points: [{outdoorTemperatureC: 0, flowTemperatureC: 40}]}));
        expect(result.ok).toBe(false);
        expect(result.errors[0]).toMatch(/at least 2 points/);
    });

    it('rejects points not sorted by strictly increasing outdoor temperature', () => {
        const result = validateHeatpumpHeatingCurve(curve({
            points: [
                {outdoorTemperatureC: 0, flowTemperatureC: 40},
                {outdoorTemperatureC: 0, flowTemperatureC: 38},
            ],
        }));
        expect(result.errors.join()).toMatch(/strictly increasing/);
    });

    it('rejects non-finite values and min above max', () => {
        const result = validateHeatpumpHeatingCurve(curve({
            points: [
                {outdoorTemperatureC: -10, flowTemperatureC: NaN},
                {outdoorTemperatureC: 10, flowTemperatureC: 30},
            ],
            minFlowTemperatureC: 50,
            maxFlowTemperatureC: 30,
        }));
        expect(result.errors).toHaveLength(2);
    });

    it('validates coolingPoints with the same rules', () => {
        const result = validateHeatpumpHeatingCurve(curve({coolingPoints: [{outdoorTemperatureC: 30, flowTemperatureC: 18}]}));
        expect(result.errors[0]).toMatch(/^coolingPoints/);
    });

    it('warns about a rising curve and points outside the flow bounds', () => {
        const result = validateHeatpumpHeatingCurve(curve({
            points: [
                {outdoorTemperatureC: -10, flowTemperatureC: 30},
                {outdoorTemperatureC: 10, flowTemperatureC: 60},
            ],
            maxFlowTemperatureC: 55,
        }));
        expect(result.ok).toBe(true);
        expect(result.warnings).toHaveLength(2);
    });

    it('throws from the assert variant', () => {
        expect(() => assertValidHeatpumpHeatingCurve(curve({points: []})))
            .toThrow(HeatpumpMetadataValidationError);
    });
});

describe('validateHeatpumpTimeProgram', () => {
    it('accepts a well-formed program without warnings', () => {
        expect(validateHeatpumpTimeProgram(program())).toEqual({ok: true, errors: [], warnings: []});
    });

    it('accepts 24:00 as end of day and periods wrapping past midnight', () => {
        const result = validateHeatpumpTimeProgram(program({
            periods: [
                period({daysOfWeek: [0], startTimeOfDay: '08:00', endTimeOfDay: '24:00'}),
                period({daysOfWeek: [5], startTimeOfDay: '22:00', endTimeOfDay: '02:00'}),
            ],
        }));
        expect(result).toEqual({ok: true, errors: [], warnings: []});
    });

    it('rejects malformed times, equal start/end and 24:00 as start', () => {
        const result = validateHeatpumpTimeProgram(program({
            periods: [
                period({startTimeOfDay: '6:00'}),
                period({endTimeOfDay: '25:00'}),
                period({startTimeOfDay: '08:00', endTimeOfDay: '08:00'}),
                period({startTimeOfDay: '24:00'}),
            ],
        }));
        expect(result.errors).toHaveLength(4);
    });

    it('rejects empty or out-of-range days and unknown levels', () => {
        const result = validateHeatpumpTimeProgram(program({
            defaultLevel: 'Eco' as EnyoHeatpumpTimeProgramLevelEnum,
            periods: [
                period({daysOfWeek: []}),
                period({daysOfWeek: [7]}),
                period({level: 'Party' as EnyoHeatpumpTimeProgramLevelEnum}),
            ],
        }));
        expect(result.errors).toHaveLength(4);
    });

    it('warns about overlapping periods, including across the week boundary', () => {
        const sameDay = validateHeatpumpTimeProgram(program({
            periods: [
                period({daysOfWeek: [1], startTimeOfDay: '06:00', endTimeOfDay: '10:00'}),
                period({daysOfWeek: [1], startTimeOfDay: '09:00', endTimeOfDay: '12:00'}),
            ],
        }));
        expect(sameDay.ok).toBe(true);
        expect(sameDay.warnings).toEqual(['periods[0] and periods[1] overlap — the later entry wins']);

        const acrossWeek = validateHeatpumpTimeProgram(program({
            periods: [
                period({daysOfWeek: [6], startTimeOfDay: '22:00', endTimeOfDay: '02:00'}),
                period({daysOfWeek: [0], startTimeOfDay: '01:00', endTimeOfDay: '05:00'}),
            ],
        }));
        expect(acrossWeek.warnings).toHaveLength(1);

        const adjacent = validateHeatpumpTimeProgram(program({
            periods: [
                period({daysOfWeek: [1], startTimeOfDay: '06:00', endTimeOfDay: '10:00'}),
                period({daysOfWeek: [1], startTimeOfDay: '10:00', endTimeOfDay: '12:00'}),
            ],
        }));
        expect(adjacent.warnings).toEqual([]);
    });

    it('warns when a level has no known setpoint, except Off', () => {
        const result = validateHeatpumpTimeProgram(program({
            levelTemperaturesC: undefined,
            periods: [period(), period({daysOfWeek: [0], level: Off})],
        }));
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toMatch(/'Comfort'/);
    });

    it('throws from the assert variant', () => {
        expect(() => assertValidHeatpumpTimeProgram(program({periods: [period({daysOfWeek: []})]})))
            .toThrow(HeatpumpMetadataValidationError);
    });
});

describe('validateHeatpumpAdvancedMetadata', () => {
    it('prefixes nested problems with their path', () => {
        const result = validateHeatpumpAdvancedMetadata({
            availableFeatures: [],
            heatingCircuits: [{index: 1, heatingCurve: curve({points: []})}],
            domesticHotWater: [{index: 0, targetTemperatureC: 50, timeProgram: program({periods: [period({daysOfWeek: []})]})}],
        });
        expect(result.errors).toEqual([
            expect.stringMatching(/^heatingCircuits\[index=1]\.heatingCurve: /),
            expect.stringMatching(/^domesticHotWater\[index=0]\.timeProgram: /),
        ]);
    });

    it('rejects duplicate circuit indexes', () => {
        const result = validateHeatpumpAdvancedMetadata({
            availableFeatures: [],
            heatingCircuits: [{index: 0}, {index: 0}],
        });
        expect(result.errors).toEqual(['heatingCircuits contains duplicate index 0']);
    });

    it('checks the room-temperature wiring', () => {
        const sensor = {applianceId: 'sensor-1', sensorId: 'living-room'};
        const result = validateHeatpumpAdvancedMetadata({
            availableFeatures: [],
            heatingCircuits: [
                {index: 0, roomTemperatureSource: EnyoHeatpumpRoomTemperatureSourceEnum.External},
                {index: 1, roomTemperatureSource: EnyoHeatpumpRoomTemperatureSourceEnum.Internal, roomTemperatureSensor: sensor},
            ],
        });
        expect(result.ok).toBe(true);
        // External without sensor; sensor without External; sensor without RoomTemperatureInput.
        expect(result.warnings).toHaveLength(3);

        const wired = validateHeatpumpAdvancedMetadata({
            availableFeatures: [EnyoHeatpumpApplianceAvailableFeaturesEnum.RoomTemperatureInput],
            heatingCircuits: [{
                index: 0,
                roomTemperatureSource: EnyoHeatpumpRoomTemperatureSourceEnum.External,
                roomTemperatureSensor: sensor,
            }],
        });
        expect(wired).toEqual({ok: true, errors: [], warnings: []});
    });
});
