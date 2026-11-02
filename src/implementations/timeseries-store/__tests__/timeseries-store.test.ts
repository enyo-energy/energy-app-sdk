import {describe, expect, it, vi} from 'vitest';
import {
    EnyoTimeseriesStoreAggregationEnum,
    EnyoTimeseriesStorePointInput,
    EnyoTimeseriesStoreValueTypeEnum,
    EnyoTimeseriesStoreWriteResult,
    TIMESERIES_STORE_MAX_POINTS_PER_WRITE,
    TIMESERIES_STORE_MAX_TEXT_LENGTH,
} from '../../../types/enyo-timeseries-store.js';
import {EnergyAppTimeseriesStore} from '../../../packages/energy-app-timeseries-store.js';
import {EnergyAppInterval} from '../../../packages/energy-app-interval.js';
import {
    isValidTimeseriesStoreName,
    validateTimeseriesStoreAggregatedQuery,
    validateTimeseriesStorePoint,
    validateTimeseriesStorePoints,
    validateTimeseriesStoreSeriesDefinition,
} from '../timeseries-store-validators.js';
import {TimeseriesStoreWriteBuffer} from '../timeseries-store-write-buffer.js';

const {Number: NumberType, Text} = EnyoTimeseriesStoreValueTypeEnum;
const {Avg, Max, Count, Last} = EnyoTimeseriesStoreAggregationEnum;

describe('timeseries store validators', () => {
    it('accepts and rejects series names', () => {
        expect(isValidTimeseriesStoreName('compressor.temperature_1-a')).toBe(true);
        expect(isValidTimeseriesStoreName('')).toBe(false);
        expect(isValidTimeseriesStoreName('.hidden')).toBe(false);
        expect(isValidTimeseriesStoreName('with space')).toBe(false);
        expect(isValidTimeseriesStoreName('a'.repeat(129))).toBe(false);
    });

    it('validates series definitions', () => {
        expect(validateTimeseriesStoreSeriesDefinition({name: 'temp', valueType: NumberType, retentionDays: 30}).ok).toBe(true);
        const result = validateTimeseriesStoreSeriesDefinition({name: 'bad name', valueType: 'bool' as EnyoTimeseriesStoreValueTypeEnum, retentionDays: 1.5});
        expect(result.ok).toBe(false);
        expect(result.errors).toHaveLength(3);
    });

    it('checks point values against the series type', () => {
        expect(validateTimeseriesStorePoint({series: 'temp', value: 21.5}, NumberType)).toBeUndefined();
        expect(validateTimeseriesStorePoint({series: 'state', value: 'defrost'}, Text)).toBeUndefined();
        expect(validateTimeseriesStorePoint({series: 'temp', value: 'hot'}, NumberType)).toMatch(/holds numbers/);
        expect(validateTimeseriesStorePoint({series: 'state', value: 1}, Text)).toMatch(/holds text/);
        expect(validateTimeseriesStorePoint({series: 'temp', value: NaN})).toMatch(/finite/);
        expect(validateTimeseriesStorePoint({series: 'state', value: 'x'.repeat(TIMESERIES_STORE_MAX_TEXT_LENGTH + 1)})).toMatch(/longer/);
        expect(validateTimeseriesStorePoint({series: 'temp', value: 1, timestampIso: 'yesterday'})).toMatch(/timestampIso/);
    });

    it('checks tags', () => {
        expect(validateTimeseriesStorePoint({series: 'temp', value: 1, tags: {phase: 'L1'}})).toBeUndefined();
        expect(validateTimeseriesStorePoint({series: 'temp', value: 1, tags: {phase: ''}})).toMatch(/tag 'phase'/);
        expect(validateTimeseriesStorePoint({series: 'temp', value: 1, tags: {'bad key': 'x'}})).toMatch(/tag key/);
        const tooMany = Object.fromEntries(Array.from({length: 9}, (_, i) => [`k${i}`, 'v']));
        expect(validateTimeseriesStorePoint({series: 'temp', value: 1, tags: tooMany})).toMatch(/more than 8/);
    });

    it('reports invalid points of a batch by index, including those beyond the batch limit', () => {
        const points: EnyoTimeseriesStorePointInput[] = Array.from({length: TIMESERIES_STORE_MAX_POINTS_PER_WRITE + 1}, () => ({series: 'temp', value: 1}));
        points[3] = {series: 'temp', value: 'x'};
        const rejected = validateTimeseriesStorePoints(points, {temp: NumberType});
        expect(rejected.map((r) => r.index)).toEqual([3, TIMESERIES_STORE_MAX_POINTS_PER_WRITE]);
    });

    it('validates aggregated queries', () => {
        const base = {series: 'state', fromIso: '2026-11-01T00:00:00Z', untilIso: '2026-11-02T00:00:00Z', resolution: '1h' as const};
        expect(validateTimeseriesStoreAggregatedQuery({...base, aggregations: [Count, Last]}, Text).ok).toBe(true);
        expect(validateTimeseriesStoreAggregatedQuery({...base, aggregations: [Avg, Max]}, Text).errors).toEqual(['aggregations avg, max need a number series']);
        expect(validateTimeseriesStoreAggregatedQuery({...base, aggregations: []}).ok).toBe(false);
        expect(validateTimeseriesStoreAggregatedQuery({...base, untilIso: base.fromIso, aggregations: [Count]}).errors).toEqual(['fromIso must be before untilIso']);
    });
});

/**
 * Builds a store whose `write` records each batch and can be made to fail.
 */
function fakeStore() {
    const batches: EnyoTimeseriesStorePointInput[][] = [];
    let failNext = false;
    const write = vi.fn(async (points: EnyoTimeseriesStorePointInput[]): Promise<EnyoTimeseriesStoreWriteResult> => {
        if (failNext) {
            failNext = false;
            throw new Error('host busy');
        }
        batches.push(points);
        return {written: points.length, rejected: []};
    });
    const store = {write} as unknown as EnergyAppTimeseriesStore;
    return {store, batches, write, failOnce: () => { failNext = true; }};
}

describe('TimeseriesStoreWriteBuffer', () => {
    it('stamps points when they are added and writes them on flush', async () => {
        const {store, batches} = fakeStore();
        const buffer = new TimeseriesStoreWriteBuffer({store});
        buffer.add({series: 'temp', value: 1});
        buffer.add({series: 'temp', value: 2, timestampIso: '2026-11-01T00:00:00.000Z'});
        expect(buffer.size).toBe(2);
        await buffer.flush();
        expect(buffer.size).toBe(0);
        expect(batches).toHaveLength(1);
        expect(batches[0][0].timestampIso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(batches[0][1].timestampIso).toBe('2026-11-01T00:00:00.000Z');
    });

    it('flushes on size, in batches of at most maxPoints', async () => {
        const {store, batches} = fakeStore();
        const buffer = new TimeseriesStoreWriteBuffer({store, maxPoints: 2});
        buffer.add([{series: 'temp', value: 1}, {series: 'temp', value: 2}, {series: 'temp', value: 3}]);
        await buffer.flush();
        expect(batches.map((b) => b.length)).toEqual([2, 1]);
    });

    it('keeps points after a failed write and retries them on the next flush', async () => {
        const {store, batches, failOnce} = fakeStore();
        const onError = vi.fn();
        const buffer = new TimeseriesStoreWriteBuffer({store, onError});
        buffer.add({series: 'temp', value: 1});
        failOnce();
        await buffer.flush();
        expect(onError).toHaveBeenCalledOnce();
        expect(buffer.size).toBe(1);
        buffer.add({series: 'temp', value: 2});
        await buffer.flush();
        expect(batches[0].map((p) => p.value)).toEqual([1, 2]);
    });

    it('drops the oldest points beyond maxBufferedPoints', async () => {
        const {store, batches} = fakeStore();
        const buffer = new TimeseriesStoreWriteBuffer({store, maxPoints: 10, maxBufferedPoints: 10});
        for (let value = 0; value < 9; value++) buffer.add({series: 'temp', value});
        // a failing write keeps the 9 points; 3 more exceed the cap of 10
        (store.write as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('busy'));
        await buffer.flush();
        buffer.add([{series: 'temp', value: 9}, {series: 'temp', value: 10}, {series: 'temp', value: 11}]);
        await buffer.flush();
        expect(batches.flat().map((p) => p.value)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    it('reports rejected points', async () => {
        const write = vi.fn(async (points: EnyoTimeseriesStorePointInput[]) => ({written: points.length - 1, rejected: [{index: 0, reason: 'unknown series'}]}));
        const onRejected = vi.fn();
        const buffer = new TimeseriesStoreWriteBuffer({store: {write} as unknown as EnergyAppTimeseriesStore, onRejected});
        buffer.add([{series: 'nope', value: 1}, {series: 'temp', value: 2}]);
        await buffer.flush();
        expect(onRejected).toHaveBeenCalledWith([{index: 0, reason: 'unknown series'}], expect.any(Array));
    });

    it('flushes on the interval and stops it on dispose, writing what is left', async () => {
        const {store, batches} = fakeStore();
        let tick: (() => void | Promise<void>) | undefined;
        const interval: EnergyAppInterval = {
            createInterval: vi.fn((_duration, callback) => { tick = () => callback('clock'); return 'interval-1'; }),
            stopInterval: vi.fn(),
        };
        const buffer = new TimeseriesStoreWriteBuffer({store, interval, flushInterval: '10s'});
        expect(interval.createInterval).toHaveBeenCalledWith('10s', expect.any(Function));
        buffer.add({series: 'temp', value: 1});
        await tick!();
        buffer.add({series: 'temp', value: 2});
        await buffer.dispose();
        expect(interval.stopInterval).toHaveBeenCalledWith('interval-1');
        expect(batches.map((b) => b.map((p) => p.value))).toEqual([[1], [2]]);
    });
});
