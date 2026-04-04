import {EnyoDataBusMessage, EnyoDataBusMessageEnum} from "./enyo-data-bus-value.js";

// ============================================================================
// Base Types
// ============================================================================

/**
 * Supported time resolutions for timeseries data buckets.
 * - `'1m'`  — 1-minute buckets aligned to clock minutes (:00, :01, :02, …)
 * - `'15m'` — 15-minute buckets aligned to clock quarters (:00, :15, :30, :45)
 */
export type TimeseriesResolution = '1m' | '15m';

/**
 * Defines a custom time range for timeseries queries.
 * Multiple ranges can be provided as an alternative to the single
 * `startDateIso` / `endDateIso` pair on {@link TimeseriesRequestBase}.
 */
export interface TimeseriesRange {
    /** ISO 8601 timestamp for the start of this range (inclusive) */
    startDateIso: string;
    /** ISO 8601 timestamp for the end of this range (exclusive) */
    endDateIso: string;
}

/**
 * Base interface for all timeseries entries.
 * Contains the timestamp boundaries for each time bucket.
 */
export interface TimeseriesEntryBase {
    /** ISO 8601 timestamp marking the start of this bucket (inclusive) */
    timestampIso: string;
    /** ISO 8601 timestamp marking the end of this bucket (exclusive) */
    timestampEndIso: string;
}

/**
 * Base interface for all timeseries requests.
 * Defines the date range, resolution, and optional appliance filter for queries.
 */
export interface TimeseriesRequestBase {
    /** ISO 8601 timestamp for the start of the query range (inclusive) */
    startDateIso: string;
    /** ISO 8601 timestamp for the end of the query range (exclusive) */
    endDateIso: string;
    /** Optional array of appliance IDs to filter by. If omitted, returns aggregated data from all relevant appliances */
    applianceIds?: string[];
    /** Time resolution of the requested data buckets. Defaults to `'15m'` if not specified */
    resolution?: TimeseriesResolution;
}

/**
 * Base interface for all timeseries responses.
 * Contains metadata about the query and result set.
 */
export interface TimeseriesResponseBase {
    /** ISO 8601 timestamp of the requested start date (inclusive) */
    requestedStartDateIso: string;
    /** ISO 8601 timestamp of the requested end date (exclusive) */
    requestedEndDateIso: string;
    /** ISO 8601 timestamp when this response was generated */
    generatedAtIso: string;
    /** Time resolution of the returned data buckets */
    resolution: TimeseriesResolution;
    /** Array of appliance IDs that contributed data to this response */
    includedApplianceIds: string[];
}

// ============================================================================
// Data Bus Message Query Types
// ============================================================================

/**
 * Request parameters for querying raw data bus messages.
 * Allows filtering by appliance, date range, and message types.
 */
export interface DataBusMessageQueryRequest {
    /** ID of the appliance to query messages for */
    applianceId: string;
    /** ISO 8601 timestamp for the start of the query range (inclusive) */
    startDateIso: string;
    /** ISO 8601 timestamp for the end of the query range (exclusive) */
    endDateIso: string;
    /** Optional array of message types to filter by. If omitted, returns all message types */
    messageTypes?: EnyoDataBusMessageEnum[];
    /** Maximum number of messages to return. Defaults to 100 if not specified */
    limit?: number;
    /** Number of messages to skip for pagination. Defaults to 0 if not specified */
    offset?: number;
}

/**
 * Response containing queried data bus messages with pagination metadata.
 */
export interface DataBusMessageQueryResponse {
    /** Array of data bus messages matching the query */
    messages: EnyoDataBusMessage[];
    /** Total count of messages matching the query (before pagination) */
    totalCount: number;
    /** Indicates whether more messages are available beyond the current page */
    hasMore: boolean;
    /** Metadata about the query */
    metadata: {
        /** ID of the appliance that was queried */
        applianceId: string;
        /** ISO 8601 timestamp of the requested start date */
        requestedStartDateIso: string;
        /** ISO 8601 timestamp of the requested end date */
        requestedEndDateIso: string;
        /** ISO 8601 timestamp when this response was generated */
        generatedAtIso: string;
    };
}

// ============================================================================
// PV Production Timeseries Types
// ============================================================================

/**
 * A single entry in the PV production timeseries.
 * Contains power and energy values for a single time bucket.
 */
export interface PvProductionTimeseriesEntry extends TimeseriesEntryBase {
    /** Time-weighted average PV power output in Watts for this bucket */
    pvPowerW: number;
    /** Cumulative PV energy production in Watt-hours for this bucket */
    pvPowerWh: number;
}

/**
 * Request parameters for querying PV production timeseries data.
 */
export interface PvProductionTimeseriesRequest extends TimeseriesRequestBase {}

/**
 * Response containing PV production timeseries data.
 */
export interface PvProductionTimeseriesResponse extends TimeseriesResponseBase {
    /** Array of PV production entries, one per time bucket */
    entries: PvProductionTimeseriesEntry[];
    /** Total PV energy production in Watt-hours across all buckets in the response */
    totalPvProductionWh: number;
}

// ============================================================================
// Battery SOC Timeseries Types
// ============================================================================

/**
 * A single entry in the battery state of charge timeseries.
 * Contains SOC statistics for a single time bucket.
 */
export interface BatterySocTimeseriesEntry extends TimeseriesEntryBase {
    /** Time-weighted average battery state of charge (0-100) for this bucket */
    batterySoC: number;
    /** Minimum battery state of charge (0-100) observed in this bucket */
    batterySoCMin: number;
    /** Maximum battery state of charge (0-100) observed in this bucket */
    batterySoCMax: number;
}

/**
 * Request parameters for querying battery SOC timeseries data.
 */
export interface BatterySocTimeseriesRequest extends TimeseriesRequestBase {}

/**
 * Response containing battery SOC timeseries data.
 */
export interface BatterySocTimeseriesResponse extends TimeseriesResponseBase {
    /** Array of battery SOC entries, one per time bucket */
    entries: BatterySocTimeseriesEntry[];
    /** Average state of charge across all buckets in the response */
    averageSoC: number;
}

// ============================================================================
// Battery Power Timeseries Types
// ============================================================================

/**
 * A single entry in the battery power timeseries.
 * Contains power and energy values for a single time bucket.
 * Positive values indicate discharge (consumption from battery),
 * negative values indicate charge (energy into battery).
 */
export interface BatteryPowerTimeseriesEntry extends TimeseriesEntryBase {
    /** Time-weighted average battery power in Watts for this bucket. Positive = discharge, negative = charge */
    batteryPowerW: number;
    /** Cumulative battery energy in Watt-hours for this bucket. Positive = discharge, negative = charge */
    batteryPowerWh: number;
}

/**
 * Request parameters for querying battery power timeseries data.
 */
export interface BatteryPowerTimeseriesRequest extends TimeseriesRequestBase {}

/**
 * Response containing battery power timeseries data.
 */
export interface BatteryPowerTimeseriesResponse extends TimeseriesResponseBase {
    /** Array of battery power entries, one per time bucket */
    entries: BatteryPowerTimeseriesEntry[];
    /** Total energy discharged from battery in Watt-hours across all buckets */
    totalDischargeWh: number;
    /** Total energy charged into battery in Watt-hours across all buckets */
    totalChargeWh: number;
}

// ============================================================================
// Meter Values Timeseries Types
// ============================================================================

/**
 * A single entry in the meter values timeseries.
 * Contains grid consumption and feed-in energy values for a single time bucket.
 */
export interface MeterValuesTimeseriesEntry extends TimeseriesEntryBase {
    /** Grid energy consumption in Watt-hours for this bucket */
    gridConsumptionWh: number;
    /** Grid energy feed-in in Watt-hours for this bucket */
    gridFeedInWh: number;
}

/**
 * Request parameters for querying meter values timeseries data.
 */
export interface MeterValuesTimeseriesRequest extends TimeseriesRequestBase {}

/**
 * Response containing meter values timeseries data.
 */
export interface MeterValuesTimeseriesResponse extends TimeseriesResponseBase {
    /** Array of meter value entries, one per time bucket */
    entries: MeterValuesTimeseriesEntry[];
    /** Total grid consumption in Watt-hours across all buckets */
    totalGridConsumptionWh: number;
    /** Total grid feed-in in Watt-hours across all buckets */
    totalGridFeedInWh: number;
}

// ============================================================================
// Grid Power Timeseries Types
// ============================================================================

/**
 * A single entry in the grid power timeseries.
 * Contains power and energy values for a single time bucket.
 * Positive values indicate import (consumption from grid),
 * negative values indicate export (feed-in to grid).
 */
export interface GridPowerTimeseriesEntry extends TimeseriesEntryBase {
    /** Time-weighted average grid power in Watts for this bucket. Positive = import, negative = export */
    gridPowerW: number;
    /** Cumulative grid energy in Watt-hours for this bucket. Positive = import, negative = export */
    gridPowerWh: number;
}

/**
 * Request parameters for querying grid power timeseries data.
 */
export interface GridPowerTimeseriesRequest extends TimeseriesRequestBase {}

/**
 * Response containing grid power timeseries data.
 */
export interface GridPowerTimeseriesResponse extends TimeseriesResponseBase {
    /** Array of grid power entries, one per time bucket */
    entries: GridPowerTimeseriesEntry[];
    /** Total energy imported from grid in Watt-hours across all buckets */
    totalImportWh: number;
    /** Total energy exported to grid in Watt-hours across all buckets */
    totalExportWh: number;
}

// ============================================================================
// Home Consumption Timeseries Types
// ============================================================================

/**
 * A single entry in the home consumption timeseries.
 * Contains power and energy values for a single time bucket.
 * Represents the total energy consumed by the home (all appliances combined).
 */
export interface HomeConsumptionTimeseriesEntry extends TimeseriesEntryBase {
    /** Time-weighted average home consumption power in Watts for this bucket */
    homeConsumptionW: number;
    /** Cumulative home consumption energy in Watt-hours for this bucket */
    homeConsumptionWh: number;
}

/**
 * Request parameters for querying home consumption timeseries data.
 */
export interface HomeConsumptionTimeseriesRequest extends TimeseriesRequestBase {}

/**
 * Response containing home consumption timeseries data.
 */
export interface HomeConsumptionTimeseriesResponse extends TimeseriesResponseBase {
    /** Array of home consumption entries, one per time bucket */
    entries: HomeConsumptionTimeseriesEntry[];
    /** Total home consumption energy in Watt-hours across all buckets */
    totalHomeConsumptionWh: number;
}

/**
 * A single entry in the heatpump temperature timeseries.
 * Contains average temperature readings for a single time bucket.
 * All fields are optional since not all heatpumps report all temperature types.
 */
export interface HeatpumpTemperatureTimeseriesEntry extends TimeseriesEntryBase {
    /** Average outdoor temperature in degrees Celsius for this bucket */
    outdoorTemperatureC?: number;
    /** Average heatpump flow temperature in degrees Celsius for this bucket */
    heatpumpFlowTemperatureC?: number;
    /** Average buffer tank temperature in degrees Celsius for this bucket */
    bufferTankTemperatureC?: number;
    /** Domestic hot water tank temperature readings, indexed per tank */
    domesticHotWater?: {
        /** Zero-based index identifying the DHW tank */
        index: number;
        /** Average temperature in degrees Celsius for this bucket */
        averageTemperatureC: number;
        /** Average target temperature in degrees Celsius for this bucket */
        averageTargetTemperatureC: number;
    }[];
    /** Heating circuit temperature readings, indexed per circuit */
    heatingCircuits?: {
        /** Zero-based index identifying the heating circuit */
        index: number;
        /** Average temperature in degrees Celsius for this bucket */
        averageTemperatureC: number;
        /** Average target temperature in degrees Celsius for this bucket */
        averageTargetTemperatureC: number;
    }[];
}

/**
 * Request parameters for querying heatpump temperature timeseries data.
 */
export interface HeatpumpTemperatureTimeseriesRequest extends TimeseriesRequestBase {}

/**
 * Response containing heatpump temperature timeseries data.
 */
export interface HeatpumpTemperatureTimeseriesResponse extends TimeseriesResponseBase {
    /** Array of heatpump temperature entries, one per time bucket */
    entries: HeatpumpTemperatureTimeseriesEntry[];
    /** Average outdoor temperature in degrees Celsius across all buckets */
    averageOutdoorTemperatureC?: number;
    /** Average heatpump flow temperature in degrees Celsius across all buckets */
    averageHeatpumpFlowTemperatureC?: number;
    /** Average buffer tank temperature in degrees Celsius across all buckets */
    averageBufferTankTemperatureC?: number;
}

/**
 * A single entry in the temperature sensor timeseries.
 * Contains per-sensor average temperature readings for a single time bucket.
 */
export interface TemperatureSensorTimeseriesEntry extends TimeseriesEntryBase {
    /** Array of sensor readings for this bucket */
    sensors: {
        /** Unique identifier for the temperature sensor */
        sensorId: string;
        /** Average temperature in degrees Celsius for this bucket */
        averageTemperatureC: number;
        /** Average target temperature in degrees Celsius for this bucket, if applicable */
        averageTargetTemperatureC?: number;
    }[];
}

/**
 * Request parameters for querying temperature sensor timeseries data.
 */
export interface TemperatureSensorTimeseriesRequest extends TimeseriesRequestBase {}

/**
 * Response containing temperature sensor timeseries data.
 */
export interface TemperatureSensorTimeseriesResponse extends TimeseriesResponseBase {
    /** Array of temperature sensor entries, one per time bucket */
    entries: TemperatureSensorTimeseriesEntry[];
    /** Per-sensor average temperatures across the full queried period */
    sensors: {
        /** Unique identifier for the temperature sensor */
        sensorId: string;
        /** Average temperature in degrees Celsius across the full period */
        averageTemperatureC: number;
        /** Average target temperature in degrees Celsius across the full period, if applicable */
        averageTargetTemperatureC?: number;
    }[];
}
