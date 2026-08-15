import {
    EnyoEpexNegativePriceWindow,
    EnyoEpexSpotPriceEntry,
    EnyoEpexSpotPriceFilter,
    EnyoEpexSpotPrices,
} from "../types/enyo-epex-spot-price.js";

/**
 * Interface for reading EPEX SPOT day-ahead electricity prices.
 *
 * The host fetches the cleared prices that apply to this device and caches
 * them locally, so every app on the device shares one source of truth instead
 * of each one calling a price API itself. An energy manager can use the series
 * to decide when to charge a battery, when to run a flexible load, and — via
 * {@link EnyoInverterApplianceMetadata.blockFeedInOnNegativePrices} — when to
 * stop exporting PV to the grid.
 *
 * What this API returns is **market data, not customer pricing**: the raw
 * exchange result, excluding grid fees, levies, taxes and supplier margin, and
 * negative whenever supply outruns demand. For what the customer is actually
 * billed, use {@link EnergyAppEnergyPrices}; for forward-looking price
 * forecasts published by other apps, use
 * {@link EnergyAppDynamicPriceForecast}.
 *
 * Prices for the following day become known once the auction clears (14:00
 * CET/CEST) — before that, only the current day is available, so an app must
 * always tolerate a series that ends earlier than it would like.
 *
 * Access to this API requires the `EpexSpotPrices` permission
 * ({@link EnergyAppPermissionType}); {@link EnergyApp.useEpexSpotPrices} throws
 * when it has not been granted.
 *
 * @example
 * ```typescript
 * const epex = energyApp.useEpexSpotPrices();
 *
 * const now = await epex.getCurrentSpotPrice();
 * if (now && now.pricePerKwh < 0) {
 *     // exporting costs money right now
 * }
 *
 * // Re-plan whenever tomorrow's auction result arrives.
 * epex.onSpotPricesUpdated(prices => scheduler.replan(prices.entries));
 * ```
 */
export interface EnergyAppEpexSpotPrice {
    /**
     * Retrieves the cached EPEX SPOT price series for a time range.
     *
     * Returns `null` when the host holds no prices at all (for example on a
     * device that has never been online). A series that is merely shorter than
     * the requested range is returned as-is with the entries that are known —
     * check the last entry's `endTimestampIso` before planning against it.
     *
     * @param filter - Optional time range. Defaults to the current delivery
     *   period through the end of the known series.
     * @returns Promise resolving to the price series, or `null` if none is available.
     * @throws {EnergyAppPermissionNotGrantedError} If the `EpexSpotPrices`
     *   permission is not granted.
     *
     * @example
     * ```typescript
     * const prices = await epex.getSpotPrices({
     *     fromIso: '2026-08-12T00:00:00Z',
     *     untilIso: '2026-08-13T00:00:00Z'
     * });
     * const cheapest = prices?.entries
     *     .reduce((min, e) => e.pricePerKwh < min.pricePerKwh ? e : min);
     * ```
     */
    getSpotPrices(filter?: EnyoEpexSpotPriceFilter): Promise<EnyoEpexSpotPrices | null>;

    /**
     * Retrieves the price of the delivery period that contains "now".
     *
     * Convenience wrapper around {@link getSpotPrices} for control loops that
     * only need the price they are currently exposed to.
     *
     * @returns Promise resolving to the current entry, or `null` when the
     *   current period is not covered by the cached series.
     * @throws {EnergyAppPermissionNotGrantedError} If the `EpexSpotPrices`
     *   permission is not granted.
     */
    getCurrentSpotPrice(): Promise<EnyoEpexSpotPriceEntry | null>;

    /**
     * Retrieves the contiguous runs of delivery periods priced below zero
     * within the requested range.
     *
     * This is the same information as {@link getSpotPrices}, pre-grouped for
     * the decisions that care about it: curtailing PV feed-in, and pulling
     * consumption into hours the market is paying for. Windows are returned in
     * chronological order; an empty array means no negative prices are known
     * for the range.
     *
     * @param filter - Optional time range; same defaults as {@link getSpotPrices}.
     * @returns Promise resolving to the negative-price windows in the range.
     * @throws {EnergyAppPermissionNotGrantedError} If the `EpexSpotPrices`
     *   permission is not granted.
     *
     * @example
     * ```typescript
     * const windows = await epex.getNegativePriceWindows();
     * for (const w of windows) {
     *     console.log(`negative from ${w.startIso} for ${w.durationMinutes} min`);
     * }
     * ```
     */
    getNegativePriceWindows(filter?: EnyoEpexSpotPriceFilter): Promise<EnyoEpexNegativePriceWindow[]>;

    /**
     * Registers a listener invoked whenever the host has refreshed the cached
     * series — most importantly when the day-ahead auction for the next day
     * clears, which is the moment a scheduler can plan a full 24 hours ahead.
     *
     * The listener receives the complete refreshed series, not just the
     * changed entries.
     *
     * @param listener - Callback invoked with the newly cached price series.
     * @returns A unique listener id for {@link offSpotPricesUpdated}.
     * @throws {EnergyAppPermissionNotGrantedError} If the `EpexSpotPrices`
     *   permission is not granted.
     */
    onSpotPricesUpdated(listener: (prices: EnyoEpexSpotPrices) => void | Promise<void>): string;

    /**
     * Removes a previously registered price-update listener. Unknown listener
     * ids are ignored.
     *
     * @param listenerId - The id returned from {@link onSpotPricesUpdated}.
     */
    offSpotPricesUpdated(listenerId: string): void;
}
