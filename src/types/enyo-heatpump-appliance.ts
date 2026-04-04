export enum EnyoHeatpumpApplianceAvailableFeaturesEnum {
    /** If the heatpump is capable of domestic hot water*/
    DomesticHotWater = 'DomesticHotWater',
    /** If the heatpump is capable of domestic hot water boost to use more pv energy*/
    DomesticHotWaterBoost = 'DomesticHotWaterBoost',
    /** If the heatpump has a heating rod*/
    HeatingRod = 'HeatingRod',
    /** If the heatpump supports room overheating via heating circuits */
    RoomOverheating = 'RoomOverheating',
    /** If the heatpump supports buffer tank overheating */
    BufferTankOverheating = 'BufferTankOverheating',
    /** If the heatpump supports domestic hot water overheating */
    DomesticHotWaterOverheating = 'DomesticHotWaterOverheating',
}

export enum EnyoHeatpumpApplianceModeEnum {
    Idle = 'Idle',
    Heating = 'Heating',
    DomesticHotWater = 'DomesticHotWater',
    EmergencyOperation = 'EmergencyOperation',
}

export interface EnyoHeatpumpApplianceDomesticHotWater {
    index: number;
    tankSizeLiter?: number;
    targetTemperatureC: number;
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
    compressors?: EnyoHeatpumpApplianceCompressor[];
    heatingCircuits?: EnyoHeatpumpApplianceHeatingCircuit[];
}