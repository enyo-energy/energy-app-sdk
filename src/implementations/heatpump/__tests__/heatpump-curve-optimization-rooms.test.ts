import {describe, expect, it} from 'vitest';
import {type EnyoRoom, EnyoRoomThermostatEnum as Thermostat, EnyoRoomWarmthEnum as Warmth} from '../../../types/enyo-room.js';
import {
    type CurveRoomTraits,
    curveJudgedRoomIds,
    curveOptimizationRooms,
    isManualRoomThermostat,
} from '../heatpump-curve-optimization-rooms.js';

const room = (id: string, extra: Partial<EnyoRoom> = {}): EnyoRoom => ({
    id,
    name: id,
    applianceIds: [],
    targetTemperatureC: 21,
    ...extra,
});

describe('isManualRoomThermostat', () => {
    it('counts the dials and an unknown thermostat as manual', () => {
        expect(isManualRoomThermostat(undefined)).toBe(true);
        expect(isManualRoomThermostat(Thermostat.Steps6)).toBe(true);
        expect(isManualRoomThermostat(Thermostat.CelsiusDial)).toBe(true);
        expect(isManualRoomThermostat(Thermostat.SelfRegulating)).toBe(false);
        expect(isManualRoomThermostat(Thermostat.None)).toBe(false);
    });
});

describe('curveJudgedRoomIds', () => {
    const traits: Record<string, CurveRoomTraits> = {bed: {warmth: Warmth.Cool}, bath: {warmth: Warmth.Warm}};
    const traitsOf = (roomId: string) => traits[roomId];

    it('judges every room when all ask for the same', () => {
        expect(curveJudgedRoomIds(['living', 'hall'], traitsOf)).toEqual(['living', 'hall']);
    });

    it('judges only the warmest rooms behind a manual thermostat', () => {
        expect(curveJudgedRoomIds(['bath', 'living', 'bed'], traitsOf)).toEqual(['bath']);
    });

    it('always judges a room behind a self-regulating thermostat or none', () => {
        const mixed: Record<string, CurveRoomTraits> = {
            bath: {warmth: Warmth.Warm},
            bed: {warmth: Warmth.Cool, thermostat: Thermostat.SelfRegulating},
            hall: {warmth: Warmth.Cool, thermostat: Thermostat.None},
        };
        expect(curveJudgedRoomIds(['bath', 'bed', 'hall'], (roomId) => mixed[roomId])).toEqual(['bath', 'bed', 'hall']);
    });
});

describe('curveOptimizationRooms', () => {
    it("resolves the circuit's judged rooms and drops the ones that are gone", () => {
        const rooms = [
            room('living', {warmth: Warmth.Warm}),
            room('bed', {warmth: Warmth.Cool}),
            room('office', {thermostat: Thermostat.SelfRegulating}),
        ];
        expect(curveOptimizationRooms({enabled: true, roomIds: ['living', 'bed', 'office', 'gone']}, rooms).map((r) => r.id))
            .toEqual(['living', 'office']);
    });

    it('has no rooms without settings or room ids', () => {
        expect(curveOptimizationRooms(undefined, [room('living')])).toEqual([]);
        expect(curveOptimizationRooms({enabled: true}, [room('living')])).toEqual([]);
    });
});
