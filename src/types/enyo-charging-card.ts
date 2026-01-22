/**
 * Represents a charging card in the enyo system.
 * Contains all relevant information about an electric vehicle charging card.
 */
export interface EnyoChargingCard {
    /** Unique identifier for the charging card */
    id: string;
    name: string;
    rfid?: string;
    pendingRegistration?: boolean;
}