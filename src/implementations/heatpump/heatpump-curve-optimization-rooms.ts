/**
 * Which rooms of a heating circuit the room-temperature based heating curve
 * optimisation is judged by. Shared by the energy manager, which lowers the
 * curve, and the host's app, which tells the customer how to set each room's
 * thermostat — both must agree on it.
 */

import type {EnyoHeatpumpHeatingCurveOptimizationSettings} from '../../types/enyo-heatpump-appliance.js';
import {type EnyoRoom, EnyoRoomThermostatEnum, EnyoRoomWarmthEnum} from '../../types/enyo-room.js';

/** What the curve rules need to know about a room. */
export interface CurveRoomTraits {
    /** Absent: {@link EnyoRoomWarmthEnum.Normal}. */
    warmth?: EnyoRoomWarmthEnum;
    /** Absent: {@link EnyoRoomThermostatEnum.Steps5}. */
    thermostat?: EnyoRoomThermostatEnum;
}

const WARMTH_RANK: Record<EnyoRoomWarmthEnum, number> = {
    [EnyoRoomWarmthEnum.Cool]: 0,
    [EnyoRoomWarmthEnum.Normal]: 1,
    [EnyoRoomWarmthEnum.Warm]: 2,
};

const MANUAL_THERMOSTATS: ReadonlySet<EnyoRoomThermostatEnum> = new Set([
    EnyoRoomThermostatEnum.Steps5,
    EnyoRoomThermostatEnum.Steps6,
    EnyoRoomThermostatEnum.CelsiusDial,
]);

/**
 * How much warmth a room asks for compared with the other rooms of its
 * circuit: 0 for `cool`, 1 for `normal` (also when absent), 2 for `warm`.
 *
 * @param traits - The room's warmth, if known.
 * @returns The rank.
 */
export function curveWarmthRank(traits: CurveRoomTraits | undefined): number {
    return WARMTH_RANK[traits?.warmth ?? EnyoRoomWarmthEnum.Normal];
}

/**
 * Whether a thermostat is set by hand: a dial with steps or a dial in °C.
 * Absent counts as the common dial with steps 1–5.
 *
 * @param thermostat - The room's thermostat.
 * @returns `true` for a manual thermostat.
 */
export function isManualRoomThermostat(thermostat: EnyoRoomThermostatEnum | undefined): boolean {
    return thermostat === undefined || MANUAL_THERMOSTATS.has(thermostat);
}

/**
 * How much warmth the most demanding room behind a manual thermostat asks for.
 *
 * @param roomIds - The rooms of the circuit.
 * @param traitsOf - A room's warmth and thermostat.
 * @returns The highest rank, or `undefined` when no room has a manual thermostat.
 */
export function curveTopManualRank(
    roomIds: readonly string[],
    traitsOf: (roomId: string) => CurveRoomTraits | undefined,
): number | undefined {
    const ranks = roomIds
        .filter((roomId) => isManualRoomThermostat(traitsOf(roomId)?.thermostat))
        .map((roomId) => curveWarmthRank(traitsOf(roomId)));
    return ranks.length > 0 ? Math.max(...ranks) : undefined;
}

/**
 * The rooms of a heating circuit the curve is judged by. One flow temperature
 * heats every room of the circuit, so the curve has to serve the warmest wish:
 * of the rooms with a manual thermostat, those asking for the most warmth keep
 * it fully open and show what the curve does. Every other one is held back by
 * its thermostat, reads the thermostat rather than the curve, and would mislead
 * the controller. A room with no thermostat follows the curve, and one with a
 * self-regulating thermostat holds its own target — both are always judged.
 *
 * @param roomIds - The rooms of the circuit.
 * @param traitsOf - A room's warmth and thermostat.
 * @returns The judged room IDs, in the order given.
 */
export function curveJudgedRoomIds(
    roomIds: readonly string[],
    traitsOf: (roomId: string) => CurveRoomTraits | undefined,
): string[] {
    const top = curveTopManualRank(roomIds, traitsOf);
    return roomIds.filter((roomId) => {
        const traits = traitsOf(roomId);
        return !isManualRoomThermostat(traits?.thermostat) || curveWarmthRank(traits) === top;
    });
}

/**
 * The rooms a heating circuit's curve optimisation is judged by, resolved
 * against the rooms of the home ({@link EnergyAppRoom.getRooms} or
 * {@link EnergyAppRoom.getRoomsById}). A room that no longer exists is
 * dropped. Whether a judged room can be measured is up to
 * {@link EnergyAppRoomTemperatures}.
 *
 * @param settings - The circuit's {@link EnyoHeatpumpApplianceHeatingCircuit.curveOptimization}.
 * @param rooms - Every room of the home.
 * @returns The judged rooms, in the order of `settings.roomIds`.
 */
export function curveOptimizationRooms(
    settings: EnyoHeatpumpHeatingCurveOptimizationSettings | undefined,
    rooms: readonly EnyoRoom[],
): EnyoRoom[] {
    const live = (settings?.roomIds ?? []).flatMap((roomId) => {
        const room = rooms.find((candidate) => candidate.id === roomId);
        return room ? [room] : [];
    });
    const judged = curveJudgedRoomIds(live.map((room) => room.id), (roomId) => live.find((room) => room.id === roomId));
    return live.filter((room) => judged.includes(room.id));
}
