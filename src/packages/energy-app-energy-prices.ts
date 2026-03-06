import {EnyoEnergyPriceEntry, EnyoEnergyPrices} from "../types/enyo-energy-prices.js";

/**
 * Interface for retrieving electricity price information.
 * Provides methods to get current and forecast electricity prices,
 * always normalized to 15-minute intervals regardless of source data resolution.
 */
export interface EnergyAppEnergyPrices {
    /**
     * Retrieves electricity prices for a specified time range.
     * The response always contains prices in 15-minute intervals,
     * interpolated from the original data source (constant, 15min, or 1hr intervals).
     *
     * @param request - The price request parameters including time range and optional appliance ID
     * @returns Promise that resolves to electricity prices for the requested time range
     */
    getPrices(request: EnergyAppEnergyPricesFilter): Promise<EnyoEnergyPrices>;

    /**
     * Retrieves the current electricity price for the current 15-minute interval.
     * This is a convenience method that gets the price for "now".
     *
     * @param applianceId - Optional appliance ID to get appliance-specific pricing
     * @returns Promise that resolves to current price information, or null if no pricing data is available
     */
    getCurrentPrice(applianceId?: string): Promise<EnyoEnergyPriceEntry | null>;
}

export interface EnergyAppEnergyPricesFilter {
    /** Start time for price data in ISO format */
    fromIso: string;
    /** End time for price data in ISO format */
    untilIso: string;
    /** Optional appliance ID to get appliance-specific pricing */
    applianceId?: string;
    /** Optional tariff ID to use for pricing. If omitted, uses the default tariff */
    tariffId?: string;
}