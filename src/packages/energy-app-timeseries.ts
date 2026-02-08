import {
    DataBusMessageQueryRequest,
    DataBusMessageQueryResponse,
    PvProductionTimeseriesRequest,
    PvProductionTimeseriesResponse,
    BatterySocTimeseriesRequest,
    BatterySocTimeseriesResponse,
    BatteryPowerTimeseriesRequest,
    BatteryPowerTimeseriesResponse,
    MeterValuesTimeseriesRequest,
    MeterValuesTimeseriesResponse,
    GridPowerTimeseriesRequest,
    GridPowerTimeseriesResponse,
} from "../types/enyo-timeseries.js";

/**
 * Interface for querying historical energy data with 15-minute bucket granularity.
 * Provides methods to retrieve aggregated timeseries data for various energy metrics
 * including PV production, battery state, meter values, and grid power.
 *
 * All aggregated methods return data in 15-minute buckets aligned to clock time
 * (:00, :15, :30, :45). Power values (W) represent time-weighted averages within
 * each bucket, while energy values (Wh) represent cumulative sums.
 *
 * Date ranges use inclusive start and exclusive end timestamps.
 */
export interface EnergyAppTimeseries {
    /**
     * Queries raw data bus messages for a specific appliance.
     * Supports pagination and filtering by message type.
     *
     * @param request - The query parameters including appliance ID, date range, and optional filters
     * @returns Promise resolving to the matching messages with pagination metadata
     *
     * @example
     * ```typescript
     * const response = await timeseries.queryDataBusMessages({
     *     applianceId: 'inverter-001',
     *     startDateIso: '2024-01-01T00:00:00Z',
     *     endDateIso: '2024-01-02T00:00:00Z',
     *     messageTypes: [EnyoDataBusMessageEnum.InverterValuesUpdateV1],
     *     limit: 100
     * });
     * ```
     */
    queryDataBusMessages(request: DataBusMessageQueryRequest): Promise<DataBusMessageQueryResponse>;

    /**
     * Retrieves PV production timeseries data aggregated in 15-minute buckets.
     * Returns both instantaneous power (W) and cumulative energy (Wh) values.
     *
     * @param request - The query parameters including date range and optional appliance filter
     * @returns Promise resolving to PV production entries and total production
     *
     * @example
     * ```typescript
     * const response = await timeseries.getPvProductionTimeseries({
     *     startDateIso: '2024-01-01T00:00:00Z',
     *     endDateIso: '2024-01-02T00:00:00Z'
     * });
     * console.log(`Total production: ${response.totalPvProductionWh} Wh`);
     * ```
     */
    getPvProductionTimeseries(request: PvProductionTimeseriesRequest): Promise<PvProductionTimeseriesResponse>;

    /**
     * Retrieves battery state of charge (SOC) timeseries data aggregated in 15-minute buckets.
     * Returns average, minimum, and maximum SOC values for each bucket.
     *
     * @param request - The query parameters including date range and optional appliance filter
     * @returns Promise resolving to battery SOC entries and overall average SOC
     *
     * @example
     * ```typescript
     * const response = await timeseries.getBatterySocTimeseries({
     *     startDateIso: '2024-01-01T00:00:00Z',
     *     endDateIso: '2024-01-02T00:00:00Z',
     *     applianceIds: ['battery-001']
     * });
     * console.log(`Average SOC: ${response.averageSoC}%`);
     * ```
     */
    getBatterySocTimeseries(request: BatterySocTimeseriesRequest): Promise<BatterySocTimeseriesResponse>;

    /**
     * Retrieves battery power timeseries data aggregated in 15-minute buckets.
     * Positive values indicate discharge (consumption from battery),
     * negative values indicate charge (energy into battery).
     *
     * @param request - The query parameters including date range and optional appliance filter
     * @returns Promise resolving to battery power entries with total charge and discharge amounts
     *
     * @example
     * ```typescript
     * const response = await timeseries.getBatteryPowerTimeseries({
     *     startDateIso: '2024-01-01T00:00:00Z',
     *     endDateIso: '2024-01-02T00:00:00Z'
     * });
     * console.log(`Total discharged: ${response.totalDischargeWh} Wh`);
     * console.log(`Total charged: ${response.totalChargeWh} Wh`);
     * ```
     */
    getBatteryPowerTimeseries(request: BatteryPowerTimeseriesRequest): Promise<BatteryPowerTimeseriesResponse>;

    /**
     * Retrieves meter values timeseries data aggregated in 15-minute buckets.
     * Returns grid consumption and feed-in energy values.
     *
     * @param request - The query parameters including date range and optional appliance filter
     * @returns Promise resolving to meter value entries with total consumption and feed-in
     *
     * @example
     * ```typescript
     * const response = await timeseries.getMeterValuesTimeseries({
     *     startDateIso: '2024-01-01T00:00:00Z',
     *     endDateIso: '2024-01-02T00:00:00Z'
     * });
     * console.log(`Grid consumption: ${response.totalGridConsumptionWh} Wh`);
     * console.log(`Grid feed-in: ${response.totalGridFeedInWh} Wh`);
     * ```
     */
    getMeterValuesTimeseries(request: MeterValuesTimeseriesRequest): Promise<MeterValuesTimeseriesResponse>;

    /**
     * Retrieves grid power timeseries data aggregated in 15-minute buckets.
     * Positive values indicate import (consumption from grid),
     * negative values indicate export (feed-in to grid).
     *
     * @param request - The query parameters including date range and optional appliance filter
     * @returns Promise resolving to grid power entries with total import and export amounts
     *
     * @example
     * ```typescript
     * const response = await timeseries.getGridPowerTimeseries({
     *     startDateIso: '2024-01-01T00:00:00Z',
     *     endDateIso: '2024-01-02T00:00:00Z'
     * });
     * console.log(`Total imported: ${response.totalImportWh} Wh`);
     * console.log(`Total exported: ${response.totalExportWh} Wh`);
     * ```
     */
    getGridPowerTimeseries(request: GridPowerTimeseriesRequest): Promise<GridPowerTimeseriesResponse>;
}
