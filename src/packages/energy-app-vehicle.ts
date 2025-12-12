import {HemsOneVehicle} from "../types/hems-one-vehicle.js";

/**
 * Interface for managing vehicles in HEMS one packages.
 * Provides read-only operations for vehicle information.
 */
export interface EnergyAppVehicle {
    /** Get a list of all registered vehicles */
    list: () => Promise<HemsOneVehicle[]>;
    /** Get a specific vehicle by its ID */
    getById: (id: string) => Promise<HemsOneVehicle | null>;
}