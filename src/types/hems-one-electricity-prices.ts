import {EnergyTariffInfo} from "./hems-one-energy-tariff.js";

/**
 * Request parameters for retrieving electricity prices
 */
export interface ElectricityPriceRequest {
    /** Start time for price data in ISO format */
    fromIso: string;
    /** End time for price data in ISO format */
    untilIso: string;
    /** Optional appliance ID to get appliance-specific pricing */
    applianceId?: string;
}

/**
 * Represents a single electricity price entry for a 15-minute interval
 */
export interface ElectricityPriceEntry {
    /** Start time of this 15-minute interval in ISO format */
    timestampIso: string;
    /** Price per kWh for electricity consumption during this interval */
    consumptionPricePerKwh: number;
    /** Optional price per kWh for grid feed-in during this interval */
    feedInPricePerKwh?: number;
}

/**
 * Response containing electricity prices for the requested time range
 */
export interface ElectricityPriceResponse {
    /** Array of price entries, always in 15-minute intervals */
    priceEntries: ElectricityPriceEntry[];
    /** Original data resolution that was used to generate these 15-minute intervals */
    sourceType: 'constant' | '15min' | '1hr';
    /** Currency code (ISO 4217, e.g., 'EUR', 'USD') */
    currency: string;
    /** Energy provider/supplier name */
    provider: string;
    /** Start time that was requested */
    requestedFromIso: string;
    /** End time that was requested */
    requestedUntilIso: string;
    /** Timestamp when this price data was last updated */
    lastUpdatedIso: string;
    /** Unique identifier of the tariff used for these prices */
    tariffId: string;
}

/**
 * Real-time update notification for electricity price changes
 */
export interface ElectricityPriceUpdate {
    /** Type of update that occurred */
    updateType: 'tariff_changed' | 'prices_updated' | 'new_forecast';
    /** Updated tariff information (if applicable) */
    tariffInfo?: EnergyTariffInfo;
    /** Time range affected by this update */
    affectedFromIso: string;
    /** End of time range affected by this update */
    affectedUntilIso: string;
    /** Timestamp when this update occurred */
    updateTimestampIso: string;
    /** Optional appliance ID if this update is appliance-specific */
    applianceId?: string;
    /** Optional reason for the update */
    updateReason?: string;
}