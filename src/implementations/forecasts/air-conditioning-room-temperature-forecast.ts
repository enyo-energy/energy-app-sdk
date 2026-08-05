import {EnergyApp} from '../../energy-app.js';
import {
    EnyoAirConditioningRoomTemperatureForecastDataPoint,
    EnyoDataBusAirConditioningRoomTemperatureForecastV1,
    EnyoDataBusAirConditioningTemperaturesV1,
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
 * Per-slot room-temperature history payload.
 */
interface RoomTemperatureHistoryValues {
    /** Average room temperature in degrees Celsius during the slot. */
    temperatureC: number;
    /** Number of live samples that contributed to `temperatureC`. */
    samples: number;
}

/**
 * Forecast result returned by
 * {@link AirConditioningRoomTemperatureForecast.getForecast}, shaped to match
 * `EnyoDataBusAirConditioningRoomTemperatureForecastV1.data`.
 */
export type AirConditioningRoomTemperatureForecastResult =
    BaseForecast<EnyoDataBusAirConditioningRoomTemperatureForecastV1['data']>;

/**
 * Configuration specific to {@link AirConditioningRoomTemperatureForecast}.
 */
export interface AirConditioningRoomTemperatureForecastConfig extends ForecastConfig {
    /**
     * Optional zero-based room index to forecast on. If omitted, the forecaster
     * averages across all rooms reported by the appliance per timestamp.
     */
    roomIndex?: number;
}

/**
 * Builds a 24-hour room temperature forecast for a single air conditioning
 * appliance from historical air conditioning temperature timeseries data, with
 * live updates merged in from `AirConditioningTemperaturesUpdateV1` data-bus
 * events.
 *
 * Room temperature follows the household's daily occupancy and setpoint
 * rhythm, which is strongly weekday-cyclic, so the algorithm uses a
 * same-weekday recency-weighted average over the configured history window
 * (default 7 d), with an all-weekday fallback. A single room can be selected
 * via {@link AirConditioningRoomTemperatureForecastConfig.roomIndex};
 * otherwise all reported rooms are averaged per timestamp.
 *
 * The forecast is the primary input for planning AC flexibility — for example
 * pre-cooling on forecasted PV surplus — since it says where the room
 * temperature is heading if nothing changes.
 *
 * @example
 * ```ts
 * const forecast = new AirConditioningRoomTemperatureForecast(app, 'ac-1', {
 *     source: EnyoSourceEnum.Device,
 *     config: { roomIndex: 0 },
 * });
 * await forecast.initialize();
 * const result = forecast.getForecast();
 * ```
 */
export class AirConditioningRoomTemperatureForecast implements Forecaster {
    /** Default history window. Room temperature cycles are weekday-cyclic. */
    public static readonly DEFAULT_HISTORY_DAYS = 7;

    private readonly config: ResolvedForecastConfig;
    private readonly history: HistoricalBucket<RoomTemperatureHistoryValues>[] = [];
    private readonly roomIndex: number | undefined;
    private listenerId: string | undefined;
    private currentSlotMs: number | undefined;
    private currentSlotTempSum = 0;
    private currentSlotSamples = 0;
    private initialized = false;
    private readonly source: EnyoSourceEnum;

    /**
     * @param app - The energy-app SDK instance.
     * @param applianceId - Air conditioning appliance ID.
     * @param options.source - Source identifier used for outgoing forecast messages.
     * @param options.config - Optional config overrides; `historyDays` defaults to 7.
     */
    constructor(
        private readonly app: EnergyApp,
        public readonly applianceId: string,
        options: {source: EnyoSourceEnum; config?: AirConditioningRoomTemperatureForecastConfig},
    ) {
        this.config = resolveForecastConfig(
            {historyDays: AirConditioningRoomTemperatureForecast.DEFAULT_HISTORY_DAYS},
            options.config,
        );
        this.source = options.source;
        this.roomIndex = options.config?.roomIndex;
    }

    /**
     * Pulls the air conditioning temperature timeseries history and starts
     * listening to live `AirConditioningTemperaturesUpdateV1` events.
     * Idempotent.
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;

        const now = Date.now();
        const startMs = now - this.config.historyDays * 24 * 60 * 60 * 1000;
        const response = await this.app.useTimeseries().getAirConditioningTemperatureTimeseries({
            startDateIso: new Date(startMs).toISOString(),
            endDateIso: new Date(now).toISOString(),
            applianceIds: [this.applianceId],
            resolution: this.config.resolution,
        });
        for (const entry of response.entries) {
            const temperature = this.extractHistoricalTemperature(entry.rooms);
            if (temperature === undefined) continue;
            this.history.push({
                timestampIso: entry.timestampIso,
                values: {temperatureC: temperature, samples: 1},
            });
        }

        this.listenerId = this.app.useDataBus().listenForMessages(
            [EnyoDataBusMessageEnum.AirConditioningTemperaturesUpdateV1],
            (msg) => this.onAirConditioningTemperatures(msg as EnyoDataBusAirConditioningTemperaturesV1),
        );
    }

    /**
     * Returns the current forecast as an
     * `EnyoDataBusAirConditioningRoomTemperatureForecastV1`-shaped payload over
     * the configured horizon.
     */
    public getForecast(): AirConditioningRoomTemperatureForecastResult {
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

        const entries: EnyoAirConditioningRoomTemperatureForecastDataPoint[] = buckets.map((b) => ({
            timestampIso: b.timestampIso,
            temperatureC: round1(b.payload.temperatureC),
        }));

        const result: AirConditioningRoomTemperatureForecastResult = {
            generatedAtIso: new Date(now).toISOString(),
            data: {
                resolution: this.config.resolution,
                ...(this.roomIndex !== undefined ? {roomIndex: this.roomIndex} : {}),
                entries,
            },
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

    private onAirConditioningTemperatures(message: EnyoDataBusAirConditioningTemperaturesV1): void {
        if (message.applianceId !== this.applianceId) return;
        const rooms = message.data.rooms;
        if (!rooms || rooms.length === 0) return;
        const temperature = this.extractLiveTemperature(rooms);
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

    private extractHistoricalTemperature(
        rooms: {index: number; averageTemperatureC: number}[] | undefined,
    ): number | undefined {
        if (!rooms || rooms.length === 0) return undefined;
        const matching = this.roomIndex !== undefined
            ? rooms.filter((r) => r.index === this.roomIndex)
            : rooms;
        if (matching.length === 0) return undefined;
        const sum = matching.reduce((acc, r) => acc + r.averageTemperatureC, 0);
        return sum / matching.length;
    }

    private extractLiveTemperature(
        rooms: {index: number; temperatureC: number}[],
    ): number | undefined {
        const matching = this.roomIndex !== undefined
            ? rooms.filter((r) => r.index === this.roomIndex)
            : rooms;
        if (matching.length === 0) return undefined;
        const sum = matching.reduce((acc, r) => acc + r.temperatureC, 0);
        return sum / matching.length;
    }

    private publish(result: AirConditioningRoomTemperatureForecastResult): void {
        const message: EnyoDataBusAirConditioningRoomTemperatureForecastV1 = {
            id: globalThis.crypto.randomUUID(),
            type: 'message',
            message: EnyoDataBusMessageEnum.AirConditioningRoomTemperatureForecastV1,
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
