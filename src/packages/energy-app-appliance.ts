import {HemsOneAppliance} from "../types/hems-one-appliance.js";

/**
 * Interface for managing appliances in HEMS one packages.
 * Provides CRUD operations for appliance registration and management.
 */
export interface EnergyAppAppliance {
    /** Save or update an appliance in the system */
    save: (appliance: Omit<HemsOneAppliance, 'id'>, applianceId: string | undefined) => Promise<void>;
    /** Get a list of all registered appliances of your package */
    list: () => Promise<HemsOneAppliance[]>;
    /** Get a list of all appliances. Needs a specific permission */
    listAll: () => Promise<HemsOneAppliance[]>;
    /** Get a specific appliance by its ID */
    getById: (id: string) => Promise<HemsOneAppliance | null>;
    /** Remove an appliance by its ID */
    removeById: (id: string) => Promise<void>;
}