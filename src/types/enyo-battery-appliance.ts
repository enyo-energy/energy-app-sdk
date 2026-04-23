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
    DischargeLimitation = 'discharge-limitation',
    /** If the battery is connected between DC strings and the inverter */
    BetweenDcStringAndInverter = 'between-dc-string-and-inverter'
}

export interface EnyoBatteryApplianceMetadata {
    connectedToApplianceId?: string;
    /** If the battery is connected in between dc strings, you can configure it here*/
    connectedWithDcStrings?: number[];
    maxDischargePowerW?: number;
    maxChargingPowerW?: number;
    maxCapacityWh?: number;
    storageMode?: EnyoBatteryStorageMode;
    gridChargingEnabled?: boolean;
    features?: EnyoBatteryFeature[];
}