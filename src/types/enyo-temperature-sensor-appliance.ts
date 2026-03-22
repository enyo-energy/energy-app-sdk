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
}

/**
 * Metadata for a temperature sensor appliance, containing the list of sensors it manages.
 */
export interface EnyoTemperatureSensorApplianceMetadata {
    /** Array of sensor definitions managed by this appliance */
    sensors: EnyoTemperatureSensor[];
}
