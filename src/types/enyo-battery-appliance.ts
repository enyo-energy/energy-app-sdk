export enum EnyoBatteryStorageMode {
    CHARGE = 'charge',
    DISCHARGE = 'discharge',
    HOLDING = 'holding',
    AUTO = 'auto',
    Unknown = 'unknown'
}

export enum EnyoBatteryFeature {
    /**
     * If the battery supports being charged from the grid
     */
    GridCharging = 'grid-charging',
    /**
     * If the battery supports discharging into the grid
     */
    GridDischarging = 'grid-discharging',
    /**
     * If the battery supports discharge power limitation
     * @deprecated
     */
    DischargeLimitation = 'discharge-limitation',
    /**
     * If the battery supports charge power limitation
     * @deprecated
     */
    ChargeLimitation = 'charge-limitation',
    /** If the battery is connected between DC strings and the inverter */
    BetweenDcStringAndInverter = 'between-dc-string-and-inverter',
    /** If the battery supports manual charging */
    ManualCharge = 'manual-charge',
    /** If the battery supports manual discharging */
    ManualDischarge = 'manual-discharge'
}

export interface EnyoBatteryApplianceMetadata {
    connectedToApplianceId?: string;
    /** If the battery is connected in between dc strings, you can configure it here*/
    connectedWithDcStrings?: number[];
    maxDischargePowerW?: number;
    maxChargingPowerW?: number;
    maxCapacityWh?: number;
    storageMode?: EnyoBatteryStorageMode;
    /** Whether grid-to-storage charging is currently enabled */
    gridChargingEnabled?: boolean;
    /** Whether storage-to-grid discharging is currently enabled */
    gridDischargingEnabled?: boolean;
    /** Currently active charge power limit in Watts (if any) */
    activeChargeLimitW?: number;
    /** Currently active discharge power limit in Watts (if any) */
    activeDischargeLimitW?: number;
    features?: EnyoBatteryFeature[];
}