export enum EnyoBatteryStorageMode {
    CHARGE = 'charge',
    DISCHARGE = 'discharge',
    HOLDING = 'holding',
    AUTO = 'auto',
    Unknown = 'unknown'
}

export enum EnyoBatteryFeature {
    GridCharging = 'grid-charging',
    /** If the battery supports discharge power limitation */
    DischargeLimitation = 'discharge-limitation'
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