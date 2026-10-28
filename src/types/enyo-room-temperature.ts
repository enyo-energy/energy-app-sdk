import {TimeseriesEntryBase, TimeseriesResolution} from "./enyo-timeseries.js";

/**
 * The latest reading of one temperature sensor in a room.
 *
 * `applianceId` and `sensorId` match the
 * {@link EnyoDataBusTemperatureSensorValuesV1} messages of that sensor, so an
 * app can read the current values once and then follow the sensor on the data
 * bus.
 */
export interface EnyoRoomTemperatureSensorReading {
    /** ID of the {@link EnyoApplianceTypeEnum.TemperatureSensor} appliance */
    applianceId: string;
    /** ID of the sensor within that appliance ({@link EnyoTemperatureSensor.id}) */
    sensorId: string;
    /** Measured temperature in °C */
    temperatureC: number;
    /**
     * Measured **relative** humidity in percent (0-100), for sensors that
     * measure it ({@link EnyoTemperatureSensor.measuresHumidity}).
     */
    humidityPercent?: number;
    /** When the sensor reported this reading, in ISO 8601 format */
    timestampIso: string;
}

/**
 * The current temperatures of one room: the latest reading of every room
 * temperature sensor in it. A room can have several sensors; they are reported
 * one by one, and the app decides how to combine them.
 */
export interface EnyoRoomCurrentTemperatures {
    /** ID of the room ({@link EnyoRoom.id}) */
    roomId: string;
    /**
     * The latest reading of every room temperature sensor in the room. Empty
     * when the room has no sensor or none has reported yet. An outdoor sensor
     * placed in the room is left out.
     */
    sensors: EnyoRoomTemperatureSensorReading[];
}

/**
 * Request for the measured temperatures of rooms over a time interval.
 *
 * The interval is half-open: `startDateIso` is included and `endDateIso` is
 * not, so consecutive intervals can be requested back to back.
 */
export interface EnyoRoomTemperatureHistoryRequest {
    /** IDs of the rooms ({@link EnyoRoom.id}) to read */
    roomIds: string[];
    /** ISO 8601 timestamp for the start of the interval (inclusive) */
    startDateIso: string;
    /** ISO 8601 timestamp for the end of the interval (exclusive) */
    endDateIso: string;
    /** Size of the returned buckets. Defaults to `'15m'` */
    resolution?: TimeseriesResolution;
}

/**
 * One sensor's readings within a bucket of {@link EnyoRoomTemperatureHistoryEntry}.
 */
export interface EnyoRoomTemperatureHistorySensor {
    /** ID of the {@link EnyoApplianceTypeEnum.TemperatureSensor} appliance */
    applianceId: string;
    /** ID of the sensor within that appliance ({@link EnyoTemperatureSensor.id}) */
    sensorId: string;
    /** Time-weighted average temperature in °C within the bucket */
    averageTemperatureC: number;
    /** Lowest temperature in °C within the bucket */
    minTemperatureC: number;
    /** Highest temperature in °C within the bucket */
    maxTemperatureC: number;
    /** Average **relative** humidity in percent (0-100), for sensors that measure it */
    averageHumidityPercent?: number;
}

/**
 * One time bucket of a room's temperature history. A sensor that did not
 * report within the bucket is absent from it.
 */
export interface EnyoRoomTemperatureHistoryEntry extends TimeseriesEntryBase {
    /** The readings of the room's sensors within this bucket */
    sensors: EnyoRoomTemperatureHistorySensor[];
}

/**
 * The temperature history of one room.
 */
export interface EnyoRoomTemperatureHistory {
    /** ID of the room ({@link EnyoRoom.id}) */
    roomId: string;
    /** One entry per bucket, oldest first. Buckets without any reading are left out */
    entries: EnyoRoomTemperatureHistoryEntry[];
}

/**
 * Response to {@link EnergyAppRoomTemperatures.getRoomTemperatureHistory}.
 */
export interface EnyoRoomTemperatureHistoryResponse {
    /** ISO 8601 timestamp of the requested start (inclusive) */
    requestedStartDateIso: string;
    /** ISO 8601 timestamp of the requested end (exclusive) */
    requestedEndDateIso: string;
    /** Size of the returned buckets */
    resolution: TimeseriesResolution;
    /** One history per requested room that still exists, in the order of the request */
    rooms: EnyoRoomTemperatureHistory[];
}
