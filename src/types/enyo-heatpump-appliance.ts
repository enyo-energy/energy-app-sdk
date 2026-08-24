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

export interface EnyoHeatpumpApplianceDomesticHotWater {
    index: number;
    tankSizeLiter?: number;
    targetTemperatureC: number;
    hysteresisK?: number;
    /**
     * Maximum temperature (in °C) the domestic hot water tank may be heated to.
     * Acts as an upper bound the EMS must not exceed (e.g. when overheating the
     * tank to store surplus energy).
     */
    maxTemperatureC?: number;
}

export interface EnyoHeatpumpApplianceBufferTank {
    index: number;
    tankSizeLiter?: number;
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
}