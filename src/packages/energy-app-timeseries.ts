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
    HomeConsumptionTimeseriesRequest,
    HomeConsumptionTimeseriesResponse,
    HeatpumpTemperatureTimeseriesRequest,
    HeatpumpTemperatureTimeseriesResponse,
    HeatpumpPowerTimeseriesRequest,
    HeatpumpPowerTimeseriesResponse,
    TemperatureSensorTimeseriesRequest,
    TemperatureSensorTimeseriesResponse,
    AirConditioningPowerTimeseriesRequest,
    AirConditioningPowerTimeseriesResponse,
    AirConditioningTemperatureTimeseriesRequest,
    AirConditioningTemperatureTimeseriesResponse,
} from "../types/enyo-timeseries.js";

/**
 * Interface for querying historical energy data with configurable bucket granularity.
 * Provides methods to retrieve aggregated timeseries data for various energy metrics
 * including PV production, battery state, meter values, and grid power.
 *
 * Data is returned in time buckets whose size is determined by the requested resolution:
 * - `'1m'`  — 1-minute buckets aligned to clock minutes (:00, :01, :02, …)
 * - `'15m'` — 15-minute buckets aligned to clock quarters (:00, :15, :30, :45) (default)
 *
 * Power values (W) represent time-weighted averages within each bucket,
 * while energy values (Wh) represent cumulative sums.
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
     * Retrieves PV production timeseries data aggregated in time buckets.
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
     * Retrieves battery state of charge (SOC) timeseries data aggregated in time buckets.
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
     * Retrieves battery power timeseries data aggregated in time buckets.
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
     * Retrieves meter values timeseries data aggregated in time buckets.
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
     * Retrieves grid power timeseries data aggregated in time buckets.
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

    /**
     * Retrieves home consumption timeseries data aggregated in time buckets.
     * Returns total power consumed by the home (all appliances combined).
     *
     * @param request - The query parameters including date range and optional appliance filter
     * @returns Promise resolving to home consumption entries with total consumption
     *
     * @example
     * ```typescript
     * const response = await timeseries.getHomeConsumptionTimeseries({
     *     startDateIso: '2024-01-01T00:00:00Z',
     *     endDateIso: '2024-01-02T00:00:00Z'
     * });
     * console.log(`Total home consumption: ${response.totalHomeConsumptionWh} Wh`);
     * ```
     */
    getHomeConsumptionTimeseries(request: HomeConsumptionTimeseriesRequest): Promise<HomeConsumptionTimeseriesResponse>;

    /**
     * Retrieves heatpump temperature timeseries data aggregated in time buckets.
     * Returns average temperatures for outdoor, flow, buffer tank, DHW tanks, and heating circuits.
     * All temperature fields are optional since not all heatpumps report all temperature types.
     *
     * @param request - The query parameters including date range and optional appliance filter
     * @returns Promise resolving to heatpump temperature entries with response-level averages
     *
     * @example
     * ```typescript
     * const response = await timeseries.getHeatpumpTemperatureTimeseries({
     *     startDateIso: '2024-01-01T00:00:00Z',
     *     endDateIso: '2024-01-02T00:00:00Z'
     * });
     * console.log(`Average outdoor temp: ${response.averageOutdoorTemperatureC} °C`);
     * ```
     */
    getHeatpumpTemperatureTimeseries(request: HeatpumpTemperatureTimeseriesRequest): Promise<HeatpumpTemperatureTimeseriesResponse>;

    /**
     * Retrieves heatpump power timeseries data aggregated in time buckets.
     * Returns time-weighted average electrical power (W) and cumulative
     * electrical energy (Wh) for each bucket. When the heatpump reports them,
     * also returns the split between space heating and domestic hot water for
     * both electrical consumption and thermal energy delivered.
     *
     * Split fields are optional because not all heatpumps report meter values
     * for the heating / domestic-hot-water categories.
     *
     * @param request - The query parameters including date range and optional appliance filter
     * @returns Promise resolving to heatpump power entries with total electrical consumption
     *
     * @example
     * ```typescript
     * const response = await timeseries.getHeatpumpPowerTimeseries({
     *     startDateIso: '2024-01-01T00:00:00Z',
     *     endDateIso: '2024-01-02T00:00:00Z'
     * });
     * console.log(`Total heatpump consumption: ${response.totalHeatpumpPowerWh} Wh`);
     * if (response.totalHeatGenerationHeatingWh && response.totalPowerConsumptionHeatingWh) {
     *     const cop = response.totalHeatGenerationHeatingWh / response.totalPowerConsumptionHeatingWh;
     *     console.log(`Heating COP: ${cop.toFixed(2)}`);
     * }
     * ```
     */
    getHeatpumpPowerTimeseries(request: HeatpumpPowerTimeseriesRequest): Promise<HeatpumpPowerTimeseriesResponse>;

    /**
     * Retrieves temperature sensor timeseries data aggregated in time buckets.
     * Returns per-sensor average temperature readings for each bucket, along with
     * per-sensor averages across the full queried period.
     *
     * @param request - The query parameters including date range and optional appliance filter
     * @returns Promise resolving to temperature sensor entries with per-sensor period averages
     *
     * @example
     * ```typescript
     * const response = await timeseries.getTemperatureSensorTimeseries({
     *     startDateIso: '2024-01-01T00:00:00Z',
     *     endDateIso: '2024-01-02T00:00:00Z'
     * });
     * response.sensors.forEach(s => {
     *     console.log(`Sensor ${s.sensorId}: ${s.averageTemperatureC} °C`);
     * });
     * ```
     */
    getTemperatureSensorTimeseries(request: TemperatureSensorTimeseriesRequest): Promise<TemperatureSensorTimeseriesResponse>;

    /**
     * Retrieves air conditioning power timeseries data aggregated in time buckets.
     * Returns both instantaneous power (W) and cumulative energy (Wh) values
     * for air conditioning appliances.
     *
     * @param request - The query parameters including date range and optional appliance filter
     * @returns Promise resolving to air conditioning power entries with total consumption
     *
     * @example
     * ```typescript
     * const response = await timeseries.getAirConditioningPowerTimeseries({
     *     startDateIso: '2024-01-01T00:00:00Z',
     *     endDateIso: '2024-01-02T00:00:00Z'
     * });
     * console.log(`Total AC consumption: ${response.totalAirConditioningPowerWh} Wh`);
     * ```
     */
    getAirConditioningPowerTimeseries(request: AirConditioningPowerTimeseriesRequest): Promise<AirConditioningPowerTimeseriesResponse>;

    /**
     * Retrieves air conditioning temperature timeseries data aggregated in time buckets.
     * Returns per-room average, min, max, and delta temperature readings for each bucket.
     *
     * @param request - The query parameters including date range and optional appliance filter
     * @returns Promise resolving to air conditioning temperature entries with per-room readings
     *
     * @example
     * ```typescript
     * const response = await timeseries.getAirConditioningTemperatureTimeseries({
     *     startDateIso: '2024-01-01T00:00:00Z',
     *     endDateIso: '2024-01-02T00:00:00Z'
     * });
     * response.entries.forEach(entry => {
     *     entry.rooms?.forEach(room => {
     *         console.log(`Room ${room.index}: ${room.averageTemperatureC} °C`);
     *     });
     * });
     * ```
     */
    getAirConditioningTemperatureTimeseries(request: AirConditioningTemperatureTimeseriesRequest): Promise<AirConditioningTemperatureTimeseriesResponse>;
}
