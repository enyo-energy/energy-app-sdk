import {EnergyAppApplianceTypeEnum} from "../energy-app-appliance-type.enum.js";
import {EnyoApplianceTypeEnum} from "./enyo-appliance.js";
import {EnyoCurrencyEnum} from "./enyo-currency.js";
import {EnyoChargeModeEnum} from "./enyo-data-bus-value.js";

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

export type EnyoDiagnosticsForecastAppliance = EnyoDiagnosticsForecastInverterAppliance
    | EnyoDiagnosticsForecastStorageAppliance
    | EnyoDiagnosticsForecastChargerAppliance
    | EnyoDiagnosticsForecastHeatpumpAppliance;

/** Aggregated current state of the entire energy system. */
export interface EnyoDiagnosticsCurrentState {
    // System-level aggregates
    totalPvPowerW: number | undefined;
    totalBatteryPowerW: number | undefined;
    totalBatterySoCPercent: number | undefined;
    totalGridPowerW: number | undefined;
    totalHeatpumpPowerW: number | undefined;
    totalChargerPowerW: number | undefined;
    // Per-appliance current state
    appliances: EnyoDiagnosticsCurrentStateAppliance[];
}

export type EnyoDiagnosticsCurrentStateAppliance =
    | EnyoDiagnosticsCurrentStateBatteryAppliance
    | EnyoDiagnosticsCurrentStateInverterAppliance
    | EnyoDiagnosticsCurrentStateHeatpumpAppliance
    | EnyoDiagnosticsCurrentStateChargerAppliance;

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
    | EnyoDiagnosticsHeatpumpBufferTankBoostAction;

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
