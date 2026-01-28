/**
 * Defines the interval duration for time-based pricing
 */
export type EnergyTariffInterval = '15min' | '1hr';

/**
 * Represents a single price point in time-based tariffs
 */
export interface EnergyTariffPricePoint {
    /** Start time of this price period in ISO format */
    timestampIso: string;
    /** Price per kWh for consumption during this period */
    pricePerKwh: number;
    /** Optional price per kWh for grid feed-in during this period */
    feedInPricePerKwh?: number;
}

/**
 * Represents constant pricing structure
 */
export interface EnergyTariffConstantPricing {
    /** Fixed price per kWh for consumption */
    pricePerKwh: number;
    /** Optional fixed price per kWh for grid feed-in */
    feedInPricePerKwh?: number;
    /** Start of validity period in ISO format */
    validFromIso?: string;
}

/**
 * Represents interval-based pricing structure (15min or 1hr intervals)
 */
export interface EnergyTariffIntervalPricing {
    /** Interval duration (15 minutes or 1 hour) */
    interval: EnergyTariffInterval;
    /** Array of price points for the specified intervals */
    pricePoints: EnergyTariffPricePoint[];
}

/**
 * Union type for different pricing data structures
 */
export type EnergyTariffData = {
    type: 'constant';
    constantPricing: EnergyTariffConstantPricing;
} | {
    type: 'interval';
    intervalPricing: EnergyTariffIntervalPricing;
};

/**
 * Represents complete energy tariff information
 */
export interface EnergyTariffInfo {
    /** Unique identifier for this tariff */
    tariffId: string;
    /** Human-readable name of the tariff */
    tariffName: string;
    /** Currency code (ISO 4217, e.g., 'EUR', 'USD') */
    currency: string;
    /** Tariff provider/supplier name */
    provider: string;
    /** Pricing data structure */
    tariffData: EnergyTariffData;
    /** Optional description of the tariff */
    description?: string;
    /** Timestamp when this tariff information was last updated */
    lastUpdatedIso: string;
}