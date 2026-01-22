/**
 * Represents a vehicle in the enyo system.
 * Contains all relevant information about an electric vehicle.
 */
export interface EnyoVehicle {
    /** Unique identifier for the vehicle */
    id: string;
    name: string;
    licensePlate?: string;
    batterySizeKwh?: number;
    pinnedChargingCardId?: string;
}