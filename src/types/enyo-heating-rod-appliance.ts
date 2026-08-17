/**
 * Available features for a heating rod (immersion / electric resistive heating
 * element) appliance.
 */
export enum EnyoHeatingRodApplianceAvailableFeaturesEnum {
    /** If the heating rod reports electrical power values (e.g. consumption in watts) */
    Power = 'Power',
    /** If the heating rod supports available power announcements */
    AvailablePowerAnnouncement = 'AvailablePowerAnnouncement',
    /**
     * If the heating rod has a domestic hot water temperature sensor, i.e. it
     * reports the measured DHW tank temperature rather than only its own
     * operating state.
     *
     * Without this feature {@link EnyoHeatingRodApplianceMetadata.targetTemperatureC}
     * is a setpoint the appliance cannot verify — consumers should not expect a
     * measured temperature to compare it against.
     */
    DomesticHotWaterSensor = 'DomesticHotWaterSensor',
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
    /** the target temperature of this heating rod. Might be different than the target of the heatpump */
    targetTemperatureC: number;
    /**
     * Optional identifier of the heat pump appliance this heating rod is
     * associated with. References the `id` of an EnyoAppliance of type Heatpump.
     */
    heatpumpApplianceId?: string;
    /**
     * Whether the energy manager is allowed to actively control (steer) this
     * heating rod. When `false`, the heating rod is treated as
     * read-only/monitor-only and the EMS must not issue control commands to it.
     * When omitted, consumers should fall back to their configured default
     * behaviour.
     */
    controlAllowed?: boolean;
}
