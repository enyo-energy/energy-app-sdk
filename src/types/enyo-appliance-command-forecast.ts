/**
 * Data interfaces for the
 * {@link EnergyAppApplianceEnergyManagerForecast} package — the API an
 * energy-manager app uses to declare the **command plans** it intends to
 * apply to its appliances over the upcoming horizon.
 *
 * Three appliance families are supported today:
 *  - **Chargers** — {@link ChargerForecast}: relative phase / power schedule.
 *  - **Batteries** — {@link BatteryCommandForecast}: either a relative
 *    direction / power schedule, or an explicit "auto" release that hands
 *    control back to the appliance's own logic. Mirrors the
 *    {@link EnyoDataBusSetStorageScheduleV1} command shape.
 *  - **Heatpumps** — {@link HeatpumpForecast}: a single relative schedule
 *    whose entries carry the forecasted DHW / room / buffer-tank
 *    temperatures together with planned DHW-boost / pre-heating /
 *    buffer-boost flags and the available-power announcement at each slot.
 *
 * Every forecast carries an optional {@link ApplianceForecastEstimatedSavings}
 * payload so consumers can rank competing plans.
 *
 * Publishing happens through
 * {@link EnergyAppApplianceEnergyManagerForecast.publishChargerForecast},
 * {@link EnergyAppApplianceEnergyManagerForecast.publishBatteryForecast},
 * and {@link EnergyAppApplianceEnergyManagerForecast.publishHeatpumpForecast}.
 * The transport / fan-out is an internal detail of the runtime SDK and
 * not exposed to apps.
 */

/**
 * Optional metadata describing the estimated savings of a forecasted
 * command plan compared to an unmanaged baseline.
 *
 * The unit of `costSavings` is the supplied {@link currency}. Negative
 * values indicate the plan is **more expensive** than the baseline (useful
 * to express the cost of a comfort-driven plan); positive values indicate
 * savings.
 */
export interface ApplianceForecastEstimatedSavings {
    /** Estimated cost savings over the horizon (positive = savings, negative = extra cost). */
    costSavings: number;
    /** ISO 4217 currency code matching {@link costSavings}. */
    currency: string;
    /** Optional estimated CO₂ savings, in grams. */
    co2SavingsGrams?: number;
    /** Optional estimated self-consumption increase, in Watt-hours. */
    selfConsumptionGainWh?: number;
}

/**
 * Time resolution of a forecast's relative schedule — the fixed spacing
 * between consecutive entries' `seconds` values.
 *
 * Consumers use this to know how finely a publisher is willing (or able)
 * to plan: a 1-minute resolution forecast describes near-term control
 * intent at high fidelity, a 15-minute resolution forecast covers a
 * longer horizon at market-slot granularity.
 *
 * - `OneMinute` — entries are spaced 60 seconds apart.
 * - `FifteenMinutes` — entries are spaced 900 seconds apart.
 */
export enum ApplianceForecastResolutionEnum {
    /** One-minute resolution (60s between entries). */
    OneMinute = '1min',
    /** Fifteen-minute resolution (900s between entries). */
    FifteenMinutes = '15min',
}

/**
 * Fields shared by every forecast carried through this package.
 */
export interface ApplianceForecastMetadata {
    /**
     * Time resolution of this forecast's relative schedule — the fixed
     * spacing between consecutive entries' `seconds` values. Only the
     * values declared on {@link ApplianceForecastResolutionEnum} (1min /
     * 15min) are allowed.
     */
    resolution: ApplianceForecastResolutionEnum;
    /**
     * Optional estimated-savings metadata associated with this forecast.
     */
    estimatedSavings?: ApplianceForecastEstimatedSavings;
}

// =============================================================================
// Charger
// =============================================================================

/**
 * One entry of a charger's relative phase / power schedule.
 *
 * Each entry is **relative** to the moment the receiving appliance
 * processes the forecast: the setpoint becomes active {@link seconds}
 * later and remains active until the next entry's `seconds` is reached.
 * The first entry of a schedule should therefore have `seconds = 0`.
 */
export interface ChargerForecastScheduleEntry {
    /**
     * Seconds from the moment the forecast becomes effective at which
     * this setpoint becomes active. `0` for the first entry; subsequent
     * entries must be strictly increasing.
     */
    seconds: number;
    /**
     * Target charging power in Watts. Always non-negative — `0` means
     * "pause charging at this point of the schedule".
     */
    powerW: number;
    /**
     * Optional number of grid phases the charger should use at this
     * setpoint (1, 2 or 3). Omit when the integration should choose, or
     * when phase switching is not supported.
     */
    numberOfPhases?: 1 | 2 | 3;
}

/**
 * Forecasted command plan for a charger appliance, published via
 * {@link EnergyAppApplianceEnergyManagerForecast.publishChargerForecast}.
 */
export interface ChargerForecast extends ApplianceForecastMetadata {
    /**
     * Relative schedule of `{seconds, powerW, numberOfPhases?}` setpoints
     * the publisher plans to apply, sorted ascending by `seconds` and
     * starting at `seconds = 0`. Must contain at least one entry.
     */
    relativeSchedule: ChargerForecastScheduleEntry[];
}

// =============================================================================
// Battery
// =============================================================================

/**
 * Top-level control mode carried by {@link BatteryCommandForecast}.
 *
 * Mirrors {@link EnyoStorageScheduleModeEnum} on the command-side
 * {@link EnyoDataBusSetStorageScheduleV1} message so a forecast can be
 * translated 1:1 into the command that will eventually be issued.
 *
 * - `Auto` declares that the publisher intends to leave the battery to
 *   its own logic over the upcoming horizon — no schedule is prescribed,
 *   so {@link BatteryCommandForecastScheduled.relativeSchedule} is absent.
 * - `Schedule` declares an explicit relative direction / power schedule
 *   the publisher intends to apply.
 */
export enum BatteryCommandForecastModeEnum {
    /** Hand control back to the appliance's own logic — no schedule prescribed. */
    Auto = 'auto',
    /** Follow the relative schedule carried by the forecast. */
    Schedule = 'schedule',
}

/**
 * Direction of energy flow for one entry of a battery command-forecast
 * relative schedule.
 *
 * Direction is encoded as an explicit enum (rather than a signed
 * `powerW`) to mirror {@link EnyoStorageScheduleDirectionEnum} and keep
 * each entry unambiguous on the wire: `powerW` is always non-negative,
 * and consumers never have to disambiguate `0` from "direction-of-zero"
 * or interpret sign conventions per integration.
 */
export enum BatteryCommandForecastDirectionEnum {
    /** Power should flow from PV / home / grid into the battery (charging). */
    Charge = 'charge',
    /** Power should flow from the battery into the home / grid (discharging). */
    Discharge = 'discharge',
}

/**
 * One entry of a battery's relative direction / power schedule.
 *
 * The setpoint becomes active {@link seconds} after the forecast becomes
 * effective and remains active until the next entry's `seconds` is
 * reached.
 */
export interface BatteryCommandForecastScheduleEntry {
    /**
     * Seconds from the moment the forecast becomes effective at which
     * this setpoint becomes active. `0` for the first entry; subsequent
     * entries must be strictly increasing.
     */
    seconds: number;
    /** Direction of energy flow for this setpoint. */
    direction: BatteryCommandForecastDirectionEnum;
    /**
     * Target power in Watts. Always non-negative — direction is carried
     * by {@link direction}, never by sign. A `powerW` of `0` means "hold
     * at zero in the named direction" (effectively idle until the next
     * entry).
     */
    powerW: number;
}

/**
 * Forecast variant that declares the publisher intends to release the
 * battery back to its own logic over the upcoming horizon. No schedule
 * is prescribed.
 */
export interface BatteryCommandForecastAuto extends ApplianceForecastMetadata {
    /** Discriminator — set to {@link BatteryCommandForecastModeEnum.Auto}. */
    mode: BatteryCommandForecastModeEnum.Auto;
}

/**
 * Forecast variant that declares an explicit relative schedule the
 * publisher intends to apply.
 */
export interface BatteryCommandForecastScheduled extends ApplianceForecastMetadata {
    /** Discriminator — set to {@link BatteryCommandForecastModeEnum.Schedule}. */
    mode: BatteryCommandForecastModeEnum.Schedule;
    /**
     * Relative schedule of `{seconds, direction, powerW}` setpoints the
     * publisher plans to apply, sorted ascending by `seconds` and
     * starting at `seconds = 0`. Must contain at least one entry.
     */
    relativeSchedule: BatteryCommandForecastScheduleEntry[];
}

/**
 * Forecasted command plan for a battery / storage appliance, published
 * via
 * {@link EnergyAppApplianceEnergyManagerForecast.publishBatteryForecast}.
 *
 * The shape is a discriminated union on {@link BatteryCommandForecastModeEnum}
 * that mirrors {@link EnyoDataBusSetStorageScheduleV1} on the
 * command-side: either the publisher prescribes a relative schedule
 * (`mode = 'schedule'`) or it declares that no schedule will be
 * prescribed (`mode = 'auto'`).
 *
 * Named `BatteryCommandForecast` (rather than `BatteryForecast`) to make
 * the distinction with the existing
 * {@link ../implementations/forecasts/battery-forecast.BatteryForecast}
 * class explicit: this type describes the **control plan** an app intends
 * to issue; that class produces a predicted **state-of-charge trajectory**
 * from history.
 */
export type BatteryCommandForecast =
    | BatteryCommandForecastAuto
    | BatteryCommandForecastScheduled;

// =============================================================================
// Heatpump
// =============================================================================

/**
 * One entry of a heatpump's unified relative schedule.
 *
 * The entry packs every per-slot piece of information the energy-manager
 * forecast carries for a heatpump: the forecasted DHW / room /
 * buffer-tank temperatures, the planned boost / pre-heating flags, and
 * the available-power announcement. The setpoint becomes active
 * {@link seconds} after the forecast becomes effective and stays active
 * until the next entry's `seconds` is reached.
 *
 * Every field other than {@link seconds} is optional — an entry may
 * describe only temperatures, only flags, only power, or any
 * combination. A field that is omitted carries no information for that
 * slot (it is **not** "set to zero / false"); the previous entry's
 * value should be treated as still in effect.
 */
export interface HeatpumpForecastScheduleEntry {
    /**
     * Seconds from the moment the forecast becomes effective at which
     * this entry becomes active. `0` for the first entry; subsequent
     * entries must be strictly increasing.
     */
    seconds: number;
    /**
     * Planned available electrical power in Watts the energy manager
     * intends to make available to the heatpump during this slot. The
     * heatpump is free to consume up to this value — and free to
     * consume less if it cannot use it all. Non-negative when present.
     */
    powerW?: number;
    /**
     * Forecasted DHW (domestic-hot-water) tank temperature in °C at this
     * slot. Plausible range: [-50, 150].
     */
    dhwTemperatureC?: number;
    /**
     * Forecasted room (heating-circuit) temperature in °C at this slot.
     * Plausible range: [-50, 150].
     */
    roomTemperatureC?: number;
    /**
     * Forecasted buffer-tank temperature in °C at this slot. Plausible
     * range: [-50, 150].
     */
    bufferTankTemperatureC?: number;
    /**
     * Whether a DHW boost is planned to be active during this slot —
     * `true` while the publisher intends to drive the DHW tank up,
     * `false` (or omitted) otherwise.
     */
    dhwBoostActive?: boolean;
    /**
     * Whether a room pre-heating is planned to be active during this
     * slot — `true` while the publisher intends to pre-heat the
     * heating-circuit / room, `false` (or omitted) otherwise.
     */
    roomPreHeatingActive?: boolean;
    /**
     * Whether a buffer-tank boost is planned to be active during this
     * slot — `true` while the publisher intends to drive the buffer
     * tank up, `false` (or omitted) otherwise.
     */
    bufferTankBoostActive?: boolean;
}

/**
 * Forecasted command plan for a heatpump appliance, published via
 * {@link EnergyAppApplianceEnergyManagerForecast.publishHeatpumpForecast}.
 *
 * A heatpump forecast is a **single** relative schedule whose entries
 * carry every per-slot piece of information at once (forecasted
 * temperatures, boost / pre-heating flags, available-power
 * announcement). One entry per slot keeps the temperature trajectories
 * and the boost decisions aligned by construction — no need to
 * reconcile separate window lists with separate timestamp axes.
 *
 * The schedule must be sorted ascending by `seconds` and start at
 * `seconds = 0` so the appliance has an authoritative "right now"
 * entry.
 */
export interface HeatpumpForecast extends ApplianceForecastMetadata {
    /**
     * Relative schedule of forecast entries. Sorted ascending by
     * `seconds`, starting at `seconds = 0`. Must contain at least one
     * entry.
     */
    relativeSchedule: HeatpumpForecastScheduleEntry[];
}
