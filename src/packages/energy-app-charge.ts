import {HemsOneCharge, HemsOneChargeFilter} from "../types/hems-one-charge.js";

/**
 * Interface for managing charging sessions in HEMS one packages.
 * Provides operations for charge session tracking and management.
 */
export interface EnergyAppCharge {
    /** Save or update a charging session in the system */
    save: (charge: Omit<HemsOneCharge, 'id'>, chargeId?: string) => Promise<void>;
    /** Get a list of charging sessions with optional filtering */
    list: (filter?: HemsOneChargeFilter) => Promise<HemsOneCharge[]>;
    /** Get a specific charging session by its ID */
    getById: (id: string) => Promise<HemsOneCharge | null>;
}