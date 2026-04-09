import {EnergyAppApplianceTypeEnum} from "../energy-app-appliance-type.enum.js";
import {EnyoApplianceTypeEnum} from "./enyo-appliance.js";
import {EnyoChargeModeEnum} from "./enyo-data-bus-value.js";

// ─── Decision & state types ────────────────────────────────

/** Domestic hot water tank state. */
export type DhwState = "charging" | "discharging" | "idle";

/** Heating circuit state. */
export type HeatingState = "active" | "idle";

/** Battery control decision issued by the energy manager. */
export type BatteryDecision = "normal" | "block_discharge" | "charge_from_grid" | "force_discharge";

/** EV charging control decision issued by the energy manager. */
export type EvDecision = "normal" | "charging_pv" | "charging_grid" | "charging_mixed";

/** Heat pump control decision issued by the energy manager. */
export type HeatpumpDecision = "normal" | "dhw_boost" | "room_overheating" | "buffer_tank_boost";

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

/** Battery control command for a specific appliance. */
export interface EnyoDiagnosticsStorageControlCommand {
    type: EnyoApplianceTypeEnum.Storage;
    /** Target appliance ID. */
    applianceId: string;
    /** Control decision for the battery. */
    decision: BatteryDecision;
    /** Target power in Watts. */
    powerW: number;
    /** Optional target state of charge as a percentage. */
    targetSoCPercent?: number;
}

/** EV charger control command for a specific appliance. */
export interface EnyoDiagnosticsChargerControlCommand {
    type: EnyoApplianceTypeEnum.Charger;
    /** Target appliance ID. */
    applianceId: string;
    /** Control decision for the EV charger. */
    decision: EvDecision;
    /** Charging power in Watts. */
    chargingPowerW: number;
    /** Optional charging limit in kW. */
    chargingLimitKw?: number;
}

/** Heat pump control command for a specific appliance. */
export interface EnyoDiagnosticsHeatpumpControlCommand {
    type: EnyoApplianceTypeEnum.Heatpump;
    /** Target appliance ID. */
    applianceId: string;
    /** Control decision for the heat pump. */
    decision: HeatpumpDecision;
    /** Target power in Watts. */
    powerW: number;
    /** Optional target temperature in Celsius. */
    targetTempC?: number;
}

/** Union of all appliance control command types. */
export type EnyoDiagnosticsApplianceControlCommand =
    | EnyoDiagnosticsStorageControlCommand
    | EnyoDiagnosticsChargerControlCommand
    | EnyoDiagnosticsHeatpumpControlCommand;

// ─── Time-slotted control plan ─────────────────────────────

/** A single time slot in a control plan with its associated commands. */
export interface EnyoDiagnosticsControlSlot {
    /** ISO 8601 timestamp for this slot. */
    timestampIso: string;
    /** Commands to execute during this slot. */
    commands: EnyoDiagnosticsApplianceControlCommand[];
    /** Estimated cost for this slot in EUR. */
    estimatedSlotCostEur: number;
    /** Estimated grid power in Watts for this slot. */
    estimatedGridPowerW: number;
}

/** Complete control plan with time-slotted commands and cost estimates. */
export interface EnyoDiagnosticsControlPlan {
    /** Time-slotted command sequence. */
    slots: EnyoDiagnosticsControlSlot[];
    /** ISO 8601 timestamp when this plan was generated. */
    generatedAtIso: string;
    /** Total estimated cost in EUR. */
    totalEstimatedCostEur: number;
    /** Total estimated grid import in kWh. */
    totalGridImportKwh: number;
    /** Total estimated grid export in kWh. */
    totalGridExportKwh: number;
}
