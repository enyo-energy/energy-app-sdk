import {EnyoCurrencyEnum} from "./enyo-currency.js";
import {ForecastResolutionEnum} from "./enyo-forecasting.js";

/**
 * A single cleared market price for one delivery period.
 *
 * Prices are the raw exchange result: they exclude grid fees, levies, taxes
 * and any supplier margin, and they **can be negative** when generation
 * exceeds demand.
 */
export interface EnyoEpexSpotPriceEntry {
    /** Start of the delivery period in ISO format (inclusive) */
    timestampIso: string;
    /** End of the delivery period in ISO format (exclusive) */
    endTimestampIso: string;
    /**
     * Cleared price per megawatt hour, in the series' currency. This is the
     * unit the exchange publishes (e.g. `-14.2` for EUR -14.20/MWh).
     */
    pricePerMwh: number;
    /**
     * The same price expressed per kilowatt hour (`pricePerMwh / 1000`), for
     * consistency with the rest of the SDK, which prices energy per kWh.
     */
    pricePerKwh: number;
}

/**
 * A contiguous run of delivery periods whose spot price is below zero.
 *
 * Convenience shape for the common decision "should PV feed-in be curtailed /
 * should a flexible load be pulled forward?" — see
 * {@link EnyoInverterApplianceMetadata.blockFeedInOnNegativePrices}.
 */
export interface EnyoEpexNegativePriceWindow {
    /** Start of the window in ISO format (inclusive) */
    startIso: string;
    /** End of the window in ISO format (exclusive) */
    endIso: string;
    /** Length of the window in minutes */
    durationMinutes: number;
    /** Most negative price per kWh observed inside the window */
    minPricePerKwh: number;
    /** Arithmetic mean price per kWh across the window's delivery periods */
    averagePricePerKwh: number;
}

/**
 * The EPEX SPOT day-ahead price series that applies to this device.
 */
export interface EnyoEpexSpotPrices {
    /** Currency of every price in {@link entries} */
    currency: EnyoCurrencyEnum;
    /**
     * Length of one delivery period. EPEX SPOT day-ahead moved to 15-minute
     * periods in 2025, but older data is still hourly — read this instead of
     * assuming a resolution.
     */
    resolution: ForecastResolutionEnum;
    /**
     * When the host last fetched this series from the exchange, in ISO format.
     * Useful to detect stale data when the device was offline.
     */
    retrievedAtIso: string;
    /** Price entries sorted ascending by `timestampIso`, without gaps */
    entries: EnyoEpexSpotPriceEntry[];
}

/**
 * Restricts a price query to a time range.
 *
 * Both fields are optional: with an empty filter the host returns the full
 * currently known window — typically today plus tomorrow, once the day-ahead
 * auction has cleared.
 */
export interface EnyoEpexSpotPriceFilter {
    /** Start of the requested range in ISO format (inclusive). Defaults to the start of the current delivery period. */
    fromIso?: string;
    /** End of the requested range in ISO format (exclusive). Defaults to the end of the known series. */
    untilIso?: string;
}
