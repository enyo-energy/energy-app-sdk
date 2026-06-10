import {EnergyAppApplianceTypeEnum} from "../energy-app-appliance-type.enum.js";
import {EnyoApplianceTypeEnum} from "./enyo-appliance.js";
import {EnyoCurrencyEnum} from "./enyo-currency.js";
import {EnyoChargeModeEnum, EnyoDataBusMessageEnum} from "./enyo-data-bus-value.js";
import {EnyoAirConditioningApplianceModeEnum} from "./enyo-air-conditioning-appliance.js";

// ─── Price table types ────────────────────────────────────

/** Energy source type for price table entries. */
export enum EnyoDiagnosticsPriceTableSourceEnum {
    Pv = "pv",
    Battery = "battery",
    Grid = "grid",
}

/** A single entry in a forecast bucket's price table. */
export interface EnyoDiagnosticsPriceTableEntry {
    /** The energy source type. */
    type: EnyoDiagnosticsPriceTableSourceEnum;
    /** Price per kilowatt-hour for this source. */
    pricePerKwh: number;
    /** Available power in Watts from this source. */
    availablePowerW: number;
}

// ─── Decision & state types ────────────────────────────────

/** Domestic hot water tank state. */
export type DhwState = "charging" | "discharging" | "idle";

/** Heating circuit state. */
export type HeatingState = "active" | "idle";

export interface EnyoDiagnosticsForecastInverterAppliance {
    type: EnyoApplianceTypeEnum.Inverter;
    applianceId: string;
    values: {
        powerW: number;
        lastUpdateIso: string;
    };
}

export interface EnyoDiagnosticsForecastStorageAppliance {
    type: EnyoApplianceTypeEnum.Storage;
    applianceId: string;
    values: {
        /** < 0 discharge, > 0 charging*/
        powerW: number;
        socPercent: number;
    };
}

export interface EnyoDiagnosticsForecastChargerAppliance {
    applianceId: string;
    type: EnyoApplianceTypeEnum.Charger;
    values: {
        chargingPowerW?: number;
        isCharging: boolean;
        chargeMode?: EnyoChargeModeEnum;
    };
}

export interface EnyoDiagnosticsForecastHeatpumpAppliance {
    type: EnyoApplianceTypeEnum.Heatpump;
    applianceId: string;
    values: {
        powerW?: number;
        flowTemperatureC?: number;
        roomTemperatureC?: number;
        dhwTemperatureC?: number;
        bufferTankTemperatureC?: number;
    };
}

/** Per-appliance forecast data for an air conditioning unit. */
export interface EnyoDiagnosticsForecastAirConditioningAppliance {
    type: EnyoApplianceTypeEnum.AirConditioning;
    applianceId: string;
    values: {
        /** Current power consumption in Watts. */
        powerW?: number;
        /** Current operating mode of the air conditioning unit. */
        operationMode?: EnyoAirConditioningApplianceModeEnum;
    };
}

export type EnyoDiagnosticsForecastAppliance = EnyoDiagnosticsForecastInverterAppliance
    | EnyoDiagnosticsForecastStorageAppliance
    | EnyoDiagnosticsForecastChargerAppliance
    | EnyoDiagnosticsForecastHeatpumpAppliance
    | EnyoDiagnosticsForecastAirConditioningAppliance;

/** Aggregated current state of the entire energy system. */
export interface EnyoDiagnosticsCurrentState {
    // System-level aggregates
    totalPvPowerW: number | undefined;
    totalBatteryPowerW: number | undefined;
    totalBatterySoCPercent: number | undefined;
    totalGridPowerW: number | undefined;
    totalHeatpumpPowerW: number | undefined;
    totalAirConditioningPowerW: number | undefined;
    totalChargerPowerW: number | undefined;
    // Per-appliance current state
    appliances: EnyoDiagnosticsCurrentStateAppliance[];
}

export type EnyoDiagnosticsCurrentStateAppliance =
    | EnyoDiagnosticsCurrentStateBatteryAppliance
    | EnyoDiagnosticsCurrentStateInverterAppliance
    | EnyoDiagnosticsCurrentStateHeatpumpAppliance
    | EnyoDiagnosticsCurrentStateChargerAppliance
    | EnyoDiagnosticsCurrentStateAirConditioningAppliance;

export interface EnyoDiagnosticsCurrentStateInverterAppliance {
    type: EnyoApplianceTypeEnum.Inverter;
    applianceId: string;
    values: {
        powerW: number;
        lastUpdateIso: string;
    };
}

export interface EnyoDiagnosticsCurrentStateBatteryAppliance {
    type: EnyoApplianceTypeEnum.Storage;
    applianceId: string;
    values: {
        /** < 0 discharge, > 0 charging*/
        powerW?: number;
        socPercent: number;
        capacityWh?: number;
    };
}

export interface EnyoDiagnosticsCurrentStateHeatpumpAppliance {
    type: EnyoApplianceTypeEnum.Heatpump;
    applianceId: string;
    values: {
        powerW?: number;
        roomTemperatureC?: number;
        dhwTemperatureC?: number;
        bufferTankTemperatureC?: number;
    };
}

export interface EnyoDiagnosticsCurrentStateChargerAppliance {
    applianceId: string;
    type: EnyoApplianceTypeEnum.Charger;
    values: {
        evConnected: boolean;
        requiredKwhToCharge: number | undefined;
        targetCompletionIso?: string;
        chargingPowerW: number | undefined;
        chargeMode?: EnyoChargeModeEnum;
    };
}

/** Current state snapshot for an air conditioning appliance. */
export interface EnyoDiagnosticsCurrentStateAirConditioningAppliance {
    type: EnyoApplianceTypeEnum.AirConditioning;
    applianceId: string;
    values: {
        /** Current power consumption in Watts. */
        powerW?: number;
        /** Current operating mode of the air conditioning unit. */
        operationMode?: EnyoAirConditioningApplianceModeEnum;
        /** Current room temperature in Celsius. */
        roomTemperatureC?: number;
        /** Target temperature in Celsius. */
        targetTemperatureC?: number;
    };
}

/** A single time bucket within a forecast. */
export interface EnyoDiagnosticsForecastBucket {
    timestampIso: string;
    relativeSeconds: number;
    gridConsumptionPricePerKwh: number;
    gridFeedInPricePerKwh: number;
    /** Optional per-source price and available power breakdown. */
    priceTable?: EnyoDiagnosticsPriceTableEntry[];
    // Home consumption (optional)
    homeConsumptionW?: number;
    homeConsumptionWh?: number;
    // PV (optional)
    pvProductionW?: number;
    pvProductionWh?: number;
    // Battery (optional)
    batterySoCPercent?: number;
    batteryPowerW?: number;
    // EV (optional)
    evChargingPowerW?: number;
    evChargingPowerWh?: number;
    carConnected?: boolean;
    // Heatpump (optional)
    heatpumpPowerW?: number;
    heatpumpPowerWh?: number;
    outdoorTemperatureC?: number;
    dhwTemperatureC?: number;
    dhwState?: DhwState;
    heatingState?: HeatingState;
    // Air conditioning (optional)
    airConditioningPowerW?: number;
    airConditioningPowerWh?: number;
}

/** Complete forecast with per-bucket data, appliance breakdowns, and cost totals. */
export interface EnyoDiagnosticsForecast {
    /** Time-series forecast buckets. */
    buckets: EnyoDiagnosticsForecastBucket[];
    /** Per-appliance forecast data. */
    applianceBuckets: EnyoDiagnosticsForecastAppliance[];
    /** Appliance types included in this forecast. */
    availableAppliances: EnyoApplianceTypeEnum[];
    /** ISO 8601 timestamp when this forecast was generated. */
    generatedAtIso: string;
    /** Total estimated cost in EUR. */
    totalCostEur: number;
    /** Total estimated grid import in kWh. */
    totalGridImportKwh: number;
    /** Total estimated grid export in kWh. */
    totalGridExportKwh: number;
}

// ─── Action-based control plan ──────────────────────────────

/**
 * Enum of all control plan action types.
 * Each value represents a specific action the energy manager can plan for an appliance.
 */
export enum EnyoDiagnosticsControlActionEnum {
    /** Block the battery from discharging. */
    BatteryBlockDischarge = 'battery_block_discharge',
    /** Charge the battery from the grid. */
    BatteryChargeFromGrid = 'battery_charge_from_grid',
    /** Force the battery to discharge. */
    BatteryForceDischarge = 'battery_force_discharge',
    /** Battery is charging from PV surplus (observational, not a command). */
    BatteryChargingFromPv = 'battery_charging_from_pv',
    /** Battery is discharging into the home (observational, not a command). */
    BatteryDischargingIntoHome = 'battery_discharging_into_home',
    /** Start charging the EV. */
    EvStartCharge = 'ev_start_charge',
    /** Pause charging the EV. */
    EvPauseCharge = 'ev_pause_charge',
    /** Boost domestic hot water production via heat pump. */
    HeatpumpDhwBoost = 'heatpump_dhw_boost',
    /** Address room overheating via heat pump. */
    HeatpumpRoomOverheating = 'heatpump_room_overheating',
    /** Boost buffer tank temperature via heat pump. */
    HeatpumpBufferTankBoost = 'heatpump_buffer_tank_boost',
    /** Announce available power to the heat pump. */
    HeatpumpAvailablePowerAnnouncement = 'heatpump_available_power_announcement',
    /** Start cooling via air conditioning. */
    AirConditioningStartCooling = 'air_conditioning_start_cooling',
    /** Stop cooling via air conditioning. */
    AirConditioningStopCooling = 'air_conditioning_stop_cooling',
    /** Start heating via air conditioning. */
    AirConditioningStartHeating = 'air_conditioning_start_heating',
    /** Stop heating via air conditioning. */
    AirConditioningStopHeating = 'air_conditioning_stop_heating',
}

/**
 * Enum of reason types explaining why an action was planned.
 * Used to attach context to actions for logging, debugging, and UI display.
 */
export enum EnyoDiagnosticsActionReasonTypeEnum {
    /** Action planned because the electricity price is below a configured threshold. */
    ElectricityPriceBelowThreshold = 'electricity-price-below-threshold',
    /** Action planned because the electricity price is above a configured threshold. */
    ElectricityPriceAboveThreshold = 'electricity-price-above-threshold',
    /** Action planned because PV surplus is available. */
    PvSurplusAvailable = 'pv-surplus-available',
    /** Action planned because PV surplus is unavailable. */
    PvSurplusUnavailable = 'pv-surplus-unavailable',
    /** Action planned because battery capacity is available. */
    BatteryCapacityAvailable = 'battery-capacity-available',
    /** Action planned because battery capacity is unavailable. */
    BatteryCapacityUnavailable = 'battery-capacity-unavailable',
    /** Action planned because the battery state of charge is low. */
    BatterySoCLow = 'battery-soc-low',
    /** Action planned because the battery state of charge is high. */
    BatterySoCHigh = 'battery-soc-high',
    /** Action planned based on the EV charging schedule. */
    EvChargingSchedule = 'ev-charging-schedule',
    /** Action planned because of a grid operator power limitation. */
    GridOperatorPowerLimitation = 'grid-operator-power-limitation',
    /** Action planned because the DHW temperature is low. */
    DhwTemperatureLow = 'dhw-temperature-low',
    /** Action planned because the room temperature is high. */
    RoomTemperatureHigh = 'room-temperature-high',
    /** Action planned because the buffer tank temperature is low. */
    BufferTankTemperatureLow = 'buffer-tank-temperature-low',
    /** Action planned because the home consumption is high. */
    HomeConsumptionHigh = 'home-consumption-high',
    /** Action planned because the room temperature is low. */
    RoomTemperatureLow = 'room-temperature-low',
}

/**
 * Structured reason explaining why an action was planned.
 * Provides context such as pricing information, capacity, power, or temperature values.
 */
export interface EnyoDiagnosticsActionReason {
    /** The reason type indicating why this action was planned. */
    type: EnyoDiagnosticsActionReasonTypeEnum;
    /** Electricity price per kWh that influenced this action. */
    electricityPricePerKwh?: number;
    /** Currency of the electricity price. */
    currency?: EnyoCurrencyEnum;
    /** Relevant capacity in kWh. */
    capacityKwh?: number;
    /** Relevant power in Watts. */
    powerW?: number;
    /** Relevant temperature in Celsius. */
    temperatureC?: number;
    /** Relevant state of charge as a percentage. */
    socPercent?: number;
}

/**
 * Base interface for all control plan actions.
 * Each specific action interface extends this with narrowed discriminant fields.
 */
export interface EnyoDiagnosticsControlActionBase {
    /** Discriminant identifying the specific action type. */
    action: EnyoDiagnosticsControlActionEnum;
    /** Appliance type this action applies to. */
    type: EnyoApplianceTypeEnum;
    /** Target appliance ID. */
    applianceId: string;
    /** ISO 8601 timestamp when this action starts. */
    timestampIso: string;
    /** Duration of this action in minutes. */
    durationInMinutes: number;
    /** Whether this action sends a command to hardware ({@code true}) or is observational ({@code false}). */
    isCommand: boolean;
    /** Reason why this action was planned. */
    reason: EnyoDiagnosticsActionReason;
}

// ─── Battery actions ────────────────────────────────────────

/** Battery action: block the battery from discharging. */
export interface EnyoDiagnosticsStorageBlockDischargeAction extends EnyoDiagnosticsControlActionBase {
    action: EnyoDiagnosticsControlActionEnum.BatteryBlockDischarge;
    type: EnyoApplianceTypeEnum.Storage;
    isCommand: true;
    /** Target power in Watts. */
    powerW: number;
    /** Optional target state of charge as a percentage. */
    targetSoCPercent?: number;
}

/** Battery action: charge the battery from the grid. */
export interface EnyoDiagnosticsStorageChargeFromGridAction extends EnyoDiagnosticsControlActionBase {
    action: EnyoDiagnosticsControlActionEnum.BatteryChargeFromGrid;
    type: EnyoApplianceTypeEnum.Storage;
    isCommand: true;
    /** Target power in Watts. */
    powerW: number;
    /** Optional target state of charge as a percentage. */
    targetSoCPercent?: number;
}

/** Battery action: force the battery to discharge. */
export interface EnyoDiagnosticsStorageForceDischargeAction extends EnyoDiagnosticsControlActionBase {
    action: EnyoDiagnosticsControlActionEnum.BatteryForceDischarge;
    type: EnyoApplianceTypeEnum.Storage;
    isCommand: true;
    /** Target power in Watts. */
    powerW: number;
    /** Optional target state of charge as a percentage. */
    targetSoCPercent?: number;
}

/** Battery action: battery is charging from PV surplus (observational, not a command). */
export interface EnyoDiagnosticsStorageChargingFromPvAction extends EnyoDiagnosticsControlActionBase {
    action: EnyoDiagnosticsControlActionEnum.BatteryChargingFromPv;
    type: EnyoApplianceTypeEnum.Storage;
    isCommand: false;
    /** Power in Watts being charged from PV. */
    powerW: number;
    /** Current state of charge as a percentage. */
    socPercent?: number;
}

/** Battery action: battery is discharging into the home (observational, not a command). */
export interface EnyoDiagnosticsStorageDischargingIntoHomeAction extends EnyoDiagnosticsControlActionBase {
    action: EnyoDiagnosticsControlActionEnum.BatteryDischargingIntoHome;
    type: EnyoApplianceTypeEnum.Storage;
    isCommand: false;
    /** Power in Watts being discharged into the home. */
    powerW: number;
    /** Current state of charge as a percentage. */
    socPercent?: number;
}

// ─── EV charger actions ─────────────────────────────────────

/** EV charger action: start charging the EV. */
export interface EnyoDiagnosticsChargerStartChargeAction extends EnyoDiagnosticsControlActionBase {
    action: EnyoDiagnosticsControlActionEnum.EvStartCharge;
    type: EnyoApplianceTypeEnum.Charger;
    isCommand: true;
    /** Charging power in Watts. */
    chargingPowerW: number;
    /** Optional charging limit in kW. */
    chargingLimitKw?: number;
}

/** EV charger action: pause charging the EV. */
export interface EnyoDiagnosticsChargerPauseChargeAction extends EnyoDiagnosticsControlActionBase {
    action: EnyoDiagnosticsControlActionEnum.EvPauseCharge;
    type: EnyoApplianceTypeEnum.Charger;
    isCommand: true;
}

// ─── Heatpump actions ───────────────────────────────────────

/** Heatpump action: boost domestic hot water production. */
export interface EnyoDiagnosticsHeatpumpDhwBoostAction extends EnyoDiagnosticsControlActionBase {
    action: EnyoDiagnosticsControlActionEnum.HeatpumpDhwBoost;
    type: EnyoApplianceTypeEnum.Heatpump;
    isCommand: true;
    /** Target power in Watts. */
    powerW: number;
    /** Optional target temperature in Celsius. */
    targetTempC?: number;
    /** Optional current domestic hot water temperature in Celsius. */
    currentTemperatureC?: number;
    /** Optional current outdoor temperature in Celsius. */
    outdoorTemperatureC?: number;
}

/** Heatpump action: address room overheating. */
export interface EnyoDiagnosticsHeatpumpRoomOverheatingAction extends EnyoDiagnosticsControlActionBase {
    action: EnyoDiagnosticsControlActionEnum.HeatpumpRoomOverheating;
    type: EnyoApplianceTypeEnum.Heatpump;
    isCommand: true;
    /** Target power in Watts. */
    powerW: number;
    /** Optional target temperature in Celsius. */
    targetTempC?: number;
    /** Optional current room temperature in Celsius. */
    currentTemperatureC?: number;
    /** Optional current outdoor temperature in Celsius. */
    outdoorTemperatureC?: number;
}

/** Heatpump action: boost buffer tank temperature. */
export interface EnyoDiagnosticsHeatpumpBufferTankBoostAction extends EnyoDiagnosticsControlActionBase {
    action: EnyoDiagnosticsControlActionEnum.HeatpumpBufferTankBoost;
    type: EnyoApplianceTypeEnum.Heatpump;
    isCommand: true;
    /** Target power in Watts. */
    powerW: number;
    /** Optional target temperature in Celsius. */
    targetTempC?: number;
    /** Optional current room temperature in Celsius. */
    currentTemperatureC?: number;
    /** Optional current outdoor temperature in Celsius. */
    outdoorTemperatureC?: number;
}

/** Heatpump action: announce available power to the heat pump. */
export interface EnyoDiagnosticsHeatpumpAvailablePowerAnnouncementAction extends EnyoDiagnosticsControlActionBase {
    action: EnyoDiagnosticsControlActionEnum.HeatpumpAvailablePowerAnnouncement;
    type: EnyoApplianceTypeEnum.Heatpump;
    isCommand: true;
    /** Available power in Watts. */
    powerW: number;
}

// ─── Air conditioning actions ──────────────────────────────

/** Air conditioning action: start cooling. */
export interface EnyoDiagnosticsAirConditioningStartCoolingAction extends EnyoDiagnosticsControlActionBase {
    action: EnyoDiagnosticsControlActionEnum.AirConditioningStartCooling;
    type: EnyoApplianceTypeEnum.AirConditioning;
    isCommand: true;
    /** Target power in Watts. */
    powerW?: number;
    /** Optional target temperature in Celsius. */
    targetTempC?: number;
    /** Optional current room temperature in Celsius. */
    currentTemperatureC?: number;
    /** Optional current outdoor temperature in Celsius. */
    outdoorTemperatureC?: number;
}

/** Air conditioning action: stop cooling. */
export interface EnyoDiagnosticsAirConditioningStopCoolingAction extends EnyoDiagnosticsControlActionBase {
    action: EnyoDiagnosticsControlActionEnum.AirConditioningStopCooling;
    type: EnyoApplianceTypeEnum.AirConditioning;
    isCommand: true;
}

/** Air conditioning action: start heating. */
export interface EnyoDiagnosticsAirConditioningStartHeatingAction extends EnyoDiagnosticsControlActionBase {
    action: EnyoDiagnosticsControlActionEnum.AirConditioningStartHeating;
    type: EnyoApplianceTypeEnum.AirConditioning;
    isCommand: true;
    /** Target power in Watts. */
    powerW?: number;
    /** Optional target temperature in Celsius. */
    targetTempC?: number;
    /** Optional current room temperature in Celsius. */
    currentTemperatureC?: number;
    /** Optional current outdoor temperature in Celsius. */
    outdoorTemperatureC?: number;
}

/** Air conditioning action: stop heating. */
export interface EnyoDiagnosticsAirConditioningStopHeatingAction extends EnyoDiagnosticsControlActionBase {
    action: EnyoDiagnosticsControlActionEnum.AirConditioningStopHeating;
    type: EnyoApplianceTypeEnum.AirConditioning;
    isCommand: true;
}

// ─── Control plan ───────────────────────────────────────────

/** Union of all control plan action types. */
export type EnyoDiagnosticsControlAction =
    | EnyoDiagnosticsStorageBlockDischargeAction
    | EnyoDiagnosticsStorageChargeFromGridAction
    | EnyoDiagnosticsStorageForceDischargeAction
    | EnyoDiagnosticsStorageChargingFromPvAction
    | EnyoDiagnosticsStorageDischargingIntoHomeAction
    | EnyoDiagnosticsChargerStartChargeAction
    | EnyoDiagnosticsChargerPauseChargeAction
    | EnyoDiagnosticsHeatpumpDhwBoostAction
    | EnyoDiagnosticsHeatpumpRoomOverheatingAction
    | EnyoDiagnosticsHeatpumpBufferTankBoostAction
    | EnyoDiagnosticsHeatpumpAvailablePowerAnnouncementAction
    | EnyoDiagnosticsAirConditioningStartCoolingAction
    | EnyoDiagnosticsAirConditioningStopCoolingAction
    | EnyoDiagnosticsAirConditioningStartHeatingAction
    | EnyoDiagnosticsAirConditioningStopHeatingAction;

/** Complete control plan with duration-based actions and cost estimates. */
export interface EnyoDiagnosticsControlPlan {
    /** Sequence of planned actions, each with its own duration. */
    actions: EnyoDiagnosticsControlAction[];
    /** ISO 8601 timestamp when this plan was generated. */
    generatedAtIso: string;
    /** Total estimated cost in EUR. */
    totalEstimatedCostEur: number;
    /** Total estimated grid import in kWh. */
    totalGridImportKwh: number;
    /** Total estimated grid export in kWh. */
    totalGridExportKwh: number;
    /** Total estimated savings in EUR. */
    totalEstimatedSavingsEur?: number;
}

// ─── Energy-manager cycle diagnostics ───────────────────────────────────────
//
// Operational telemetry for the energy manager's planning loop. One
// `EnyoEnergyManagerCycleDiagnostics` is published per cycle via
// `EnergyAppDiagnostics.publishCycleDiagnostics` and answers the four
// real ops questions:
//   liveness            — outcome + timestamps
//   latency             — durations
//   throughput & success — commands issued + acknowledgements
//   failure modes       — issues
//
// The shape is deliberately separate from `EnyoDiagnosticsControlPlan`
// (which describes *what* the EM decided to do, published via
// `EnergyAppEnergyManager.publishForecast`) — this surface describes
// *how the EM's planning loop performed*.

/**
 * Outcome of a single energy-manager planning cycle.
 *
 * - `Completed` — the cycle ran end-to-end and dispatched its plan.
 * - `Skipped` — the cycle was intentionally short-circuited (e.g. nothing
 *   to do, prerequisites missing). `outcomeReason` should explain.
 * - `Failed` — the cycle aborted because of an unrecoverable error.
 *   `outcomeReason` should explain.
 */
export enum EnyoEnergyManagerCycleOutcomeEnum {
    /** Cycle ran end-to-end and dispatched its plan. */
    Completed = 'completed',
    /** Cycle was intentionally short-circuited; `outcomeReason` explains why. */
    Skipped = 'skipped',
    /** Cycle aborted because of an unrecoverable error; `outcomeReason` explains. */
    Failed = 'failed',
}

/**
 * The discrete phases an energy-manager cycle progresses through. Each
 * phase's wall-clock duration is reported in
 * {@link EnyoEnergyManagerPhaseDuration}.
 */
export enum EnyoEnergyManagerCyclePhaseEnum {
    /** Snapshot the current state of appliances, grid, and tariffs. */
    LoadCurrentState = 'load-current-state',
    /** Fetch / refresh all forecasts needed by the optimizer. */
    FetchForecasts = 'fetch-forecasts',
    /** Run the optimization / planning step. */
    Optimize = 'optimize',
    /** Translate the plan into data-bus commands and dispatch them. */
    DispatchCommands = 'dispatch-commands',
    /** Publish the resulting control plan / forecasts to subscribers. */
    Publish = 'publish',
}

/**
 * Identifies which forecaster a {@link EnyoEnergyManagerForecastUsage}
 * entry refers to. Mirrors the forecaster accessors on
 * `EnergyAppEnergyManager`.
 */
export enum EnyoEnergyManagerForecastTypeEnum {
    /** PV production forecast. */
    PvProduction = 'pv-production',
    /** Battery state-of-charge trajectory forecast. */
    Battery = 'battery',
    /** Whole-home consumption forecast. */
    HomeConsumption = 'home-consumption',
    /** EV charging forecast. */
    EvCharging = 'ev-charging',
    /** Heatpump electrical consumption forecast. */
    HeatpumpConsumption = 'heatpump-consumption',
    /** Heatpump DHW (domestic-hot-water) temperature trajectory forecast. */
    HeatpumpDhwTemperature = 'heatpump-dhw-temperature',
}

/**
 * Severity of an {@link EnyoEnergyManagerIssue} encountered during a
 * cycle.
 *
 * - `Warning` — the cycle continued; this is informational / degraded.
 * - `Error` — the cycle aborted or had to drop work on the floor.
 */
export enum EnyoEnergyManagerIssueSeverityEnum {
    /** Informational / degraded; the cycle continued. */
    Warning = 'warning',
    /** The cycle aborted or had to drop work on the floor. */
    Error = 'error',
}

/**
 * Wall-clock duration spent in one cycle phase.
 */
export interface EnyoEnergyManagerPhaseDuration {
    /** Which phase this measurement belongs to. */
    phase: EnyoEnergyManagerCyclePhaseEnum;
    /** Wall-clock duration spent in the phase, in milliseconds. */
    durationMs: number;
}

/**
 * One forecaster call the cycle made — useful to spot which forecaster
 * is slow or failing.
 */
export interface EnyoEnergyManagerForecastUsage {
    /** Which forecaster was called. */
    forecastType: EnyoEnergyManagerForecastTypeEnum;
    /** Appliance the forecaster was scoped to, when applicable (e.g. per-battery). */
    applianceId?: string;
    /** Wall-clock duration of the forecaster call, in milliseconds. */
    durationMs: number;
    /** Whether the call succeeded. `false` should be paired with an entry in `issues`. */
    ok: boolean;
}

/**
 * Number of commands of a given data-bus message kind that the energy
 * manager issued during the cycle.
 */
export interface EnyoEnergyManagerCommandCount {
    /** Data-bus message kind issued (e.g. `EnyoDataBusMessageEnum.SetStorageScheduleV1`). */
    messageType: EnyoDataBusMessageEnum;
    /** How many commands of this type the cycle issued. Non-negative integer. */
    count: number;
}

/**
 * Aggregated acknowledgement outcomes (since the previous cycle) for a
 * given data-bus message kind. Counts come from
 * `EnyoDataBusCommandAcknowledgeV1.answer`.
 *
 * Reported per cycle as a *delta* — the counts cover acknowledgements
 * received between the end of the previous cycle and this one — so
 * dashboards can chart rejection rates aligned to cycle boundaries.
 */
export interface EnyoEnergyManagerCommandAcknowledgement {
    /** Data-bus message kind these acks correspond to. */
    messageType: EnyoDataBusMessageEnum;
    /** Number of acks that came back `Accepted`. Non-negative integer. */
    accepted: number;
    /** Number of acks that came back `Rejected`. Non-negative integer. */
    rejected: number;
    /** Number of acks that came back `NotSupported`. Non-negative integer. */
    notSupported: number;
}

/**
 * Headcount of appliances the energy manager is currently planning for,
 * broken down by appliance type.
 */
export interface EnyoEnergyManagerApplianceCount {
    /** Which appliance type this count is for. */
    applianceType: EnyoApplianceTypeEnum;
    /** How many appliances of this type are under management. Non-negative integer. */
    count: number;
}

/**
 * A single problem encountered while running the cycle — a forecast
 * fetch failure, a constraint violation, an appliance that had to be
 * skipped, etc.
 *
 * `code` is a short, stable, kebab-case identifier (e.g.
 * `'forecast-fetch-failed'`, `'no-storage-headroom'`) intended for
 * grouping in dashboards / alerts; `message` is the human-readable
 * detail. Implementations SHOULD cap the per-cycle list at a sensible
 * upper bound (e.g. 50) to keep the payload small.
 */
export interface EnyoEnergyManagerIssue {
    /** Severity — controls whether the issue is a warning or an error. */
    severity: EnyoEnergyManagerIssueSeverityEnum;
    /** Short, stable kebab-case identifier suitable for grouping in dashboards. */
    code: string;
    /** Human-readable detail. */
    message: string;
    /** Optional appliance the issue is scoped to. */
    applianceId?: string;
}

/**
 * Operational telemetry for one energy-manager cycle — published once
 * per cycle (typically at the end of the cycle so timings are final)
 * via `EnergyAppDiagnostics.publishCycleDiagnostics`.
 *
 * Intentionally complementary to `EnergyAppEnergyManager.publishForecast`:
 * `publishForecast` ships the *plan* (what the EM decided to do);
 * `publishCycleDiagnostics` ships the *health of the planning loop*
 * (how long it took, what it dispatched, what went wrong).
 */
export interface EnyoEnergyManagerCycleDiagnostics {
    /** ISO 8601 timestamp when the cycle started. */
    cycleStartedAtIso: string;
    /** ISO 8601 timestamp when the cycle completed. MUST be ≥ `cycleStartedAtIso`. */
    cycleCompletedAtIso: string;
    /** Overall cycle outcome. */
    outcome: EnyoEnergyManagerCycleOutcomeEnum;
    /** Required when `outcome` is `Skipped` or `Failed`; explains the reason. */
    outcomeReason?: string;

    /** Total wall-clock duration of the cycle, in milliseconds. Non-negative finite. */
    totalDurationMs: number;
    /**
     * Per-phase wall-clock durations. May be a partial set when an early
     * phase aborted the cycle. The sum of `phaseDurations[].durationMs`
     * MUST NOT exceed `totalDurationMs`.
     */
    phaseDurations: EnyoEnergyManagerPhaseDuration[];

    /** One entry per forecaster call the cycle performed. */
    forecastsConsumed: EnyoEnergyManagerForecastUsage[];

    /** Commands issued this cycle, aggregated by data-bus message kind. */
    commandsIssued: EnyoEnergyManagerCommandCount[];
    /**
     * Acknowledgements received between the previous cycle and this one,
     * aggregated by data-bus message kind. Reported as a per-cycle delta
     * (NOT a running total) so dashboards can chart rejection rates
     * aligned to cycle boundaries.
     */
    commandAcknowledgements: EnyoEnergyManagerCommandAcknowledgement[];

    /** How many appliances of each type are currently under EM control. */
    appliancesManaged: EnyoEnergyManagerApplianceCount[];
    /**
     * Length of the planning horizon the cycle actually produced a plan
     * for, in minutes. `0` is allowed (e.g. when `outcome` is `Skipped`
     * or `Failed`).
     */
    plannedHorizonMinutes: number;

    /**
     * Issues encountered while running this cycle. Bounded by the
     * publisher — implementations SHOULD cap at a sensible upper bound
     * (e.g. 50) to keep the payload small.
     */
    issues: EnyoEnergyManagerIssue[];
}
