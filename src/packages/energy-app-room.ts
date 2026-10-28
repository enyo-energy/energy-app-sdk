import {EnyoRoom, EnyoRoomsChangedListener} from "../types/enyo-room.js";

/**
 * Interface for reading the rooms of the home.
 *
 * Rooms are set up by the customer in the enyo app: a name, the appliances in
 * it, the temperature the customer wants there and — for the heating curve
 * optimisation — how warm it should be compared with the other rooms of its
 * heating circuit and which thermostat it has. Apps only read them. The
 * temperatures measured in a room come from {@link EnergyAppRoomTemperatures}.
 *
 * Access to this API requires the `Room` permission
 * ({@link EnergyAppPermissionType}).
 *
 * @example
 * ```typescript
 * const rooms = energyApp.useRoom();
 *
 * // On boot: read the rooms.
 * applyRooms(await rooms.getRooms());
 *
 * // Afterwards: react to the customer changing a room.
 * rooms.listenForRoomsChanged((all) => applyRooms(all));
 * ```
 */
export interface EnergyAppRoom {
    /**
     * Returns every room of the home.
     *
     * @returns Promise that resolves to the rooms, in no particular order
     * @throws {EnergyAppPermissionNotGrantedError} If the `Room` permission is not granted.
     */
    getRooms(): Promise<EnyoRoom[]>;
    /**
     * Returns the rooms with the given IDs, e.g. the
     * {@link EnyoHeatpumpHeatingCurveOptimizationSettings.roomIds} of a
     * heating circuit. An ID without a room — the customer removed it — is
     * left out.
     *
     * @param roomIds - IDs of the rooms to return
     * @returns Promise that resolves to the rooms found, in the order of `roomIds`
     * @throws {EnergyAppPermissionNotGrantedError} If the `Room` permission is not granted.
     */
    getRoomsById(roomIds: string[]): Promise<EnyoRoom[]>;
    /**
     * Registers a listener called with every room of the home whenever the
     * customer creates, changes or removes one.
     *
     * @param listener - Callback invoked with all rooms after the change
     * @returns A listener ID that can be passed to {@link removeListener}
     * @throws {EnergyAppPermissionNotGrantedError} If the `Room` permission is not granted.
     */
    listenForRoomsChanged(listener: EnyoRoomsChangedListener): string;
    /**
     * Removes a listener registered with {@link listenForRoomsChanged}.
     *
     * @param listenerId - The ID returned when the listener was registered
     */
    removeListener(listenerId: string): void;
}
