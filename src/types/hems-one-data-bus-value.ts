export enum HemsOneDataBusValueTypeEnum {
    InverterValuesV1 = 'InverterValuesV1',
    MeterValuesV1 = 'MeterValuesV1',
    BatteryValuesV1 = 'BatteryValuesV1',
    ApplianceFlexibilityAnnouncementV1 = 'ApplianceFlexibilityAnnouncementV1',
}

export interface HemsOneDataBusValue {
    id: string;
    type: HemsOneDataBusValueTypeEnum;
    values: object;
    resolution: '1s' | '10s' | '30s' | '1m' | '15m' | '1h' | '1d';
    persist: boolean;
}

export interface HemsOneDataBusMeterValuesV1 extends HemsOneDataBusValue {
    type: HemsOneDataBusValueTypeEnum.MeterValuesV1;
    /** ID of the appliance that delivered these values */
    applianceId: string;
    values: {
        /** Power from Grid (in Watt), negative: grid feed in, positive: grid consumption*/
        gridPowerW: number;
        /** Grid Feed in (in Watt hours) */
        gridFeedInWh: number;
        /** Grid Feed in (in Watt hours) */
        gridConsumptionWh: number;
        /** current self consumption (in Watt) */
        selfConsumptionW?: number;
        /** Self consumed energy (in Watt hours) */
        selfConsumptionWh?: number;
    }
}

export interface HemsOneDataBusBatteryValuesV1 extends HemsOneDataBusValue {
    type: HemsOneDataBusValueTypeEnum.BatteryValuesV1;
    /** ID of the appliance that delivered these values */
    applianceId: string;
    values: {
        /** Current Battery Power (in Watt). Positive = Consumption from the Battery, Negative = Feed in / charging of the battery. */
        batteryPowerW: number;
        /** Battery State of Charge. Value between 0 and 100 */
        batterySoC: number;
        /** Grid consumption Watt hours of battery */
        gridConsumptionWh?: number;
        /** Grid feed in Watt hours of battery */
        gridFeedInWh?: number;
    }
}

export interface HemsOneDataBusInverterValuesV1 extends HemsOneDataBusValue {
    type: HemsOneDataBusValueTypeEnum.InverterValuesV1;
    /** ID of the appliance that delivered these values */
    applianceId: string;
    values: {
        /** Current PV Production (in Watt) */
        pvPowerW: number;
        /** Current in Ampere */
        currentA: number;
        /** voltage of Phase L1 to N*/
        voltageL1: number;
        /** voltage of Phase L2 to N*/
        voltageL2?: number;
        /** voltage of Phase L3 to N*/
        voltageL3: number;
        /** Total pv production in Wh to measure the produced electricity in Wh*/
        pvProductionWh: number;
    }
}

export interface HemsOneDataBusApplianceFlexibilityAnnouncementV1 extends HemsOneDataBusValue {
    type: HemsOneDataBusValueTypeEnum.ApplianceFlexibilityAnnouncementV1;
    /** ID of the appliance */
    applianceId: string;
    values: {
        flexibility: {
            kWh: number;
            /** Defines until the kWh flexibility can be shifted. If for Example 10 kWh can be shifted until 2025-10-01T14:00:00 (current time 2025-10-01T10:00:00), the control can shift the 10 kWh in the next 4 hours */
            availableUntilIsoTimestamp: string;
        }
    }
}
