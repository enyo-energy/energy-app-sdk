import {EnyoVehicle} from "../types/enyo-vehicle.js";

/**
 * Interface for managing vehicles in enyo packages.
 * Provides read-only operations for vehicle information.
 */
export interface EnergyAppVehicle {
    /** Get a list of all registered vehicles */
    list: () => Promise<EnyoVehicle[]>;
    /** Get a specific vehicle by its ID */
    getById: (id: string) => Promise<EnyoVehicle | null>;
}