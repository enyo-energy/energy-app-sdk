export enum EnyoBatteryStorageMode {
    CHARGE = 'charge',
    DISCHARGE = 'discharge',
    HOLDING = 'holding',
    AUTO = 'auto',
    Unknown = 'unknown'
}

export enum EnyoBatteryFeature {
    GridCharging = 'grid-charging'
}

export interface EnyoBatteryApplianceMetadata {
    connectedToApplianceId?: string;
    maxDischargePowerW?: number;
    maxChargingPowerW?: number;
    maxCapacityWh?: number;
    storageMode?: EnyoBatteryStorageMode;
    gridChargingEnabled?: boolean;
    features?: EnyoBatteryFeature[];
}