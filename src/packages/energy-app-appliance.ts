import {HemsOneAppliance} from "../types/hems-one-appliance.js";

/**
 * Interface for managing appliances in HEMS one packages.
 * Provides CRUD operations for appliance registration and management.
 */
export interface EnergyAppAppliance {
    /** Save or update an appliance in the system */
    save: (appliance: Omit<HemsOneAppliance, 'id'>, applianceId: string | undefined) => Promise<void>;
    /** Get a list of all registered appliances */
    list: () => Promise<HemsOneAppliance[]>;
    /** Get a specific appliance by its ID */
    getById: (id: string) => Promise<HemsOneAppliance | null>;
    /** Remove an appliance by its ID */
    removeById: (id: string) => Promise<void>;
}