import {EnergyApp} from '../../energy-app.js';
import {
    EnyoDataBusHeatpumpConsumptionForecastV1,
    EnyoDataBusHeatpumpValuesV1,
    EnyoDataBusMessageEnum,
    EnyoHeatpumpConsumptionForecastDataPoint,
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
 * Per-slot heatpump consumption history payload.
 */
interface HeatpumpConsumptionHistoryValues {
    /** Average heatpump electrical consumption power in Watts during the slot. */
    powerW: number;
    samples: number;
}

/**
 * Forecast result returned by {@link HeatpumpConsumptionForecast.getForecast},
 * shaped to match `EnyoDataBusHeatpumpConsumptionForecastV1.data`.
 */
export type HeatpumpConsumptionForecastResult =
    BaseForecast<EnyoDataBusHeatpumpConsumptionForecastV1['data']>;

/**
 * Builds a 24-hour heatpump electrical consumption forecast for a single
 * heatpump appliance from historical `HeatpumpValuesUpdateV1` data-bus
 * messages, with live updates merged in as new readings arrive.
 *
 * Heatpump operation is strongly tied to outdoor temperature (which itself is
 * weekday-cyclic on average), so the algorithm uses a same-weekday
 * recency-weighted average over the configured history window (default 7 d),
 * with an all-weekday fallback. Note: this implementation does not adjust for
 * forecasted outdoor temperature; if you need that, layer a COP-based
 * correction on top of the returned `powerW` values using the weather forecast
 * for the same horizon.
 *
 * @example
 * ```ts
 * const forecast = new HeatpumpConsumptionForecast(app, 'heatpump-1', { source: EnyoSourceEnum.Device });
 * await forecast.initialize();
 * const result = forecast.getForecast();
 * ```
 */
export class HeatpumpConsumptionForecast implements Forecaster {
    /** Default history window. Heatpump load is weekday-cyclic on average. */
    public static readonly DEFAULT_HISTORY_DAYS = 7;

    private readonly config: ResolvedForecastConfig;
    private readonly history: HistoricalBucket<HeatpumpConsumptionHistoryValues>[] = [];
    private listenerId: string | undefined;
    private currentSlotMs: number | undefined;
    private currentSlotPowerSum = 0;
    private currentSlotSamples = 0;
    private initialized = false;
    private readonly source: EnyoSourceEnum;

    /**
     * @param app - The energy-app SDK instance.
     * @param applianceId - Heatpump appliance ID.
     * @param options.source - Source identifier used for outgoing forecast messages.
     * @param options.config - Optional config overrides; `historyDays` defaults to 7.
     */
    constructor(
        private readonly app: EnergyApp,
        public readonly applianceId: string,
        options: {source: EnyoSourceEnum; config?: ForecastConfig},
    ) {
        this.config = resolveForecastConfig(
            {historyDays: HeatpumpConsumptionForecast.DEFAULT_HISTORY_DAYS},
            options.config,
        );
        this.source = options.source;
    }

    /**
     * Pulls historical `HeatpumpValuesUpdateV1` messages, aggregates them into
     * 15-minute slots, and starts listening to live heatpump events. Idempotent.
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;

        const now = Date.now();
        const startMs = now - this.config.historyDays * 24 * 60 * 60 * 1000;
        const response = await this.app.useTimeseries().queryDataBusMessages({
            applianceId: this.applianceId,
            startDateIso: new Date(startMs).toISOString(),
            endDateIso: new Date(now).toISOString(),
            messageTypes: [EnyoDataBusMessageEnum.HeatpumpValuesUpdateV1],
            limit: 100000,
        });

        const slotAggregator = new Map<number, {sum: number; count: number}>();
        for (const raw of response.messages) {
            const message = raw as EnyoDataBusHeatpumpValuesV1;
            const power = message.data.values.powerW;
            if (typeof power !== 'number' || Number.isNaN(power)) continue;
            const slotMs = roundDownTo15Minutes(new Date(message.timestampIso).getTime());
            const existing = slotAggregator.get(slotMs);
            if (existing) {
                existing.sum += power;
                existing.count += 1;
            } else {
                slotAggregator.set(slotMs, {sum: power, count: 1});
            }
        }
        const slots = Array.from(slotAggregator.keys()).sort((a, b) => a - b);
        for (const slotMs of slots) {
            const agg = slotAggregator.get(slotMs)!;
            this.history.push({
                timestampIso: new Date(slotMs).toISOString(),
                values: {powerW: agg.sum / agg.count, samples: agg.count},
            });
        }

        this.listenerId = this.app.useDataBus().listenForMessages(
            [EnyoDataBusMessageEnum.HeatpumpValuesUpdateV1],
            (msg) => this.onHeatpumpValues(msg as EnyoDataBusHeatpumpValuesV1),
        );
    }

    /**
     * Returns the current forecast as an
     * `EnyoDataBusHeatpumpConsumptionForecastV1`-shaped payload over the
     * configured horizon.
     */
    public getForecast(): HeatpumpConsumptionForecastResult {
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

        const entries: EnyoHeatpumpConsumptionForecastDataPoint[] = buckets.map((b) => ({
            timestampIso: b.timestampIso,
            powerW: b.payload.powerW,
            powerWh: b.payload.powerWh,
        }));

        const result: HeatpumpConsumptionForecastResult = {
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

    private onHeatpumpValues(message: EnyoDataBusHeatpumpValuesV1): void {
        if (message.applianceId !== this.applianceId) return;
        const power = message.data.values.powerW;
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

    private publish(result: HeatpumpConsumptionForecastResult): void {
        const message: EnyoDataBusHeatpumpConsumptionForecastV1 = {
            id: globalThis.crypto.randomUUID(),
            type: 'message',
            message: EnyoDataBusMessageEnum.HeatpumpConsumptionForecastV1,
            source: this.source,
            applianceId: this.applianceId,
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
