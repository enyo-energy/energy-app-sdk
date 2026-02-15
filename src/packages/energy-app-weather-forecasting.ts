import {
    WeatherForecastRegistration,
    WeatherForecastInfo,
    WeatherForecastByZipCodeRequest,
    WeatherForecastByCoordinatesRequest,
    WeatherForecastResponse
} from "../types/enyo-forecasting.js";

/**
 * Interface for managing weather forecast providers and retrieving weather forecasts.
 * Allows energy apps to register weather forecast providers and fetch forecasts
 * using either zip code or geographic coordinates depending on the provider's requirements.
 */
export interface EnergyAppWeatherForecasting {
    /**
     * Registers a new weather forecast provider or updates an existing one.
     * Uses upsert logic based on forecastId - if a provider with the same ID exists,
     * it will be updated; otherwise, a new provider will be created.
     *
     * @param registration - The forecast provider registration data
     * @returns Promise that resolves when the provider has been registered
     *
     * @example
     * ```typescript
     * await weatherForecasting.registerForecast({
     *     forecastId: 'openweather-1',
     *     name: 'OpenWeather Forecast',
     *     vendor: 'OpenWeather',
     *     locationType: WeatherForecastLocationTypeEnum.ZipCode
     * });
     * ```
     */
    registerForecast(registration: WeatherForecastRegistration): Promise<void>;

    /**
     * Removes a registered weather forecast provider by its ID.
     * If the provider does not exist, this operation is a no-op.
     *
     * @param forecastId - The unique identifier of the forecast provider to remove
     * @returns Promise that resolves when the provider has been removed
     */
    deregisterForecast(forecastId: string): Promise<void>;

    /**
     * Retrieves all registered weather forecast providers.
     *
     * @returns Promise that resolves to an array of all registered weather forecast providers
     *
     * @example
     * ```typescript
     * const providers = await weatherForecasting.listForecasts();
     * providers.forEach(p => console.log(`${p.name} (${p.vendor})`));
     * ```
     */
    listForecasts(): Promise<WeatherForecastInfo[]>;

    /**
     * Fetches a weather forecast using a zip code.
     * The forecast provider must be configured with locationType 'zip-code'.
     *
     * @param forecastId - The unique identifier of the forecast provider to use
     * @param request - The request containing the zip code
     * @returns Promise that resolves to the weather forecast data with resolution and entries
     *
     * @example
     * ```typescript
     * const forecast = await weatherForecasting.getWeatherForecastByZipCode(
     *     'openweather-1',
     *     { zipCode: '80331' }
     * );
     * console.log(`Resolution: ${forecast.resolution}`);
     * forecast.entries.forEach(e =>
     *     console.log(`${e.timestampIso}: ${e.outdoorTemperatureCelsius}°C`)
     * );
     * ```
     */
    getWeatherForecastByZipCode(
        forecastId: string,
        request: WeatherForecastByZipCodeRequest
    ): Promise<WeatherForecastResponse>;

    /**
     * Fetches a weather forecast using geographic coordinates.
     * The forecast provider must be configured with locationType 'coordinates'.
     *
     * @param forecastId - The unique identifier of the forecast provider to use
     * @param request - The request containing latitude and longitude
     * @returns Promise that resolves to the weather forecast data with resolution and entries
     *
     * @example
     * ```typescript
     * const forecast = await weatherForecasting.getWeatherForecastByCoordinates(
     *     'weather-api-1',
     *     { latitude: 48.1351, longitude: 11.5820 }
     * );
     * console.log(`Resolution: ${forecast.resolution}`);
     * forecast.entries.forEach(e =>
     *     console.log(`${e.timestampIso}: ${e.outdoorTemperatureCelsius}°C`)
     * );
     * ```
     */
    getWeatherForecastByCoordinates(
        forecastId: string,
        request: WeatherForecastByCoordinatesRequest
    ): Promise<WeatherForecastResponse>;
}
