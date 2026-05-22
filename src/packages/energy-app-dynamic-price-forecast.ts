import {
    DynamicPriceForecastFilter,
    DynamicPriceForecastPayload,
    DynamicPriceForecastProviderInfo,
    DynamicPriceForecastProviderRegistration,
    DynamicPriceForecastResponse,
} from "../types/enyo-forecasting.js";

/**
 * Interface for publishing and consuming dynamic electricity price forecasts.
 *
 * Any energy app can act as a producer by registering a forecast provider and
 * publishing forecasts, and any energy app can act as a consumer by listing
 * registered providers and fetching their most recently published forecasts.
 *
 * Publishing requires the `DynamicPriceForecastRegister` permission;
 * consuming requires the `DynamicPriceForecastUse` permission.
 *
 * The data exposed through this API is strictly forecast data — it represents
 * expected future electricity prices (e.g. day-ahead spot prices) and must
 * not be treated as realized, billed, or contractually guaranteed pricing.
 * For billed pricing tied to a tariff, use {@link EnergyAppEnergyPrices}.
 */
export interface EnergyAppDynamicPriceForecast {
    /**
     * Registers a new dynamic price forecast provider or updates an existing
     * one. Uses upsert logic based on `forecastId` — if a provider with the
     * same id already exists, it will be updated; otherwise a new provider
     * will be created.
     *
     * Registration alone does not publish a forecast; call
     * {@link publishForecast} to make forecast data available to consumers.
     *
     * @param registration - The forecast provider registration data
     * @returns Promise that resolves when the provider has been registered
     *
     * @example
     * ```typescript
     * await dynamicPriceForecast.registerForecast({
     *     forecastId: 'spot-market-1',
     *     name: 'Day-Ahead Spot Prices',
     *     vendor: 'EPEX'
     * });
     * ```
     */
    registerForecast(registration: DynamicPriceForecastProviderRegistration): Promise<void>;

    /**
     * Removes a registered dynamic price forecast provider and any forecast
     * data it has previously published. If the provider does not exist, this
     * operation is a no-op.
     *
     * @param forecastId - The unique identifier of the forecast provider to remove
     * @returns Promise that resolves when the provider has been removed
     */
    deregisterForecast(forecastId: string): Promise<void>;

    /**
     * Retrieves all registered dynamic price forecast providers across all
     * energy apps on the system.
     *
     * @returns Promise that resolves to an array of all registered providers
     *
     * @example
     * ```typescript
     * const providers = await dynamicPriceForecast.listForecasts();
     * providers.forEach(p => console.log(`${p.name} (${p.vendor})`));
     * ```
     */
    listForecasts(): Promise<DynamicPriceForecastProviderInfo[]>;

    /**
     * Publishes a new dynamic price forecast for a previously registered
     * provider. Replaces the provider's currently stored forecast — only the
     * most recent forecast per provider is retained.
     *
     * Entries in the payload must be sorted ascending by `timestampIso` and
     * aligned to the payload's declared `resolution`. The payload represents
     * a forecast only and must not be used to convey realized prices.
     *
     * @param forecastId - The identifier of the registered provider that owns this forecast
     * @param payload - The forecast payload to publish
     * @returns Promise that resolves when the forecast has been stored and dispatched to consumers
     *
     * @example
     * ```typescript
     * await dynamicPriceForecast.publishForecast('spot-market-1', {
     *     currency: 'EUR',
     *     resolution: ForecastResolutionEnum.OneHour,
     *     entries: [
     *         { timestampIso: '2026-05-21T10:00:00Z', consumptionPricePerKwh: 0.21 },
     *         { timestampIso: '2026-05-21T11:00:00Z', consumptionPricePerKwh: 0.19 },
     *     ],
     * });
     * ```
     */
    publishForecast(forecastId: string, payload: DynamicPriceForecastPayload): Promise<void>;

    /**
     * Retrieves the most recently published forecast for a specific provider.
     * Returns `null` when the provider is registered but has not yet
     * published a forecast, or when no provider with the given id exists.
     *
     * Use the optional `filter` to constrain returned entries to a time
     * window. Entries outside the window are omitted; entries inside the
     * window are returned in their original order.
     *
     * @param forecastId - The identifier of the provider whose forecast to fetch
     * @param filter - Optional time-range filter for forecast entries
     * @returns Promise that resolves to the latest forecast for the provider, or `null`
     */
    getForecast(
        forecastId: string,
        filter?: DynamicPriceForecastFilter,
    ): Promise<DynamicPriceForecastResponse | null>;

    /**
     * Retrieves the most recently published forecast across all registered
     * providers. When multiple providers have published, the forecast with
     * the most recent `publishedAtIso` is returned. Returns `null` when no
     * forecast has been published by any provider.
     *
     * Use the optional `filter` to constrain returned entries to a time
     * window. Entries outside the window are omitted; entries inside the
     * window are returned in their original order.
     *
     * @param filter - Optional time-range filter for forecast entries
     * @returns Promise that resolves to the latest forecast across all providers, or `null`
     */
    getLatestForecast(
        filter?: DynamicPriceForecastFilter,
    ): Promise<DynamicPriceForecastResponse | null>;

    /**
     * Registers a listener that is invoked whenever any provider publishes a
     * new forecast. Each invocation receives the full published response,
     * including the publishing provider's id and publication timestamp.
     *
     * @param listener - Callback invoked with the newly published forecast
     * @returns A unique listener id that can be passed to {@link offForecastPublished} to remove the listener
     *
     * @example
     * ```typescript
     * const id = dynamicPriceForecast.onForecastPublished(forecast => {
     *     console.log(`new ${forecast.forecastId} forecast in ${forecast.currency}`);
     * });
     * // later
     * dynamicPriceForecast.offForecastPublished(id);
     * ```
     */
    onForecastPublished(
        listener: (forecast: DynamicPriceForecastResponse) => void | Promise<void>,
    ): string;

    /**
     * Removes a previously registered forecast-published listener. If the
     * listener id is unknown, this operation is a no-op.
     *
     * @param listenerId - The id returned from {@link onForecastPublished}
     */
    offForecastPublished(listenerId: string): void;
}
