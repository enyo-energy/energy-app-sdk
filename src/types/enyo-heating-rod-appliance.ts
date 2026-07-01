/**
 * Available features for a heating rod (immersion / electric resistive heating
 * element) appliance.
 */
export enum EnyoHeatingRodApplianceAvailableFeaturesEnum {
    /** If the heating rod reports electrical power values (e.g. consumption in watts) */
    Power = 'Power',
    /** If the heating rod supports available power announcements */
    AvailablePowerAnnouncement = 'AvailablePowerAnnouncement',
}

/**
 * Operating modes for a heating rod appliance.
 */
export enum EnyoHeatingRodApplianceModeEnum {
    /** The heating rod is idle (not consuming power) */
    Idle = 'Idle',
    /** The heating rod is actively heating */
    Heating = 'Heating',
}

/**
 * Type-specific metadata for a heating rod appliance.
 * Contains available features, current operating mode, rated power, and an
 * optional reference to the heat pump the heating rod is associated with.
 */
export interface EnyoHeatingRodApplianceMetadata {
    /** List of features supported by this heating rod */
    availableFeatures: EnyoHeatingRodApplianceAvailableFeaturesEnum[];
    /** Current operating mode of the heating rod */
    mode?: EnyoHeatingRodApplianceModeEnum;
    /** Rated electrical power of the heating rod in watts */
    ratedPowerW?: number;
    /**
     * Optional identifier of the heat pump appliance this heating rod is
     * associated with. References the `id` of an EnyoAppliance of type Heatpump.
     */
    heatpumpApplianceId?: string;
}
