import {describe, expect, it} from 'vitest';
import type {EnyoRoom} from '../../../types/enyo-room.js';
import {curveOptimizationRooms} from '../heatpump-curve-optimization-rooms.js';

const room = (id: string): EnyoRoom => ({id, name: id, applianceIds: [], targetTemperatureC: 21});

describe('curveOptimizationRooms', () => {
    it("resolves every room of the circuit and drops the ones that are gone", () => {
        const rooms = [room('living'), room('bed'), room('office')];
        expect(curveOptimizationRooms({enabled: true, roomIds: ['living', 'bed', 'office', 'gone']}, rooms).map((r) => r.id))
            .toEqual(['living', 'bed', 'office']);
    });

    it('has no rooms without settings or room ids', () => {
        expect(curveOptimizationRooms(undefined, [room('living')])).toEqual([]);
        expect(curveOptimizationRooms({enabled: true}, [room('living')])).toEqual([]);
    });
});
