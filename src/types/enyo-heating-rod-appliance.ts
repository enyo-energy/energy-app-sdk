import type {EnyoHeatpumpControlAreaEnum, EnyoHeatpumpControlModeDefault, EnyoHeatpumpControlModeEnum} from './enyo-heatpump-appliance.js';
import type {EnyoLegionellaProgramMetadata} from './enyo-legionella.js';

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
    /**
     * If the heating rod's app can write the start of its weekly legionella
     * program via {@link EnyoDataBusSetLegionellaScheduleV1} — so the energy
     * manager can move it to a time with solar power or cheaper electricity.
     *
     * Declare it only when the app handles the message (check it with
     * {@link validateHeatingRodLegionellaSchedule} first), and report
     * {@link EnyoHeatingRodApplianceMetadata.legionella} with `ownerSlot` and
     * `adjustable`. Without the feature, a rod reporting `legionella` still
     * gets recommendations the customer carries out on the device.
     */
    LegionellaSchedule = 'LegionellaSchedule',
    /**
     * If the heating rod's app publishes {@link EnyoDataBusLegionellaStatusV1}
     * for every run of its legionella program. Optional: without it the
     * energy manager assumes a run is done `estimatedDurationMinutes` after
     * its start.
     */
    LegionellaRunStatus = 'LegionellaRunStatus',
}

/**
 * The customer's {@link EnyoHeatpumpControlModeEnum | mode} per control area of
 * a heating rod — see {@link EnyoHeatingRodApplianceMetadata.controlModes}. A
 * heating rod has one area,
 * {@link EnyoHeatpumpControlAreaEnum.LegionellaProgram}; the rod's surplus
 * heating keeps following the energy manager settings (`heatingRodControl`,
 * `heatingRodMode`).
 */
export type EnyoHeatingRodControlModes = Partial<
    Record<EnyoHeatpumpControlAreaEnum.LegionellaProgram, EnyoHeatpumpControlModeEnum>
>;

/**
 * The integration's default mode per control area of a heating rod — see
 * {@link EnyoHeatingRodApplianceMetadata.controlModeDefaults}. Only
 * {@link EnyoHeatpumpControlModeEnum.Off} or
 * {@link EnyoHeatpumpControlModeEnum.Recommend}, never `Auto`.
 */
export type EnyoHeatingRodControlModeDefaults = Partial<
    Record<EnyoHeatpumpControlAreaEnum.LegionellaProgram, EnyoHeatpumpControlModeDefault>
>;

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
    /**
     * The weekly legionella program of the tank this rod heats, when the rod
     * runs it itself. Makes the control area
     * {@link EnyoHeatpumpControlAreaEnum.LegionellaProgram} available; with
     * {@link EnyoHeatingRodApplianceAvailableFeaturesEnum.LegionellaSchedule}
     * the energy manager can also move the slot itself.
     *
     * When the rod belongs to a heatpump ({@link heatpumpApplianceId}) and the
     * heatpump runs the program, report it on the heatpump's
     * domestic-hot-water zone only, not here.
     */
    legionella?: EnyoLegionellaProgramMetadata;
    /**
     * The customer's mode per control area: off, recommend or auto. The only
     * area is {@link EnyoHeatpumpControlAreaEnum.LegionellaProgram}.
     *
     * **Customer-owned.** Set in the enyo app, never by an integration: the
     * host keeps the customer's value whenever an integration saves the
     * appliance. Always read it through {@link resolveHeatingRodControlModes}.
     * An integration that wants another starting mode sets
     * {@link controlModeDefaults} instead.
     * A monitor-only rod ({@link controlAllowed} `false`) resolves to `Off`.
     */
    controlModes?: EnyoHeatingRodControlModes;
    /**
     * The mode the integration wants while the customer has stored none in
     * {@link controlModes}: `Off` or `Recommend`, never `Auto`.
     *
     * **Integration-owned**, the opposite of {@link controlModes}: the
     * integration writes it and the host keeps it as written. Replaces the SDK
     * default `Recommend` in {@link resolveHeatingRodControlModes}; an `Auto`
     * or unknown value is ignored. Validate with
     * `validateControlModeDefaults(defaults, [EnyoHeatpumpControlAreaEnum.LegionellaProgram])`.
     */
    controlModeDefaults?: EnyoHeatingRodControlModeDefaults;
}
