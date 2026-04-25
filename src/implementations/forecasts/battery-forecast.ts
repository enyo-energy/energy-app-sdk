import {EnergyApp} from '../../energy-app.js';
import {
    EnyoBatteryForecastDataPoint,
    EnyoDataBusBatteryForecastV1,
    EnyoDataBusBatteryValuesUpdateV1,
    EnyoDataBusMessageEnum,
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
 * Per-slot battery history payload.
 */
interface BatteryHistoryValues {
    /** Time-weighted average state of charge in percent (0–100). */
    socPercent: number;
    /** Net battery power in Watts. Positive = charging, negative = discharging. */
    powerW: number;
    /** Number of samples that contributed to the averages. */
    samples: number;
}

/**
 * Forecast result returned by {@link BatteryForecast.getForecast}, shaped to
 * match `EnyoDataBusBatteryForecastV1.data`.
 */
export type BatteryForecastResult = BaseForecast<EnyoDataBusBatteryForecastV1['data']>;

/**
 * Configuration specific to {@link BatteryForecast}.
 */
export interface BatteryForecastConfig extends ForecastConfig {
    /**
     * Rated battery capacity in Watt-hours, used to translate the forecasted
     * SoC % into `capacityWh` on the output. If omitted, the forecaster tries
     * to read `EnyoBatteryApplianceMetadata.maxCapacityWh` for the appliance
     * during {@link BatteryForecast.initialize}; if neither is available,
     * `capacityWh` is set to `0`.
     */
    ratedCapacityWh?: number;
}

/**
 * Builds a 24-hour battery state-of-charge / capacity forecast for a single
 * battery appliance from historical SoC timeseries data, with live updates
 * merged in from `BatteryValuesUpdateV1` data-bus events.
 *
 * Battery cycles strongly correlate with day-of-week patterns (work-from-home
 * vs. office, weekend vs. weekday), so the algorithm uses a same-weekday
 * recency-weighted average over the configured history window (default 14 d),
 * with a fallback to all-weekday data when same-weekday samples are missing.
 *
 * @example
 * ```ts
 * const forecast = new BatteryForecast(app, 'battery-1', { source: EnyoSourceEnum.Device });
 * await forecast.initialize();
 * const result = forecast.getForecast();
 * ```
 */
export class BatteryForecast implements Forecaster {
    /** Battery patterns are highly weekday-cyclic; default to a 14-day window. */
    public static readonly DEFAULT_HISTORY_DAYS = 14;

    private readonly config: ResolvedForecastConfig;
    private readonly history: HistoricalBucket<BatteryHistoryValues>[] = [];
    private listenerId: string | undefined;
    private currentSlotMs: number | undefined;
    private currentSlotSocSum = 0;
    private currentSlotPowerSum = 0;
    private currentSlotSamples = 0;
    private initialized = false;
    private ratedCapacityWh: number | undefined;
    private readonly source: EnyoSourceEnum;

    /**
     * @param app - The energy-app SDK instance.
     * @param applianceId - Storage/battery appliance ID.
     * @param options.source - Source identifier used for outgoing forecast messages.
     * @param options.config - Optional config overrides; `historyDays` defaults to 14.
     */
    constructor(
        private readonly app: EnergyApp,
        public readonly applianceId: string,
        options: {source: EnyoSourceEnum; config?: BatteryForecastConfig},
    ) {
        this.config = resolveForecastConfig(
            {historyDays: BatteryForecast.DEFAULT_HISTORY_DAYS},
            options.config,
        );
        this.source = options.source;
        this.ratedCapacityWh = options.config?.ratedCapacityWh;
    }

    /**
     * Pulls the historical battery SoC and battery power timeseries, fills in
     * any missing rated capacity from appliance metadata, and starts listening
     * to live `BatteryValuesUpdateV1` events. Idempotent.
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;

        const now = Date.now();
        const startMs = now - this.config.historyDays * 24 * 60 * 60 * 1000;
        const startDateIso = new Date(startMs).toISOString();
        const endDateIso = new Date(now).toISOString();

        const [socResp, powerResp, appliance] = await Promise.all([
            this.app.useTimeseries().getBatterySocTimeseries({
                startDateIso,
                endDateIso,
                applianceIds: [this.applianceId],
                resolution: this.config.resolution,
            }),
            this.app.useTimeseries().getBatteryPowerTimeseries({
                startDateIso,
                endDateIso,
                applianceIds: [this.applianceId],
                resolution: this.config.resolution,
            }),
            this.ratedCapacityWh === undefined
                ? this.app.useAppliances().getById(this.applianceId).catch(() => null)
                : Promise.resolve(null),
        ]);

        if (this.ratedCapacityWh === undefined && appliance?.battery?.maxCapacityWh !== undefined) {
            this.ratedCapacityWh = appliance.battery.maxCapacityWh;
        }

        const powerByIso = new Map<string, number>();
        for (const entry of powerResp.entries) {
            powerByIso.set(entry.timestampIso, entry.batteryPowerW);
        }
        for (const entry of socResp.entries) {
            this.history.push({
                timestampIso: entry.timestampIso,
                values: {
                    socPercent: entry.batterySoC,
                    powerW: powerByIso.get(entry.timestampIso) ?? 0,
                    samples: 1,
                },
            });
        }

        this.listenerId = this.app.useDataBus().listenForMessages(
            [EnyoDataBusMessageEnum.BatteryValuesUpdateV1],
            (msg) => this.onBatteryValues(msg as EnyoDataBusBatteryValuesUpdateV1),
        );
    }

    /**
     * Returns the current forecast as an `EnyoDataBusBatteryForecastV1`-shaped
     * payload over the configured horizon. SoC is bounded to [0, 100].
     */
    public getForecast(): BatteryForecastResult {
        const now = Date.now();
        this.flushCurrentSlot(now);

        const parsed = parseHistory(this.history);
        const todayWeekday = new Date(now).getUTCDay();
        const sameWeekdayMap = buildSlotMap(parsed, (b) => b.weekday === todayWeekday);
        const fallbackMap = buildSlotMap(parsed);
        const isoIndex = buildIsoIndex(parsed, (v) => v.socPercent);

        const buckets: ForecastBucket<{socPercent: number; capacityWh: number}>[] = buildForecastSlots(
            now,
            this.config.horizonHours,
            this.config.resolution,
        ).map((slotMs) => {
            const key = formatSlotKey(slotMs);
            const slotBuckets = sameWeekdayMap.get(key) ?? fallbackMap.get(key);
            const avg = weightedAverageBySlot(slotBuckets, now, this.config.historyDays, {
                socPercent: (v) => v.socPercent,
            });
            const socPercent = clamp(avg.socPercent, 0, 100);
            return {
                timestampIso: new Date(slotMs).toISOString(),
                payload: {socPercent, capacityWh: this.computeCapacityWh(socPercent)},
            };
        });

        if (this.config.alignToRecentActuals) {
            alignForecastToRecentActuals(
                buckets,
                (iso) => isoIndex.get(iso),
                'socPercent',
                ['socPercent'],
            );
            for (const b of buckets) {
                b.payload.socPercent = clamp(b.payload.socPercent, 0, 100);
                b.payload.capacityWh = this.computeCapacityWh(b.payload.socPercent);
            }
        }

        const entries: EnyoBatteryForecastDataPoint[] = buckets.map((b) => ({
            timestampIso: b.timestampIso,
            socPercent: round2(b.payload.socPercent),
            capacityWh: Math.round(b.payload.capacityWh),
        }));

        const result: BatteryForecastResult = {
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

    private onBatteryValues(message: EnyoDataBusBatteryValuesUpdateV1): void {
        if (message.applianceId !== this.applianceId) return;
        const ts = new Date(message.timestampIso).getTime();
        const slotMs = roundDownTo15Minutes(ts);
        if (this.currentSlotMs === undefined || slotMs !== this.currentSlotMs) {
            this.flushCurrentSlot(ts);
            this.currentSlotMs = slotMs;
            this.currentSlotSocSum = 0;
            this.currentSlotPowerSum = 0;
            this.currentSlotSamples = 0;
        }
        this.currentSlotSocSum += message.data.batterySoC;
        if (typeof message.data.batteryPowerW === 'number') {
            this.currentSlotPowerSum += message.data.batteryPowerW;
        }
        this.currentSlotSamples += 1;
    }

    private flushCurrentSlot(nowMs: number): void {
        if (this.currentSlotMs === undefined || this.currentSlotSamples === 0) return;
        const avgSoc = this.currentSlotSocSum / this.currentSlotSamples;
        const avgPower = this.currentSlotPowerSum / this.currentSlotSamples;
        upsertLiveBucket(
            this.history,
            this.currentSlotMs,
            {socPercent: avgSoc, powerW: avgPower, samples: this.currentSlotSamples},
            (existing, incoming) => {
                const total = existing.samples + incoming.samples;
                return {
                    socPercent: (existing.socPercent * existing.samples + incoming.socPercent * incoming.samples) / total,
                    powerW: (existing.powerW * existing.samples + incoming.powerW * incoming.samples) / total,
                    samples: total,
                };
            },
        );
        if (this.currentSlotMs < roundDownTo15Minutes(nowMs)) {
            this.currentSlotMs = undefined;
            this.currentSlotSocSum = 0;
            this.currentSlotPowerSum = 0;
            this.currentSlotSamples = 0;
        }
        trimHistory(this.history, nowMs, this.config.historyDays * 24 * 60 * 60 * 1000 + FIFTEEN_MIN_MS);
    }

    private computeCapacityWh(socPercent: number): number {
        if (this.ratedCapacityWh === undefined) return 0;
        return (socPercent / 100) * this.ratedCapacityWh;
    }

    private publish(result: BatteryForecastResult): void {
        const message: EnyoDataBusBatteryForecastV1 = {
            id: globalThis.crypto.randomUUID(),
            type: 'message',
            message: EnyoDataBusMessageEnum.BatteryForecastV1,
            source: this.source,
            applianceId: this.applianceId,
            timestampIso: result.generatedAtIso,
            resolution: 'dynamic',
            data: result.data,
        };
        this.app.useDataBus().sendMessage([message]);
    }
}

function clamp(value: number, lo: number, hi: number): number {
    if (Number.isNaN(value)) return lo;
    return Math.min(hi, Math.max(lo, value));
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

function formatSlotKey(slotMs: number): string {
    const d = new Date(slotMs);
    return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes()
        .toString()
        .padStart(2, '0')}`;
}
