import {HistoricalBucket} from './forecast-types.js';

/**
 * One quarter of an hour, in milliseconds. Used everywhere a 15-minute slot
 * boundary needs to be computed.
 */
export const FIFTEEN_MIN_MS = 15 * 60 * 1000;

/**
 * One minute, in milliseconds.
 */
export const ONE_MIN_MS = 60 * 1000;

/**
 * Rounds a millisecond timestamp down to the most recent 15-minute boundary
 * (in UTC).
 *
 * @example
 * ```ts
 * roundDownTo15Minutes(Date.UTC(2024, 0, 1, 12, 17, 30)); // 12:15:00 UTC
 * ```
 */
export function roundDownTo15Minutes(ms: number): number {
    return Math.floor(ms / FIFTEEN_MIN_MS) * FIFTEEN_MIN_MS;
}

/**
 * Rounds a millisecond timestamp down to the most recent boundary at the given
 * resolution.
 *
 * @param ms - Millisecond timestamp to round.
 * @param resolution - `'15m'` or `'1m'`.
 */
export function roundDownToResolution(ms: number, resolution: '1m' | '15m'): number {
    const slot = resolution === '1m' ? ONE_MIN_MS : FIFTEEN_MIN_MS;
    return Math.floor(ms / slot) * slot;
}

/**
 * Rounds an ISO timestamp down to the most recent 15-minute UTC boundary,
 * returning a fresh ISO string.
 */
export function roundDownTo15MinutesIso(iso: string): string {
    return new Date(roundDownTo15Minutes(new Date(iso).getTime())).toISOString();
}

/**
 * Returns the day-of-week index (0 = Sunday … 6 = Saturday) of `ms` in UTC.
 */
export function getUtcWeekday(ms: number): number {
    return new Date(ms).getUTCDay();
}

/**
 * Returns the slot key (`"HH:MM"`) for the 15-minute slot that `ms` falls into,
 * computed in UTC. Used to group/index historical buckets by time-of-day.
 */
export function getSlotKey(ms: number): string {
    const d = new Date(ms);
    const h = d.getUTCHours().toString().padStart(2, '0');
    const m = d.getUTCMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * Floors `ms` to the start of the corresponding UTC day, in milliseconds since
 * the Unix epoch.
 */
export function startOfUtcDay(ms: number): number {
    const d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Number of whole UTC days between `bucketMs` (in the past) and `nowMs`.
 * Always non-negative; same day → 0, yesterday → 1, etc.
 */
export function daysAgo(nowMs: number, bucketMs: number): number {
    const dayDiff = startOfUtcDay(nowMs) - startOfUtcDay(bucketMs);
    return Math.max(0, Math.round(dayDiff / (24 * 60 * 60 * 1000)));
}

/**
 * Pre-parsed history bucket carrying common derived fields, so we only compute
 * them once per bucket per forecast run instead of per slot.
 */
export interface ParsedHistoryBucket<V extends object> {
    /** Original bucket. */
    readonly bucket: HistoricalBucket<V>;
    /** `bucket.timestampIso` parsed to milliseconds. */
    readonly ms: number;
    /** UTC weekday (0–6). */
    readonly weekday: number;
    /** UTC `"HH:MM"` slot key. */
    readonly slotKey: string;
}

/**
 * Pre-parses an array of history buckets into {@link ParsedHistoryBucket}
 * entries to avoid quadratic re-parsing inside forecast loops.
 */
export function parseHistory<V extends object>(
    history: HistoricalBucket<V>[],
): ParsedHistoryBucket<V>[] {
    return history.map((bucket) => {
        const ms = new Date(bucket.timestampIso).getTime();
        return {
            bucket,
            ms,
            weekday: getUtcWeekday(ms),
            slotKey: getSlotKey(ms),
        };
    });
}

/**
 * Indexes parsed history by `"HH:MM"` slot key. The map can be used for O(1)
 * lookups when iterating forecast buckets.
 *
 * @param parsed - Pre-parsed history.
 * @param filter - Optional per-bucket filter (e.g. "same weekday only").
 */
export function buildSlotMap<V extends object>(
    parsed: ParsedHistoryBucket<V>[],
    filter?: (bucket: ParsedHistoryBucket<V>) => boolean,
): Map<string, ParsedHistoryBucket<V>[]> {
    const map = new Map<string, ParsedHistoryBucket<V>[]>();
    for (const entry of parsed) {
        if (filter && !filter(entry)) continue;
        const list = map.get(entry.slotKey);
        if (list) {
            list.push(entry);
        } else {
            map.set(entry.slotKey, [entry]);
        }
    }
    return map;
}

/**
 * Computes a recency-weighted average of one or more numeric fields across the
 * history buckets at a given slot. Buckets seen `n` days ago contribute weight
 * `max(1, historyDays + 1 − n)`, i.e. the most recent days dominate.
 *
 * If no buckets match the slot, every requested field defaults to `0`.
 *
 * @param slotBuckets - Pre-parsed buckets at the desired `"HH:MM"` slot.
 * @param nowMs - Current time in millis (used to compute `daysAgo`).
 * @param historyDays - Configured history window. Buckets older than this are ignored.
 * @param fields - The numeric fields to extract. Each maps `bucket.values` → number.
 * @returns An object with the weighted average per requested field.
 */
export function weightedAverageBySlot<V extends object, K extends string>(
    slotBuckets: ParsedHistoryBucket<V>[] | undefined,
    nowMs: number,
    historyDays: number,
    fields: Record<K, (values: V) => number | undefined>,
): Record<K, number> {
    const sums = {} as Record<K, number>;
    const weights = {} as Record<K, number>;
    for (const fieldKey of Object.keys(fields) as K[]) {
        sums[fieldKey] = 0;
        weights[fieldKey] = 0;
    }
    if (!slotBuckets || slotBuckets.length === 0) {
        return sums;
    }
    for (const entry of slotBuckets) {
        const dAgo = daysAgo(nowMs, entry.ms);
        if (dAgo < 1 || dAgo > historyDays) continue;
        const weight = Math.max(1, historyDays + 1 - dAgo);
        for (const fieldKey of Object.keys(fields) as K[]) {
            const value = fields[fieldKey](entry.bucket.values);
            if (value === undefined || Number.isNaN(value)) continue;
            sums[fieldKey] += value * weight;
            weights[fieldKey] += weight;
        }
    }
    const result = {} as Record<K, number>;
    for (const fieldKey of Object.keys(fields) as K[]) {
        result[fieldKey] = weights[fieldKey] > 0 ? sums[fieldKey] / weights[fieldKey] : 0;
    }
    return result;
}

/**
 * A single forecast bucket as the algorithm computes it: a UTC slot boundary
 * plus an arbitrary numeric payload.
 */
export interface ForecastBucket<P extends object> {
    /** ISO 8601 UTC timestamp at the start of the slot. */
    timestampIso: string;
    /** Numeric payload (e.g. `{ powerW: 1234, powerWh: 308.5 }`). */
    payload: P;
}

/**
 * Generates the UTC slot boundaries to forecast over, starting at the next
 * 15-minute boundary at or after `nowMs` and covering `horizonHours`.
 *
 * @param nowMs - Reference "now" in millis.
 * @param horizonHours - Forecast horizon in hours.
 * @param resolution - Slot size, `'15m'` (default) or `'1m'`.
 */
export function buildForecastSlots(
    nowMs: number,
    horizonHours: number,
    resolution: '1m' | '15m' = '15m',
): number[] {
    const slot = resolution === '1m' ? ONE_MIN_MS : FIFTEEN_MIN_MS;
    const start = roundDownToResolution(nowMs, resolution);
    const total = Math.max(1, Math.round((horizonHours * 60 * 60 * 1000) / slot));
    const slots: number[] = [];
    for (let i = 0; i < total; i += 1) {
        slots.push(start + i * slot);
    }
    return slots;
}

/**
 * Aligns the leading buckets of a forecast to the most recent actual data so
 * that the forecast joins smoothly with reality.
 *
 * Computes `ratio = sum(actualField) / sum(forecastField)` over the overlap
 * window, then multiplies the first `decayBuckets` forecast buckets by a
 * linearly-decaying factor that goes from `ratio` (at the first bucket) to
 * `1.0` (at `decayBuckets`).
 *
 * No-op if there are too few overlapping buckets to compute a stable ratio.
 *
 * @param forecast - Mutable list of forecast buckets to adjust.
 * @param actuals - Recent actual buckets indexed by ISO timestamp.
 * @param fieldsToScale - Names of numeric fields on `bucket.payload` to scale.
 * @param actualGetter - Function returning the actual value at a forecast bucket's timestamp.
 * @param decayBuckets - Number of leading forecast buckets to scale (default 8 = 2 h at 15 min).
 * @param minOverlap - Minimum number of overlapping buckets required (default 4).
 */
export function alignForecastToRecentActuals<P extends Record<string, number>>(
    forecast: ForecastBucket<P>[],
    actualGetter: (timestampIso: string) => number | undefined,
    forecastField: keyof P,
    fieldsToScale: (keyof P)[],
    decayBuckets = 8,
    minOverlap = 4,
): void {
    let actualSum = 0;
    let predictedSum = 0;
    let overlap = 0;
    for (const fb of forecast) {
        const actual = actualGetter(fb.timestampIso);
        if (actual === undefined || Number.isNaN(actual)) continue;
        const predicted = fb.payload[forecastField];
        if (typeof predicted !== 'number' || Number.isNaN(predicted)) continue;
        actualSum += actual;
        predictedSum += predicted;
        overlap += 1;
    }
    if (overlap < minOverlap || predictedSum === 0) {
        return;
    }
    const ratio = actualSum / predictedSum;
    if (!Number.isFinite(ratio) || ratio <= 0) {
        return;
    }
    const buckets = Math.min(decayBuckets, forecast.length);
    for (let i = 0; i < buckets; i += 1) {
        const decay = 1 - i / buckets;
        const factor = 1 + (ratio - 1) * decay;
        const target = forecast[i];
        for (const f of fieldsToScale) {
            const raw = target.payload[f];
            if (typeof raw === 'number' && Number.isFinite(raw)) {
                (target.payload as Record<string, number>)[f as string] = raw * factor;
            }
        }
    }
}

/**
 * Creates a `Map` from `timestampIso` to numeric value, used by
 * {@link alignForecastToRecentActuals}.
 */
export function buildIsoIndex<V extends object>(
    parsed: ParsedHistoryBucket<V>[],
    getValue: (values: V) => number | undefined,
): Map<string, number> {
    const map = new Map<string, number>();
    for (const entry of parsed) {
        const v = getValue(entry.bucket.values);
        if (v !== undefined && !Number.isNaN(v)) {
            map.set(entry.bucket.timestampIso, v);
        }
    }
    return map;
}

/**
 * Converts a power value (in Watts) to energy (in Watt-hours) over a 15-minute
 * slot. Convenience used by every forecaster that emits both `powerW` and
 * `powerWh`.
 */
export function wToWhPer15Min(powerW: number): number {
    return Math.round(powerW * 0.25 * 100) / 100;
}

/**
 * Inserts or merges a live update into a sorted history array. If the history
 * already has a bucket at the same 15-minute slot, the supplied `merge` fn is
 * applied; otherwise a new bucket is appended (and the array remains sorted as
 * long as updates arrive in chronological order, which holds for live events).
 *
 * @param history - Sorted-by-time history array (mutated in place).
 * @param slotMs - 15-min-rounded UTC slot start for the live update.
 * @param newValues - Values from the live update.
 * @param merge - Combiner: `(existing, incoming) => merged`. Called only on collisions.
 */
export function upsertLiveBucket<V extends object>(
    history: HistoricalBucket<V>[],
    slotMs: number,
    newValues: V,
    merge: (existing: V, incoming: V) => V,
): void {
    const iso = new Date(slotMs).toISOString();
    if (history.length > 0) {
        const last = history[history.length - 1];
        if (last.timestampIso === iso) {
            last.values = merge(last.values, newValues);
            return;
        }
    }
    history.push({timestampIso: iso, values: newValues});
}

/**
 * Drops history buckets older than `maxAgeMs` from `nowMs`. Mutates the array
 * in place. Used to keep the in-memory history bounded as live updates arrive.
 */
export function trimHistory<V extends object>(
    history: HistoricalBucket<V>[],
    nowMs: number,
    maxAgeMs: number,
): void {
    const cutoff = nowMs - maxAgeMs;
    let removeCount = 0;
    for (const entry of history) {
        if (new Date(entry.timestampIso).getTime() < cutoff) {
            removeCount += 1;
        } else {
            break;
        }
    }
    if (removeCount > 0) {
        history.splice(0, removeCount);
    }
}
