export enum EnyoHeatpumpApplianceAvailableFeaturesEnum {
    /** If the heatpump is capable of domestic hot water*/
    DomesticHotWater = 'DomesticHotWater',
    /** If the heatpump has a heating rod*/
    HeatingRod = 'HeatingRod',
    /** If the heating rod of the heatpump can be actively controlled (steered) by the energy manager */
    HeatingRodControllable = 'HeatingRodControllable',
    /** If the heatpump supports room overheating via heating circuits */
    RoomOverheating = 'RoomOverheating',
    /** If the heatpump supports buffer tank overheating */
    BufferTankOverheating = 'BufferTankOverheating',
    /** If the heatpump supports domestic hot water overheating */
    DomesticHotWaterOverheating = 'DomesticHotWaterOverheating',
    /** If the heatpump supports available power announcements */
    AvailablePowerAnnouncement = 'AvailablePowerAnnouncement',
    /** If the heatpump reports power values (e.g. electrical power consumption in watts) */
    Power = 'Power',
    /** If the heatpump is ready for calibration (i.e. has all prerequisites in place to start a calibration run) */
    ReadyForCalibration = 'ReadyForCalibration',
    /** If the heatpump supports cooling (reversible heatpump) */
    Cooling = 'Cooling',
}

/**
 * The current operating state of a heatpump.
 */
export enum EnyoHeatpumpApplianceModeEnum {
    /** The heatpump is idle (not actively heating, cooling, or producing hot water) */
    Idle = 'Idle',
    /** The heatpump is actively heating */
    Heating = 'Heating',
    /** The heatpump is actively cooling (reversible heatpumps only) */
    Cooling = 'Cooling',
    /** The heatpump is actively producing domestic hot water */
    DomesticHotWater = 'DomesticHotWater',
    /** The heatpump is running in emergency operation */
    EmergencyOperation = 'EmergencyOperation',
}

/**
 * Describes how an enyo Hub physically/logically connects to the heatpump.
 * Used by hosts and energy managers to reason about the integration's
 * capabilities (e.g. SG-Ready offers only coarse 4-state control while an API
 * connection typically exposes fine-grained read/write access).
 */
export enum EnyoHeatpumpApplianceConnectionTypeEnum {
    /** Connected via the SG-Ready interface (two relay inputs, four states) */
    SgReady = 'sg-ready',
    /** Connected via a vendor or local API (e.g. REST, Modbus, EEBus) */
    Api = 'api',
}

/**
 * Additional heating devices that can be attached to / combined with a
 * heatpump installation.
 */
export enum EnyoHeatpumpApplianceAdditionalDeviceEnum {
    /** An electric heating rod (immersion heater) is present in the installation */
    HeatingRod = 'HeatingRod',
    /** A solar thermal system is present in the installation */
    SolarThermal = 'SolarThermal',
}

/**
 * Describes how the heating rod of a heatpump installation is used.
 * Consumers (UI, energy manager) use this to decide whether the heating rod is
 * the sole heat source or only assists the compressor.
 */
export enum EnyoHeatpumpApplianceHeatingRodUsageEnum {
    /** The heating rod is the only heat source used (no compressor support) */
    OnlyHeatingRot = 'OnlyHeatingRot',
    /** The heating rod is used in addition to the compressor to further increase the temperature */
    HeatingRodForTemperatureIncrease = 'HeatingRodForTemperatureIncrease',
}

/**
 * How the installation stores thermal energy — which is what decides whether a
 * buffer-tank entry and a domestic-hot-water entry describe two separate
 * vessels or one shared one.
 *
 * A **combi storage** (Kombispeicher) is a single cylinder that serves both the
 * heating buffer and domestic hot water, typically as a tank-in-tank or with an
 * internal DHW coil. It is reported as one
 * {@link EnyoHeatpumpApplianceBufferTank} *and* one
 * {@link EnyoHeatpumpApplianceDomesticHotWater} entry sharing the same `index`,
 * because both functions have their own setpoint and their own temperature —
 * but the two entries are backed by the same water.
 */
export enum EnyoHeatpumpApplianceStorageTypeEnum {
    /** No thermal store — the heatpump feeds the heating circuits directly. */
    None = 'None',
    /**
     * A dedicated buffer tank and a dedicated domestic-hot-water cylinder, each
     * its own physical vessel. This is the default: an omitted
     * {@link EnyoHeatpumpApplianceMetadata.storageType} means `SeparateTanks`.
     */
    SeparateTanks = 'SeparateTanks',
    /**
     * One combi storage serving both the heating buffer and domestic hot water.
     *
     * Consumers must not treat the buffer and DHW entries as independent energy
     * stores: their {@link EnyoHeatpumpApplianceBufferTank.whPerDegreeCelsius}
     * and {@link EnyoHeatpumpApplianceDomesticHotWater.whPerDegreeCelsius}
     * describe overlapping volume, so summing them overstates how much surplus
     * the installation can absorb, and overheating one zone moves the other.
     */
    CombiStorage = 'CombiStorage',
}

/**
 * The type of heat emitter connected to a heating circuit. Influences the
 * flow temperatures the circuit operates at (floor heating typically runs at
 * lower temperatures than radiators).
 */
export enum EnyoHeatpumpApplianceHeatingCircuitTypeEnum {
    /** The heating circuit supplies radiators */
    Radiators = 'Radiators',
    /** The heating circuit supplies underfloor (floor) heating */
    FloorHeating = 'FloorHeating',
}

/**
 * A domestic-hot-water zone of the installation.
 *
 * In a combi installation
 * ({@link EnyoHeatpumpApplianceStorageTypeEnum.CombiStorage}) this describes the
 * DHW half of the shared cylinder, and the {@link EnyoHeatpumpApplianceBufferTank}
 * with the same {@link index} describes the buffer half of that same vessel.
 */
export interface EnyoHeatpumpApplianceDomesticHotWater {
    /**
     * Zero-based index of this DHW zone. Under
     * {@link EnyoHeatpumpApplianceStorageTypeEnum.CombiStorage} it also links
     * this zone to the buffer-tank entry sharing the same physical tank.
     */
    index: number;
    tankSizeLiter?: number;
    /**
     * Thermal energy required to raise this tank's temperature by 1 K, in
     * watt-hours per Kelvin (Wh/K).
     *
     * Turns a temperature band into an amount of storable energy: overheating
     * the tank from 50 °C to 60 °C absorbs `10 * whPerDegreeCelsius` watt-hours.
     * That is what lets an EMS weigh the tank against a battery when deciding
     * where to put PV surplus, and size an overheating run against
     * {@link maxTemperatureC} rather than guessing.
     *
     * For pure water the theoretical figure is ~1.163 Wh/(L·K), so a 300 L tank
     * sits near 350 Wh/K. Report the value that reflects the real installation
     * where it is known or measured — stratification, the usable share of the
     * volume and standing losses all pull it away from the ideal, and a value
     * derived from a calibration run beats one derived from
     * {@link tankSizeLiter}.
     *
     * This is **thermal** energy in the tank, not electricity drawn from the
     * grid. Divide by the heatpump's COP at the time to get the electrical
     * input; for a resistive heating rod the two are effectively equal (see
     * {@link EnyoHeatingRodApplianceMetadata.whPerDegreeCelsius}).
     */
    whPerDegreeCelsius?: number;
    targetTemperatureC: number;
    hysteresisK?: number;
    /**
     * Maximum temperature (in °C) the domestic hot water tank may be heated to.
     * Acts as an upper bound the EMS must not exceed (e.g. when overheating the
     * tank to store surplus energy).
     */
    maxTemperatureC?: number;
}

/**
 * A heating buffer tank of the installation.
 *
 * In a combi installation
 * ({@link EnyoHeatpumpApplianceStorageTypeEnum.CombiStorage}) this describes the
 * buffer half of the shared cylinder — see
 * {@link EnyoHeatpumpApplianceMetadata.storageType}.
 */
export interface EnyoHeatpumpApplianceBufferTank {
    /**
     * Zero-based index of this buffer tank. Under
     * {@link EnyoHeatpumpApplianceStorageTypeEnum.CombiStorage} it also links
     * this tank to the DHW entry sharing the same physical vessel.
     */
    index: number;
    tankSizeLiter?: number;
    /**
     * Thermal energy required to raise this buffer tank's temperature by 1 K,
     * in watt-hours per Kelvin (Wh/K).
     *
     * The buffer-tank counterpart of
     * {@link EnyoHeatpumpApplianceDomesticHotWater.whPerDegreeCelsius}, and read
     * the same way: overheating the buffer by 5 K stores
     * `5 * whPerDegreeCelsius` watt-hours of thermal energy. Relevant to any
     * heatpump advertising
     * {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.BufferTankOverheating},
     * which otherwise has no way to say how much energy an overheating run
     * actually absorbs.
     *
     * Thermal energy in the tank, not electrical input — divide by the current
     * COP for the latter.
     */
    whPerDegreeCelsius?: number;
    targetTemperatureC?: number;
    hysteresisK?: number;
}

export interface EnyoHeatpumpApplianceCompressor {
    index: number;
}

export interface EnyoHeatpumpApplianceHeatingCircuit {
    index: number;
    /** Target room temperature setpoint when heating (in °C) */
    targetRoomTemperatureC?: number;
    /** Target room temperature setpoint when cooling (in °C). Only meaningful for cooling-capable heatpumps. */
    targetCoolingRoomTemperatureC?: number;
    /** Type of heat emitter connected to this circuit (e.g. radiators or floor heating) */
    type?: EnyoHeatpumpApplianceHeatingCircuitTypeEnum;
    /** Optional custom name for the heating circuit, defined by the user (e.g. "Ground floor") */
    customName?: string;
}

/**
 * The fitted thermal model of the building the heatpump heats.
 *
 * Produced by observing the installation rather than read from the device: an
 * app derives the coefficients from measured outdoor temperature, room
 * temperature and heat output over time, so the figures describe *this* house
 * as it actually behaves, not its design values. They are what lets an EMS
 * answer "how much heat does this building need at -5 °C" and "how long does it
 * coast once the compressor stops" — the two questions behind every
 * pre-heating, load-shifting or blocking decision.
 *
 * Treat the model as an estimate with an age: it drifts with the seasons, with
 * occupancy, and after any change to the envelope or the hydraulics. Weigh it
 * against {@link fittedAtMs} and re-fit rather than trusting an old fit
 * indefinitely.
 */
export interface EnyoHeatpumpApplianceBuildingModel {
    /**
     * Heat loss coefficient of the building in Watts per Kelvin (W/K) — the
     * steady-state heat output needed per Kelvin of difference between inside
     * and outside.
     *
     * Multiply by the temperature difference for the heat demand: a building at
     * 312 W/K holding 21 °C against an outdoor -5 °C needs roughly
     * `312 * 26 ≈ 8.1 kW` of heat. Divide by the COP for the electrical input.
     *
     * This is the whole-building figure including ventilation losses, as fitted
     * — not a per-square-metre or per-element U-value.
     */
    uaWPerK: number;
    /**
     * Heating limit temperature in °C (Heizgrenztemperatur) — the outdoor
     * temperature above which the building needs no space heating, because
     * solar and internal gains cover the losses on their own.
     *
     * Marks the boundary of the heating season for this building. Above it,
     * space-heating demand is effectively zero and only domestic hot water
     * remains, so an EMS should not plan pre-heating runs against a forecast
     * that stays above this value.
     */
    heatingLimitC: number;
    /**
     * Thermal time constant of the building in hours — how long it takes the
     * indoor temperature to fall to roughly 37 % (1/e) of an initial deviation
     * once heating stops.
     *
     * The building's thermal inertia, and therefore how long it can be blocked
     * before comfort suffers: a heavy house at 32 h coasts through an expensive
     * evening almost unharmed, a light one at 8 h does not. It also bounds how
     * far ahead pre-heating is worth placing — heat banked much earlier than
     * this has leaked away before it is needed.
     */
    timeConstantH: number;
    /**
     * When this model was fitted, as epoch milliseconds.
     *
     * Its age is part of the reading: coefficients fitted last winter may no
     * longer describe the building after insulation work, a new heating curve,
     * or a change in how the house is used. Consumers should prefer a recent
     * fit and may disregard a stale one.
     */
    fittedAtMs: number;
}

export interface EnyoHeatpumpApplianceMetadata {
    availableFeatures: EnyoHeatpumpApplianceAvailableFeaturesEnum[];
    mode?: EnyoHeatpumpApplianceModeEnum;
    domesticHotWater?: EnyoHeatpumpApplianceDomesticHotWater[];
    bufferTanks?: EnyoHeatpumpApplianceBufferTank[];
    compressors?: EnyoHeatpumpApplianceCompressor[];
    heatingCircuits?: EnyoHeatpumpApplianceHeatingCircuit[];
    /**
     * Optional indicator of how the package connects to the heatpump.
     * Helps consumers (UI, energy manager) understand the control surface
     * available — e.g. an SG-Ready connection is limited to four discrete
     * states, while an API connection typically allows direct read/write.
     */
    connectionType?: EnyoHeatpumpApplianceConnectionTypeEnum;
    /**
     * Whether the energy manager is allowed to actively control (steer) this
     * heatpump. When `false`, the heatpump is treated as read-only/monitor-only
     * and the EMS must not issue control commands to it. When omitted,
     * consumers should fall back to their configured default behaviour.
     */
    controlAllowed?: boolean;
    /**
     * Additional heating devices present in the installation alongside the
     * heatpump (e.g. a heating rod or a solar thermal system).
     */
    additionalDevices?: EnyoHeatpumpApplianceAdditionalDeviceEnum[];
    /**
     * How the heating rod of the installation is used (e.g. as the only heat
     * source or only to further increase the temperature on top of the
     * compressor). Only meaningful if the heatpump has a heating rod
     * (see {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.HeatingRod}).
     */
    heatingRodUsage?: EnyoHeatpumpApplianceHeatingRodUsageEnum;
    /**
     * How the installation stores thermal energy — separate buffer and DHW
     * tanks, a single combi storage serving both, or no store at all.
     *
     * Set it to {@link EnyoHeatpumpApplianceStorageTypeEnum.CombiStorage} for a
     * Kombispeicher and report the tank in both {@link bufferTanks} and
     * {@link domesticHotWater} under the same `index`: the two zones have
     * separate setpoints but share one body of water, so an EMS must plan them
     * as one store rather than adding their capacities together.
     *
     * Defaults to {@link EnyoHeatpumpApplianceStorageTypeEnum.SeparateTanks}
     * when omitted, so a combi installation has to declare itself — an
     * unreported Kombispeicher is planned as two independent stores.
     */
    storageType?: EnyoHeatpumpApplianceStorageTypeEnum;
    /**
     * The fitted thermal model of the building this heatpump heats — its heat
     * loss coefficient, heating limit and time constant, plus when the fit was
     * made.
     *
     * Optional and absent until an app has observed the installation long
     * enough to fit it; consumers must handle its absence rather than
     * substituting design values for an unknown building.
     */
    building?: EnyoHeatpumpApplianceBuildingModel;
}