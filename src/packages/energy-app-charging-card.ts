import {EnyoChargingCard} from "../types/enyo-charging-card.js";

/**
 * Interface for managing charging cards in enyo packages.
 * Provides read-only operations for charging card information.
 */
export interface EnergyAppChargingCard {
    /** Get a list of all registered charging cards */
    list: () => Promise<EnyoChargingCard[]>;
    /** Get a specific charging card by its ID */
    getById: (id: string) => Promise<EnyoChargingCard | null>;
}