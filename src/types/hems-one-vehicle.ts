/**
 * Represents a vehicle in the HEMS one system.
 * Contains all relevant information about an electric vehicle.
 */
export interface HemsOneVehicle {
    /** Unique identifier for the vehicle */
    id: string;
    name: string;
    licensePlate?: string;
    batterySizeKwh?: number;
    pinnedChargingCardId?: string;
}