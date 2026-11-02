import {
    EnyoTimeseriesStoreAggregatedQuery,
    EnyoTimeseriesStoreAggregationEnum,
    EnyoTimeseriesStorePointInput,
    EnyoTimeseriesStoreSeriesDefinition,
    EnyoTimeseriesStoreTags,
    EnyoTimeseriesStoreValueTypeEnum,
    EnyoTimeseriesStoreWriteResult,
    TIMESERIES_STORE_MAX_NAME_LENGTH,
    TIMESERIES_STORE_MAX_POINTS_PER_WRITE,
    TIMESERIES_STORE_MAX_TAGS,
    TIMESERIES_STORE_MAX_TEXT_LENGTH,
} from '../../types/enyo-timeseries-store.js';

/** Allowed series names and tag keys: letters, digits, `.`, `_`, `-`, starting with a letter or digit. */
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Aggregations that need numbers and are therefore invalid on a text series. */
const NUMERIC_AGGREGATIONS: ReadonlySet<EnyoTimeseriesStoreAggregationEnum> = new Set([
    EnyoTimeseriesStoreAggregationEnum.Avg,
    EnyoTimeseriesStoreAggregationEnum.Min,
    EnyoTimeseriesStoreAggregationEnum.Max,
    EnyoTimeseriesStoreAggregationEnum.Sum,
]);

/**
 * Result of the timeseries store validators that check a whole object.
 */
export interface TimeseriesStoreValidationResult {
    /** `true` when {@link errors} is empty. */
    ok: boolean;
    /** One human-readable message per problem found. */
    errors: string[];
}

/**
 * Whether a string is a valid series name or tag key.
 *
 * @param name - The name to check.
 * @returns `true` for 1 to {@link TIMESERIES_STORE_MAX_NAME_LENGTH} letters, digits, `.`, `_` or `-`, starting with a letter or digit.
 */
export function isValidTimeseriesStoreName(name: string): boolean {
    return typeof name === 'string'
        && name.length <= TIMESERIES_STORE_MAX_NAME_LENGTH
        && NAME_PATTERN.test(name);
}

/**
 * Validates a series definition before it is passed to `defineSeries`.
 *
 * @param definition - The definition to check.
 * @returns The {@link TimeseriesStoreValidationResult}.
 */
export function validateTimeseriesStoreSeriesDefinition(
    definition: EnyoTimeseriesStoreSeriesDefinition,
): TimeseriesStoreValidationResult {
    const errors: string[] = [];
    if (!isValidTimeseriesStoreName(definition.name)) {
        errors.push(`invalid series name '${definition.name}'`);
    }
    if (!Object.values(EnyoTimeseriesStoreValueTypeEnum).includes(definition.valueType)) {
        errors.push(`invalid valueType '${String(definition.valueType)}'`);
    }
    if (definition.retentionDays !== undefined
        && !(Number.isInteger(definition.retentionDays) && definition.retentionDays > 0)) {
        errors.push('retentionDays must be a positive integer');
    }
    return {ok: errors.length === 0, errors};
}

/**
 * Checks one point to be written and returns why it is invalid.
 *
 * @param point - The point to check.
 * @param valueType - Value type of the point's series, when known; without it the value is only checked to be a finite number or a string.
 * @returns The reason the point is invalid, or `undefined` when it is valid.
 */
export function validateTimeseriesStorePoint(
    point: EnyoTimeseriesStorePointInput,
    valueType?: EnyoTimeseriesStoreValueTypeEnum,
): string | undefined {
    if (!isValidTimeseriesStoreName(point.series)) {
        return `invalid series name '${point.series}'`;
    }
    if (point.timestampIso !== undefined && Number.isNaN(Date.parse(point.timestampIso))) {
        return `invalid timestampIso '${point.timestampIso}'`;
    }
    const isNumber = typeof point.value === 'number';
    if (isNumber && !Number.isFinite(point.value)) {
        return 'value must be a finite number';
    }
    if (!isNumber && typeof point.value !== 'string') {
        return 'value must be a number or a string';
    }
    if (typeof point.value === 'string' && point.value.length > TIMESERIES_STORE_MAX_TEXT_LENGTH) {
        return `text value longer than ${TIMESERIES_STORE_MAX_TEXT_LENGTH} characters`;
    }
    if (valueType === EnyoTimeseriesStoreValueTypeEnum.Number && !isNumber) {
        return `series '${point.series}' holds numbers, got a string`;
    }
    if (valueType === EnyoTimeseriesStoreValueTypeEnum.Text && isNumber) {
        return `series '${point.series}' holds text, got a number`;
    }
    return validateTimeseriesStoreTags(point.tags);
}

/**
 * Checks a batch of points to be written, the way the host does.
 *
 * @param points - The batch to check.
 * @param valueTypes - Value type per series name, when known (e.g. from the app's own series definitions).
 * @returns The invalid points with their index and reason — the same shape as
 *   {@link EnyoTimeseriesStoreWriteResult.rejected}. A batch larger than
 *   {@link TIMESERIES_STORE_MAX_POINTS_PER_WRITE} rejects every point beyond the limit.
 */
export function validateTimeseriesStorePoints(
    points: EnyoTimeseriesStorePointInput[],
    valueTypes?: Record<string, EnyoTimeseriesStoreValueTypeEnum>,
): EnyoTimeseriesStoreWriteResult['rejected'] {
    const rejected: EnyoTimeseriesStoreWriteResult['rejected'] = [];
    points.forEach((point, index) => {
        const reason = index >= TIMESERIES_STORE_MAX_POINTS_PER_WRITE
            ? `batch exceeds ${TIMESERIES_STORE_MAX_POINTS_PER_WRITE} points`
            : validateTimeseriesStorePoint(point, valueTypes?.[point.series]);
        if (reason) {
            rejected.push({index, reason});
        }
    });
    return rejected;
}

/**
 * Validates an aggregated query before it is passed to `queryAggregated`.
 *
 * @param query - The query to check.
 * @param valueType - Value type of the queried series, when known; needed to reject numeric aggregations on a text series.
 * @returns The {@link TimeseriesStoreValidationResult}.
 */
export function validateTimeseriesStoreAggregatedQuery(
    query: EnyoTimeseriesStoreAggregatedQuery,
    valueType?: EnyoTimeseriesStoreValueTypeEnum,
): TimeseriesStoreValidationResult {
    const errors: string[] = [];
    if (!isValidTimeseriesStoreName(query.series)) {
        errors.push(`invalid series name '${query.series}'`);
    }
    const from = Date.parse(query.fromIso);
    const until = Date.parse(query.untilIso);
    if (Number.isNaN(from) || Number.isNaN(until)) {
        errors.push('fromIso and untilIso must be valid ISO 8601 timestamps');
    } else if (from >= until) {
        errors.push('fromIso must be before untilIso');
    }
    if (query.aggregations.length === 0) {
        errors.push('at least one aggregation is required');
    }
    if (valueType === EnyoTimeseriesStoreValueTypeEnum.Text) {
        const numeric = query.aggregations.filter((aggregation) => NUMERIC_AGGREGATIONS.has(aggregation));
        if (numeric.length > 0) {
            errors.push(`aggregations ${numeric.join(', ')} need a number series`);
        }
    }
    const tagError = validateTimeseriesStoreTags(query.tags);
    if (tagError) {
        errors.push(tagError);
    }
    return {ok: errors.length === 0, errors};
}

/**
 * Checks the tags of a point or a query filter.
 *
 * @param tags - The tags, if any.
 * @returns The reason the tags are invalid, or `undefined` when they are valid.
 */
function validateTimeseriesStoreTags(tags: EnyoTimeseriesStoreTags | undefined): string | undefined {
    if (!tags) {
        return undefined;
    }
    const entries = Object.entries(tags);
    if (entries.length > TIMESERIES_STORE_MAX_TAGS) {
        return `more than ${TIMESERIES_STORE_MAX_TAGS} tags`;
    }
    for (const [key, value] of entries) {
        if (!isValidTimeseriesStoreName(key)) {
            return `invalid tag key '${key}'`;
        }
        if (typeof value !== 'string' || value.length === 0 || value.length > TIMESERIES_STORE_MAX_NAME_LENGTH) {
            return `tag '${key}' needs a string value of 1 to ${TIMESERIES_STORE_MAX_NAME_LENGTH} characters`;
        }
    }
    return undefined;
}
