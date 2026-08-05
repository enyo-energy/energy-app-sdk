import {EnergyApp} from '../energy-app.js';
import {EnyoSourceEnum} from '../types/enyo-source.enum.js';
import {ForecastConfig} from '../implementations/forecasts/forecast-types.js';
import {PvProductionForecast} from '../implementations/forecasts/pv-production-forecast.js';
import {
    BatteryForecast,
    BatteryForecastConfig,
} from '../implementations/forecasts/battery-forecast.js';
import {HomeConsumptionForecast} from '../implementations/forecasts/home-consumption-forecast.js';
import {EvChargingForecast} from '../implementations/forecasts/ev-charging-forecast.js';
import {HeatpumpConsumptionForecast} from '../implementations/forecasts/heatpump-consumption-forecast.js';
import {
    HeatpumpDhwTemperatureForecast,
    HeatpumpDhwTemperatureForecastConfig,
} from '../implementations/forecasts/heatpump-dhw-temperature-forecast.js';
import {AirConditioningConsumptionForecast} from '../implementations/forecasts/air-conditioning-consumption-forecast.js';
import {
    AirConditioningRoomTemperatureForecast,
    AirConditioningRoomTemperatureForecastConfig,
} from '../implementations/forecasts/air-conditioning-room-temperature-forecast.js';

/**
 * Constructor options for {@link EnergyManagerEnergyApp}.
 */
export interface EnergyManagerEnergyAppOptions {
    /** Source identifier used when emitting forecast messages on the data bus. */
    source: EnyoSourceEnum;
    /**
     * Default forecast configuration applied to every forecaster the manager
     * creates. Per-forecast overrides supplied to the `getXxxForecast()`
     * methods take precedence over these defaults.
     */
    forecastConfig?: ForecastConfig;
    /**
     * When `true` (default), {@link EnergyManagerEnergyApp.stop} is registered
     * against {@link EnergyApp.onShutdown} so all forecasters tear down on
     * process exit.
     */
    autoStopOnShutdown?: boolean;
}

/**
 * Energy-manager-side energy app.
 *
 * Where the appliance-oriented `*IntegrationEnergyApp` classes acknowledge
 * commands, an energy manager primarily *produces* forecasts that other
 * packages consume. This class is the orchestrator for the appliance-category
 * forecasters defined in {@link ../implementations/forecasts/}: it lazily
 * creates a forecaster the first time the implementer asks for it, fetches
 * the appropriate history via `useTimeseries()`, registers data-bus listeners
 * to keep it fresh, and (by default) publishes refreshed forecasts on the bus.
 *
 * Forecaster instances are cached by appliance id so repeated calls return
 * the same object; {@link EnergyManagerEnergyApp.stop} disposes every cached
 * forecaster.
 *
 * @example
 * ```ts
 * const manager = new EnergyManagerEnergyApp({ source: EnyoSourceEnum.Device });
 * const pv = await manager.getPvProductionForecast('inverter-1');
 * console.log(pv.getForecast().data.entries);
 * ```
 */
export class EnergyManagerEnergyApp extends EnergyApp {
    protected readonly source: EnyoSourceEnum;
    private readonly defaultConfig: ForecastConfig | undefined;

    private readonly pvForecasts = new Map<string, PvProductionForecast>();
    private readonly batteryForecasts = new Map<string, BatteryForecast>();
    private readonly evChargingForecasts = new Map<string, EvChargingForecast>();
    private readonly heatpumpConsumptionForecasts = new Map<string, HeatpumpConsumptionForecast>();
    private readonly heatpumpDhwTemperatureForecasts = new Map<string, HeatpumpDhwTemperatureForecast>();
    private readonly airConditioningConsumptionForecasts = new Map<string, AirConditioningConsumptionForecast>();
    private readonly airConditioningRoomTemperatureForecasts =
        new Map<string, AirConditioningRoomTemperatureForecast>();
    private homeConsumptionForecast: HomeConsumptionForecast | undefined;

    /**
     * @param options - Configuration. `source` is required; `autoStopOnShutdown`
     *   defaults to `true`; `forecastConfig` is merged with per-call overrides.
     */
    constructor(options: EnergyManagerEnergyAppOptions) {
        super();
        this.source = options.source;
        this.defaultConfig = options.forecastConfig;

        if (options.autoStopOnShutdown !== false) {
            this.onShutdown(() => this.stop());
        }
    }

    /**
     * Returns (and lazily registers) a PV-production forecaster for the given
     * inverter. Subsequent calls with the same `applianceId` return the cached
     * instance; the `config` argument is honored only on the first call.
     *
     * @param applianceId - Inverter appliance ID.
     * @param config - Optional config overrides (merged with the manager-level default).
     */
    public async getPvProductionForecast(
        applianceId: string,
        config?: ForecastConfig,
    ): Promise<PvProductionForecast> {
        const existing = this.pvForecasts.get(applianceId);
        if (existing) return existing;
        const forecast = new PvProductionForecast(this, applianceId, {
            source: this.source,
            config: this.mergeConfig(config),
        });
        await forecast.initialize();
        this.pvForecasts.set(applianceId, forecast);
        return forecast;
    }

    /**
     * Returns (and lazily registers) a battery forecaster for the given
     * battery appliance.
     *
     * @param applianceId - Storage/battery appliance ID.
     * @param config - Optional config overrides (merged with the manager-level default).
     */
    public async getBatteryForecast(
        applianceId: string,
        config?: BatteryForecastConfig,
    ): Promise<BatteryForecast> {
        const existing = this.batteryForecasts.get(applianceId);
        if (existing) return existing;
        const forecast = new BatteryForecast(this, applianceId, {
            source: this.source,
            config: this.mergeBatteryConfig(config),
        });
        await forecast.initialize();
        this.batteryForecasts.set(applianceId, forecast);
        return forecast;
    }

    /**
     * Returns (and lazily registers) the system-wide home-consumption
     * forecaster. Home consumption is always system-wide (no per-appliance
     * variant), so a single instance is cached for the manager.
     *
     * @param config - Optional config overrides (merged with the manager-level default).
     */
    public async getHomeConsumptionForecast(
        config?: ForecastConfig,
    ): Promise<HomeConsumptionForecast> {
        if (this.homeConsumptionForecast) return this.homeConsumptionForecast;
        const forecast = new HomeConsumptionForecast(this, {
            source: this.source,
            config: this.mergeConfig(config),
        });
        await forecast.initialize();
        this.homeConsumptionForecast = forecast;
        return forecast;
    }

    /**
     * Returns (and lazily registers) an EV-charging forecaster for the given
     * charger appliance.
     *
     * @param applianceId - Charger appliance ID.
     * @param config - Optional config overrides (merged with the manager-level default).
     */
    public async getEvChargingForecast(
        applianceId: string,
        config?: ForecastConfig,
    ): Promise<EvChargingForecast> {
        const existing = this.evChargingForecasts.get(applianceId);
        if (existing) return existing;
        const forecast = new EvChargingForecast(this, applianceId, {
            source: this.source,
            config: this.mergeConfig(config),
        });
        await forecast.initialize();
        this.evChargingForecasts.set(applianceId, forecast);
        return forecast;
    }

    /**
     * Returns (and lazily registers) a heatpump electrical-consumption
     * forecaster.
     *
     * @param applianceId - Heatpump appliance ID.
     * @param config - Optional config overrides (merged with the manager-level default).
     */
    public async getHeatpumpConsumptionForecast(
        applianceId: string,
        config?: ForecastConfig,
    ): Promise<HeatpumpConsumptionForecast> {
        const existing = this.heatpumpConsumptionForecasts.get(applianceId);
        if (existing) return existing;
        const forecast = new HeatpumpConsumptionForecast(this, applianceId, {
            source: this.source,
            config: this.mergeConfig(config),
        });
        await forecast.initialize();
        this.heatpumpConsumptionForecasts.set(applianceId, forecast);
        return forecast;
    }

    /**
     * Returns (and lazily registers) a heatpump DHW-temperature forecaster.
     *
     * @param applianceId - Heatpump appliance ID.
     * @param config - Optional config overrides (merged with the manager-level default).
     */
    public async getHeatpumpDhwTemperatureForecast(
        applianceId: string,
        config?: HeatpumpDhwTemperatureForecastConfig,
    ): Promise<HeatpumpDhwTemperatureForecast> {
        const existing = this.heatpumpDhwTemperatureForecasts.get(applianceId);
        if (existing) return existing;
        const forecast = new HeatpumpDhwTemperatureForecast(this, applianceId, {
            source: this.source,
            config: this.mergeDhwConfig(config),
        });
        await forecast.initialize();
        this.heatpumpDhwTemperatureForecasts.set(applianceId, forecast);
        return forecast;
    }

    /**
     * Returns (and lazily registers) an air conditioning electrical-consumption
     * forecaster.
     *
     * @param applianceId - Air conditioning appliance ID.
     * @param config - Optional config overrides (merged with the manager-level default).
     */
    public async getAirConditioningConsumptionForecast(
        applianceId: string,
        config?: ForecastConfig,
    ): Promise<AirConditioningConsumptionForecast> {
        const existing = this.airConditioningConsumptionForecasts.get(applianceId);
        if (existing) return existing;
        const forecast = new AirConditioningConsumptionForecast(this, applianceId, {
            source: this.source,
            config: this.mergeConfig(config),
        });
        await forecast.initialize();
        this.airConditioningConsumptionForecasts.set(applianceId, forecast);
        return forecast;
    }

    /**
     * Returns (and lazily registers) an air conditioning room-temperature
     * forecaster.
     *
     * @param applianceId - Air conditioning appliance ID.
     * @param config - Optional config overrides (merged with the manager-level default).
     */
    public async getAirConditioningRoomTemperatureForecast(
        applianceId: string,
        config?: AirConditioningRoomTemperatureForecastConfig,
    ): Promise<AirConditioningRoomTemperatureForecast> {
        const existing = this.airConditioningRoomTemperatureForecasts.get(applianceId);
        if (existing) return existing;
        const forecast = new AirConditioningRoomTemperatureForecast(this, applianceId, {
            source: this.source,
            config: this.mergeRoomConfig(config),
        });
        await forecast.initialize();
        this.airConditioningRoomTemperatureForecasts.set(applianceId, forecast);
        return forecast;
    }

    /**
     * Disposes every registered forecaster, detaching data-bus listeners and
     * freeing in-memory history. Safe to call multiple times.
     */
    public stop(): void {
        for (const f of this.pvForecasts.values()) f.dispose();
        for (const f of this.batteryForecasts.values()) f.dispose();
        for (const f of this.evChargingForecasts.values()) f.dispose();
        for (const f of this.heatpumpConsumptionForecasts.values()) f.dispose();
        for (const f of this.heatpumpDhwTemperatureForecasts.values()) f.dispose();
        for (const f of this.airConditioningConsumptionForecasts.values()) f.dispose();
        for (const f of this.airConditioningRoomTemperatureForecasts.values()) f.dispose();
        this.homeConsumptionForecast?.dispose();

        this.pvForecasts.clear();
        this.batteryForecasts.clear();
        this.evChargingForecasts.clear();
        this.heatpumpConsumptionForecasts.clear();
        this.heatpumpDhwTemperatureForecasts.clear();
        this.airConditioningConsumptionForecasts.clear();
        this.airConditioningRoomTemperatureForecasts.clear();
        this.homeConsumptionForecast = undefined;
    }

    private mergeConfig(override: ForecastConfig | undefined): ForecastConfig | undefined {
        if (!this.defaultConfig && !override) return undefined;
        return {...(this.defaultConfig ?? {}), ...(override ?? {})};
    }

    private mergeBatteryConfig(
        override: BatteryForecastConfig | undefined,
    ): BatteryForecastConfig | undefined {
        if (!this.defaultConfig && !override) return undefined;
        return {...(this.defaultConfig ?? {}), ...(override ?? {})};
    }

    private mergeDhwConfig(
        override: HeatpumpDhwTemperatureForecastConfig | undefined,
    ): HeatpumpDhwTemperatureForecastConfig | undefined {
        if (!this.defaultConfig && !override) return undefined;
        return {...(this.defaultConfig ?? {}), ...(override ?? {})};
    }

    private mergeRoomConfig(
        override: AirConditioningRoomTemperatureForecastConfig | undefined,
    ): AirConditioningRoomTemperatureForecastConfig | undefined {
        if (!this.defaultConfig && !override) return undefined;
        return {...(this.defaultConfig ?? {}), ...(override ?? {})};
    }
}
