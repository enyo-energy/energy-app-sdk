import {EnyoDataBusMessage, EnyoDataBusMessageEnum} from "./enyo-data-bus-value.js";

// ============================================================================
// Base Types
// ============================================================================

/**
 * Base interface for all timeseries entries.
 * Contains the timestamp boundaries for each 15-minute bucket.
 */
export interface TimeseriesEntryBase {
    /** ISO 8601 timestamp marking the start of this bucket (inclusive) */
    timestampIso: string;
    /** ISO 8601 timestamp marking the end of this bucket (exclusive) */
    timestampEndIso: string;
}

/**
 * Base interface for all timeseries requests.
 * Defines the date range and optional appliance filter for queries.
 */
export interface TimeseriesRequestBase {
    /** ISO 8601 timestamp for the start of the query range (inclusive) */
    startDateIso: string;
    /** ISO 8601 timestamp for the end of the query range (exclusive) */
    endDateIso: string;
    /** Optional array of appliance IDs to filter by. If omitted, returns aggregated data from all relevant appliances */
    applianceIds?: string[];
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
    resolution: '15m';
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
 * Contains power and energy values for a 15-minute bucket.
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
    /** Array of PV production entries, one per 15-minute bucket */
    entries: PvProductionTimeseriesEntry[];
    /** Total PV energy production in Watt-hours across all buckets in the response */
    totalPvProductionWh: number;
}

// ============================================================================
// Battery SOC Timeseries Types
// ============================================================================

/**
 * A single entry in the battery state of charge timeseries.
 * Contains SOC statistics for a 15-minute bucket.
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
    /** Array of battery SOC entries, one per 15-minute bucket */
    entries: BatterySocTimeseriesEntry[];
    /** Average state of charge across all buckets in the response */
    averageSoC: number;
}

// ============================================================================
// Battery Power Timeseries Types
// ============================================================================

/**
 * A single entry in the battery power timeseries.
 * Contains power and energy values for a 15-minute bucket.
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
    /** Array of battery power entries, one per 15-minute bucket */
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
 * Contains grid consumption and feed-in energy values for a 15-minute bucket.
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
    /** Array of meter value entries, one per 15-minute bucket */
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
 * Contains power and energy values for a 15-minute bucket.
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
    /** Array of grid power entries, one per 15-minute bucket */
    entries: GridPowerTimeseriesEntry[];
    /** Total energy imported from grid in Watt-hours across all buckets */
    totalImportWh: number;
    /** Total energy exported to grid in Watt-hours across all buckets */
    totalExportWh: number;
}
