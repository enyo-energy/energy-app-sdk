import {describe, expect, it} from 'vitest';
import type {EnyoRoom} from '../../../types/enyo-room.js';
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
    temperatureSensors: [],
    targetTemperatureC: 21,
    ...extra,
});

describe('isManualRoomThermostat', () => {
    it('counts the dials and an unknown thermostat as manual', () => {
        expect(isManualRoomThermostat(undefined)).toBe(true);
        expect(isManualRoomThermostat('steps-6')).toBe(true);
        expect(isManualRoomThermostat('celsius-dial')).toBe(true);
        expect(isManualRoomThermostat('self-regulating')).toBe(false);
        expect(isManualRoomThermostat('none')).toBe(false);
    });
});

describe('curveJudgedRoomIds', () => {
    const traits: Record<string, CurveRoomTraits> = {bed: {warmth: 'cool'}, bath: {warmth: 'warm'}};
    const traitsOf = (roomId: string) => traits[roomId];

    it('judges every room when all ask for the same', () => {
        expect(curveJudgedRoomIds(['living', 'hall'], traitsOf)).toEqual(['living', 'hall']);
    });

    it('judges only the warmest rooms behind a manual thermostat', () => {
        expect(curveJudgedRoomIds(['bath', 'living', 'bed'], traitsOf)).toEqual(['bath']);
    });

    it('always judges a room behind a self-regulating thermostat or none', () => {
        const mixed: Record<string, CurveRoomTraits> = {
            bath: {warmth: 'warm'},
            bed: {warmth: 'cool', thermostat: 'self-regulating'},
            hall: {warmth: 'cool', thermostat: 'none'},
        };
        expect(curveJudgedRoomIds(['bath', 'bed', 'hall'], (roomId) => mixed[roomId])).toEqual(['bath', 'bed', 'hall']);
    });
});

describe('curveOptimizationRooms', () => {
    it("resolves the circuit's judged rooms and drops the ones that are gone", () => {
        const rooms = [
            room('living', {warmth: 'warm', temperatureSensors: [{applianceId: 'shelly-1', sensorId: 'ambient'}]}),
            room('bed', {warmth: 'cool'}),
            room('office', {thermostat: 'self-regulating'}),
        ];
        expect(curveOptimizationRooms({enabled: true, roomIds: ['living', 'bed', 'office', 'gone']}, rooms).map((r) => r.id))
            .toEqual(['living', 'office']);
    });

    it('has no rooms without settings or room ids', () => {
        expect(curveOptimizationRooms(undefined, [room('living')])).toEqual([]);
        expect(curveOptimizationRooms({enabled: true}, [room('living')])).toEqual([]);
    });
});
