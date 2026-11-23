import {EnergyAppPackageLanguage} from "../energy-app-package-definition.js";

/**
 * Enum representing the type classification of a temperature sensor.
 */
export enum EnyoTemperatureSensorTypeEnum {
    /** Outdoor ambient temperature sensor */
    Outdoor = 'Outdoor',
    /** Room temperature sensor */
    Room = 'Room',
    /** Other/unclassified temperature sensor */
    Other = 'Other',
}

/**
 * Control mode a room thermostat (radiator or wall thermostat) runs in, as
 * reported in {@link EnyoTemperatureSensorValue.controlMode}.
 *
 * Mirrors the modes common to room thermostats (e.g. Homematic's
 * `AUTOMATIC` / `MANUAL` / `ECO`). Temporary overrides such as boost or an
 * open window are not modes; they are reported separately as
 * {@link EnyoTemperatureSensorValue.boostActive} and
 * {@link EnyoTemperatureSensorValue.windowOpen}.
 */
export enum EnyoRoomControlModeEnum {
    /** The thermostat follows its own time program. */
    Automatic = 'Automatic',
    /** The setpoint was set by hand and is held until changed. */
    Manual = 'Manual',
    /** The thermostat holds its lowered eco setpoint (e.g. while nobody is home). */
    Eco = 'Eco',
}

export interface EnyoApplianceSensorName {
    language: EnergyAppPackageLanguage;
    name: string;
}

/**
 * Represents a single temperature sensor definition within an appliance.
 */
export interface EnyoTemperatureSensor {
    /** Unique identifier for the sensor */
    id: string;
    name: EnyoApplianceSensorName[];
    /** Optional type classification of the sensor */
    type?: EnyoTemperatureSensorTypeEnum;
    /**
     * Whether this sensor also measures relative humidity, reported as
     * {@link EnyoTemperatureSensorValue.humidityPercent}.
     *
     * Declared here rather than inferred from whether a reading happens to
     * carry a value: a consumer laying out a sensor screen needs to know
     * before the first reading arrives, and a sensor that reports humidity
     * intermittently would otherwise flicker in and out of the UI.
     *
     * Absent means unknown, not `false` — plenty of integrations predate the
     * flag, so fall back to whatever the readings carry rather than hiding a
     * value that is plainly there.
     */
    measuresHumidity?: boolean;
    /**
     * Whether this sensor is a thermostat that reports its control state:
     * {@link EnyoTemperatureSensorValue.controlMode},
     * {@link EnyoTemperatureSensorValue.boostActive} and
     * {@link EnyoTemperatureSensorValue.windowOpen}.
     *
     * Declared here for the same reason as {@link measuresHumidity}: a consumer
     * can lay out the mode row before the first reading arrives.
     *
     * Absent means unknown, not `false` — fall back to whatever the readings
     * carry.
     */
    reportsControlMode?: boolean;
}

/**
 * Metadata for a temperature sensor appliance, containing the list of sensors it manages.
 */
export interface EnyoTemperatureSensorApplianceMetadata {
    /** Array of sensor definitions managed by this appliance */
    sensors: EnyoTemperatureSensor[];
}
