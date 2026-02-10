/**
 * Represents a single 15-minute bucket of PV forecast data
 */
export interface PvForecastBucket {
    /** Start time of this 15-minute interval in ISO format */
    timestampIso: string;
    /** Forecasted PV production power in Watts */
    pvProductionW: number;
    /** Forecasted PV production energy in Watt hours for this interval */
    pvProductionWh: number;
}

/**
 * PV forecast data for a specified time range
 */
export interface PvForecast {
    /** Start of the forecast range in ISO format */
    fromIso: string;
    /** End of the forecast range in ISO format */
    untilIso: string;
    /** Array of 15-minute forecast buckets */
    buckets: PvForecastBucket[];
}
