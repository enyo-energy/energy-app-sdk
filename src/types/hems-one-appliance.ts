export enum HemsOneApplianceTypeEnum {
    Inverter = 'Inverter',
    Charger = 'Charger',
    Storage = 'Storage',
    Meter = 'Meter',
}

/**
 * Represents an appliance managed by the HEMS one system.
 */
export interface HemsOneAppliance {
    /** Unique identifier for the appliance */
    id: string;
    /** Type/category of the appliance */
    type: HemsOneApplianceTypeEnum;
    /** network device IDs associated with the appliance */
    networkDeviceIds: string[];
}