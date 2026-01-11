export enum HemsOneMeterApplianceAvailableFeaturesEnum {
    /** If the meter can get the live power consumption in Watt */
    LivePowerConsumption = 'LivePowerConsumption',
    /** If the meter can read the current meter values in Wh */
    MeterValues = 'MeterValues'
}

export interface HemsOneMeterAppliance {
    availableFeatures: HemsOneMeterApplianceAvailableFeaturesEnum[];
    meterNumber?: string;
}