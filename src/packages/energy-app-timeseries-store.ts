import {
    EnyoTimeseriesStoreAggregatedQuery,
    EnyoTimeseriesStoreAggregatedResult,
    EnyoTimeseriesStoreDeleteQuery,
    EnyoTimeseriesStorePoint,
    EnyoTimeseriesStorePointInput,
    EnyoTimeseriesStorePointPage,
    EnyoTimeseriesStorePointQuery,
    EnyoTimeseriesStoreSeries,
    EnyoTimeseriesStoreSeriesDefinition,
    EnyoTimeseriesStoreTags,
    EnyoTimeseriesStoreWriteResult,
} from "../types/enyo-timeseries-store.js";

/**
 * Interface for storing and querying an app's own timeseries — numbers and
 * text — on the host.
 *
 * Use it for anything the app measures or decides over time that is not
 * already on the data bus: internal device registers, learned parameters,
 * controller states, error codes. {@link EnergyAppStorage} is the wrong place
 * for that — it rewrites a whole object per key — and the data bus history
 * ({@link EnergyAppTimeseries}) only covers the standard messages.
 *
 * **Efficient by design.**
 * - A series is defined once with its value type, so the host can store numbers
 *   compressed and text deduplicated.
 * - Points are written in batches of up to
 *   {@link TIMESERIES_STORE_MAX_POINTS_PER_WRITE}; use
 *   {@link TimeseriesStoreWriteBuffer} to collect them instead of writing every
 *   point on its own.
 * - Aggregation happens on the host ({@link queryAggregated}), so a month of
 *   one-second values comes back as 30 daily buckets, not 2.6 million points.
 * - Old points are dropped by the host after the series' retention.
 *
 * Every series belongs to the package that defined it: an app only sees and
 * changes its own series. Access requires the `TimeseriesStore` permission
 * ({@link EnergyAppPermissionType}).
 *
 * @example
 * ```typescript
 * const store = energyApp.useTimeseriesStore();
 *
 * await store.defineSeries({name: 'compressor.temperature', valueType: EnyoTimeseriesStoreValueTypeEnum.Number, unit: '°C', retentionDays: 90});
 * await store.defineSeries({name: 'compressor.state', valueType: EnyoTimeseriesStoreValueTypeEnum.Text});
 *
 * await store.write([
 *     {series: 'compressor.temperature', value: 61.5, tags: {circuit: '1'}},
 *     {series: 'compressor.state', value: 'defrost'},
 * ]);
 *
 * const hourly = await store.queryAggregated({
 *     series: 'compressor.temperature',
 *     fromIso: '2026-11-01T00:00:00Z',
 *     untilIso: '2026-11-02T00:00:00Z',
 *     resolution: '1h',
 *     aggregations: [EnyoTimeseriesStoreAggregationEnum.Avg, EnyoTimeseriesStoreAggregationEnum.Max],
 *     groupByTags: ['circuit'],
 * });
 * ```
 */
export interface EnergyAppTimeseriesStore {
    /**
     * Defines a series, or updates the unit, description and retention of an
     * existing one. Idempotent — call it on every start.
     *
     * The value type of an existing series cannot change: redefining it with a
     * different `valueType` rejects. Delete the series first if it really has to.
     *
     * @param definition - The series to define.
     * @returns Promise resolving to the series as stored by the host.
     * @throws {EnergyAppPermissionNotGrantedError} If the `TimeseriesStore`
     *         permission is not granted.
     */
    defineSeries(definition: EnyoTimeseriesStoreSeriesDefinition): Promise<EnyoTimeseriesStoreSeries>;

    /**
     * Lists the series this package has defined, with their size and time range.
     *
     * @returns Promise resolving to the package's series.
     * @throws {EnergyAppPermissionNotGrantedError} If the `TimeseriesStore`
     *         permission is not granted.
     */
    listSeries(): Promise<EnyoTimeseriesStoreSeries[]>;

    /**
     * Deletes a series and all of its points. Idempotent.
     *
     * @param name - Name of the series to delete.
     * @throws {EnergyAppPermissionNotGrantedError} If the `TimeseriesStore`
     *         permission is not granted.
     */
    deleteSeries(name: string): Promise<void>;

    /**
     * Writes a batch of points, possibly to several series.
     *
     * Points with the same series, tags and timestamp as a stored one overwrite
     * it, so retrying a failed batch is safe. Invalid points are reported in
     * {@link EnyoTimeseriesStoreWriteResult.rejected} without failing the rest of
     * the batch. Validate up front with `validateTimeseriesStorePoints` to catch
     * mistakes during development.
     *
     * @param points - At most {@link TIMESERIES_STORE_MAX_POINTS_PER_WRITE} points.
     * @returns Promise resolving to how many points were stored and which were rejected.
     * @throws {EnergyAppPermissionNotGrantedError} If the `TimeseriesStore`
     *         permission is not granted.
     */
    write(points: EnyoTimeseriesStorePointInput[]): Promise<EnyoTimeseriesStoreWriteResult>;

    /**
     * Reads stored points of one series in a time range, page by page.
     *
     * @param query - Series, range, optional tag filter, order and paging.
     * @returns Promise resolving to one page of points and the cursor for the next.
     * @throws {EnergyAppPermissionNotGrantedError} If the `TimeseriesStore`
     *         permission is not granted.
     */
    queryPoints(query: EnyoTimeseriesStorePointQuery): Promise<EnyoTimeseriesStorePointPage>;

    /**
     * Reads one series bucketed and aggregated by the host — the efficient way
     * to read long ranges or draw charts.
     *
     * @param query - Series, range, bucket size, aggregations, optional tag filter and grouping.
     * @returns Promise resolving to the non-empty buckets, per group.
     * @throws {EnergyAppPermissionNotGrantedError} If the `TimeseriesStore`
     *         permission is not granted.
     */
    queryAggregated(query: EnyoTimeseriesStoreAggregatedQuery): Promise<EnyoTimeseriesStoreAggregatedResult>;

    /**
     * Returns the newest point of every stream of a series — e.g. the last known
     * state after a restart — without scanning a time range.
     *
     * @param series - Name of the series.
     * @param tags - Only streams whose tags contain all of these key/value pairs.
     * @returns Promise resolving to one point per matching stream; empty when the series has no points.
     * @throws {EnergyAppPermissionNotGrantedError} If the `TimeseriesStore`
     *         permission is not granted.
     */
    getLatest(series: string, tags?: EnyoTimeseriesStoreTags): Promise<EnyoTimeseriesStorePoint[]>;

    /**
     * Deletes the points of a series in a time range, e.g. values recorded while
     * a sensor was known to be faulty.
     *
     * @param query - Series, range and optional tag filter of the points to delete.
     * @returns Promise resolving to the number of deleted points.
     * @throws {EnergyAppPermissionNotGrantedError} If the `TimeseriesStore`
     *         permission is not granted.
     */
    deletePoints(query: EnyoTimeseriesStoreDeleteQuery): Promise<number>;
}
