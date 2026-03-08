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
export enum PvSystemOrientationSourceEnum {
    UserProvided = 'user',
    Estimated = 'estimated'
}

export enum PvSystemCreatedBy {
    User = 'user',
    EnergyApp = 'energy-app'
}

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
 * Feed-in tariff configuration for a PV system.
 * Defines the price for grid feed-in and behavior during negative market prices.
 */
export interface PvSystemFeedInTariff {
    /** Price per kWh received for feeding electricity into the grid */
    gridFeedInPricePerKwh: number;
    /** Whether feed-in refund is disabled when the market price is negative */
    noFeedInRefundOnNegativeMarketPrice: boolean;
}

/**
 * Registration data for a PV system.
 */
export interface EnyoPvSystem {
    /** Unique identifier of the registered PV system */
    id: string;
    /** Peak power capacity of the entire PV system in kilowatts peak */
    kWp: number;
    /** Indicates who created the PV system entry (user or energy app) */
    createdBy: PvSystemCreatedBy;
    /** Array of DC strings describing the panel groups and their orientations */
    dcStrings: PvSystemDcString[];
    /** Optional list of appliances associated with this PV system */
    appliances?: PvSystemAppliance[];
    /** Optional feature flags for this PV system */
    features?: PvSystemFeatureEnum[];
    /** Optional feed-in tariff configuration for this PV system */
    feedInTariff?: PvSystemFeedInTariff;
}
