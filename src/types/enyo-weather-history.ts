import {EnyoWeatherSymbolEnum} from './enyo-forecasting.js';

/**
 * Resolution of historical weather data entries.
 *
 * The values mirror {@link ForecastResolutionEnum} so a history series and a
 * forecast series of the same resolution can be concatenated without
 * translating between the two vocabularies.
 */
export enum WeatherHistoryResolutionEnum {
    /** 1-minute intervals */
    OneMinute = '1min',
    /** 15-minute intervals */
    FifteenMinutes = '15min',
    /** 1-hour intervals */
    OneHour = '1hr'
}

/**
 * Registration data for a weather history provider.
 *
 * A provider is not told which place to serve: it resolves the device's own
 * location itself via `energyApp.useLocation()`, so nothing location-shaped
 * travels through this API.
 */
export interface WeatherHistoryRegistration {
    /** Unique identifier for the weather history provider */
    historyId: string;
    /** Human-readable name of the history provider */
    name: string;
    /** Vendor or company providing the historical data */
    vendor: string;
    /**
     * How far back the provider can serve data, in days. Informational — it
     * lets a consumer size its request before issuing one that would only be
     * partially covered.
     */
    availableHistoryDays?: number;
    /**
     * The measures this provider can serve. Informational — it lets a consumer
     * pick a provider that holds the quantity it needs instead of discovering
     * the gap from an empty result. When omitted, assume outdoor temperature
     * only.
     */
    availableMeasures?: WeatherHistoryMeasureEnum[];
}

/**
 * A registered weather history provider with metadata.
 */
export interface WeatherHistoryInfo extends WeatherHistoryRegistration {
    /** Timestamp when this history provider was registered in ISO format */
    registeredAtIso: string;
}

/**
 * Time interval and resolution shared by every weather history request.
 *
 * The interval is half-open — `fromIso` is included, `untilIso` is not — so
 * consecutive intervals can be requested back to back without the boundary
 * timestamp being counted twice.
 */
export interface WeatherHistoryIntervalRequest {
    /** Start of the requested interval in ISO format (inclusive) */
    fromIso: string;
    /** End of the requested interval in ISO format (exclusive) */
    untilIso: string;
    /**
     * Desired resolution of the returned readings. When omitted, the
     * provider's own resolution is used. A resolution finer than the
     * provider's is filled by linear interpolation; a coarser one is
     * aggregated as a time-weighted average.
     */
    resolution?: WeatherHistoryResolutionEnum;
}

/**
 * Request parameters for fetching historical outdoor temperatures for a time
 * interval — the interval and resolution, nothing else.
 */
export type OutdoorTemperatureHistoryRequest = WeatherHistoryIntervalRequest;

/**
 * A single observed outdoor temperature at a point in time.
 */
export interface OutdoorTemperatureReading {
    /** Start of the bucket this reading applies to, in ISO format */
    timestampIso: string;
    /** Observed outdoor temperature in degrees Celsius */
    outdoorTemperatureCelsius: number;
}

/**
 * Observed outdoor temperatures covering a requested time interval.
 *
 * `fromIso`, `untilIso` and `resolution` echo what was asked for, while
 * {@link OutdoorTemperatureHistory.coveredFromIso} and
 * {@link OutdoorTemperatureHistory.coveredUntilIso} state what the provider
 * could actually deliver — these differ whenever the requested interval
 * reaches further back than the provider's archive, or into the future.
 */
export interface OutdoorTemperatureHistory {
    /** Start of the requested interval in ISO format (inclusive) */
    fromIso: string;
    /** End of the requested interval in ISO format (exclusive) */
    untilIso: string;
    /** The resolution of the returned readings */
    resolution: WeatherHistoryResolutionEnum;
    /**
     * Readings ordered by timestamp, one per bucket of
     * {@link OutdoorTemperatureHistory.resolution}. Empty when the provider
     * holds no data for the requested interval — this is a normal result, not
     * an error.
     */
    readings: OutdoorTemperatureReading[];
    /**
     * Time-weighted mean temperature over the covered part of the interval, in
     * degrees Celsius. Absent when {@link OutdoorTemperatureHistory.readings}
     * is empty.
     */
    averageCelsius?: number;
    /**
     * Lowest temperature in degrees Celsius over the covered part of the
     * interval. Absent when {@link OutdoorTemperatureHistory.readings} is
     * empty.
     */
    minCelsius?: number;
    /**
     * Highest temperature in degrees Celsius over the covered part of the
     * interval. Absent when {@link OutdoorTemperatureHistory.readings} is
     * empty.
     */
    maxCelsius?: number;
    /**
     * Start of the part of the interval the provider could cover, in ISO
     * format. Later than {@link OutdoorTemperatureHistory.fromIso} when the
     * request reached further back than the archive goes. Absent when
     * {@link OutdoorTemperatureHistory.readings} is empty.
     */
    coveredFromIso?: string;
    /**
     * End of the part of the interval the provider could cover, in ISO format.
     * Earlier than {@link OutdoorTemperatureHistory.untilIso} when the request
     * reached into the future or past the most recent observation. Absent when
     * {@link OutdoorTemperatureHistory.readings} is empty.
     */
    coveredUntilIso?: string;
}

/**
 * A weather quantity a history provider can serve.
 *
 * Used to narrow a request to the measures an app actually needs — archives
 * are usually billed or rate-limited per quantity, so asking for irradiance
 * when only wind is wanted is pure cost.
 */
export enum WeatherHistoryMeasureEnum {
    /** Outdoor air temperature in degrees Celsius */
    OutdoorTemperature = 'outdoor-temperature',
    /** Wind speed in meters per second */
    WindSpeed = 'wind-speed',
    /** Cloud coverage area in percent */
    CloudArea = 'cloud-area',
    /** Global horizontal irradiance in W/m² */
    GlobalHorizontalIrradiance = 'global-horizontal-irradiance',
    /** Direct normal irradiance in W/m² */
    DirectNormalIrradiance = 'direct-normal-irradiance',
    /** Diffuse horizontal irradiance in W/m² */
    DiffuseHorizontalIrradiance = 'diffuse-horizontal-irradiance',
    /** Categorical weather symbol */
    Symbol = 'symbol'
}

/**
 * A single observed weather data point.
 *
 * Every measure is optional: a reading only carries the quantities the
 * provider holds and the request asked for. The field names and units mirror
 * `WeatherForecastEntry` exactly, so an observed series and a forecast series
 * can be concatenated into one timeline without translating between them.
 */
export interface WeatherHistoryReading {
    /** Start of the bucket this reading applies to, in ISO format */
    timestampIso: string;
    /** Observed outdoor temperature in degrees Celsius */
    outdoorTemperatureCelsius?: number;
    /** Observed wind speed in meters per second */
    windSpeedMs?: number;
    /** Observed cloud coverage area as a percentage (0-100) */
    cloudAreaPercent?: number;
    /** Weather symbol describing the observed condition */
    symbol?: EnyoWeatherSymbolEnum;
    /**
     * Global horizontal irradiance in W/m².
     *
     * Total shortwave radiation received by a horizontal surface — the sum of
     * the diffuse part and the horizontal projection of the direct part
     * (`GHI = DHI + DNI * cos(zenith)`). This is the quantity to correlate
     * with measured PV production.
     */
    globalHorizontalIrradiance?: number;
    /**
     * Direct normal irradiance (DNI) in W/m².
     *
     * Beam radiation arriving from the direction of the sun, measured on a
     * surface held perpendicular to the sun's rays. Together with
     * {@link WeatherHistoryReading.diffuseHorizontalIrradiance} it allows
     * transposing the observation onto an arbitrarily tilted plane (plane of
     * array), which a single GHI value cannot do.
     */
    directNormalIrradiance?: number;
    /**
     * Diffuse horizontal irradiance (DHI) in W/m².
     *
     * The part of the radiation on a horizontal surface that has been
     * scattered by the atmosphere and clouds, i.e. everything that did not
     * arrive directly from the sun's disc. See
     * {@link WeatherHistoryReading.directNormalIrradiance}.
     */
    diffuseHorizontalIrradiance?: number;
}

/**
 * Aggregates of one numeric measure over the covered part of an interval.
 */
export interface WeatherHistoryStatistics {
    /**
     * Time-weighted mean of the measure over the covered interval, in the
     * measure's own unit.
     *
     * For the irradiance measures this is a mean power density in W/m²;
     * multiply by the covered duration in hours to get the received energy in
     * Wh/m².
     */
    averageValue: number;
    /** Lowest observed value of the measure, in the measure's own unit */
    minValue: number;
    /** Highest observed value of the measure, in the measure's own unit */
    maxValue: number;
}

/**
 * Request parameters for fetching observed weather for a time interval.
 */
export interface WeatherHistoryRequest extends WeatherHistoryIntervalRequest {
    /**
     * The measures to return. When omitted, the provider returns everything it
     * holds for the interval.
     */
    measures?: WeatherHistoryMeasureEnum[];
}

/**
 * Observed weather covering a requested time interval, across every requested
 * measure.
 *
 * This is the general-purpose counterpart to {@link OutdoorTemperatureHistory}:
 * same interval and coverage semantics, but each reading carries the full set
 * of requested quantities instead of temperature alone.
 */
export interface WeatherHistory {
    /** Start of the requested interval in ISO format (inclusive) */
    fromIso: string;
    /** End of the requested interval in ISO format (exclusive) */
    untilIso: string;
    /** The resolution of the returned readings */
    resolution: WeatherHistoryResolutionEnum;
    /** The measures actually contained in the readings */
    measures: WeatherHistoryMeasureEnum[];
    /**
     * Readings ordered by timestamp, one per bucket of
     * {@link WeatherHistory.resolution}. Empty when the provider holds no data
     * for the requested interval — this is a normal result, not an error.
     */
    readings: WeatherHistoryReading[];
    /**
     * Aggregates per numeric measure over the covered part of the interval.
     * {@link WeatherHistoryMeasureEnum.Symbol} is categorical and therefore
     * never present here. Absent when {@link WeatherHistory.readings} is empty.
     */
    statistics?: Partial<Record<WeatherHistoryMeasureEnum, WeatherHistoryStatistics>>;
    /**
     * Start of the part of the interval the provider could cover, in ISO
     * format. Later than {@link WeatherHistory.fromIso} when the request
     * reached further back than the archive goes. Absent when
     * {@link WeatherHistory.readings} is empty.
     */
    coveredFromIso?: string;
    /**
     * End of the part of the interval the provider could cover, in ISO format.
     * Earlier than {@link WeatherHistory.untilIso} when the request reached
     * into the future or past the most recent observation. Absent when
     * {@link WeatherHistory.readings} is empty.
     */
    coveredUntilIso?: string;
}
