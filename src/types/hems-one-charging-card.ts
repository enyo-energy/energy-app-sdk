/**
 * Represents a charging card in the HEMS one system.
 * Contains all relevant information about an electric vehicle charging card.
 */
export interface HemsOneChargingCard {
    /** Unique identifier for the charging card */
    id: string;
    name: string;
    rfid?: string;
    pendingRegistration?: boolean;
}