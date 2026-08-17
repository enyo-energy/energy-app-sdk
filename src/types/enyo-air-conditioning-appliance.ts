/**
 * Available features for an air conditioning appliance.
 */
export enum EnyoAirConditioningApplianceAvailableFeaturesEnum {
    /** If the air conditioning unit supports cooling */
    Cooling = 'Cooling',
    /** If the air conditioning unit supports heating */
    Heating = 'Heating',
    /** If the air conditioning unit reports electrical power values (e.g. consumption in watts) */
    Power = 'Power',
    /** If the air conditioning unit's electrical power draw can be steered (e.g. limited to a target in watts) */
    PowerControllable = 'PowerControllable',
    /** If the air conditioning unit's target room temperature can be set */
    TemperatureControllable = 'TemperatureControllable',
}

/**
 * Energy-optimization modes for an air conditioning appliance. These control how
 * the appliance is driven with respect to available energy, independent of the
 * physical {@link EnyoAirConditioningApplianceModeEnum operating mode}.
 */
export enum EnyoAirConditioningOptimizationModeEnum {
    /** Run the air conditioning unit to consume available PV surplus. */
    PvSurplus = 'PvSurplus',
    /** Force the air conditioning unit to run at full power for maximum comfort, regardless of surplus. */
    Boost = 'Boost',
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
    /** List of features supported by this air conditioning unit (e.g. Cooling, Heating) */
    availableFeatures: EnyoAirConditioningApplianceAvailableFeaturesEnum[];
    /** Current operating mode of the air conditioning unit */
    mode?: EnyoAirConditioningApplianceModeEnum;
    /** Current energy-optimization mode of the air conditioning unit (e.g. PV surplus, boost) */
    optimizationMode?: EnyoAirConditioningOptimizationModeEnum;
    /** Rooms served by this air conditioning unit (0 to n) */
    rooms?: EnyoAirConditioningApplianceRoom[];
    /**
     * Whether the energy manager is allowed to actively control (steer) this
     * air conditioning unit. When `false`, the unit is treated as
     * read-only/monitor-only and the EMS must not issue control commands to it.
     * When omitted, consumers should fall back to their configured default
     * behaviour.
     */
    controlAllowed?: boolean;
}
