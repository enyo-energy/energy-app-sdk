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
}

/**
 * Metadata for a temperature sensor appliance, containing the list of sensors it manages.
 */
export interface EnyoTemperatureSensorApplianceMetadata {
    /** Array of sensor definitions managed by this appliance */
    sensors: EnyoTemperatureSensor[];
}
