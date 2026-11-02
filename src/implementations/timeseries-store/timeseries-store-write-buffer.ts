import {EnergyAppInterval, IntervalDuration} from '../../packages/energy-app-interval.js';
import {EnergyAppTimeseriesStore} from '../../packages/energy-app-timeseries-store.js';
import {
    EnyoTimeseriesStorePointInput,
    EnyoTimeseriesStoreWriteResult,
    TIMESERIES_STORE_MAX_POINTS_PER_WRITE,
} from '../../types/enyo-timeseries-store.js';

/**
 * Options of a {@link TimeseriesStoreWriteBuffer}.
 */
export interface TimeseriesStoreWriteBufferOptions {
    /** The store to write to, from `energyApp.useTimeseriesStore()`. */
    store: EnergyAppTimeseriesStore;
    /**
     * Interval API, from `energyApp.useInterval()`. When given, the buffer is
     * flushed every {@link flushInterval}; without it, only on size and on
     * explicit {@link TimeseriesStoreWriteBuffer.flush} calls.
     */
    interval?: EnergyAppInterval;
    /** How often to flush when {@link interval} is given. Defaults to `'30s'`. */
    flushInterval?: IntervalDuration;
    /**
     * Number of buffered points that triggers a flush right away. Defaults to
     * and is capped at {@link TIMESERIES_STORE_MAX_POINTS_PER_WRITE}.
     */
    maxPoints?: number;
    /**
     * Most points kept while writes fail (e.g. the host is busy). The oldest are
     * dropped beyond it, so a long outage cannot exhaust memory. Defaults to
     * 10 × {@link maxPoints}.
     */
    maxBufferedPoints?: number;
    /** Called with the result of every write that rejected points. */
    onRejected?: (rejected: EnyoTimeseriesStoreWriteResult['rejected'], points: EnyoTimeseriesStorePointInput[]) => void;
    /** Called when a write fails as a whole; the points stay buffered and are retried on the next flush. */
    onError?: (error: unknown) => void;
}

/**
 * Collects timeseries points in memory and writes them to the
 * {@link EnergyAppTimeseriesStore} in batches — the efficient way to record
 * values that arrive one at a time (every poll, every data bus message).
 *
 * Points get their timestamp when they are added, not when they are written,
 * so batching never shifts them in time. A failed write keeps the points and
 * retries them on the next flush; since writes overwrite points with the same
 * series, tags and timestamp, a retry never duplicates data.
 *
 * Call {@link dispose} on shutdown: it stops the interval and writes what is
 * still buffered.
 *
 * @example
 * ```typescript
 * const buffer = new TimeseriesStoreWriteBuffer({
 *     store: energyApp.useTimeseriesStore(),
 *     interval: energyApp.useInterval(),
 * });
 * buffer.add({series: 'compressor.temperature', value: 61.5});
 * energyApp.onShutdown(() => buffer.dispose());
 * ```
 */
export class TimeseriesStoreWriteBuffer {
    private readonly store: EnergyAppTimeseriesStore;
    private readonly interval?: EnergyAppInterval;
    private readonly maxPoints: number;
    private readonly maxBufferedPoints: number;
    private readonly onRejected?: TimeseriesStoreWriteBufferOptions['onRejected'];
    private readonly onError?: TimeseriesStoreWriteBufferOptions['onError'];
    private readonly intervalId?: string;
    private buffer: EnyoTimeseriesStorePointInput[] = [];
    private flushing?: Promise<void>;

    /**
     * Creates the buffer and, when an interval API is given, starts flushing periodically.
     *
     * @param options - See {@link TimeseriesStoreWriteBufferOptions}.
     */
    constructor(options: TimeseriesStoreWriteBufferOptions) {
        this.store = options.store;
        this.interval = options.interval;
        this.maxPoints = Math.max(1, Math.min(options.maxPoints ?? TIMESERIES_STORE_MAX_POINTS_PER_WRITE, TIMESERIES_STORE_MAX_POINTS_PER_WRITE));
        this.maxBufferedPoints = Math.max(this.maxPoints, options.maxBufferedPoints ?? this.maxPoints * 10);
        this.onRejected = options.onRejected;
        this.onError = options.onError;
        if (this.interval) {
            this.intervalId = this.interval.createInterval(options.flushInterval ?? '30s', () => this.flush());
        }
    }

    /** Number of points waiting to be written. */
    public get size(): number {
        return this.buffer.length;
    }

    /**
     * Adds points to the buffer, stamping those without `timestampIso` with the
     * current time. Starts a flush when {@link TimeseriesStoreWriteBufferOptions.maxPoints} is reached.
     *
     * @param points - One point or several.
     */
    public add(points: EnyoTimeseriesStorePointInput | EnyoTimeseriesStorePointInput[]): void {
        const nowIso = new Date().toISOString();
        for (const point of Array.isArray(points) ? points : [points]) {
            this.buffer.push(point.timestampIso ? point : {...point, timestampIso: nowIso});
        }
        this.trimToCapacity();
        if (this.buffer.length >= this.maxPoints) {
            void this.flush();
        }
    }

    /**
     * Writes everything buffered so far, in batches of at most
     * {@link TimeseriesStoreWriteBufferOptions.maxPoints}. Concurrent calls share
     * one flush. Never throws: failures go to `onError` and the points stay buffered.
     *
     * @returns Promise resolving once the flush has ended.
     */
    public flush(): Promise<void> {
        if (!this.flushing) {
            this.flushing = this.writeAll().finally(() => {
                this.flushing = undefined;
            });
        }
        return this.flushing;
    }

    /**
     * Stops the periodic flush and writes the remaining points.
     *
     * @returns Promise resolving once the final flush has ended.
     */
    public async dispose(): Promise<void> {
        if (this.interval && this.intervalId) {
            this.interval.stopInterval(this.intervalId);
        }
        await this.flushing;
        await this.flush();
    }

    /**
     * Writes the buffer batch by batch until it is empty or a write fails.
     */
    private async writeAll(): Promise<void> {
        while (this.buffer.length > 0) {
            // Taken out before the write, so points added meanwhile are never mixed up with it.
            const batch = this.buffer.splice(0, this.maxPoints);
            try {
                const result = await this.store.write(batch);
                if (result.rejected.length > 0) {
                    this.onRejected?.(result.rejected, batch);
                }
            } catch (error) {
                this.buffer.unshift(...batch);
                this.trimToCapacity();
                this.onError?.(error);
                return;
            }
        }
    }

    /**
     * Drops the oldest points beyond {@link TimeseriesStoreWriteBufferOptions.maxBufferedPoints}.
     */
    private trimToCapacity(): void {
        const excess = this.buffer.length - this.maxBufferedPoints;
        if (excess > 0) {
            this.buffer.splice(0, excess);
        }
    }
}
