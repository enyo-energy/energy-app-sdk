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

/**
 * Weather symbol representing the current or forecasted weather condition.
 * Values correspond to standard meteorological symbol codes.
 */
export enum EnyoWeatherSymbolEnum {
    ClearskyDay = 'clearsky_day',
    ClearskyNight = 'clearsky_night',
    ClearskyPolartwilight = 'clearsky_polartwilight',
    Cloudy = 'cloudy',
    FairDay = 'fair_day',
    FairNight = 'fair_night',
    FairPolartwilight = 'fair_polartwilight',
    Fog = 'fog',
    Heavyrain = 'heavyrain',
    HeavyrainAndThunder = 'heavyrainandthunder',
    HeavyrainShowersDay = 'heavyrainshowers_day',
    HeavyrainShowersNight = 'heavyrainshowers_night',
    HeavyrainShowersPolartwilight = 'heavyrainshowers_polartwilight',
    HeavyrainShowersAndThunderDay = 'heavyrainshowersandthunder_day',
    HeavyrainShowersAndThunderNight = 'heavyrainshowersandthunder_night',
    HeavyrainShowersAndThunderPolartwilight = 'heavyrainshowersandthunder_polartwilight',
    Heavysleet = 'heavysleet',
    HeavysleetAndThunder = 'heavysleetandthunder',
    HeavysleetShowersDay = 'heavysleetshowers_day',
    HeavysleetShowersNight = 'heavysleetshowers_night',
    HeavysleetShowersPolartwilight = 'heavysleetshowers_polartwilight',
    HeavysleetShowersAndThunderDay = 'heavysleetshowersandthunder_day',
    HeavysleetShowersAndThunderNight = 'heavysleetshowersandthunder_night',
    HeavysleetShowersAndThunderPolartwilight = 'heavysleetshowersandthunder_polartwilight',
    Heavysnow = 'heavysnow',
    HeavysnowAndThunder = 'heavysnowandthunder',
    HeavysnowShowersDay = 'heavysnowshowers_day',
    HeavysnowShowersNight = 'heavysnowshowers_night',
    HeavysnowShowersPolartwilight = 'heavysnowshowers_polartwilight',
    HeavysnowShowersAndThunderDay = 'heavysnowshowersandthunder_day',
    HeavysnowShowersAndThunderNight = 'heavysnowshowersandthunder_night',
    HeavysnowShowersAndThunderPolartwilight = 'heavysnowshowersandthunder_polartwilight',
    Lightrain = 'lightrain',
    LightrainAndThunder = 'lightrainandthunder',
    LightrainShowersDay = 'lightrainshowers_day',
    LightrainShowersNight = 'lightrainshowers_night',
    LightrainShowersPolartwilight = 'lightrainshowers_polartwilight',
    LightrainShowersAndThunderDay = 'lightrainshowersandthunder_day',
    LightrainShowersAndThunderNight = 'lightrainshowersandthunder_night',
    LightrainShowersAndThunderPolartwilight = 'lightrainshowersandthunder_polartwilight',
    Lightsleet = 'lightsleet',
    LightsleetAndThunder = 'lightsleetandthunder',
    LightsleetShowersDay = 'lightsleetshowers_day',
    LightsleetShowersNight = 'lightsleetshowers_night',
    LightsleetShowersPolartwilight = 'lightsleetshowers_polartwilight',
    Lightsnow = 'lightsnow',
    LightsnowAndThunder = 'lightsnowandthunder',
    LightsnowShowersDay = 'lightsnowshowers_day',
    LightsnowShowersNight = 'lightsnowshowers_night',
    LightsnowShowersPolartwilight = 'lightsnowshowers_polartwilight',
    LightssleetShowersAndThunderDay = 'lightssleetshowersandthunder_day',
    LightssleetShowersAndThunderNight = 'lightssleetshowersandthunder_night',
    LightssleetShowersAndThunderPolartwilight = 'lightssleetshowersandthunder_polartwilight',
    LightssnowShowersAndThunderDay = 'lightssnowshowersandthunder_day',
    LightssnowShowersAndThunderNight = 'lightssnowshowersandthunder_night',
    LightssnowShowersAndThunderPolartwilight = 'lightssnowshowersandthunder_polartwilight',
    PartlycloudyDay = 'partlycloudy_day',
    PartlycloudyNight = 'partlycloudy_night',
    PartlycloudyPolartwilight = 'partlycloudy_polartwilight',
    Rain = 'rain',
    RainAndThunder = 'rainandthunder',
    RainShowersDay = 'rainshowers_day',
    RainShowersNight = 'rainshowers_night',
    RainShowersPolartwilight = 'rainshowers_polartwilight',
    RainShowersAndThunderDay = 'rainshowersandthunder_day',
    RainShowersAndThunderNight = 'rainshowersandthunder_night',
    RainShowersAndThunderPolartwilight = 'rainshowersandthunder_polartwilight',
    Sleet = 'sleet',
    SleetAndThunder = 'sleetandthunder',
    SleetShowersDay = 'sleetshowers_day',
    SleetShowersNight = 'sleetshowers_night',
    SleetShowersPolartwilight = 'sleetshowers_polartwilight',
    SleetShowersAndThunderDay = 'sleetshowersandthunder_day',
    SleetShowersAndThunderNight = 'sleetshowersandthunder_night',
    SleetShowersAndThunderPolartwilight = 'sleetshowersandthunder_polartwilight',
    Snow = 'snow',
    SnowAndThunder = 'snowandthunder',
    SnowShowersDay = 'snowshowers_day',
    SnowShowersNight = 'snowshowers_night',
    SnowShowersPolartwilight = 'snowshowers_polartwilight',
    SnowShowersAndThunderDay = 'snowshowersandthunder_day',
    SnowShowersAndThunderNight = 'snowshowersandthunder_night',
    SnowShowersAndThunderPolartwilight = 'snowshowersandthunder_polartwilight',
    Unknown = 'unknown'
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
    /** Wind speed in meters per second */
    windSpeedMs?: number;
    /** Cloud coverage area as a percentage (0-100) */
    cloudAreaPercent?: number;
    /** Weather symbol representing the forecasted weather condition */
    symbol?: EnyoWeatherSymbolEnum;
    /** Global horizontal irradiance in W/m² */
    globalHorizontalIrradiance?: number;
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

export enum EnyoPvForecastProviderQualityLevelEnum {
    /** High-quality forecast with low expected error margin */
    High = 'high',
    /** Medium-quality forecast with moderate expected error margin */
    Medium = 'medium',
    /** Low-quality forecast with high expected error margin */
    Low = 'low'
}

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
    qualityLevel: EnyoPvForecastProviderQualityLevelEnum;
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

// ─── Dynamic Price Forecasting Types ─────────────────────────────────────────

/**
 * Registration data for a dynamic price forecast provider.
 * A dynamic price forecast represents forward-looking electricity prices
 * (e.g. day-ahead spot market prices) published by any energy app for
 * consumption by other energy apps. The data is a forecast only and must
 * not be treated as billed/realized pricing.
 */
export interface DynamicPriceForecastProviderRegistration {
    /** Unique identifier for the dynamic price forecast provider */
    forecastId: string;
    /** Human-readable name of the forecast provider */
    name: string;
    /** Vendor or company providing the forecast */
    vendor: string;
}

/**
 * A registered dynamic price forecast provider with metadata.
 */
export interface DynamicPriceForecastProviderInfo extends DynamicPriceForecastProviderRegistration {
    /** Timestamp when this forecast provider was registered in ISO format */
    registeredAtIso: string;
    /**
     * Timestamp of the most recent published forecast in ISO format.
     * Undefined when the provider has not yet published a forecast.
     */
    lastPublishedAtIso?: string;
}

/**
 * A single data point in a dynamic price forecast.
 * Prices are expressed per kWh in the forecast's declared currency.
 * Both consumption and feed-in prices are forecasts and not realized values.
 */
export interface DynamicPriceForecastEntry {
    /** Start time of this forecast interval in ISO format */
    timestampIso: string;
    /** Forecasted price per kWh for electricity consumption during this interval */
    consumptionPricePerKwh: number;
    /** Optional forecasted price per kWh for grid feed-in during this interval */
    feedInPricePerKwh?: number;
}

/**
 * Payload published by a dynamic price forecast provider.
 * Contains the ordered forecast entries, their resolution, and the currency
 * the prices are expressed in. The payload is forecast data only — it does
 * not represent realized or billed energy prices.
 */
export interface DynamicPriceForecastPayload {
    /** Currency code (ISO 4217, e.g., 'EUR', 'USD') the prices are expressed in */
    currency: string;
    /** The resolution of the forecast data */
    resolution: ForecastResolutionEnum;
    /**
     * Ordered array of forecast entries. Entries must be sorted ascending by
     * `timestampIso` and aligned to the declared `resolution`.
     */
    entries: DynamicPriceForecastEntry[];
}

/**
 * Response containing a dynamic price forecast as returned by the consumer
 * API. Carries the publishing provider's id and the time the forecast was
 * published in addition to the {@link DynamicPriceForecastPayload}.
 */
export interface DynamicPriceForecastResponse extends DynamicPriceForecastPayload {
    /** Identifier of the forecast provider that published this forecast */
    forecastId: string;
    /** ISO timestamp at which this forecast was published */
    publishedAtIso: string;
}

/**
 * Filter parameters for retrieving a dynamic price forecast.
 */
export interface DynamicPriceForecastFilter {
    /**
     * Optional lower bound (inclusive) for forecast entries in ISO format.
     * When omitted, the full forecast horizon is returned.
     */
    fromIso?: string;
    /**
     * Optional upper bound (exclusive) for forecast entries in ISO format.
     * When omitted, the full forecast horizon is returned.
     */
    untilIso?: string;
}
