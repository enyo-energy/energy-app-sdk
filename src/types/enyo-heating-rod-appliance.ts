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
    /**
     * Volume of the tank this heating rod sits in, in litres.
     *
     * The same field as
     * {@link EnyoHeatpumpApplianceDomesticHotWater.tankSizeLiter} /
     * {@link EnyoHeatpumpApplianceBufferTank.tankSizeLiter}, and it applies to
     * whichever tank the rod actually heats — a domestic hot water cylinder or a
     * heating buffer. Reported here so a standalone heating rod, one that belongs
     * to no heatpump appliance, can still describe its storage.
     *
     * Useful on its own for sizing and display, and as the fallback behind
     * {@link whPerDegreeCelsius}: at ~1.163 Wh/(L·K) for pure water a tank of
     * this size takes roughly `tankSizeLiter * 1.163` watt-hours per Kelvin.
     * Prefer the measured {@link whPerDegreeCelsius} where it is known — the
     * volume alone ignores stratification and the share of it the rod really
     * reaches.
     *
     * When the rod belongs to a heatpump installation
     * ({@link heatpumpApplianceId}), this describes the same physical tank as the
     * heatpump's entry and the two should agree.
     */
    tankSizeLiter?: number;
    /**
     * Thermal energy required to raise the temperature of the tank this heating
     * rod sits in by 1 K, in watt-hours per Kelvin (Wh/K).
     *
     * Applies to whichever tank the rod actually heats — a domestic hot water
     * cylinder or a heating buffer. Together with {@link ratedPowerW} it answers
     * the two questions an EMS has about a surplus run: how much energy the tank
     * can absorb over a temperature band (`ΔT * whPerDegreeCelsius`), and how
     * long the rod needs to deliver it
     * (`ΔT * whPerDegreeCelsius / ratedPowerW` hours).
     *
     * For pure water the theoretical figure is ~1.163 Wh/(L·K), so a 300 L tank
     * sits near 350 Wh/K. Report the value that reflects the real installation
     * where it is known or measured: stratification and the usable share of the
     * volume both pull it away from the ideal, and a rod mounted high in a
     * cylinder heats far less water than the cylinder holds.
     *
     * Defined as **thermal** energy, matching
     * {@link EnyoHeatpumpApplianceDomesticHotWater.whPerDegreeCelsius} so the two
     * are directly comparable. A resistive element converts electricity to heat
     * at essentially 100 %, so for the rod alone the electrical input is the same
     * number — unlike a heatpump, where it must be divided by the COP.
     *
     * When the rod belongs to a heatpump installation
     * ({@link heatpumpApplianceId}), this value and the one on the heatpump's
     * tank describe the same physical tank and should agree.
     */
    whPerDegreeCelsius?: number;
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
