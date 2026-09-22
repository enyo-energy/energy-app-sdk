import {
    WeatherHistoryRegistration,
    WeatherHistoryInfo,
    OutdoorTemperatureHistoryRequest,
    OutdoorTemperatureHistory,
    WeatherHistoryRequest,
    WeatherHistory
} from "../types/enyo-weather-history.js";

/**
 * Interface for managing weather history providers and retrieving observed
 * weather data for a past time interval.
 *
 * This is the backward-looking counterpart to `EnergyAppWeatherForecasting`:
 * where the forecasting API answers "what will the weather do", this one
 * answers "what was the weather between these two timestamps" — temperature,
 * wind, cloud cover and solar irradiance. That is the input an app needs to
 * correlate measured consumption with the weather that drove it, to build
 * heating-degree-day statistics, to check measured PV production against the
 * irradiance that was actually available, or to train a consumption model on
 * outdoor conditions.
 *
 * Two queries are offered: {@link EnergyAppWeatherHistory.getWeatherHistory}
 * returns every requested measure per bucket, while
 * {@link EnergyAppWeatherHistory.getOutdoorTemperature} is the shorthand for
 * the common temperature-only case. Neither takes a location — the registered
 * provider resolves the device's own location via `energyApp.useLocation()`,
 * so a consumer only ever states the interval it cares about.
 *
 * Like the forecasting API, data comes from registered providers; an app
 * either registers one (wrapping an external archive) or consumes one that is
 * already registered, or both.
 */
export interface EnergyAppWeatherHistory {
    /**
     * Registers a new weather history provider or updates an existing one.
     * Uses upsert logic based on historyId - if a provider with the same ID
     * exists, it will be updated; otherwise, a new provider will be created.
     *
     * @param registration - The history provider registration data
     * @returns Promise that resolves when the provider has been registered
     *
     * @example
     * ```typescript
     * await weatherHistory.registerHistory({
     *     historyId: 'dwd-archive',
     *     name: 'DWD Climate Archive',
     *     vendor: 'Deutscher Wetterdienst',
     *     availableHistoryDays: 730,
     *     availableMeasures: [WeatherHistoryMeasureEnum.OutdoorTemperature]
     * });
     * ```
     */
    registerHistory(registration: WeatherHistoryRegistration): Promise<void>;

    /**
     * Removes a registered weather history provider by its ID.
     * If the provider does not exist, this operation is a no-op.
     *
     * @param historyId - The unique identifier of the history provider to remove
     * @returns Promise that resolves when the provider has been removed
     */
    deregisterHistory(historyId: string): Promise<void>;

    /**
     * Retrieves all registered weather history providers.
     *
     * @returns Promise that resolves to an array of all registered weather history providers
     *
     * @example
     * ```typescript
     * const providers = await weatherHistory.listHistories();
     * providers.forEach(p => console.log(`${p.name} (${p.vendor})`));
     * ```
     */
    listHistories(): Promise<WeatherHistoryInfo[]>;

    /**
     * Fetches the observed outdoor temperature for a time interval.
     *
     * The interval is half-open: `fromIso` is included and `untilIso` is not,
     * so consecutive intervals can be requested back to back without the
     * boundary timestamp being counted twice. Pass `resolution` to get a bucket
     * size other than the provider's own — a finer resolution is filled by
     * linear interpolation, a coarser one aggregated as a time-weighted
     * average.
     *
     * An interval that reaches further back than the provider's archive, or
     * forward past its most recent observation, is not an error: the covered
     * part is returned and `coveredFromIso` / `coveredUntilIso` state where the
     * data actually began and ended. An interval the provider holds no data for
     * at all yields an empty `readings` array.
     *
     * @param historyId - The unique identifier of the history provider to use
     * @param request - The requested interval and resolution
     * @returns Promise that resolves to the observed temperatures for the interval
     *
     * @example
     * ```typescript
     * const temperatures = await weatherHistory.getOutdoorTemperature('dwd-archive', {
     *     fromIso: '2026-01-15T00:00:00Z',
     *     untilIso: '2026-01-16T00:00:00Z',
     *     resolution: WeatherHistoryResolutionEnum.OneHour
     * });
     * console.log(`Average: ${temperatures.averageCelsius}°C`);
     * temperatures.readings.forEach(r =>
     *     console.log(`${r.timestampIso}: ${r.outdoorTemperatureCelsius}°C`)
     * );
     * ```
     */
    getOutdoorTemperature(
        historyId: string,
        request: OutdoorTemperatureHistoryRequest
    ): Promise<OutdoorTemperatureHistory>;

    /**
     * Fetches the observed weather for a time interval across every requested
     * measure — temperature, wind speed, cloud cover and the three irradiance
     * components.
     *
     * Interval, resolution and coverage behave exactly as described on
     * {@link EnergyAppWeatherHistory.getOutdoorTemperature}. Narrow the result
     * with `measures` when only some quantities are needed — archives are
     * typically billed or rate-limited per quantity. Measures the provider does
     * not hold are simply absent from the readings rather than reported as an
     * error; `measures` on the result states what actually came back.
     *
     * @param historyId - The unique identifier of the history provider to use
     * @param request - The requested interval, resolution and measures
     * @returns Promise that resolves to the observed weather for the interval
     *
     * @example
     * ```typescript
     * const history = await weatherHistory.getWeatherHistory('open-meteo-archive', {
     *     fromIso: '2026-01-15T00:00:00Z',
     *     untilIso: '2026-01-16T00:00:00Z',
     *     resolution: WeatherHistoryResolutionEnum.OneHour,
     *     measures: [
     *         WeatherHistoryMeasureEnum.GlobalHorizontalIrradiance,
     *         WeatherHistoryMeasureEnum.WindSpeed,
     *         WeatherHistoryMeasureEnum.CloudArea
     *     ]
     * });
     *
     * const ghi = history.statistics?.[WeatherHistoryMeasureEnum.GlobalHorizontalIrradiance];
     * console.log(`Mean irradiance: ${ghi?.averageValue} W/m²`);
     * history.readings.forEach(r =>
     *     console.log(`${r.timestampIso}: ${r.globalHorizontalIrradiance} W/m², ${r.windSpeedMs} m/s`)
     * );
     * ```
     */
    getWeatherHistory(
        historyId: string,
        request: WeatherHistoryRequest
    ): Promise<WeatherHistory>;
}
