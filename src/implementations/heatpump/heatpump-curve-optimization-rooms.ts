/**
 * Which rooms of a heating circuit the room-temperature based heating curve
 * optimisation is judged by: every room the customer named for the circuit.
 */

import type {EnyoHeatpumpHeatingCurveOptimizationSettings} from '../../types/enyo-heatpump-appliance.js';
import type {EnyoRoom} from '../../types/enyo-room.js';

/**
 * The rooms a heating circuit's curve optimisation is judged by — every room
 * the customer named for the circuit — resolved
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
    return (settings?.roomIds ?? []).flatMap((roomId) => {
        const room = rooms.find((candidate) => candidate.id === roomId);
        return room ? [room] : [];
    });
}
