import {
    ElectricityPriceRequest,
    ElectricityPriceResponse,
    ElectricityPriceUpdate
} from "../types/enyo-electricity-prices.js";
import {EnergyTariffInfo} from "../types/enyo-energy-tariff.js";

/**
 * Interface for retrieving electricity price information.
 * Provides methods to get current and forecast electricity prices,
 * always normalized to 15-minute intervals regardless of source data resolution.
 */
export interface EnergyAppElectricityPrices {
    /**
     * Retrieves electricity prices for a specified time range.
     * The response always contains prices in 15-minute intervals,
     * interpolated from the original data source (constant, 15min, or 1hr intervals).
     *
     * @param request - The price request parameters including time range and optional appliance ID
     * @returns Promise that resolves to electricity prices for the requested time range
     */
    getPrices(request: ElectricityPriceRequest): Promise<ElectricityPriceResponse>;

    /**
     * Retrieves the current active tariff information.
     * This includes tariff metadata, provider information, and pricing structure details.
     *
     * @param applianceId - Optional appliance ID to get appliance-specific tariff. If omitted, returns system-wide tariff
     * @returns Promise that resolves to current tariff information, or null if no tariff is configured
     */
    getCurrentTariff(applianceId?: string): Promise<EnergyTariffInfo | null>;

    /**
     * Registers a listener for real-time electricity price updates.
     * The listener will be called when tariffs change, prices are updated, or new forecasts become available.
     *
     * @param listener - Callback function that will be called when price updates occur
     * @returns Listener ID that can be used to remove the listener later
     */
    listenForPriceUpdates(listener: (update: ElectricityPriceUpdate) => void): string;

    /**
     * Removes a previously registered price update listener.
     *
     * @param listenerId - The ID of the listener to remove
     */
    removeListener(listenerId: string): void;

    /**
     * Retrieves the current electricity price for the current 15-minute interval.
     * This is a convenience method that gets the price for "now".
     *
     * @param applianceId - Optional appliance ID to get appliance-specific pricing
     * @returns Promise that resolves to current price information, or null if no pricing data is available
     */
    getCurrentPrice(applianceId?: string): Promise<ElectricityPriceEntry | null>;

    /**
     * Retrieves the system default tariff information.
     * Returns the full tariff including pricing data.
     *
     * @returns Promise that resolves to the default tariff info, or null if none is configured
     */
    getDefaultTariff(): Promise<EnergyTariffInfo | null>;

    /**
     * Retrieves tariff information by tariff ID.
     * Returns the full tariff including pricing data.
     *
     * @param tariffId - The unique identifier of the tariff
     * @returns Promise that resolves to the tariff info, or null if not found
     */
    getTariffById(tariffId: string): Promise<EnergyTariffInfo | null>;
}

/**
 * Represents a single electricity price entry for convenience methods
 */
export interface ElectricityPriceEntry {
    /** Start time of this 15-minute interval in ISO format */
    timestampIso: string;
    /** Price per kWh for electricity consumption during this interval */
    consumptionPricePerKwh: number;
    /** Optional price per kWh for grid feed-in during this interval */
    feedInPricePerKwh?: number;
}