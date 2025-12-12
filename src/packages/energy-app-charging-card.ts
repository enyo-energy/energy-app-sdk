import {HemsOneChargingCard} from "../types/hems-one-charging-card.js";

/**
 * Interface for managing charging cards in HEMS one packages.
 * Provides read-only operations for charging card information.
 */
export interface EnergyAppChargingCard {
    /** Get a list of all registered charging cards */
    list: () => Promise<HemsOneChargingCard[]>;
    /** Get a specific charging card by its ID */
    getById: (id: string) => Promise<HemsOneChargingCard | null>;
}