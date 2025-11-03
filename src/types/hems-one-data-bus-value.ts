export enum HemsOneDataBusValueTypeEnum {
    InverterProductionV1 = 'InverterProductionV1',
    ApplianceFlexibilityAnnouncementV1 = 'ApplianceFlexibilityAnnouncementV1',
}

export interface HemsOneDataBusValue {
    id: string;
    type: HemsOneDataBusValueTypeEnum;
    values: object;
    resolution: '1s' | '10s' | '30s' | '1m' | '15m' | '1h' | '1d';
    persist: boolean;
}

export interface HemsOneDataBusInverterProductionV1 extends HemsOneDataBusValue {
    type: HemsOneDataBusValueTypeEnum.InverterProductionV1;
    values: {
        productionW: number;
    }
}

export interface HemsOneDataBusApplianceFlexibilityAnnouncementV1 extends HemsOneDataBusValue {
    type: HemsOneDataBusValueTypeEnum.ApplianceFlexibilityAnnouncementV1;
    values: {
        applianceId: string;
        flexibility: {
            kWh: number;
            /** Defines until the kWh flexibility can be shifted. If for Example 10 kWh can be shifted until 2025-10-01T14:00:00 (current time 2025-10-01T10:00:00), the control can shift the 10 kWh in the next 4 hours */
            availableUntilIsoTimestamp: string;
        }
    }
}
