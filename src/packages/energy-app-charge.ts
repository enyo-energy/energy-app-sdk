import {EnyoCharge, EnyoChargeFilter} from "../types/enyo-charge.js";

/**
 * Interface for managing charging sessions in enyo packages.
 * Provides operations for charge session tracking and management.
 */
export interface EnergyAppCharge {
    /** Save or update a charging session in the system */
    save: (charge: Omit<EnyoCharge, 'id'>, chargeId?: string) => Promise<void>;
    /** Get a list of charging sessions with optional filtering */
    list: (filter?: EnyoChargeFilter) => Promise<EnyoCharge[]>;
    /** Get a specific charging session by its ID */
    getById: (id: string) => Promise<EnyoCharge | null>;
}