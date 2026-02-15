/**
 * Resolution of forecast data entries
 */
export enum ForecastResolutionEnum {
    /** 1-minute intervals */
    OneMinute = '1min',
    /** 15-minute intervals */
    FifteenMinutes = '15min',
    /** 1-hour intervals */
    OneHour = '1hr'
}

/**
 * Defines what location input a weather forecast provider requires
 */
export enum WeatherForecastLocationTypeEnum {
    /** Forecast provider requires a zip code */
    ZipCode = 'zip-code',
    /** Forecast provider requires latitude and longitude coordinates */
    Coordinates = 'coordinates'
}

// ─── Weather Forecasting Types ───────────────────────────────────────────────

/**
 * Registration data for a weather forecast provider
 */
export interface WeatherForecastRegistration {
    /** Unique identifier for the weather forecast provider */
    forecastId: string;
    /** Human-readable name of the forecast provider */
    name: string;
    /** Vendor or company providing the forecast */
    vendor: string;
    /** The type of location input this provider requires */
    locationType: WeatherForecastLocationTypeEnum;
}

/**
 * A registered weather forecast provider with metadata
 */
export interface WeatherForecastInfo extends WeatherForecastRegistration {
    /** Timestamp when this forecast was registered in ISO format */
    registeredAtIso: string;
}

/**
 * Request parameters for fetching a weather forecast using a zip code
 */
export interface WeatherForecastByZipCodeRequest {
    /** The zip code to get the weather forecast for */
    zipCode: string;
}

/**
 * Request parameters for fetching a weather forecast using coordinates
 */
export interface WeatherForecastByCoordinatesRequest {
    /** Latitude of the location */
    latitude: number;
    /** Longitude of the location */
    longitude: number;
}

/**
 * A single weather forecast data point
 */
export interface WeatherForecastEntry {
    /** Timestamp of this forecast entry in ISO format */
    timestampIso: string;
    /** Forecasted outdoor temperature in degrees Celsius */
    outdoorTemperatureCelsius: number;
}

/**
 * Response containing weather forecast data
 */
export interface WeatherForecastResponse {
    /** The resolution of the forecast data */
    resolution: ForecastResolutionEnum;
    /** Array of weather forecast entries ordered by timestamp */
    entries: WeatherForecastEntry[];
}

// ─── PV Forecasting Types ────────────────────────────────────────────────────

/**
 * Registration data for a PV forecast provider
 */
export interface PvForecastProviderRegistration {
    /** Unique identifier for the PV forecast provider */
    forecastId: string;
    /** Human-readable name of the forecast provider */
    name: string;
    /** Vendor or company providing the forecast */
    vendor: string;
}

/**
 * A registered PV forecast provider with metadata
 */
export interface PvForecastProviderInfo extends PvForecastProviderRegistration {
    /** Timestamp when this forecast provider was registered in ISO format */
    registeredAtIso: string;
}

/**
 * A single PV forecast data point
 */
export interface PvForecastEntry {
    /** Timestamp of this forecast entry in ISO format */
    timestampIso: string;
    /** Forecasted PV power output in kilowatts */
    forecastedKw: number;
}

/**
 * Response containing PV forecast data for a specific PV system
 */
export interface PvForecastResponse {
    /** The resolution of the forecast data */
    resolution: ForecastResolutionEnum;
    /** Array of PV forecast entries ordered by timestamp */
    entries: PvForecastEntry[];
}
