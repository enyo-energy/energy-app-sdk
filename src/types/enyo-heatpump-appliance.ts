export enum EnyoHeatpumpApplianceAvailableFeaturesEnum {
    /** If the heatpump is capable of domestic hot water*/
    DomesticHotWater = 'DomesticHotWater',
    /** If the heatpump has a heating rod*/
    HeatingRod = 'HeatingRod',
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
}

export enum EnyoHeatpumpApplianceModeEnum {
    Idle = 'Idle',
    Heating = 'Heating',
    DomesticHotWater = 'DomesticHotWater',
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

export interface EnyoHeatpumpApplianceDomesticHotWater {
    index: number;
    tankSizeLiter?: number;
    targetTemperatureC: number;
    hysteresisK?: number;
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
    targetRoomTemperatureC?: number;
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
}