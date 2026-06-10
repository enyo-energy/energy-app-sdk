import {
    BatteryCommandForecast,
    ChargerForecast,
    HeatpumpForecast,
} from '../types/enyo-appliance-command-forecast.js';

/**
 * SDK accessor for the **Appliance Energy-Manager Forecast** package.
 *
 * The energy manager (or any orchestrator app) uses this package to
 * declare the **command plans** it intends to apply to its appliances
 * over the upcoming horizon — *not* what it predicts the appliance will
 * do on its own. Three appliance families are supported today:
 *
 *  - **Chargers** — phase / power schedule
 *    ({@link ChargerForecast}).
 *  - **Batteries** — either a relative direction / power schedule, or an
 *    explicit "auto" release that hands control back to the appliance's
 *    own logic ({@link BatteryCommandForecast}).
 *  - **Heatpumps** — a single unified relative schedule whose entries
 *    carry the forecasted DHW / room / buffer-tank temperatures together
 *    with planned boost / pre-heating flags and the available-power
 *    announcement at each slot ({@link HeatpumpForecast}).
 *
 * Every forecast optionally carries
 * {@link ApplianceForecastEstimatedSavings} so downstream consumers can
 * rank competing plans by cost / CO₂ / self-consumption gain.
 *
 * **Transport is internal:** how the runtime fans the forecast out to
 * subscribers (data bus, RPC, …) is an implementation detail of the SDK
 * runtime and not part of this contract.
 *
 * **Required permission:** `EnergyManager` — the publisher must own
 * dispatch authority for the appliance whose forecast it announces.
 *
 * @example
 * ```ts
 * const forecasts = energyApp.useApplianceEnergyManagerForecast();
 *
 * await forecasts.publishChargerForecast('charger-1', {
 *     relativeSchedule: [
 *         { seconds: 0,    powerW: 11_000, numberOfPhases: 3 },
 *         { seconds: 1800, powerW:  3_700, numberOfPhases: 1 },
 *     ],
 *     estimatedSavings: { costSavings: 0.42, currency: 'EUR' },
 * });
 * ```
 */
export interface EnergyAppApplianceEnergyManagerForecast {
    /**
     * Publishes the command-plan forecast for a charger.
     *
     * Validates {@link forecast} against the invariants documented on
     * {@link ChargerForecast} and rejects with
     * {@link ApplianceCommandForecastValidationError} on any violation
     * before contacting the runtime. On success the runtime fans the
     * forecast out to subscribers; transport is an internal detail.
     *
     * @param applianceId - The charger appliance the forecast applies to.
     * @param forecast - The command-plan forecast and its metadata.
     * @throws {ApplianceCommandForecastValidationError} If the forecast
     *   is malformed.
     */
    publishChargerForecast(applianceId: string, forecast: ChargerForecast): Promise<void>;

    /**
     * Publishes the command-plan forecast for a battery / storage system.
     *
     * Validates {@link forecast} against the invariants documented on
     * {@link BatteryCommandForecast}.
     *
     * @param applianceId - The battery appliance the forecast applies to.
     * @param forecast - The command-plan forecast and its metadata.
     * @throws {ApplianceCommandForecastValidationError} If the forecast
     *   is malformed.
     */
    publishBatteryForecast(
        applianceId: string,
        forecast: BatteryCommandForecast,
    ): Promise<void>;

    /**
     * Publishes the command-plan forecast for a heatpump. The forecast
     * carries a single unified relative schedule whose entries pack the
     * forecasted DHW / room / buffer-tank temperatures together with the
     * planned DHW-boost / room pre-heating / buffer-boost flags and the
     * available-power announcement at each slot.
     *
     * Validates {@link forecast} against the invariants documented on
     * {@link HeatpumpForecast}.
     *
     * @param applianceId - The heatpump appliance the forecast applies to.
     * @param forecast - The command-plan forecast and its metadata.
     * @throws {ApplianceCommandForecastValidationError} If the forecast
     *   is malformed.
     */
    publishHeatpumpForecast(
        applianceId: string,
        forecast: HeatpumpForecast,
    ): Promise<void>;
}
