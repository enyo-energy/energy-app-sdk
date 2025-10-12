import {ConnectApplianceTypeEnum} from "../types/connect-appliance-type.enum.js";

/**
 * Represents an appliance managed by the Connect EMS system.
 */
export interface ConnectAppliance {
    /** Unique identifier for the appliance */
    id: string;
    /** Type/category of the appliance */
    type: ConnectApplianceTypeEnum;
}

/**
 * Interface for managing appliances in Connect EMS packages.
 * Provides CRUD operations for appliance registration and management.
 */
export interface ConnectAppliances {
    /** Save or update an appliance in the system */
    save: (appliance: ConnectAppliance) => Promise<void>;
    /** Get a list of all registered appliances */
    list: () => Promise<ConnectAppliance[]>;
    /** Get a specific appliance by its ID */
    getById: (id: string) => Promise<ConnectAppliance | null>;
    /** Remove an appliance by its ID */
    removeById: (id: string) => Promise<void>;
}