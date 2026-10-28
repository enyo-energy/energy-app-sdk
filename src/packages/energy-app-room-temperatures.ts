import {
    EnyoRoomCurrentTemperatures,
    EnyoRoomTemperatureHistoryRequest,
    EnyoRoomTemperatureHistoryResponse,
} from "../types/enyo-room-temperature.js";

/**
 * Interface for reading the temperatures measured in the rooms of the home
 * ({@link EnergyAppRoom}), current and past. A room can have several
 * temperature sensors; each one is reported on its own.
 *
 * There is no listener: to follow a room's temperatures, read the current
 * values once and then subscribe to the
 * {@link EnyoDataBusMessageEnum.TemperatureSensorValuesUpdateV1} messages of
 * the sensors they name ({@link EnyoRoomTemperatureSensorReading.applianceId},
 * {@link EnyoRoomTemperatureSensorReading.sensorId}) on the data bus.
 *
 * Access to this API requires the `RoomTemperatures` permission
 * ({@link EnergyAppPermissionType}).
 *
 * @example
 * ```typescript
 * const roomTemperatures = energyApp.useRoomTemperatures();
 *
 * // Current values of the rooms a heating circuit heats.
 * const current = await roomTemperatures.getCurrentRoomTemperatures(['living', 'bath']);
 *
 * // The last 24 hours in 15-minute buckets.
 * const history = await roomTemperatures.getRoomTemperatureHistory({
 *     roomIds: ['living', 'bath'],
 *     startDateIso: '2026-10-27T00:00:00Z',
 *     endDateIso: '2026-10-28T00:00:00Z',
 * });
 * ```
 */
export interface EnergyAppRoomTemperatures {
    /**
     * Returns the latest reading of every temperature sensor in the given
     * rooms. An ID without a room is left out.
     *
     * @param roomIds - IDs of the rooms ({@link EnyoRoom.id}) to read
     * @returns Promise that resolves to one entry per room found, in the order of `roomIds`
     * @throws {EnergyAppPermissionNotGrantedError} If the `RoomTemperatures` permission is not granted.
     */
    getCurrentRoomTemperatures(roomIds: string[]): Promise<EnyoRoomCurrentTemperatures[]>;
    /**
     * Returns the measured temperatures of the given rooms over a time
     * interval, per sensor and bucket. The sensors are those in the room now:
     * a sensor moved to another room brings its earlier readings along.
     *
     * @param request - The rooms, the interval and the bucket size
     * @returns Promise that resolves to the history of every room found
     * @throws {EnergyAppPermissionNotGrantedError} If the `RoomTemperatures` permission is not granted.
     */
    getRoomTemperatureHistory(request: EnyoRoomTemperatureHistoryRequest): Promise<EnyoRoomTemperatureHistoryResponse>;
}
