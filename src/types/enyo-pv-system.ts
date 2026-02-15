import {EnergyAppApplianceTypeEnum} from "../energy-app-appliance-type.enum.js";

/**
 * Compass orientation for PV panel mounting direction.
 * Used to describe the azimuth orientation of DC strings.
 */
export enum PvOrientationEnum {
    North = 'north',
    NorthEast = 'north-east',
    East = 'east',
    SouthEast = 'south-east',
    South = 'south',
    SouthWest = 'south-west',
    West = 'west',
    NorthWest = 'north-west'
}

/**
 * Source of the orientation information for a DC string.
 * Indicates whether the orientation was provided by the user or estimated automatically.
 */
export type PvSystemOrientationSourceEnum = 'user' | 'estimated';

/**
 * Feature flags for a PV system.
 * Used to indicate special configurations or capabilities.
 */
export enum PvSystemFeatureEnum {
    OnlyGridFeedIn = 'only-grid-feed-in'
}

/**
 * Associates an appliance with a PV system.
 */
export interface PvSystemAppliance {
    /** Unique identifier of the appliance */
    applianceId: string;
    /** Type of the appliance */
    applianceType: EnergyAppApplianceTypeEnum;
}

/**
 * A single DC string of a PV system, describing a group of panels
 * with the same orientation.
 */
export interface PvSystemDcString {
    /** Number of PV modules in this DC string */
    numberOfModules: number;
    /** Compass orientation of the panels in this DC string */
    orientation: PvOrientationEnum;
    /** Source of the orientation information (user-provided or estimated) */
    orientationSource?: PvSystemOrientationSourceEnum;
}

/**
 * Registration data for a PV system.
 */
export interface PvSystemRegistration {
    /** Peak power capacity of the entire PV system in kilowatts peak */
    kWp: number;
    /** Array of DC strings describing the panel groups and their orientations */
    dcStrings: PvSystemDcString[];
    /** Optional list of appliances associated with this PV system */
    appliances?: PvSystemAppliance[];
    /** Optional feature flags for this PV system */
    features?: PvSystemFeatureEnum[];
}

/**
 * A registered PV system with its identifier and metadata.
 */
export interface PvSystemInfo extends PvSystemRegistration {
    /** Unique identifier of the registered PV system */
    pvSystemId: string;
    /** Timestamp when this PV system was registered in ISO format */
    registeredAtIso: string;
}
