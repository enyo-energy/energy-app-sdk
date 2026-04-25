import {EnergyApp} from '../../energy-app.js';
import {
    EnyoDataBusAggregatedStateValuesV1,
    EnyoDataBusHomeConsumptionForecastV1,
    EnyoDataBusMessageEnum,
    EnyoHomeConsumptionForecastDataPoint,
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
 * Per-slot home consumption history payload.
 */
interface HomeConsumptionHistoryValues {
    powerW: number;
    samples: number;
}

/**
 * Forecast result returned by {@link HomeConsumptionForecast.getForecast},
 * shaped to match `EnyoDataBusHomeConsumptionForecastV1.data`.
 */
export type HomeConsumptionForecastResult =
    BaseForecast<EnyoDataBusHomeConsumptionForecastV1['data']>;

/**
 * Builds a 24-hour total home-consumption forecast (system-wide, no
 * per-appliance breakdown) from historical home-consumption timeseries data,
 * with live updates merged in from `AggregatedStateUpdateV1` data-bus events.
 *
 * Home consumption is strongly weekday-cyclic, so the algorithm uses a
 * same-weekday recency-weighted average over the configured history window
 * (default 14 d), with a fallback to all-weekday data when same-weekday
 * samples are missing.
 *
 * @example
 * ```ts
 * const forecast = new HomeConsumptionForecast(app, { source: EnyoSourceEnum.Device });
 * await forecast.initialize();
 * const result = forecast.getForecast();
 * ```
 */
export class HomeConsumptionForecast implements Forecaster {
    /** Default history window. Home consumption patterns are weekday-cyclic. */
    public static readonly DEFAULT_HISTORY_DAYS = 14;

    private readonly config: ResolvedForecastConfig;
    private readonly history: HistoricalBucket<HomeConsumptionHistoryValues>[] = [];
    private listenerId: string | undefined;
    private currentSlotMs: number | undefined;
    private currentSlotPowerSum = 0;
    private currentSlotSamples = 0;
    private initialized = false;
    private readonly source: EnyoSourceEnum;

    /**
     * @param app - The energy-app SDK instance.
     * @param options.source - Source identifier used for outgoing forecast messages.
     * @param options.config - Optional config overrides; `historyDays` defaults to 14.
     */
    constructor(
        private readonly app: EnergyApp,
        options: {source: EnyoSourceEnum; config?: ForecastConfig},
    ) {
        this.config = resolveForecastConfig(
            {historyDays: HomeConsumptionForecast.DEFAULT_HISTORY_DAYS},
            options.config,
        );
        this.source = options.source;
    }

    /**
     * Pulls the home-consumption timeseries history and starts listening to
     * live `AggregatedStateUpdateV1` events. Idempotent.
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;

        const now = Date.now();
        const startMs = now - this.config.historyDays * 24 * 60 * 60 * 1000;
        const response = await this.app.useTimeseries().getHomeConsumptionTimeseries({
            startDateIso: new Date(startMs).toISOString(),
            endDateIso: new Date(now).toISOString(),
            resolution: this.config.resolution,
        });
        for (const entry of response.entries) {
            this.history.push({
                timestampIso: entry.timestampIso,
                values: {powerW: entry.homeConsumptionW, samples: 1},
            });
        }

        this.listenerId = this.app.useDataBus().listenForMessages(
            [EnyoDataBusMessageEnum.AggregatedStateUpdateV1],
            (msg) => this.onAggregatedState(msg as EnyoDataBusAggregatedStateValuesV1),
        );
    }

    /**
     * Returns the current forecast as an `EnyoDataBusHomeConsumptionForecastV1`-shaped
     * payload over the configured horizon.
     */
    public getForecast(): HomeConsumptionForecastResult {
        const now = Date.now();
        this.flushCurrentSlot(now);

        const parsed = parseHistory(this.history);
        const todayWeekday = new Date(now).getUTCDay();
        const sameWeekdayMap = buildSlotMap(parsed, (b) => b.weekday === todayWeekday);
        const fallbackMap = buildSlotMap(parsed);
        const isoIndex = buildIsoIndex(parsed, (v) => v.powerW);

        const buckets: ForecastBucket<{powerW: number; powerWh: number}>[] = buildForecastSlots(
            now,
            this.config.horizonHours,
            this.config.resolution,
        ).map((slotMs) => {
            const key = formatSlotKey(slotMs);
            const slotBuckets = sameWeekdayMap.get(key) ?? fallbackMap.get(key);
            const avg = weightedAverageBySlot(slotBuckets, now, this.config.historyDays, {
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

        const entries: EnyoHomeConsumptionForecastDataPoint[] = buckets.map((b) => ({
            timestampIso: b.timestampIso,
            powerW: b.payload.powerW,
            powerWh: b.payload.powerWh,
        }));

        const result: HomeConsumptionForecastResult = {
            generatedAtIso: new Date(now).toISOString(),
            data: {resolution: this.config.resolution, entries},
        };

        if (this.config.publishToBus) {
            this.publish(result);
        }
        return result;
    }

    /**
     * Computes and explicitly publishes the current forecast on the data bus.
     */
    public publishForecast(): void {
        const result = this.getForecast();
        if (!this.config.publishToBus) {
            this.publish(result);
        }
    }

    /**
     * Detaches data-bus listeners and clears in-memory history.
     */
    public dispose(): void {
        if (this.listenerId) {
            this.app.useDataBus().unsubscribe(this.listenerId);
            this.listenerId = undefined;
        }
        this.history.length = 0;
        this.initialized = false;
    }

    private onAggregatedState(message: EnyoDataBusAggregatedStateValuesV1): void {
        const power = message.data.totalHomeConsumptionW;
        if (typeof power !== 'number' || Number.isNaN(power)) return;
        const ts = new Date(message.timestampIso).getTime();
        const slotMs = roundDownTo15Minutes(ts);
        if (this.currentSlotMs === undefined || slotMs !== this.currentSlotMs) {
            this.flushCurrentSlot(ts);
            this.currentSlotMs = slotMs;
            this.currentSlotPowerSum = 0;
            this.currentSlotSamples = 0;
        }
        this.currentSlotPowerSum += power;
        this.currentSlotSamples += 1;
    }

    private flushCurrentSlot(nowMs: number): void {
        if (this.currentSlotMs === undefined || this.currentSlotSamples === 0) return;
        const avg = this.currentSlotPowerSum / this.currentSlotSamples;
        upsertLiveBucket(
            this.history,
            this.currentSlotMs,
            {powerW: avg, samples: this.currentSlotSamples},
            (existing, incoming) => {
                const total = existing.samples + incoming.samples;
                return {
                    powerW: (existing.powerW * existing.samples + incoming.powerW * incoming.samples) / total,
                    samples: total,
                };
            },
        );
        if (this.currentSlotMs < roundDownTo15Minutes(nowMs)) {
            this.currentSlotMs = undefined;
            this.currentSlotPowerSum = 0;
            this.currentSlotSamples = 0;
        }
        trimHistory(this.history, nowMs, this.config.historyDays * 24 * 60 * 60 * 1000 + FIFTEEN_MIN_MS);
    }

    private publish(result: HomeConsumptionForecastResult): void {
        const message: EnyoDataBusHomeConsumptionForecastV1 = {
            id: globalThis.crypto.randomUUID(),
            type: 'message',
            message: EnyoDataBusMessageEnum.HomeConsumptionForecastV1,
            source: this.source,
            timestampIso: result.generatedAtIso,
            resolution: 'dynamic',
            data: result.data,
        };
        this.app.useDataBus().sendMessage([message]);
    }
}

function formatSlotKey(slotMs: number): string {
    const d = new Date(slotMs);
    return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes()
        .toString()
        .padStart(2, '0')}`;
}
