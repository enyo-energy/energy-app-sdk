export enum HemsOneHeatpumpApplianceAvailableFeaturesEnum {
    /** If the heatpump is capable of domestic hot water*/
    DomesticHotWater = 'DomesticHotWater',
    /** If the heatpump is capable of domestic hot water boost to use more pv energy*/
    DomesticHotWaterBoost = 'DomesticHotWaterBoost',
    /** If the heatpump has a heating rod*/
    HeatingRod = 'HeatingRod',
}

export enum HemsOneHeatpumpApplianceModeEnum {
    Idle = 'Idle',
    Heating = 'Heating',
    DomesticHotWater = 'DomesticHotWater',
    EmergencyOperation = 'EmergencyOperation',
}

export interface HemsOneHeatpumpApplianceDomesticHotWater {
    index: number;
    tankSizeLiter?: number;
    targetTemperatureC: number;
    hysteresisK?: number;
}

export interface HemsOneHeatpumpApplianceCompressor {
    index: number;
}

export interface HemsOneHeatpumpApplianceHeatingCircuit {
    index: number;
    targetRoomTemperatureC?: number;
}

export interface HemsOneHeatpumpApplianceMetadata {
    availableFeatures: HemsOneHeatpumpApplianceAvailableFeaturesEnum[];
    mode?: HemsOneHeatpumpApplianceModeEnum;
    domesticHotWater?: HemsOneHeatpumpApplianceDomesticHotWater[];
    compressors?: HemsOneHeatpumpApplianceCompressor[];
    heatingCircuits?: HemsOneHeatpumpApplianceHeatingCircuit[];
}