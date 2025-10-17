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
}

/**
 * Interface for managing appliances in HEMS one packages.
 * Provides CRUD operations for appliance registration and management.
 */
export interface HemsOneAppliances {
    /** Save or update an appliance in the system */
    save: (appliance: HemsOneAppliance) => Promise<void>;
    /** Get a list of all registered appliances */
    list: () => Promise<HemsOneAppliance[]>;
    /** Get a specific appliance by its ID */
    getById: (id: string) => Promise<HemsOneAppliance | null>;
    /** Remove an appliance by its ID */
    removeById: (id: string) => Promise<void>;
}