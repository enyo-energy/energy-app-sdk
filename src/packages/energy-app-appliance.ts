import {EnyoAppliance} from "../types/enyo-appliance.js";

/**
 * Interface for managing appliances in enyo packages.
 * Provides CRUD operations for appliance registration and management.
 */
export interface EnergyAppAppliance {
    /** Save or update an appliance in the system */
    save: (appliance: Omit<EnyoAppliance, 'id'>, applianceId: string | undefined) => Promise<string>;
    /** Get a list of all registered appliances of your package */
    list: () => Promise<EnyoAppliance[]>;
    /** Get a list of all appliances. Needs a specific permission */
    listAll: () => Promise<EnyoAppliance[]>;
    /** Get a specific appliance by its ID */
    getById: (id: string) => Promise<EnyoAppliance | null>;
    /** Remove an appliance by its ID */
    removeById: (id: string) => Promise<void>;
}