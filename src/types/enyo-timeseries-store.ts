/**
 * Kind of values a series of the {@link EnergyAppTimeseriesStore} holds.
 *
 * Fixed when the series is defined: the host stores number and text series
 * differently (numbers compressed and aggregatable, text deduplicated), so a
 * series never mixes the two.
 */
export enum EnyoTimeseriesStoreValueTypeEnum {
    /** Finite numbers — measurements, counters, setpoints. Can be aggregated. */
    Number = 'number',
    /** Short strings — states, modes, error codes. Can only be counted or sampled. */
    Text = 'text',
}

/**
 * How the values inside one bucket of an aggregated query are combined.
 *
 * {@link Count}, {@link First} and {@link Last} work on every series;
 * {@link Avg}, {@link Min}, {@link Max} and {@link Sum} only on
 * {@link EnyoTimeseriesStoreValueTypeEnum.Number} series.
 */
export enum EnyoTimeseriesStoreAggregationEnum {
    /** Arithmetic mean of the values in the bucket (not time-weighted). Number series only. */
    Avg = 'avg',
    /** Smallest value in the bucket. Number series only. */
    Min = 'min',
    /** Largest value in the bucket. Number series only. */
    Max = 'max',
    /** Sum of the values in the bucket. Number series only. */
    Sum = 'sum',
    /** Number of points in the bucket. */
    Count = 'count',
    /** Value of the earliest point in the bucket. */
    First = 'first',
    /** Value of the latest point in the bucket. */
    Last = 'last',
}

/**
 * Bucket size of an aggregated query. Buckets are aligned to clock boundaries
 * in UTC (`'1h'` buckets start at :00, `'1d'` buckets at midnight UTC).
 */
export type EnyoTimeseriesStoreResolution = '1m' | '5m' | '15m' | '1h' | '1d';

/**
 * Low-cardinality labels that distinguish several streams within one series —
 * e.g. `{phase: 'L1'}` or `{circuit: '2'}`.
 *
 * Every distinct tag combination is stored as its own stream, so tags are for a
 * handful of fixed dimensions, never for values that change with every point
 * (timestamps, ids of single events, measured values). Put those into the value
 * or into a separate series.
 */
export type EnyoTimeseriesStoreTags = Record<string, string>;

/**
 * Definition of one series, passed to {@link EnergyAppTimeseriesStore.defineSeries}.
 */
export interface EnyoTimeseriesStoreSeriesDefinition {
    /**
     * Name of the series, unique within the package — e.g. `'compressor.temperature'`.
     * Letters, digits, `.`, `_` and `-`, starting with a letter or digit, at most
     * {@link TIMESERIES_STORE_MAX_NAME_LENGTH} characters.
     */
    name: string;
    /** Whether the series holds numbers or text. Cannot be changed later. */
    valueType: EnyoTimeseriesStoreValueTypeEnum;
    /** Optional unit of a number series, e.g. `'W'`, `'°C'`, `'%'`. Informational. */
    unit?: string;
    /** Optional human-readable description. Informational. */
    description?: string;
    /**
     * How many days points are kept before the host deletes them. When omitted,
     * the host's default applies. The host may cap it.
     */
    retentionDays?: number;
}

/**
 * A series as stored by the host, returned by
 * {@link EnergyAppTimeseriesStore.listSeries}.
 */
export interface EnyoTimeseriesStoreSeries extends EnyoTimeseriesStoreSeriesDefinition {
    /** Retention in days the host actually applies, after its default and cap. */
    effectiveRetentionDays: number;
    /** Number of points currently stored, across all tag combinations. */
    pointCount: number;
    /** Timestamp of the oldest stored point, in ISO 8601 format. Absent for an empty series. */
    firstTimestampIso?: string;
    /** Timestamp of the newest stored point, in ISO 8601 format. Absent for an empty series. */
    lastTimestampIso?: string;
}

/**
 * One point to write with {@link EnergyAppTimeseriesStore.write}.
 *
 * A point is identified by series, tags and timestamp: writing the same three
 * again overwrites the stored value, so retrying a failed write is safe.
 */
export interface EnyoTimeseriesStorePointInput {
    /** Name of a series defined with {@link EnergyAppTimeseriesStore.defineSeries}. */
    series: string;
    /**
     * Time the value applies to, in ISO 8601 format. Defaults to the moment the
     * host handles the write. Stored with millisecond precision.
     */
    timestampIso?: string;
    /**
     * The value. A finite number for a number series, a string of at most
     * {@link TIMESERIES_STORE_MAX_TEXT_LENGTH} characters for a text series.
     */
    value: number | string;
    /** Optional tags of the stream the point belongs to. See {@link EnyoTimeseriesStoreTags}. */
    tags?: EnyoTimeseriesStoreTags;
}

/**
 * A stored point, as returned by queries.
 */
export interface EnyoTimeseriesStorePoint {
    /** Time the value applies to, in ISO 8601 format. */
    timestampIso: string;
    /** The stored value — a number for a number series, a string for a text series. */
    value: number | string;
    /** Tags of the stream the point belongs to. Empty object for an untagged point. */
    tags: EnyoTimeseriesStoreTags;
}

/**
 * Result of {@link EnergyAppTimeseriesStore.write}.
 */
export interface EnyoTimeseriesStoreWriteResult {
    /** Number of points stored (including overwrites). */
    written: number;
    /**
     * Points the host refused, with the index into the written array and why —
     * an unknown series, a value of the wrong type, a timestamp beyond the
     * series' retention. The other points of the batch are still stored.
     */
    rejected: Array<{ index: number; reason: string }>;
}

/**
 * Query for the stored points themselves, passed to
 * {@link EnergyAppTimeseriesStore.queryPoints}.
 */
export interface EnyoTimeseriesStorePointQuery {
    /** Name of the series to read. */
    series: string;
    /** Start of the range, inclusive, in ISO 8601 format. */
    fromIso: string;
    /** End of the range, exclusive, in ISO 8601 format. */
    untilIso: string;
    /**
     * Only streams whose tags contain all of these key/value pairs. Omit to read
     * every stream of the series.
     */
    tags?: EnyoTimeseriesStoreTags;
    /** `'asc'` (oldest first, the default) or `'desc'` (newest first). */
    order?: 'asc' | 'desc';
    /**
     * Maximum number of points per page. The host applies its own upper bound
     * when this is omitted or larger than that bound.
     */
    limit?: number;
    /** `nextCursor` of the previous page, to continue reading. */
    cursor?: string;
}

/**
 * One page of points returned by {@link EnergyAppTimeseriesStore.queryPoints}.
 */
export interface EnyoTimeseriesStorePointPage {
    /** The points, in the requested order. */
    points: EnyoTimeseriesStorePoint[];
    /** Pass as `cursor` to read the next page. Absent on the last page. */
    nextCursor?: string;
}

/**
 * Query for bucketed, aggregated values, passed to
 * {@link EnergyAppTimeseriesStore.queryAggregated}. The host aggregates, so
 * only the buckets travel to the app.
 */
export interface EnyoTimeseriesStoreAggregatedQuery {
    /** Name of the series to read. */
    series: string;
    /** Start of the range, inclusive, in ISO 8601 format. */
    fromIso: string;
    /** End of the range, exclusive, in ISO 8601 format. */
    untilIso: string;
    /** Bucket size. */
    resolution: EnyoTimeseriesStoreResolution;
    /**
     * Aggregations to compute per bucket. `Avg`, `Min`, `Max` and `Sum` are only
     * valid for number series.
     */
    aggregations: EnyoTimeseriesStoreAggregationEnum[];
    /** Only streams whose tags contain all of these key/value pairs. */
    tags?: EnyoTimeseriesStoreTags;
    /**
     * Tag keys to group by: one result group per distinct combination of their
     * values. Omit to merge every matching stream into a single group.
     */
    groupByTags?: string[];
}

/**
 * One bucket of an aggregated query. Only buckets containing at least one point
 * are returned, so gaps in the data stay visible as missing buckets.
 */
export interface EnyoTimeseriesStoreBucket {
    /** Start of the bucket, inclusive, in ISO 8601 format. */
    startIso: string;
    /** Number of points in the bucket. Always present. */
    count: number;
    /** Mean value, when {@link EnyoTimeseriesStoreAggregationEnum.Avg} was requested. */
    avg?: number;
    /** Smallest value, when {@link EnyoTimeseriesStoreAggregationEnum.Min} was requested. */
    min?: number;
    /** Largest value, when {@link EnyoTimeseriesStoreAggregationEnum.Max} was requested. */
    max?: number;
    /** Sum of values, when {@link EnyoTimeseriesStoreAggregationEnum.Sum} was requested. */
    sum?: number;
    /** Value of the earliest point, when {@link EnyoTimeseriesStoreAggregationEnum.First} was requested. */
    first?: number | string;
    /** Value of the latest point, when {@link EnyoTimeseriesStoreAggregationEnum.Last} was requested. */
    last?: number | string;
}

/**
 * One group of buckets in an aggregated query result.
 */
export interface EnyoTimeseriesStoreBucketGroup {
    /**
     * Values of the `groupByTags` keys this group stands for. Empty object when
     * no grouping was requested.
     */
    tags: EnyoTimeseriesStoreTags;
    /** The non-empty buckets, oldest first. */
    buckets: EnyoTimeseriesStoreBucket[];
}

/**
 * Result of {@link EnergyAppTimeseriesStore.queryAggregated}.
 */
export interface EnyoTimeseriesStoreAggregatedResult {
    /** Name of the queried series. */
    series: string;
    /** Bucket size used. */
    resolution: EnyoTimeseriesStoreResolution;
    /** One group per distinct `groupByTags` combination, or a single group without grouping. */
    groups: EnyoTimeseriesStoreBucketGroup[];
}

/**
 * Selects points to delete with {@link EnergyAppTimeseriesStore.deletePoints}.
 */
export interface EnyoTimeseriesStoreDeleteQuery {
    /** Name of the series to delete from. */
    series: string;
    /** Start of the range, inclusive, in ISO 8601 format. */
    fromIso: string;
    /** End of the range, exclusive, in ISO 8601 format. */
    untilIso: string;
    /** Only streams whose tags contain all of these key/value pairs. Omit to delete from every stream. */
    tags?: EnyoTimeseriesStoreTags;
}

/** Longest allowed series name, tag key or tag value, in characters. */
export const TIMESERIES_STORE_MAX_NAME_LENGTH = 128;
/** Longest allowed value of a text series, in characters. */
export const TIMESERIES_STORE_MAX_TEXT_LENGTH = 1024;
/** Most tags one point may carry. */
export const TIMESERIES_STORE_MAX_TAGS = 8;
/** Most points one {@link EnergyAppTimeseriesStore.write} call may carry. */
export const TIMESERIES_STORE_MAX_POINTS_PER_WRITE = 1000;
