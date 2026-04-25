/**
 * Shared configuration and bucket types used by every forecast implementation
 * under {@link ./}.
 *
 * The forecasters in this folder all follow the same shape:
 *  1. On {@link Forecaster.initialize | initialize()}, pull a window of historical
 *     timeseries data via the `EnergyApp.useTimeseries()` API.
 *  2. Subscribe to live data-bus update events to keep the in-memory history
 *     fresh as new data arrives.
 *  3. Expose {@link Forecaster.getForecast | getForecast()} to produce a
 *     forward-looking forecast over the configured horizon.
 *  4. Optionally republish the forecast on the data bus on every refresh
 *     (when `publishToBus` is true, which is the default).
 */

/**
 * Configuration for any forecast implementation in this folder.
 *
 * Each option has a sensible default; pass an empty object to use defaults.
 * Per-forecaster defaults may differ — see each class' constructor docs.
 */
export interface ForecastConfig {
    /**
     * How many days of historical data to query when building the forecast.
     * Newer days are weighted higher.
     * @default 7
     */
    historyDays?: number;
    /**
     * Resolution of the input timeseries query and of the produced forecast.
     * @default '15m'
     */
    resolution?: '1m' | '15m';
    /**
     * Forecast horizon in hours (number of buckets = horizonHours * 4 at 15m).
     * @default 24
     */
    horizonHours?: number;
    /**
     * If `true`, the last ~2 hours of actual data are used to scale the start
     * of the forecast so it joins smoothly with reality. The correction decays
     * to zero over the alignment window.
     * @default true
     */
    alignToRecentActuals?: boolean;
    /**
     * If `true`, a fresh `EnyoDataBus*ForecastV1` message is published on the
     * data bus every time the forecast is recomputed.
     * @default true
     */
    publishToBus?: boolean;
}

/**
 * Concrete `ForecastConfig` with all defaults filled in.
 * Used internally by forecasters after merging caller config with defaults.
 */
export interface ResolvedForecastConfig extends Required<ForecastConfig> {}

/**
 * A bucket of historical data used by every forecaster. Each forecaster works
 * over a flat array of buckets sorted by `timestampIso`.
 *
 * @typeParam V — the shape of the bucket payload (e.g. `{ powerW: number }`).
 */
export interface HistoricalBucket<V extends object> {
    /** ISO 8601 UTC timestamp at the start of the 15-minute slot. */
    timestampIso: string;
    /** The bucket payload; depends on the forecaster. */
    values: V;
}

/**
 * Common shape returned by `getForecast()` on all forecasters in this folder.
 * The concrete `data` payload matches the data-bus message schema for the
 * forecast type, so the message can be sent verbatim on the bus.
 *
 * @typeParam D — the shape of the forecast `data` payload.
 */
export interface BaseForecast<D> {
    /** ISO 8601 UTC timestamp at which this forecast was generated. */
    generatedAtIso: string;
    /** Forecast payload, matching the corresponding `EnyoDataBus*ForecastV1.data`. */
    data: D;
}

/**
 * Common contract shared by every forecaster class. All forecasters in this
 * folder satisfy this interface; the concrete `getForecast()` return type is
 * narrowed in each subclass.
 */
export interface Forecaster {
    /**
     * Pull initial history via `useTimeseries()` and start listening to live
     * data-bus updates. Idempotent.
     */
    initialize(): Promise<void>;
    /**
     * Recompute and return the current forecast. Pure / side-effect free.
     */
    getForecast(): unknown;
    /**
     * Publish the current forecast on the data bus. Called automatically on
     * each recompute when `publishToBus` is `true`.
     */
    publishForecast(): void;
    /**
     * Stop listening to data-bus updates and free internal state.
     */
    dispose(): void;
}

/**
 * Default values applied to every {@link ForecastConfig} unless a forecaster
 * overrides a specific field with its own default.
 */
export const DEFAULT_FORECAST_CONFIG: ResolvedForecastConfig = {
    historyDays: 7,
    resolution: '15m',
    horizonHours: 24,
    alignToRecentActuals: true,
    publishToBus: true,
};

/**
 * Merges caller-provided config with a per-forecaster default object.
 *
 * @param defaults - Per-forecaster defaults (e.g. `historyDays: 4` for PV).
 * @param overrides - Caller's optional overrides.
 * @returns A fully populated, type-safe config object.
 */
export function resolveForecastConfig(
    defaults: Partial<ResolvedForecastConfig>,
    overrides?: ForecastConfig,
): ResolvedForecastConfig {
    return {
        ...DEFAULT_FORECAST_CONFIG,
        ...defaults,
        ...(overrides ?? {}),
    };
}
