import {EnergyApp} from '../../energy-app.js';
import {
    EnyoDataBusHeatpumpDhwTemperatureForecastV1,
    EnyoDataBusHeatpumpTemperaturesV1,
    EnyoDataBusMessageEnum,
    EnyoHeatpumpDhwTemperatureForecastDataPoint,
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
} from './forecast-utils.js';

/**
 * Per-slot DHW-temperature history payload.
 */
interface DhwHistoryValues {
    /** Average DHW tank temperature in degrees Celsius during the slot. */
    temperatureC: number;
    samples: number;
}

/**
 * Forecast result returned by
 * {@link HeatpumpDhwTemperatureForecast.getForecast}, shaped to match
 * `EnyoDataBusHeatpumpDhwTemperatureForecastV1.data`.
 */
export type HeatpumpDhwTemperatureForecastResult =
    BaseForecast<EnyoDataBusHeatpumpDhwTemperatureForecastV1['data']>;

/**
 * Configuration specific to {@link HeatpumpDhwTemperatureForecast}.
 */
export interface HeatpumpDhwTemperatureForecastConfig extends ForecastConfig {
    /**
     * Optional zero-based DHW tank index to forecast on. If omitted, the
     * forecaster averages across all reported tanks per timestamp.
     */
    dhwTankIndex?: number;
}

/**
 * Builds a 24-hour heatpump domestic-hot-water (DHW) tank temperature forecast
 * for a single heatpump appliance from historical heatpump-temperature
 * timeseries data, with live updates merged in from
 * `HeatpumpTemperaturesUpdateV1` data-bus events.
 *
 * DHW reheat cycles follow the user's hot-water draw pattern, which is
 * strongly weekday-cyclic, so the algorithm uses a same-weekday recency-
 * weighted average over the configured history window (default 7 d), with an
 * all-weekday fallback. Optionally, a single DHW tank index can be chosen via
 * {@link HeatpumpDhwTemperatureForecastConfig.dhwTankIndex}; otherwise all
 * reported tanks are averaged per timestamp.
 *
 * @example
 * ```ts
 * const forecast = new HeatpumpDhwTemperatureForecast(app, 'heatpump-1', {
 *     source: EnyoSourceEnum.Device,
 *     config: { dhwTankIndex: 0 },
 * });
 * await forecast.initialize();
 * const result = forecast.getForecast();
 * ```
 */
export class HeatpumpDhwTemperatureForecast implements Forecaster {
    /** Default history window. DHW reheats are weekday-cyclic. */
    public static readonly DEFAULT_HISTORY_DAYS = 7;

    private readonly config: ResolvedForecastConfig;
    private readonly history: HistoricalBucket<DhwHistoryValues>[] = [];
    private readonly dhwTankIndex: number | undefined;
    private listenerId: string | undefined;
    private currentSlotMs: number | undefined;
    private currentSlotTempSum = 0;
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
        options: {source: EnyoSourceEnum; config?: HeatpumpDhwTemperatureForecastConfig},
    ) {
        this.config = resolveForecastConfig(
            {historyDays: HeatpumpDhwTemperatureForecast.DEFAULT_HISTORY_DAYS},
            options.config,
        );
        this.source = options.source;
        this.dhwTankIndex = options.config?.dhwTankIndex;
    }

    /**
     * Pulls the heatpump temperature timeseries history and starts listening to
     * live `HeatpumpTemperaturesUpdateV1` events. Idempotent.
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;

        const now = Date.now();
        const startMs = now - this.config.historyDays * 24 * 60 * 60 * 1000;
        const response = await this.app.useTimeseries().getHeatpumpTemperatureTimeseries({
            startDateIso: new Date(startMs).toISOString(),
            endDateIso: new Date(now).toISOString(),
            applianceIds: [this.applianceId],
            resolution: this.config.resolution,
        });
        for (const entry of response.entries) {
            const dhwTemp = this.extractDhwTemperature(entry.domesticHotWater);
            if (dhwTemp === undefined) continue;
            this.history.push({
                timestampIso: entry.timestampIso,
                values: {temperatureC: dhwTemp, samples: 1},
            });
        }

        this.listenerId = this.app.useDataBus().listenForMessages(
            [EnyoDataBusMessageEnum.HeatpumpTemperaturesUpdateV1],
            (msg) => this.onHeatpumpTemperatures(msg as EnyoDataBusHeatpumpTemperaturesV1),
        );
    }

    /**
     * Returns the current forecast as an
     * `EnyoDataBusHeatpumpDhwTemperatureForecastV1`-shaped payload over the
     * configured horizon.
     */
    public getForecast(): HeatpumpDhwTemperatureForecastResult {
        const now = Date.now();
        this.flushCurrentSlot(now);

        const parsed = parseHistory(this.history);
        const todayWeekday = new Date(now).getUTCDay();
        const sameWeekdayMap = buildSlotMap(parsed, (b) => b.weekday === todayWeekday);
        const fallbackMap = buildSlotMap(parsed);
        const isoIndex = buildIsoIndex(parsed, (v) => v.temperatureC);

        const buckets: ForecastBucket<{temperatureC: number}>[] = buildForecastSlots(
            now,
            this.config.horizonHours,
            this.config.resolution,
        ).map((slotMs) => {
            const key = formatSlotKey(slotMs);
            const slotBuckets = sameWeekdayMap.get(key) ?? fallbackMap.get(key);
            const avg = weightedAverageBySlot(slotBuckets, now, this.config.historyDays, {
                temperatureC: (v) => v.temperatureC,
            });
            return {
                timestampIso: new Date(slotMs).toISOString(),
                payload: {temperatureC: avg.temperatureC},
            };
        });

        if (this.config.alignToRecentActuals) {
            alignForecastToRecentActuals(
                buckets,
                (iso) => isoIndex.get(iso),
                'temperatureC',
                ['temperatureC'],
            );
        }

        const entries: EnyoHeatpumpDhwTemperatureForecastDataPoint[] = buckets.map((b) => ({
            timestampIso: b.timestampIso,
            temperatureC: round1(b.payload.temperatureC),
        }));

        const result: HeatpumpDhwTemperatureForecastResult = {
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

    private onHeatpumpTemperatures(message: EnyoDataBusHeatpumpTemperaturesV1): void {
        if (message.applianceId !== this.applianceId) return;
        const tanks = message.data.domesticHotWater;
        if (!tanks || tanks.length === 0) return;
        const temperature = this.extractLiveDhwTemperature(tanks);
        if (temperature === undefined) return;

        const ts = new Date(message.timestampIso).getTime();
        const slotMs = roundDownTo15Minutes(ts);
        if (this.currentSlotMs === undefined || slotMs !== this.currentSlotMs) {
            this.flushCurrentSlot(ts);
            this.currentSlotMs = slotMs;
            this.currentSlotTempSum = 0;
            this.currentSlotSamples = 0;
        }
        this.currentSlotTempSum += temperature;
        this.currentSlotSamples += 1;
    }

    private flushCurrentSlot(nowMs: number): void {
        if (this.currentSlotMs === undefined || this.currentSlotSamples === 0) return;
        const avg = this.currentSlotTempSum / this.currentSlotSamples;
        upsertLiveBucket(
            this.history,
            this.currentSlotMs,
            {temperatureC: avg, samples: this.currentSlotSamples},
            (existing, incoming) => {
                const total = existing.samples + incoming.samples;
                return {
                    temperatureC:
                        (existing.temperatureC * existing.samples + incoming.temperatureC * incoming.samples) / total,
                    samples: total,
                };
            },
        );
        if (this.currentSlotMs < roundDownTo15Minutes(nowMs)) {
            this.currentSlotMs = undefined;
            this.currentSlotTempSum = 0;
            this.currentSlotSamples = 0;
        }
        trimHistory(this.history, nowMs, this.config.historyDays * 24 * 60 * 60 * 1000 + FIFTEEN_MIN_MS);
    }

    private extractDhwTemperature(
        tanks: {index: number; averageTemperatureC: number}[] | undefined,
    ): number | undefined {
        if (!tanks || tanks.length === 0) return undefined;
        const matching = this.dhwTankIndex !== undefined
            ? tanks.filter((t) => t.index === this.dhwTankIndex)
            : tanks;
        if (matching.length === 0) return undefined;
        const sum = matching.reduce((acc, t) => acc + t.averageTemperatureC, 0);
        return sum / matching.length;
    }

    private extractLiveDhwTemperature(
        tanks: {index: number; temperatureC: number}[],
    ): number | undefined {
        const matching = this.dhwTankIndex !== undefined
            ? tanks.filter((t) => t.index === this.dhwTankIndex)
            : tanks;
        if (matching.length === 0) return undefined;
        const sum = matching.reduce((acc, t) => acc + t.temperatureC, 0);
        return sum / matching.length;
    }

    private publish(result: HeatpumpDhwTemperatureForecastResult): void {
        const message: EnyoDataBusHeatpumpDhwTemperatureForecastV1 = {
            id: globalThis.crypto.randomUUID(),
            type: 'message',
            message: EnyoDataBusMessageEnum.HeatpumpDhwTemperatureForecastV1,
            source: this.source,
            applianceId: this.applianceId,
            timestampIso: result.generatedAtIso,
            resolution: 'dynamic',
            data: result.data,
        };
        this.app.useDataBus().sendMessage([message]);
    }
}

function round1(value: number): number {
    return Math.round(value * 10) / 10;
}

function formatSlotKey(slotMs: number): string {
    const d = new Date(slotMs);
    return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes()
        .toString()
        .padStart(2, '0')}`;
}
