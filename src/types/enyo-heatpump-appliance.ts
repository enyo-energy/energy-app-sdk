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
    /**
     * If the heatpump reports the heating curve of at least one heating circuit
     * ({@link EnyoHeatpumpApplianceHeatingCircuit.heatingCurve}).
     */
    HeatingCurve = 'HeatingCurve',
    /**
     * If the heatpump reports the time program (weekly schedule) of at least one
     * heating circuit or domestic-hot-water zone
     * ({@link EnyoHeatpumpApplianceHeatingCircuit.timeProgram},
     * {@link EnyoHeatpumpApplianceDomesticHotWater.timeProgram}).
     */
    TimeProgram = 'TimeProgram',
    /**
     * If the heatpump reports actual (measured) room temperatures for its
     * heating circuits, via `heatingCircuits[].roomTemperatureC` of
     * {@link EnyoDataBusHeatpumpTemperaturesV1}.
     */
    RoomTemperature = 'RoomTemperature',
    /**
     * If the heatpump accepts measured room temperatures as an input for its
     * room-temperature control, written into it by the energy manager via
     * {@link EnyoDataBusSetHeatpumpRoomTemperatureV1}. Typically used to feed a
     * room sensor that is not wired to the heatpump (see
     * {@link EnyoHeatpumpApplianceHeatingCircuit.roomTemperatureSensor}).
     */
    RoomTemperatureInput = 'RoomTemperatureInput',
    /**
     * If the heatpump reports flow (supply) temperatures — its own and/or per
     * heating circuit — via {@link EnyoDataBusHeatpumpTemperaturesV1}.
     */
    FlowTemperature = 'FlowTemperature',
    /**
     * If the heatpump reports return temperatures — its own and/or per heating
     * circuit — via {@link EnyoDataBusHeatpumpTemperaturesV1}.
     */
    ReturnTemperature = 'ReturnTemperature',
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
 * One point of a heating (or cooling) curve: the target flow temperature the
 * heatpump aims for at a given outdoor temperature.
 */
export interface EnyoHeatpumpApplianceHeatingCurvePoint {
    /** Outdoor temperature in °C */
    outdoorTemperatureC: number;
    /** Target flow (supply) temperature in °C at that outdoor temperature */
    flowTemperatureC: number;
}

/**
 * The heating curve (Heizkurve) of a heating circuit: which flow temperature the
 * heatpump targets for a given outdoor temperature.
 *
 * Vendors parametrise their curves differently — the same "slope 1.2, shift
 * +2 K" produces different flow temperatures on different brands — so the
 * vendor-neutral representation is {@link points}: the integration samples its
 * device's curve into outdoor → flow pairs, and consumers interpolate between
 * them. The raw vendor parameters ({@link slope}, {@link parallelShiftK}, …)
 * are kept alongside as informational values, e.g. for showing the user what
 * the installer set on the device.
 *
 * The flow temperature drives the heatpump's efficiency (COP), so the curve is
 * what lets an EMS estimate how expensive heating will be at a forecast outdoor
 * temperature and how much headroom a pre-heating run has.
 *
 * Use {@link validateHeatpumpHeatingCurve} to check a curve before publishing it.
 */
export interface EnyoHeatpumpApplianceHeatingCurve {
    /**
     * The curve as outdoor → target flow temperature pairs, sorted by strictly
     * increasing {@link EnyoHeatpumpApplianceHeatingCurvePoint.outdoorTemperatureC}.
     * At least two points are required.
     *
     * Consumers interpolate linearly between neighbouring points and clamp to
     * the first / last point outside the covered range. Sample densely enough
     * to capture a curved vendor formula (e.g. every 5 K from -20 °C to 20 °C).
     */
    points: EnyoHeatpumpApplianceHeatingCurvePoint[];
    /**
     * Raw vendor slope (Steilheit / Neigung) as shown on the device.
     * Informational only — its meaning differs between vendors; use
     * {@link points} for calculations.
     */
    slope?: number;
    /**
     * Raw vendor parallel shift (Niveau / Parallelverschiebung) of the curve in
     * Kelvin, as shown on the device. Informational only — use {@link points}
     * for calculations.
     */
    parallelShiftK?: number;
    /**
     * Room temperature in °C the curve is designed for. Some vendors shift the
     * whole curve when the room setpoint changes; this states the setpoint the
     * reported {@link points} correspond to.
     */
    referenceRoomTemperatureC?: number;
    /** Lower bound in °C the heatpump clamps the computed flow temperature to */
    minFlowTemperatureC?: number;
    /** Upper bound in °C the heatpump clamps the computed flow temperature to */
    maxFlowTemperatureC?: number;
    /**
     * Optional cooling curve of reversible heatpumps, in the same
     * representation as {@link points} (sorted by strictly increasing outdoor
     * temperature, at least two points). Only meaningful when the heatpump
     * supports {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.Cooling}.
     */
    coolingPoints?: EnyoHeatpumpApplianceHeatingCurvePoint[];
    /** When the curve was last read from the device, as epoch milliseconds */
    updatedAtMs?: number;
}

/**
 * Operating level a time program switches a heating circuit or DHW zone to.
 */
export enum EnyoHeatpumpTimeProgramLevelEnum {
    /** Normal comfort setpoint (e.g. day temperature, regular DHW temperature) */
    Comfort = 'Comfort',
    /** Reduced / eco setpoint (e.g. night setback) */
    Reduced = 'Reduced',
    /** Heating or DHW production is switched off (frost protection only) */
    Off = 'Off',
    /** Raised setpoint above comfort (e.g. DHW boost or legionella run) */
    Boost = 'Boost',
}

/**
 * One switching period of a {@link EnyoHeatpumpTimeProgram}.
 *
 * Times are local wall-clock times of the site in `HH:mm` notation — the way
 * heatpumps store them — not UTC. Consumers convert them to absolute times
 * using the site's timezone.
 */
export interface EnyoHeatpumpTimeProgramPeriod {
    /**
     * Days of the week the period applies to, `0` = Sunday … `6` = Saturday.
     * Must not be empty.
     *
     * For a period that wraps past midnight the day is evaluated against the
     * day the period **starts** — a Friday 22:00–06:00 period covers Friday
     * evening and the early hours of Saturday.
     */
    daysOfWeek: number[];
    /** Inclusive start of the period as local wall-clock time, `HH:mm` */
    startTimeOfDay: string;
    /**
     * Exclusive end of the period as local wall-clock time, `HH:mm`. `'24:00'`
     * marks the end of the day. May be **earlier** than {@link startTimeOfDay},
     * in which case the period wraps past midnight. Must differ from
     * {@link startTimeOfDay}.
     */
    endTimeOfDay: string;
    /** Level the zone runs at during this period */
    level: EnyoHeatpumpTimeProgramLevelEnum;
    /**
     * Explicit setpoint in °C for this period, for devices that store a
     * temperature per period. When omitted, the setpoint follows from
     * {@link EnyoHeatpumpTimeProgram.levelTemperaturesC} for {@link level}.
     */
    targetTemperatureC?: number;
}

/**
 * The weekly time program (Zeitprogramm) of a heating circuit or a
 * domestic-hot-water zone, as configured on the heatpump.
 *
 * Tells the EMS in advance when the heatpump will lower its room setpoint or
 * start charging its DHW tank, so the optimizer can plan around — or with —
 * the device's own schedule instead of reacting to it.
 *
 * Use {@link validateHeatpumpTimeProgram} to check a program before publishing it.
 */
export interface EnyoHeatpumpTimeProgram {
    /** Level the zone runs at outside of every {@link periods} entry */
    defaultLevel: EnyoHeatpumpTimeProgramLevelEnum;
    /**
     * The switching periods. Periods should not overlap on the same day; if
     * they do, consumers should treat the later entry in the array as winning.
     */
    periods: EnyoHeatpumpTimeProgramPeriod[];
    /**
     * Setpoint in °C per level, for devices that work with levels rather than a
     * temperature per period (e.g. `{Comfort: 21, Reduced: 18}`).
     */
    levelTemperaturesC?: Partial<Record<EnyoHeatpumpTimeProgramLevelEnum, number>>;
    /**
     * Whether the zone currently follows this program. `false` means the user
     * switched the zone to a manual / constant mode and the program is stored
     * but not in effect. Omitted means unknown.
     */
    active?: boolean;
    /** When the program was last read from the device, as epoch milliseconds */
    updatedAtMs?: number;
}

/**
 * Where the room temperature of a heating circuit is measured.
 */
export enum EnyoHeatpumpRoomTemperatureSourceEnum {
    /** No room temperature is measured — the circuit runs purely on its heating curve */
    None = 'None',
    /** Measured by the heatpump's own room unit / sensor wired to the heatpump */
    Internal = 'Internal',
    /**
     * Measured by a separate temperature sensor known to enyo (see
     * {@link EnyoHeatpumpApplianceHeatingCircuit.roomTemperatureSensor}). If
     * the heatpump supports
     * {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.RoomTemperatureInput},
     * the energy manager can forward the readings to it.
     */
    External = 'External',
}

/**
 * Reference to a single sensor of a
 * {@link EnyoApplianceTypeEnum.TemperatureSensor} appliance.
 */
export interface EnyoHeatpumpRoomTemperatureSensorReference {
    /** ID of the temperature sensor appliance */
    applianceId: string;
    /** ID of the sensor within that appliance ({@link EnyoTemperatureSensor.id}) */
    sensorId: string;
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
    maxTemperatureC?: number;    /**
     * The weekly time program of this DHW zone (when the tank is charged to
     * which temperature), if the heatpump reports one. See
     * {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.TimeProgram}.
     */
    timeProgram?: EnyoHeatpumpTimeProgram;
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
    customName?: string;    /**
     * The heating curve of this circuit, if the heatpump reports it. See
     * {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.HeatingCurve}.
     */
    heatingCurve?: EnyoHeatpumpApplianceHeatingCurve;
    /**
     * The weekly time program of this circuit (comfort / reduced periods), if
     * the heatpump reports it. See
     * {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.TimeProgram}.
     */
    timeProgram?: EnyoHeatpumpTimeProgram;
    /**
     * Where the room temperature of this circuit is measured. Omitted means
     * unknown, not {@link EnyoHeatpumpRoomTemperatureSourceEnum.None}.
     */
    roomTemperatureSource?: EnyoHeatpumpRoomTemperatureSourceEnum;
    /**
     * The enyo temperature sensor measuring this circuit's room. Set together
     * with {@link roomTemperatureSource} =
     * {@link EnyoHeatpumpRoomTemperatureSourceEnum.External}; its readings can
     * be forwarded to the heatpump via
     * {@link EnyoDataBusSetHeatpumpRoomTemperatureV1} when the heatpump supports
     * {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.RoomTemperatureInput}.
     */
    roomTemperatureSensor?: EnyoHeatpumpRoomTemperatureSensorReference;
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