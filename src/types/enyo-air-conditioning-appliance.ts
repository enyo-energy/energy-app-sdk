/**
 * Available features for an air conditioning appliance.
 */
export enum EnyoAirConditioningApplianceAvailableFeaturesEnum {
    /** If the air conditioning unit supports cooling */
    Cooling = 'Cooling',
    /** If the air conditioning unit supports heating */
    Heating = 'Heating',
}

/**
 * Operating modes for an air conditioning appliance.
 */
export enum EnyoAirConditioningApplianceModeEnum {
    /** The air conditioning unit is idle */
    Idle = 'Idle',
    /** The air conditioning unit is actively cooling */
    Cooling = 'Cooling',
    /** The air conditioning unit is actively heating */
    Heating = 'Heating',
}

/**
 * A room associated with an air conditioning appliance.
 * Each room has a unique index and an optional custom name.
 */
export interface EnyoAirConditioningApplianceRoom {
    /** Zero-based index identifying the room */
    index: number;
    /** Optional custom name for the room (e.g. "Living Room", "Bedroom") */
    customName?: string;
}

/**
 * Type-specific metadata for an air conditioning appliance.
 * Contains available features, current operating mode, and configured rooms.
 */
export interface EnyoAirConditioningApplianceMetadata {
    /** List of features supported by this air conditioning unit */
    availableFeatures: EnyoAirConditioningApplianceAvailableFeaturesEnum[];
    /** Current operating mode of the air conditioning unit */
    mode?: EnyoAirConditioningApplianceModeEnum;
    /** Rooms served by this air conditioning unit (0 to n) */
    rooms?: EnyoAirConditioningApplianceRoom[];
}
