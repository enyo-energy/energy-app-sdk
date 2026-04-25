import {EnergyApp} from '../../energy-app.js';
import {
    EnyoDataBusInverterValuesV1,
    EnyoDataBusMessageEnum,
    EnyoDataBusPvForecastV1,
    EnyoPvForecastDataPoint,
} from '../../types/enyo-data-bus-value.js';
import {EnyoSourceEnum} from '../../types/enyo-source.enum.js';
import {
    BaseForecast,
    Forecaster,
    ForecastConfig,
    HistoricalBucket,
    ResolvedForecastConfig,
    resolveForecastConfig,
} from './forecast-types.js';
import {
    FIFTEEN_MIN_MS,
    ForecastBucket,
    alignForecastToRecentActuals,
    buildForecastSlots,
    buildIsoIndex,
    buildSlotMap,
    parseHistory,
    roundDownTo15Minutes,
    trimHistory,
    upsertLiveBucket,
    weightedAverageBySlot,
    wToWhPer15Min,
} from './forecast-utils.js';

/**
 * Per-15-minute-bucket PV history payload.
 */
interface PvHistoryValues {
    powerW: number;
    powerWh: number;
    /** Number of live samples that contributed to `powerW`. */
    samples: number;
}

/**
 * Forecast result returned by {@link PvProductionForecast.getForecast}.
 *
 * The shape mirrors `EnyoDataBusPvForecastV1.data` so the result can be
 * embedded directly in a data-bus message.
 */
export type PvProductionForecastResult = BaseForecast<EnyoDataBusPvForecastV1['data']>;

/**
 * Builds a 24-hour PV production forecast for a single inverter from
 * historical PV production timeseries data, with live updates merged in from
 * `InverterValuesUpdateV1` data-bus events.
 *
 * Algorithm:
 *  1. Pull 4 days of historical 15-minute PV-production buckets via
 *     `app.useTimeseries().getPvProductionTimeseries()`.
 *  2. For each forecast slot, take the recency-weighted average of the same
 *     time-of-day across the history window. PV production is sun-driven, so
 *     all weekdays contribute (no weekday filter).
 *  3. Optionally align the leading 8 buckets (~2 h) to the very latest
 *     production so the forecast joins smoothly with reality.
 *
 * @example
 * ```ts
 * const forecast = new PvProductionForecast(app, 'inverter-1', { source: EnyoSourceEnum.Device });
 * await forecast.initialize();
 * const result = forecast.getForecast(); // { generatedAtIso, data: { resolution, entries } }
 * ```
 */
export class PvProductionForecast implements Forecaster {
    /**
     * Per-forecaster default: PV is sun-driven and benefits from a shorter,
     * more recent lookback window than weekday-cyclic loads.
     */
    public static readonly DEFAULT_HISTORY_DAYS = 4;

    private readonly config: ResolvedForecastConfig;
    private readonly history: HistoricalBucket<PvHistoryValues>[] = [];
    private listenerId: string | undefined;
    private currentSlotMs: number | undefined;
    private currentSlotPowerSum = 0;
    private currentSlotSampleCount = 0;
    private initialized = false;

    /**
     * @param app - The energy-app SDK instance the forecaster reads from and publishes through.
     * @param applianceId - Inverter appliance ID this forecast covers.
     * @param options.source - Source identifier used when emitting forecast messages.
     * @param options.config - Optional config overrides; merged with {@link DEFAULT_FORECAST_CONFIG}
     *   and the `historyDays = 4` PV-specific default.
     */
    constructor(
        private readonly app: EnergyApp,
        public readonly applianceId: string,
        options: {source: EnyoSourceEnum; config?: ForecastConfig},
    ) {
        this.config = resolveForecastConfig(
            {historyDays: PvProductionForecast.DEFAULT_HISTORY_DAYS},
            options.config,
        );
        this.source = options.source;
    }

    private readonly source: EnyoSourceEnum;

    /**
     * Pulls the historical PV-production timeseries from `useTimeseries()` and
     * starts listening to live `InverterValuesUpdateV1` events for the inverter.
     * Idempotent.
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;

        const now = Date.now();
        const startMs = now - this.config.historyDays * 24 * 60 * 60 * 1000;
        const response = await this.app.useTimeseries().getPvProductionTimeseries({
            startDateIso: new Date(startMs).toISOString(),
            endDateIso: new Date(now).toISOString(),
            applianceIds: [this.applianceId],
            resolution: this.config.resolution,
        });
        for (const entry of response.entries) {
            this.history.push({
                timestampIso: entry.timestampIso,
                values: {powerW: entry.pvPowerW, powerWh: entry.pvPowerWh, samples: 1},
            });
        }

        this.listenerId = this.app.useDataBus().listenForMessages(
            [EnyoDataBusMessageEnum.InverterValuesUpdateV1],
            (msg) => this.onInverterValues(msg as EnyoDataBusInverterValuesV1),
        );
    }

    /**
     * Returns the current forecast as an `EnyoDataBusPvForecastV1`-shaped
     * payload over the configured horizon (default 24 h).
     */
    public getForecast(): PvProductionForecastResult {
        const now = Date.now();
        this.flushCurrentSlot(now);

        const parsed = parseHistory(this.history);
        const slotMap = buildSlotMap(parsed);
        const isoIndex = buildIsoIndex(parsed, (v) => v.powerW);

        const buckets: ForecastBucket<{powerW: number; powerWh: number}>[] = buildForecastSlots(
            now,
            this.config.horizonHours,
            this.config.resolution,
        ).map((slotMs) => {
            const key = formatSlotKey(slotMs);
            const avg = weightedAverageBySlot(slotMap.get(key), now, this.config.historyDays, {
                powerW: (v) => v.powerW,
            });
            const powerW = Math.max(0, Math.round(avg.powerW));
            return {
                timestampIso: new Date(slotMs).toISOString(),
                payload: {powerW, powerWh: wToWhPer15Min(powerW)},
            };
        });

        if (this.config.alignToRecentActuals) {
            alignForecastToRecentActuals(
                buckets,
                (iso) => isoIndex.get(iso),
                'powerW',
                ['powerW', 'powerWh'],
            );
            for (const b of buckets) {
                b.payload.powerW = Math.max(0, Math.round(b.payload.powerW));
                b.payload.powerWh = wToWhPer15Min(b.payload.powerW);
            }
        }

        const entries: EnyoPvForecastDataPoint[] = buckets.map((b) => ({
            timestampIso: b.timestampIso,
            powerW: b.payload.powerW,
            powerWh: b.payload.powerWh,
        }));

        const result: PvProductionForecastResult = {
            generatedAtIso: new Date(now).toISOString(),
            data: {resolution: this.config.resolution, entries},
        };

        if (this.config.publishToBus) {
            this.publish(result);
        }
        return result;
    }

    /**
     * Computes the current forecast and explicitly publishes it on the data
     * bus, regardless of `publishToBus`. Useful for one-off pushes.
     */
    public publishForecast(): void {
        const result = this.getForecast();
        if (!this.config.publishToBus) {
            this.publish(result);
        }
    }

    /**
     * Detaches the data-bus listener and discards in-memory history.
     */
    public dispose(): void {
        if (this.listenerId) {
            this.app.useDataBus().unsubscribe(this.listenerId);
            this.listenerId = undefined;
        }
        this.history.length = 0;
        this.initialized = false;
    }

    private onInverterValues(message: EnyoDataBusInverterValuesV1): void {
        if (message.applianceId !== this.applianceId) return;
        const ts = new Date(message.timestampIso).getTime();
        const slotMs = roundDownTo15Minutes(ts);
        if (this.currentSlotMs === undefined || slotMs !== this.currentSlotMs) {
            this.flushCurrentSlot(ts);
            this.currentSlotMs = slotMs;
            this.currentSlotPowerSum = 0;
            this.currentSlotSampleCount = 0;
        }
        this.currentSlotPowerSum += message.data.pvPowerW;
        this.currentSlotSampleCount += 1;
    }

    private flushCurrentSlot(nowMs: number): void {
        if (this.currentSlotMs === undefined || this.currentSlotSampleCount === 0) return;
        const avgPowerW = this.currentSlotPowerSum / this.currentSlotSampleCount;
        upsertLiveBucket(
            this.history,
            this.currentSlotMs,
            {powerW: avgPowerW, powerWh: wToWhPer15Min(avgPowerW), samples: this.currentSlotSampleCount},
            (existing, incoming) => {
                const totalSamples = existing.samples + incoming.samples;
                const avg = (existing.powerW * existing.samples + incoming.powerW * incoming.samples) / totalSamples;
                return {powerW: avg, powerWh: wToWhPer15Min(avg), samples: totalSamples};
            },
        );
        if (this.currentSlotMs < roundDownTo15Minutes(nowMs)) {
            this.currentSlotMs = undefined;
            this.currentSlotPowerSum = 0;
            this.currentSlotSampleCount = 0;
        }
        trimHistory(this.history, nowMs, this.config.historyDays * 24 * 60 * 60 * 1000 + FIFTEEN_MIN_MS);
    }

    private publish(result: PvProductionForecastResult): void {
        const message: EnyoDataBusPvForecastV1 = {
            id: globalThis.crypto.randomUUID(),
            type: 'message',
            message: EnyoDataBusMessageEnum.PvForecastV1,
            source: this.source,
            applianceId: this.applianceId,
            timestampIso: result.generatedAtIso,
            resolution: 'dynamic',
            data: result.data,
        };
        this.app.useDataBus().sendMessage([message]);
    }
}

/**
 * Returns the slot key (`"HH:MM"`) for a UTC timestamp in millis.
 */
function formatSlotKey(slotMs: number): string {
    const d = new Date(slotMs);
    return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes()
        .toString()
        .padStart(2, '0')}`;
}
