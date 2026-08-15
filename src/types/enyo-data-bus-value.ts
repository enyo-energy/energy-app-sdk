import {
    EnyoApplianceErrorCode,
    EnyoApplianceStateEnum,
    EnyoApplianceStatusEnum,
    EnyoApplianceTypeEnum
} from "./enyo-appliance.js";
import type {EnyoAutomationTriggerData} from "./enyo-automation.js";
import {EnyoSourceEnum} from "./enyo-source.enum.js";
import {EnyoOcppRelativeSchedule} from "./enyo-ocpp.js";
import {EnyoChargerApplianceStatusEnum, EnyoChargerApplianceSuspendedReasonEnum} from "./enyo-charger-appliance.js";
import {
    PreviewChargingSchedule,
    PreviewChargingScheduleCostComparison,
    PreviewChargingScheduleUnavailableReasonEnum
} from "./enyo-energy-manager.js";
import {EnyoEnergyPrices} from "./enyo-energy-prices.js";
import {EnyoCurrencyEnum} from "./enyo-currency.js";
import {EnyoHeatpumpApplianceModeEnum} from "./enyo-heatpump-appliance.js";
import {EnyoAirConditioningApplianceModeEnum, EnyoAirConditioningOptimizationModeEnum} from "./enyo-air-conditioning-appliance.js";
import {EnergyAppPackageCategory} from "../energy-app-package-definition.js";
import {EnyoPackageConfigurationTranslatedValue} from "./enyo-settings.js";

/**
 * Enum representing the reason type for why a data bus command was issued.
 * Used to attach context to commands for logging, debugging, and UI display.
 */
export enum EnyoDataBusCommandReasonTypeEnum {
    /** Command issued because the electricity price is below a configured threshold */
    ElectricityPriceBelowThreshold = 'electricity-price-below-threshold',
    /** Command issued because the electricity price is above a configured threshold */
    ElectricityPriceAboveThreshold = 'electricity-price-above-threshold',
    /** Command issued because PV surplus is available */
    PvSurplusAvailable = 'pv-surplus-available',
    /** Command issued because PV surplus is unavailable */
    PvSurplusUnavailable = 'pv-surplus-unavailable',
    /** Command issued because battery capacity is available */
    BatteryCapacityAvailable = 'battery-capacity-available',
    /** Command issued because battery capacity is unavailable */
    BatteryCapacityUnavailable = 'battery-capacity-unavailable',
    /** Command issued because a grid operator power limitation is active */
    GridOperatorPowerLimitationActive = 'grid-operator-power-limitation-active',
    /** Command issued because a grid operator power limitation is inactive */
    GridOperatorPowerLimitationInactive = 'grid-operator-power-limitation-inactive',
    /** Command issued because the battery state of charge is low */
    BatterySoCLow = 'battery-soc-low',
    /** Command issued because the battery state of charge is high */
    BatterySoCHigh = 'battery-soc-high',
    /** Command issued to follow the planned EV charging schedule */
    EvChargingSchedule = 'ev-charging-schedule',
    /** Command issued as part of a planned/scheduled optimization */
    ScheduledOptimization = 'scheduled-optimization',
    /** Command issued because the user explicitly requested it */
    UserRequest = 'user-request',
    /** Command issued to protect the device (e.g. overheating or safety limit) */
    DeviceProtection = 'device-protection',
    /** Command issued because home consumption is high */
    HomeConsumptionHigh = 'home-consumption-high',
    /** Command issued to optimize self-consumption */
    SelfConsumptionOptimization = 'self-consumption-optimization',
}

/**
 * Coarse, machine-readable grouping of why a data bus command was issued.
 * Intended for filtering, iconography, and analytics. The human-readable,
 * end-user explanation lives in {@link EnyoDataBusCommandReason.translation}.
 */
export enum EnyoDataBusCommandReasonCategoryEnum {
    /** Driven by the electricity price (cheap/expensive). */
    EnergyPrice = 'energy-price',
    /** Driven by available/unavailable PV surplus. */
    PvSurplus = 'pv-surplus',
    /** Driven by battery capacity or state of charge. */
    BatteryState = 'battery-state',
    /** Driven by a grid operator power limitation. */
    GridLimitation = 'grid-limitation',
    /** Driven by following a planned schedule. */
    Schedule = 'schedule',
    /** Driven by an explicit user request. */
    UserRequest = 'user-request',
    /** Driven by device protection / safety (e.g. overheating). */
    DeviceProtection = 'device-protection',
    /** Driven by a temperature condition (e.g. heatpump thermal control). */
    Temperature = 'temperature',
    /** Driven by self-consumption optimization. */
    SelfConsumptionOptimization = 'self-consumption-optimization',
    /** Any reason not covered by the categories above. */
    Other = 'other',
}

/**
 * Interface describing the reason why a data bus command was issued.
 * Provides context for commands such as pricing information, capacity, or power values.
 */
export interface EnyoDataBusCommandReason {
    /** The reason type indicating why this command was issued */
    type: EnyoDataBusCommandReasonTypeEnum;
    /** Coarse category for grouping, iconography, and analytics */
    category?: EnyoDataBusCommandReasonCategoryEnum;
    /** Per-language, end-user-facing explanation of this reason */
    translation?: EnyoPackageConfigurationTranslatedValue[];
    /** Electricity price per kWh that triggered this command */
    electricityPricePerKwh?: number;
    /** Currency of the electricity price */
    currency?: EnyoCurrencyEnum;
    /** Relevant capacity in kWh */
    capacityKwh?: number;
    /** Relevant power in Watts */
    powerW?: number;
    /** Relevant energy in Watt hours */
    powerWh?: number;
    /** Relevant temperature in Celsius (e.g. heatpump-driven reasons) */
    temperatureC?: number;
    /** Relevant state of charge as a percentage (battery-driven reasons) */
    socPercent?: number;
}

/**
 * Whether a grid operator power limitation caps power drawn from the grid
 * (consumption) or power fed into the grid (production).
 */
export enum EnyoGridOperatorLimitTypeEnum {
    /** Limitation of power drawn from the grid (§14a EnWG consumption cap, EEBUS LPC) */
    Consumption = 'consumption',
    /** Limitation of power fed into the grid (feed-in / production cap, EEBUS LPP) */
    Production = 'production',
}

/**
 * Snapshot of the grid operator power limitation (§14a EnWG) an appliance is
 * currently applying. Embedded as an optional field in appliance value-update
 * messages (inverter, heatpump, battery, air conditioning, charging) so
 * consumers can observe the active cap alongside live measurements, and reused
 * as the payload of {@link EnyoDataBusGridOperatorPowerLimitationExecutedV1}.
 * Omit the containing field entirely when no limitation is currently applied.
 */
export interface EnyoGridOperatorLimit {
    /** Whether this caps grid consumption or grid production (feed-in) */
    type: EnyoGridOperatorLimitTypeEnum;
    /** The actual active power limitation the appliance applied, in watts */
    appliedLimitationW: number;
    /** ISO 8601 timestamp when the applied limitation ends */
    endTimestampIso: string;
    /** Duration the limitation is applied for, in seconds */
    durationSeconds: number;
    /**
     * Optional ID of the triggering `GridOperatorPowerLimitationV1` message,
     * for correlation with the originating command.
     */
    commandMessageId?: string;
}

export enum EnyoBatteryStateEnum {
    Off = 'off',
    Empty = 'empty',
    Discharging = 'discharging',
    Charging = 'charging',
    Full = 'full',
    Holding = 'holding',
    Testing = 'testing'
}

export enum EnyoInverterStateEnum {
    Off = 'off',
    Sleeping = 'sleeping',
    Starting = 'starting',
    Mppt = 'mppt',
    Throttled = 'throttled',
    ShuttingDown = 'shutting-down',
    Fault = 'fault',
    Standby = 'standby'
}

/**
 * Operating state of a heating rod as reported on the data bus via
 * {@link EnyoDataBusHeatingRodValuesV1}.
 *
 * This is the *observed* state of the element, not the configured mode: the
 * appliance metadata's {@link EnyoHeatingRodApplianceModeEnum} describes how the
 * heating rod is set up, while this enum says whether it is drawing power right
 * now.
 */
export enum EnyoHeatingRodStateEnum {
    /** The heating element is not energized and consumes (close to) no power */
    Idle = 'idle',
    /** The heating element is energized and heating */
    Running = 'running'
}

export enum EnyoStringStateEnum {
    Off = 'off',
    Sleeping = 'sleeping',
    Starting = 'starting',
    Mppt = 'mppt',
    Throttled = 'throttled',
    ShuttingDown = 'shutting-down',
    Fault = 'fault',
    Standby = 'standby',
    Test = ' Test'
}

/**
 * Charging meter value context defining when the measurement was taken
 */
export enum EnyoChargingMeterValueContext {
    /** Meter value at the start of a transaction */
    TransactionBegin = 'Transaction.Begin',
    /** Meter value at the end of a transaction */
    TransactionEnd = 'Transaction.End',
    /** Periodic sample during charging */
    SamplePeriodic = 'Sample.Periodic',
    /** Clock-aligned sample */
    SampleClock = 'Sample.Clock',
    /** Triggered by external request */
    Trigger = 'Trigger',
    /** Sample taken when charging is interrupted */
    InterruptionBegin = 'Interruption.Begin',
    /** Sample taken when charging resumes */
    InterruptionEnd = 'Interruption.End',
}

/**
 * Reason why a charging session was stopped
 */
export enum EnyoChargingStopReason {
    /** Session stopped by remote command */
    Remote = 'Remote',
    /** Session stopped due to power loss */
    PowerLoss = 'PowerLoss',
    /** Emergency stop was triggered */
    EmergencyStop = 'EmergencyStop',
    /** Electric vehicle was disconnected */
    EVDisconnected = 'EVDisconnected',
    /** Authorization was revoked */
    DeAuthorized = 'DeAuthorized',
    /** Session stopped for other reasons */
    Other = 'Other',
}

/**
 * Mode for charging session
 */
export enum EnyoChargeModeEnum {
    /** Start charging immediately at maximum rate */
    Immediate = 'immediate',
    /** Optimize charging schedule for lowest cost */
    CostOptimized = 'cost-optimized',
    /** Optimize charging schedule for a maximum price limit, for example 7 ct grid or pv production */
    PriceLimit = 'price-limit',
}

/**
 * Identifies who initiated a charging session.
 */
export enum EnyoChargeInitiatorEnum {
    /** Session was started from the enyo app (remote/user-driven start) */
    App = 'app',
    /** Session was started directly at the charger (e.g. plug-and-charge or local autostart) */
    Charger = 'charger',
}

export interface EnyoAggregatedStateApplianceValues {
    powerW?: number;
    batterySoC?: number;
    currentA?: number;
    voltageL1?: number;
    voltageL2?: number;
    voltageL3?: number;
}

export enum EnyoDataBusMessageEnum {
    InverterValuesUpdateV1 = 'InverterValuesUpdateV1',
    MeterValuesUpdateV1 = 'MeterValuesUpdateV1',
    BatteryValuesUpdateV1 = 'BatteryValuesUpdateV1',
    ApplianceFlexibilityAnnouncementV1 = 'ApplianceFlexibilityAnnouncementV1',
    ApplianceStateUpdateV1 = 'ApplianceStateUpdateV1',
    HeatpumpValuesUpdateV1 = 'HeatpumpValuesUpdateV1',
    HeatingRodValuesUpdateV1 = 'HeatingRodValuesUpdateV1',
    ChargingStartedV1 = 'ChargingStartedV1',
    ChargingMeterValuesUpdateV1 = 'ChargingMeterValuesUpdateV1',
    ChargingStoppedV1 = 'ChargingStoppedV1',
    StartChargingFailedV1 = 'StartChargingFailedV1',
    PauseChargingV1 = 'PauseChargingV1',
    ResumeChargingV1 = 'ResumeChargingV1',
    /** @deprecated Use {@link EnyoDataBusMessageEnum.SetChargerAvailablePowerV2} instead, which carries an available/max power envelope in Watts. */
    ChangeChargingPowerV1 = 'ChangeChargingPowerV1',
    ChangeChargeModeV1 = 'ChangeChargeModeV1',
    SetChargingScheduleV1 = 'SetChargingScheduleV1',
    StartChargeV1 = 'StartChargeV1',
    StopChargeV1 = 'StopChargeV1',
    AggregatedStateUpdateV1 = 'AggregatedStateUpdateV1',
    EnergyTariffUpdateV1 = 'EnergyTariffUpdateV1',
    ChargeFinishedV1 = 'ChargeFinishedV1',
    ChargerStatusChangedV1 = 'ChargerStatusChangedV1',
    RequestPreviewChargingScheduleV1 = 'RequestPreviewChargingScheduleV1',
    PreviewChargingScheduleResponseV1 = 'PreviewChargingScheduleResponseV1',
    PvForecastV1 = 'PvForecastV1',
    BatteryForecastV1 = 'BatteryForecastV1',
    HomeConsumptionForecastV1 = 'HomeConsumptionForecastV1',
    EvChargingForecastV1 = 'EvChargingForecastV1',
    HeatpumpConsumptionForecastV1 = 'HeatpumpConsumptionForecastV1',
    HeatpumpDhwTemperatureForecastV1 = 'HeatpumpDhwTemperatureForecastV1',
    AirConditioningConsumptionForecastV1 = 'AirConditioningConsumptionForecastV1',
    AirConditioningRoomTemperatureForecastV1 = 'AirConditioningRoomTemperatureForecastV1',
    AutomationTriggerV1 = 'AutomationTriggerV1',
    /** @deprecated Use {@link EnyoDataBusMessageEnum.SetStorageScheduleV1} instead. The schedule message subsumes start/stop/limit commands by carrying a sequence of `{seconds, direction, powerW}` setpoints. */
    StartStorageGridChargeV1 = 'StartStorageGridChargeV1',
    /** @deprecated Use {@link EnyoDataBusMessageEnum.SetStorageScheduleV1} with `mode: 'auto'` (or a schedule that returns control to the appliance) instead. */
    StopStorageGridChargeV1 = 'StopStorageGridChargeV1',
    /** @deprecated Use {@link EnyoDataBusMessageEnum.SetStorageScheduleV1} instead. */
    StartStorageGridDischargeV1 = 'StartStorageGridDischargeV1',
    /** @deprecated Use {@link EnyoDataBusMessageEnum.SetStorageScheduleV1} with `mode: 'auto'` (or a schedule that returns control to the appliance) instead. */
    StopStorageGridDischargeV1 = 'StopStorageGridDischargeV1',
    /** @deprecated Use {@link EnyoDataBusMessageEnum.SetStorageScheduleV1} instead — the schedule's `powerW` per entry replaces the standalone discharge cap. */
    SetStorageDischargeLimitV1 = 'SetStorageDischargeLimitV1',
    /** @deprecated Use {@link EnyoDataBusMessageEnum.SetStorageScheduleV1} instead — the schedule's `powerW` per entry replaces the standalone charge cap. */
    SetStorageChargeLimitV1 = 'SetStorageChargeLimitV1',
    SetStorageScheduleV1 = 'SetStorageScheduleV1',
    SetInverterFeedInLimitV1 = 'SetInverterFeedInLimitV1',
    CommandAcknowledgeV1 = 'CommandAcknowledgeV1',
    TemperatureSensorValuesUpdateV1 = 'TemperatureSensorValuesUpdateV1',
    HeatpumpTemperaturesUpdateV1 = 'HeatpumpTemperaturesUpdateV1',
    MaxChargingPowerChangedV1 = 'MaxChargingPowerChangedV1',
    MaxDischargePowerChangedV1 = 'MaxDischargePowerChangedV1',
    GridOperatorPowerLimitationV1 = 'GridOperatorPowerLimitationV1',
    GridOperatorPowerProductionLimitationV1 = 'GridOperatorPowerProductionLimitationV1',
    GridOperatorPowerLimitationExecutedV1 = 'GridOperatorPowerLimitationExecutedV1',
    ResetChargerV1 = 'ResetChargerV1',
    RebootChargerV1 = 'RebootChargerV1',
    RequestChargerLogsV1 = 'RequestChargerLogsV1',
    ClearChargingProfilesV1 = 'ClearChargingProfilesV1',
    HeatpumpOverheatingV1 = 'HeatpumpOverheatingV1',
    /** @deprecated Use {@link EnyoDataBusMessageEnum.SetHeatpumpAvailablePowerV2} instead, which adds purpose and power-source context. */
    HeatpumpAvailablePowerAnnouncementV1 = 'HeatpumpAvailablePowerAnnouncementV1',
    /** @deprecated Use {@link EnyoDataBusMessageEnum.SetHeatingRodAvailablePowerV2} instead. */
    HeatingRodAvailablePowerAnnouncementV1 = 'HeatingRodAvailablePowerAnnouncementV1',
    AirConditioningValuesUpdateV1 = 'AirConditioningValuesUpdateV1',
    AirConditioningTemperaturesUpdateV1 = 'AirConditioningTemperaturesUpdateV1',
    StartAirConditioningV1 = 'StartAirConditioningV1',
    StopAirConditioningV1 = 'StopAirConditioningV1',
    ChangeAirConditioningOptimizationModeV1 = 'ChangeAirConditioningOptimizationModeV1',
    VehicleSocUpdateV1 = 'VehicleSocUpdateV1',
    /** V2 control command: announce the available/max power (W) envelope to a charger. Supersedes {@link EnyoDataBusMessageEnum.ChangeChargingPowerV1}. */
    SetChargerAvailablePowerV2 = 'SetChargerAvailablePowerV2',
    /** V2 control command: announce the available/max power (W) envelope to a heatpump, with purpose and power-source context. Supersedes {@link EnyoDataBusMessageEnum.HeatpumpAvailablePowerAnnouncementV1}. */
    SetHeatpumpAvailablePowerV2 = 'SetHeatpumpAvailablePowerV2',
    /** V2 control command: announce the available/max power (W) envelope to a heating rod. Supersedes {@link EnyoDataBusMessageEnum.HeatingRodAvailablePowerAnnouncementV1}. */
    SetHeatingRodAvailablePowerV2 = 'SetHeatingRodAvailablePowerV2',
    /** V2 control command: prescribe a single-setpoint control (mode + direction + power) to a battery/storage appliance. */
    SetStorageControlV2 = 'SetStorageControlV2',
    EnergyAppStartedV1 = 'EnergyAppStartedV1'
}

export type EnyoDataBusMessageResolution = '1s' | '10s' | '30s' | '1m' | '15m' | '1h' | '1d' | 'dynamic';

/**
 * Optional addressing information for a {@link EnyoDataBusMessage}. When omitted
 * the message is broadcast to all subscribers; when set, the message is only
 * delivered to packages that match the specified target. Broadcasting of an
 * untargeted message can additionally be suppressed by setting
 * {@link EnyoDataBusMessage.broadcast} to `false`.
 *
 * Exactly one of {@link cloudPackageId} or {@link categories} should be provided.
 * When both are set, consumers should treat them as an AND (the receiving package
 * must match the cloud package id **and** belong to at least one of the listed
 * categories). When neither is set, the target is treated as "all packages".
 */
export interface EnyoDataBusMessageTarget {
    /**
     * Target a single cloud-deployed energy app package by its package identifier.
     * Use this when a message is intended for one specific package instance.
     */
    cloudPackageId?: string;
    /**
     * Target every energy app package whose definition declares at least one of
     * the listed categories. Use this for category-scoped fan-out (e.g. send a
     * grid operator limitation only to inverter and battery-storage packages).
     */
    categories?: EnergyAppPackageCategory[];
}

export interface EnyoDataBusMessage {
    id: string;
    message: EnyoDataBusMessageEnum;
    type: 'message' | 'answer';
    source: EnyoSourceEnum;
    applianceId?: string;
    clockId?: string;
    timestampIso: string;
    /** If you just forward events that occur, use dynamic as resolution */
    resolution?: EnyoDataBusMessageResolution;
    /**
     * Optional delivery target. When omitted the message is broadcast to all
     * subscribers. Use this to restrict delivery to a specific cloud package or
     * to packages matching one or more energy app categories. See
     * {@link EnyoDataBusMessageTarget} for matching semantics.
     */
    target?: EnyoDataBusMessageTarget;
    /**
     * Whether this message may be broadcast to all subscribers on the bus.
     * Defaults to `true` when omitted (the message is eligible for broadcast).
     * Set to `false` to prevent the message from fanning out to all subscribers —
     * for example when it should only reach the recipients named by {@link target}.
     * This flag is independent of {@link target}: `target` narrows delivery, while
     * `broadcast` controls whether an untargeted message reaches every subscriber.
     */
    broadcast?: boolean;
    data: object;
}

export interface EnyoDataBusMessageAnswer extends EnyoDataBusMessage {
    type: 'answer';
    data: {
        status: 'accepted' | 'rejected' | 'not-applicable';
    }
}

export interface EnyoDataBusMeterValuesUpdateV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.MeterValuesUpdateV1;
    /** ID of the appliance that delivered these values */
    applianceId: string;
    data: {
        /** Power from Grid (in Watt), negative: grid feed in, positive: grid consumption*/
        gridPowerW?: number;
        /** Power on phase L1 (in Watt), negative: grid feed in, positive: grid consumption */
        gridPowerPhase1W?: number;
        /** Power on phase L2 (in Watt), negative: grid feed in, positive: grid consumption */
        gridPowerPhase2W?: number;
        /** Power on phase L3 (in Watt), negative: grid feed in, positive: grid consumption */
        gridPowerPhase3W?: number;
        /** Grid Feed in (in Watt hours) */
        gridFeedInWh: number;
        /** Grid Consumption in (in Watt hours) */
        gridConsumptionWh: number;
        /** current self consumption (in Watt) */
        selfConsumptionW?: number;
        /** Self consumed energy (in Watt hours) */
        selfConsumptionWh?: number;
    }
}

export interface EnyoDataBusHeatpumpValuesV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.HeatpumpValuesUpdateV1;
    /** ID of the appliance that delivered these values */
    applianceId: string;
    data: {
        values: {
            operationMode: EnyoHeatpumpApplianceModeEnum;
            /** current power consumption in W */
            powerW?: number;
            /** Cumulative energy meter reading of the heatpump in Wh (meter value)*/
            meterValueWh?: number;
            /** Power consumption for heating in Wh (meter value)*/
            powerConsumptionHeatingWh?: number;
            /** Power consumption for domestic hot water in Wh (meter value)*/
            powerConsumptionDomesticHotWaterWh?: number;
            /** Power generation for heating in Wh (meter value)*/
            heatGenerationHeatingWh?: number;
            /** Power generation for domestic hot water in Wh (meter value)*/
            heatGenerationDomesticHotWaterWh?: number;
        };
        /** Grid operator power limitation currently applied by the heatpump, if any */
        gridOperatorLimit?: EnyoGridOperatorLimit;
    }
}

/**
 * Live values of a heating rod (immersion / electric resistive heating
 * element), published by the integration that owns the appliance.
 *
 * Send this whenever the power draw or the operating state changes, so an
 * energy manager can account for the load and decide how much power to
 * announce back via {@link EnyoDataBusSetHeatingRodAvailablePowerV2}.
 */
export interface EnyoDataBusHeatingRodValuesV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.HeatingRodValuesUpdateV1;
    /** ID of the appliance that delivered these values */
    applianceId: string;
    data: {
        /**
         * Current electrical power consumption of the heating rod in Watt.
         * Always positive (a heating rod only consumes). Omit when the
         * integration cannot measure it — do not send `0` as a stand-in for
         * "unknown", since a consumer cannot tell that apart from "off".
         */
        powerW?: number;
        /**
         * Current operating state of the heating element. Omit when the
         * integration cannot determine it.
         */
        state?: EnyoHeatingRodStateEnum;
    }
}

export interface EnyoDataBusBatteryValuesUpdateV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.BatteryValuesUpdateV1;
    /** ID of the appliance that delivered these values */
    applianceId: string;
    data: {
        state?: EnyoBatteryStateEnum;
        /** Current Battery Power (in Watt). Positive = charging of the battery, Negative = Consumption from the Battery. */
        batteryPowerW?: number;
        /** DC String input power (in Watt) */
        dcStringInputPowerW?: number;
        /** Battery State of Charge. Value between 0 and 100 */
        batterySoC: number;
        /** Grid operator power limitation currently applied by the battery, if any */
        gridOperatorLimit?: EnyoGridOperatorLimit;
    }
}

export interface EnyoDataBusInverterValuesV1String {
    index: number;
    name?: string;
    voltage?: number;
    powerW?: number;
    current?: number;
    state?: EnyoStringStateEnum;
    /** Cumulative energy meter reading for this DC string in Watt hours */
    meterValueWh?: number;
}

export interface EnyoDataBusInverterValuesV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.InverterValuesUpdateV1;
    /** ID of the appliance that delivered these values */
    applianceId: string;
    data: {
        /** Operation State of the inverter */
        state?: EnyoInverterStateEnum;
        /** Current PV Production (in Watt) */
        pvPowerW: number;
        /** voltage of Phase L1 to N in V */
        voltageL1: number;
        /** voltage of Phase L2 to N in V */
        voltageL2?: number;
        /** voltage of Phase L3 to N in V */
        voltageL3?: number;
        /** Current of Phase L1 to N in A */
        currentL1?: number;
        /** Current of Phase L2 to N in A */
        currentL2?: number;
        /** Current of Phase L3 to N in A */
        currentL3?: number;
        /** DC Power in W */
        dcPowerW?: number;
        /** Active power Limitation of the Inverter */
        activePowerLimitationW?: number;
        /** Cumulative AC energy meter reading of the inverter in Watt hours */
        meterValueWh?: number;
        /** DC String values. Please only provide active strings */
        strings?: EnyoDataBusInverterValuesV1String[];
        /** Grid operator power limitation currently applied by the inverter, if any */
        gridOperatorLimit?: EnyoGridOperatorLimit;
    }
}


export interface EnyoDataBusApplianceFlexibilityAnnouncementV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.ApplianceFlexibilityAnnouncementV1;
    /** ID of the appliance */
    applianceId: string;
    data: {
        flexibility: {
            kWh: number;
            /** Defines until the kWh flexibility can be shifted. If for Example 10 kWh can be shifted until 2025-10-01T14:00:00 (current time 2025-10-01T10:00:00), the control can shift the 10 kWh in the next 4 hours */
            availableUntilIsoTimestamp: string;
        }
    }
}

/**
 * Message sent when an appliance's connectivity state and/or health status
 * changes. At least one of `state` or `status` should be set; both may be
 * provided together if they change in the same event. `errorCodes` carries
 * vendor- or protocol-specific codes that explain a transition into a
 * `warning` or `faulted` status; each entry's `severity` field indicates
 * which.
 */
export interface EnyoDataBusApplianceStateUpdateV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.ApplianceStateUpdateV1;
    /** ID of the appliance whose state and/or status changed */
    applianceId: string;
    data: {
        /** New connectivity state of the appliance, if it changed */
        state?: EnyoApplianceStateEnum;
        /** New health status of the appliance, if it changed */
        status?: EnyoApplianceStatusEnum;
        /**
         * Optional vendor- or protocol-specific error codes that explain the
         * current status. Each entry carries the raw code and may include
         * pre-translated messages for UI display, plus an optional `severity`
         * (`'error'` or `'warning'`). Typically populated when transitioning
         * into `warning` or `faulted`; omitted or empty when there is nothing
         * to report.
         */
        errorCodes?: EnyoApplianceErrorCode[];
    };
}

/**
 * Message emitted when an energy app package finishes startup and is now
 * actively driving its appliances. Carries the running package's identity
 * plus the full set of appliance ids it has registered against, so
 * consumers can correlate subsequent activity to this package instance
 * and learn which appliances are now under its influence.
 *
 * Broadcast (no `target`) — anyone observing the data bus may listen.
 * The base {@link EnyoDataBusMessage.applianceId} field is intentionally
 * left unset; this message scopes to *all* affected appliances via
 * `data.applianceIds` rather than a single one.
 */
export interface EnyoDataBusEnergyAppStartedV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.EnergyAppStartedV1;
    data: {
        /**
         * Cloud-deployment id of the started package. Matches
         * {@link EnyoDataBusMessageTarget.cloudPackageId} so consumers
         * can address replies back at this package instance.
         */
        cloudPackageId: string;
        /**
         * Package slug from the started package's
         * {@link EnergyAppPackageDefinition.packageName}. Stable across
         * deployments of the same package, suitable for grouping
         * activity by package implementation rather than by instance.
         */
        packageName: string;
        /**
         * Ids of every appliance this package has registered against —
         * the appliances whose lifecycle is now influenced by the
         * running app. Empty array is legal (the package started but
         * has not yet resolved any appliances).
         */
        applianceIds: string[];
    };
}

export interface EnyoDataBusChargingStartedV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.ChargingStartedV1;
    /** ID of the appliance (charger) that started the session */
    applianceId: string;
    data: {
        /** Connector ID on the charge point (usually 1) */
        connectorId: number;
        /** OCPP transaction identifier */
        transactionId: string;
        /** used charging card */
        chargingCardId?: string;
        /** Who initiated the charging session — the enyo app or the charger itself */
        initiator: EnyoChargeInitiatorEnum;
        /** The charge mode of the started charge. If initiated by wallbox, use either user settings or immediate as default */
        chargeMode: EnyoChargeModeEnum;
        /** ISO timestamp for target completion time (optional) */
        completeChargeAtIso?: string;
        /** vehicle that's charging */
        vehicleId?: string;
        /** Meter reading at session start in Watt hours */
        meterValueWh: number;
    };
}

export interface EnyoDataBusChargingMeterValuesV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.ChargingMeterValuesUpdateV1;
    /** ID of the appliance (charger) providing the meter values */
    applianceId: string;
    data: {
        /** Connector ID on the charge point */
        connectorId: number;
        /** OCPP transaction identifier */
        transactionId: string;
        /** Current cumulative meter reading in Watt hours */
        meterValueWh: number;
        /** Current charging power in Watts */
        chargingPowerW: number;
        /** Voltage on phase L1 */
        voltageL1: number;
        /** Voltage on phase L2 (optional for single-phase chargers) */
        voltageL2?: number;
        /** Voltage on phase L3 (optional for single/two-phase chargers) */
        voltageL3?: number;
        /** Electric vehicle state of charge in percent (if available) */
        evStateOfChargePercent?: number;
        /** Total energy delivered since session start in Watt hours */
        energyDeliveredWh: number;
        /** Context indicating when this meter value was taken */
        context: EnyoChargingMeterValueContext;
        /** Grid operator power limitation currently applied by the charger, if any */
        gridOperatorLimit?: EnyoGridOperatorLimit;
    };
}

export interface EnyoDataBusChargingStoppedV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.ChargingStoppedV1;
    /** ID of the appliance (charger) that handled the session */
    applianceId: string;
    data: {
        /** Connector ID on the charge point */
        connectorId: number;
        /** OCPP transaction identifier */
        transactionId: string;
        /** Final meter reading at session end in Watt hours */
        meterValueWh: number;
        /** Total energy delivered during the session in Watt hours */
        energyDeliveredWh: number;
        /** Reason why the charging session was stopped */
        stopReason: EnyoChargingStopReason;
    };
}

/**
 * Message sent when a charging session fails to start.
 * This message indicates that an attempt to start charging was unsuccessful.
 */
export interface EnyoDataBusStartChargingFailedV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.StartChargingFailedV1;
    /** ID of the appliance (charger) where the start attempt failed */
    applianceId: string;
    data: {
        /** ID of the vehicle that attempted to start charging */
        vehicleId?: string;
        /** ID of the charging card used in the failed start attempt */
        chargingCardId?: string;
    };
}

export interface EnyoDataBusStopChargingFailedV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.StartChargingFailedV1;
    /** ID of the appliance (charger) where the start attempt failed */
    applianceId: string;
    data: {
        transactionId: string;
        /** ID of the vehicle that attempted to start charging */
        vehicleId?: string;
        /** ID of the charging card used in the failed start attempt */
        chargingCardId?: string;
        reason?: string;
    };
}

export interface EnyoDataBusAggregatedStateValuesV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.AggregatedStateUpdateV1;
    clockId: string;
    data: {
        /**
         * ID of the primary meter appliance whose readings the aggregated grid
         * power values are derived from. Omitted when no primary meter is
         * configured.
         */
        primaryMeterApplianceId?: string;
        /** Total grid power from all appliances (in Watt). Negative: grid feed in, positive: grid consumption */
        gridPowerW?: number;
        /** Grid power on phase L1 (in Watt). Negative: grid feed in, positive: grid consumption */
        gridPowerPhase1W?: number;
        /** Grid power on phase L2 (in Watt). Negative: grid feed in, positive: grid consumption */
        gridPowerPhase2W?: number;
        /** Grid power on phase L3 (in Watt). Negative: grid feed in, positive: grid consumption */
        gridPowerPhase3W?: number;
        /**
         * Time resolution of the aggregated grid power values (e.g. the sampling
         * interval the `gridPowerW` / `gridPowerPhaseXW` values were measured at).
         * Use `'dynamic'` when the values are forwarded as events occur.
         */
        gridPowerResolution: EnyoDataBusMessageResolution;
        gridConsumptionW?: number;
        gridFeedInW?: number;
        homeConsumptionW?: number;
        homeConsumptionWithAppliancesW?: number;
        /** battery power from all appliances (in Watt). Positive = consumption, negative = charging */
        batteryPowerW?: number;
        /** Total PV production from all appliances (in Watt) */
        pvProductionPowerW?: number;
        heatpumpPowerW?: number;
        chargerPowerW?: number;
        autarkyPercentage?: number;
        /** Array of all appliances with their individual values and current state */
        appliances: Array<{
            /** ID of the appliance */
            applianceId: string;
            /** Type of the appliance */
            type: EnyoApplianceTypeEnum;
            /** Current connection state of the appliance */
            state: EnyoApplianceStateEnum;
            /** the current state values of the appliance */
            values: EnyoAggregatedStateApplianceValues;
        }>;
    };
}

export interface EnyoDataBusPauseChargingV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.PauseChargingV1;
    data: {
        applianceId: string;
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

export interface EnyoDataBusResumeChargingV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.ResumeChargingV1;
    data: {
        applianceId: string;
        maxChargingPowerKw: number;
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * @deprecated Use {@link EnyoDataBusSetChargerAvailablePowerV2} instead, which
 * carries the available/max power envelope in Watts (`powerW`) rather than
 * kilowatts.
 */
export interface EnyoDataBusChangeChargingPowerV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.ChangeChargingPowerV1;
    applianceId: string;
    data: {
        maxChargingPowerKw: number;
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Shared payload for the V2 "available/max power" command family
 * ({@link EnyoDataBusSetChargerAvailablePowerV2},
 * {@link EnyoDataBusSetHeatingRodAvailablePowerV2}, and — extended with
 * additional context — {@link EnyoDataBusSetHeatpumpAvailablePowerV2}).
 *
 * The energy manager tells the appliance the active-power envelope it may draw;
 * the appliance is free to consume up to (but not more than) `powerW`.
 */
export interface EnyoAvailablePowerCommandData {
    /**
     * Available / maximum active power the appliance may draw, in Watts.
     * Must be non-negative. The appliance must not exceed this envelope.
     */
    powerW: number;
    /** Optional reason why this command was issued */
    reason?: EnyoDataBusCommandReason;
}

/**
 * V2 command announcing the available / maximum active-power envelope (in
 * Watts) a charger may draw. Supersedes the deprecated
 * {@link EnyoDataBusChangeChargingPowerV1}, which carried the limit in
 * kilowatts.
 *
 * The receiving integration should answer with an
 * {@link EnyoDataBusCommandAcknowledgeV1} message referencing this message's
 * `id` to indicate whether the envelope was accepted, rejected, or is not
 * supported.
 */
export interface EnyoDataBusSetChargerAvailablePowerV2 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.SetChargerAvailablePowerV2;
    /** ID of the charger appliance this power envelope applies to */
    applianceId: string;
    data: EnyoAvailablePowerCommandData;
}

/**
 * Command message to change the charge mode of an active or upcoming
 * charging session on a specific charger. Allows switching between e.g.
 * immediate, cost-optimized, or price-limit charging without stopping
 * and restarting the session.
 *
 * The receiving integration should answer with an
 * {@link EnyoDataBusCommandAcknowledgeV1} message that references this
 * message's `id` to indicate whether the mode change was accepted,
 * rejected, or is not supported.
 */
export interface EnyoDataBusChangeChargeModeV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.ChangeChargeModeV1;
    /** ID of the charger appliance whose charge mode should be changed */
    applianceId: string;
    data: {
        /** The new charge mode to apply to the session */
        chargeMode: EnyoChargeModeEnum;
        /**
         * Optional ISO timestamp for target completion time. Relevant for
         * modes such as {@link EnyoChargeModeEnum.CostOptimized} or
         * {@link EnyoChargeModeEnum.PriceLimit} that need a deadline to
         * plan against.
         */
        completeChargeAtIso?: string;
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

export interface EnyoDataBusSetChargingScheduleV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.SetChargingScheduleV1;
    applianceId: string;
    data: {
        /** If set, we set the charging profile bind to a transaction with TxProfile */
        transactionId?: string;
        relativeSchedule: EnyoOcppRelativeSchedule[];
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Command message to start a charging session on a specific charger.
 * This message triggers the charge point to begin charging.
 */
export interface EnyoDataBusStartChargeV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.StartChargeV1;
    applianceId: string;
    data: {
        /** OCPP idTag for authorization */
        idTag: string;
        /** Unique request identifier for tracking this start request */
        requestId: string;
        /** ID of the vehicle to charge (optional) */
        vehicleId?: string;
        /** ID of the charging card used (optional) */
        chargingCardId?: string;
        /** Mode for the charging session (optional) */
        chargeMode: EnyoChargeModeEnum;
        /** ISO timestamp for target completion time (optional) */
        completeChargeAtIso?: string;
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Command message to stop an active charging session.
 * When `transactionId` is provided the charge point ends that specific
 * transaction; when omitted the integration should end the currently
 * active session on the addressed appliance.
 */
export interface EnyoDataBusStopChargeV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.StopChargeV1;
    applianceId: string;
    data: {
        /**
         * OCPP transaction identifier of the session to stop. Optional —
         * if omitted, the integration stops the currently active session
         * for {@link applianceId}.
         */
        transactionId?: string;
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Energy tariff update message for communicating electricity pricing information.
 * Can be sent for specific appliances or system-wide tariff updates.
 */
export interface EnyoDataBusEnergyTariffUpdateV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.EnergyTariffUpdateV1;
    /** Optional ID of the appliance this tariff applies to. If omitted, applies system-wide */
    applianceId?: string;
    data: {
        /** Complete energy tariff information including pricing structure and validity */
        energyPrices: EnyoEnergyPrices;
    };
}

/**
 * Summary message emitted when a charging session has been completed.
 * This message provides a comprehensive overview of the entire charging session,
 * including timing, energy delivered, and optional identification information.
 */
export interface EnyoDataBusChargeFinishedV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.ChargeFinishedV1;
    /** ID of the appliance (charger) that handled the session */
    applianceId: string;
    data: {
        /** Unique identifier for this charge session */
        chargeId: string;
        /** OCPP transaction identifier for the charging session */
        transactionId: string;
        numberOfPhases?: number;
        /** ID of the vehicle that was charged (optional) */
        vehicleId?: string;
        /** ID of the charging card used for this session (optional) */
        chargingCardId?: string;
        /** ISO 8601 timestamp when the charging session started */
        startedAtIso: string;
        /** ISO 8601 timestamp when the charging session ended */
        endedAtIso: string;
        /** Total energy delivered during the session in Watt hours */
        energyDeliveredWh: number;
    };
}

/**
 * Message emitted when a charger's status changes.
 * This message reports the current OCPP status of the charger.
 */
export interface EnyoDataBusChargerStatusChangedV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.ChargerStatusChangedV1;
    /** ID of the appliance (charger) reporting the status change */
    applianceId: string;
    data: {
        /** Current OCPP status of the charger */
        status: EnyoChargerApplianceStatusEnum;
        /** Connector ID on the charge point (optional, for multi-connector chargers) */
        connectorId?: number;
        /**
         * Detailed cause of the suspension. Only meaningful when
         * {@link status} is {@link EnyoChargerApplianceStatusEnum.Suspended};
         * distinguishes an EVSE-side suspension (OCPP `SuspendedEVSE`) from an
         * EV-side suspension (OCPP `SuspendedEV`). Omit when the charger is not
         * suspended or the cause is unknown.
         */
        suspendedReason?: EnyoChargerApplianceSuspendedReasonEnum;
    };
}

/**
 * Request message to get a preview of the optimized charging schedule.
 * Sent when user wants to see the charging plan before starting.
 */
export interface EnyoDataBusRequestPreviewChargingScheduleV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.RequestPreviewChargingScheduleV1;
    data: {
        /** ID of the appliance (charger) to get preview for */
        applianceId: string;
        /** Unique request identifier for correlating the response */
        requestId: string;
        /** Target energy to be delivered in Wh (optional) */
        targetEnergyWh?: number;
        /** Alternative vehicle id instead of targetEnergyWh*/
        vehicleId?: string;
        /** Target completion time as ISO timestamp (optional) */
        completeByIso?: string;
        /** Charger max power setting in Watts for cost comparison (optional) */
        chargerMaxPowerW?: number;
        /** Whether to include cost comparison in response */
        includeCostComparison?: boolean;
    };
}

/**
 * Response message containing the preview charging schedule or indicating unavailability.
 * Sent by energy manager if available, or by device core if not.
 */
export interface EnyoDataBusPreviewChargingScheduleResponseV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.PreviewChargingScheduleResponseV1;
    applianceId: string;
    data: {
        /** The request ID this response corresponds to */
        requestId: string;
        /** Whether a preview charging schedule is available */
        available: boolean;
        /** Preview charging schedule and cost comparison per charging mode. Each entry's costComparison compares against immediate charging. Only present if available=true. */
        chargingModeResults?: PreviewChargingScheduleModeResult[];
        /** Reason why preview is not available (only present if available=false) */
        unavailableReason?: PreviewChargingScheduleUnavailableReasonEnum;
    };
}

/**
 * Result for a single charging mode in a preview charging schedule response.
 * Contains the schedule and optional cost comparison for one specific charging mode.
 */
export interface PreviewChargingScheduleModeResult {
    /** The charging mode this result represents */
    chargeMode: EnyoChargeModeEnum;
    /** The preview charging schedule for this mode */
    schedule: PreviewChargingSchedule;
    /** Cost comparison of this mode vs immediate charging (only present if cost data is available) */
    costComparison?: PreviewChargingScheduleCostComparison;
}

/**
 * Available resolution options for forecast data points.
 */
export type EnyoForecastResolution = '10s' | '1m' | '5m' | '15m' | '1h';

/**
 * A single data point in a PV forecast, containing power and energy values.
 */
export interface EnyoPvForecastDataPoint {
    /** ISO 8601 timestamp for this forecast data point */
    timestampIso: string;
    /** Forecasted PV power in Watts */
    powerW: number;
    /** Forecasted PV energy in Watt hours for this interval */
    powerWh: number;
}

/**
 * A single data point in a battery forecast, containing capacity and state of charge values.
 */
export interface EnyoBatteryForecastDataPoint {
    /** ISO 8601 timestamp for this forecast data point */
    timestampIso: string;
    /** Forecasted battery capacity in Watt hours */
    capacityWh: number;
    /** Forecasted battery state of charge in percent (0-100) */
    socPercent: number;
}

/**
 * A single data point in a home consumption forecast, containing power and energy values.
 */
export interface EnyoHomeConsumptionForecastDataPoint {
    /** ISO 8601 timestamp for this forecast data point */
    timestampIso: string;
    /** Forecasted home consumption power in Watts */
    powerW: number;
    /** Forecasted home consumption energy in Watt hours for this interval */
    powerWh: number;
}

/**
 * A single data point in an EV charging forecast, containing power and energy values.
 */
export interface EnyoEvChargingForecastDataPoint {
    /** ISO 8601 timestamp for this forecast data point */
    timestampIso: string;
    /** Forecasted EV charging power in Watts */
    powerW: number;
    /** Forecasted EV charging energy in Watt hours for this interval */
    powerWh: number;
}

/**
 * A single data point in a heatpump consumption forecast, containing power and energy values.
 */
export interface EnyoHeatpumpConsumptionForecastDataPoint {
    /** ISO 8601 timestamp for this forecast data point */
    timestampIso: string;
    /** Forecasted heatpump consumption power in Watts */
    powerW: number;
    /** Forecasted heatpump consumption energy in Watt hours for this interval */
    powerWh: number;
}

/**
 * A single data point in a heatpump DHW temperature forecast.
 */
export interface EnyoHeatpumpDhwTemperatureForecastDataPoint {
    /** ISO 8601 timestamp for this forecast data point */
    timestampIso: string;
    /** Forecasted domestic hot water temperature in Celsius */
    temperatureC: number;
}

/**
 * A single data point in an air conditioning consumption forecast, containing
 * power and energy values.
 */
export interface EnyoAirConditioningConsumptionForecastDataPoint {
    /** ISO 8601 timestamp for this forecast data point */
    timestampIso: string;
    /** Forecasted air conditioning consumption power in Watts */
    powerW: number;
    /** Forecasted air conditioning consumption energy in Watt hours for this interval */
    powerWh: number;
}

/**
 * A single data point in an air conditioning room temperature forecast.
 */
export interface EnyoAirConditioningRoomTemperatureForecastDataPoint {
    /** ISO 8601 timestamp for this forecast data point */
    timestampIso: string;
    /** Forecasted room temperature in Celsius */
    temperatureC: number;
}

/**
 * Message for delivering PV production forecast data.
 * Contains forecasted power and energy values at the specified resolution.
 * Can be sent for a specific PV appliance or as a total across all PV systems.
 */
export interface EnyoDataBusPvForecastV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.PvForecastV1;
    /** Optional ID of the specific PV appliance. Omit for total forecast. */
    applianceId?: string;
    data: {
        /** Resolution of the forecast data points */
        resolution: EnyoForecastResolution;
        /** Array of forecast data points */
        entries: EnyoPvForecastDataPoint[];
    };
}

/**
 * Message for delivering battery forecast data.
 * Contains forecasted capacity and state of charge values at the specified resolution.
 * Can be sent for a specific battery appliance or as a total across all batteries.
 */
export interface EnyoDataBusBatteryForecastV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.BatteryForecastV1;
    /** Optional ID of the specific battery appliance. Omit for total forecast. */
    applianceId?: string;
    data: {
        /** Resolution of the forecast data points */
        resolution: EnyoForecastResolution;
        /** Array of forecast data points */
        entries: EnyoBatteryForecastDataPoint[];
    };
}

/**
 * Message for delivering home consumption forecast data.
 * Contains forecasted power and energy values at the specified resolution.
 * Always represents the total home consumption (no per-appliance breakdown).
 */
export interface EnyoDataBusHomeConsumptionForecastV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.HomeConsumptionForecastV1;
    data: {
        /** Resolution of the forecast data points */
        resolution: EnyoForecastResolution;
        /** Array of forecast data points */
        entries: EnyoHomeConsumptionForecastDataPoint[];
    };
}

/**
 * Message for delivering EV charging forecast data.
 * Contains forecasted power and energy values at the specified resolution.
 * Can be sent for a specific charger appliance or as a total across all chargers.
 */
export interface EnyoDataBusEvChargingForecastV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.EvChargingForecastV1;
    /** Optional ID of the specific charger appliance. Omit for total forecast. */
    applianceId?: string;
    data: {
        /** Resolution of the forecast data points */
        resolution: EnyoForecastResolution;
        /** Array of forecast data points */
        entries: EnyoEvChargingForecastDataPoint[];
    };
}

/**
 * Message for delivering heatpump consumption forecast data.
 * Contains forecasted power and energy values at the specified resolution.
 * Always sent for a specific heatpump appliance.
 */
export interface EnyoDataBusHeatpumpConsumptionForecastV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.HeatpumpConsumptionForecastV1;
    /** ID of the heatpump appliance this forecast applies to */
    applianceId: string;
    data: {
        /** Resolution of the forecast data points */
        resolution: EnyoForecastResolution;
        /** Array of forecast data points */
        entries: EnyoHeatpumpConsumptionForecastDataPoint[];
    };
}

/**
 * Message for delivering heatpump domestic hot water temperature forecast data.
 * Contains forecasted temperature values at the specified resolution.
 * Always sent for a specific heatpump appliance.
 */
export interface EnyoDataBusHeatpumpDhwTemperatureForecastV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.HeatpumpDhwTemperatureForecastV1;
    /** ID of the heatpump appliance this forecast applies to */
    applianceId: string;
    data: {
        /** Resolution of the forecast data points */
        resolution: EnyoForecastResolution;
        /** Array of forecast data points */
        entries: EnyoHeatpumpDhwTemperatureForecastDataPoint[];
    };
}

/**
 * Message for delivering air conditioning electrical consumption forecast data.
 * Contains forecasted power and energy values at the specified resolution.
 * Always sent for a specific air conditioning appliance.
 */
export interface EnyoDataBusAirConditioningConsumptionForecastV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.AirConditioningConsumptionForecastV1;
    /** ID of the air conditioning appliance this forecast applies to */
    applianceId: string;
    data: {
        /** Resolution of the forecast data points */
        resolution: EnyoForecastResolution;
        /** Array of forecast data points */
        entries: EnyoAirConditioningConsumptionForecastDataPoint[];
    };
}

/**
 * Message for delivering air conditioning room temperature forecast data.
 * Contains forecasted temperature values at the specified resolution, either
 * for a single room or averaged across all rooms served by the appliance.
 * Always sent for a specific air conditioning appliance.
 */
export interface EnyoDataBusAirConditioningRoomTemperatureForecastV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.AirConditioningRoomTemperatureForecastV1;
    /** ID of the air conditioning appliance this forecast applies to */
    applianceId: string;
    data: {
        /** Resolution of the forecast data points */
        resolution: EnyoForecastResolution;
        /**
         * Zero-based index of the room this forecast applies to. Omitted when
         * the forecast averages across all rooms of the appliance.
         */
        roomIndex?: number;
        /** Array of forecast data points */
        entries: EnyoAirConditioningRoomTemperatureForecastDataPoint[];
    };
}

/**
 * Message carrying the live state of a user-configured automation's trigger.
 * Published by the `EnergyManager` app that owns the trigger whenever the
 * condition changes (e.g. PV surplus crosses the configured threshold).
 * Consumers subscribe via {@link EnyoDataBusMessageEnum.AutomationTriggerV1}.
 */
export interface EnyoDataBusAutomationTriggerV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.AutomationTriggerV1;
    /** Id of the automation this trigger state applies to. */
    automationId: string;
    data: {
        /** Whether the trigger condition is currently met. */
        active: boolean;
        /** Trigger-type-specific metadata (e.g. surplusW / thresholdW for PV surplus). */
        trigger: EnyoAutomationTriggerData;
    };
}

/**
 * Command message to start charging a storage/battery from the grid.
 * Instructs the battery system to begin drawing power from the grid up to the specified limit.
 *
 * @deprecated Use {@link EnyoDataBusSetStorageScheduleV1} instead. The
 * schedule message expresses "charge from the grid at N watts now" as
 * a single relative-schedule entry with `direction: 'charge'` and
 * `powerW: N` at `seconds: 0`. Maintained for backward compatibility;
 * new senders and receivers should switch to the schedule message.
 */
export interface EnyoDataBusStartStorageGridChargeV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.StartStorageGridChargeV1;
    /** ID of the battery/storage appliance to charge */
    applianceId: string;
    data: {
        /** Maximum power in watts for grid-to-storage charging */
        powerLimitW: number;
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Command message to stop charging a storage/battery from the grid.
 * Instructs the battery system to end grid-to-storage charging.
 *
 * @deprecated Use {@link EnyoDataBusSetStorageScheduleV1} with
 * `mode: 'auto'` to hand control back to the appliance, or send a
 * schedule whose first entry is `powerW: 0`. Maintained for backward
 * compatibility.
 */
export interface EnyoDataBusStopStorageGridChargeV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.StopStorageGridChargeV1;
    /** ID of the battery/storage appliance to stop charging */
    applianceId: string;
    data: {
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Command message to start discharging a storage/battery into the grid.
 * Instructs the battery system to begin feeding power into the grid up to the specified limit.
 *
 * @deprecated Use {@link EnyoDataBusSetStorageScheduleV1} instead — a
 * single relative-schedule entry with `direction: 'discharge'` and the
 * desired `powerW` at `seconds: 0` carries the same intent. Maintained
 * for backward compatibility.
 */
export interface EnyoDataBusStartStorageGridDischargeV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.StartStorageGridDischargeV1;
    /** ID of the battery/storage appliance to discharge */
    applianceId: string;
    data: {
        /** Maximum power in watts for storage-to-grid discharging */
        powerLimitW: number;
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Command message to stop discharging a storage/battery into the grid.
 * Instructs the battery system to end storage-to-grid discharging.
 *
 * @deprecated Use {@link EnyoDataBusSetStorageScheduleV1} with
 * `mode: 'auto'` to hand control back to the appliance, or send a
 * schedule whose first entry is `powerW: 0`. Maintained for backward
 * compatibility.
 */
export interface EnyoDataBusStopStorageGridDischargeV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.StopStorageGridDischargeV1;
    /** ID of the battery/storage appliance to stop discharging */
    applianceId: string;
    data: {
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Command message to limit the discharge rate of a storage/battery.
 * Sets the maximum discharge power as a percentage of the battery's maximum discharge capacity.
 *
 * @deprecated Use {@link EnyoDataBusSetStorageScheduleV1} instead — the
 * schedule's per-entry `powerW` (paired with `direction: 'discharge'`)
 * subsumes the standalone discharge cap. Maintained for backward
 * compatibility.
 */
export interface EnyoDataBusSetStorageDischargeLimitV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.SetStorageDischargeLimitV1;
    /** ID of the battery/storage appliance to limit */
    applianceId: string;
    data: {
        /** Discharge limit in W to limit the battery's discharge power */
        dischargeLimitW: number;
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Command message to limit the charge rate of a storage/battery.
 * Sets the maximum charge power in watts that the battery is allowed to draw while charging.
 *
 * @deprecated Use {@link EnyoDataBusSetStorageScheduleV1} instead — the
 * schedule's per-entry `powerW` (paired with `direction: 'charge'`)
 * subsumes the standalone charge cap. Maintained for backward
 * compatibility.
 */
export interface EnyoDataBusSetStorageChargeLimitV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.SetStorageChargeLimitV1;
    /** ID of the battery/storage appliance to limit */
    applianceId: string;
    data: {
        /** Charge limit in W to limit the battery's charge power */
        chargeLimitW: number;
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Storage control mode carried by {@link EnyoDataBusSetStorageScheduleV1}.
 *
 * - `Auto` returns full control to the appliance's own logic — the energy
 *   manager is no longer prescribing setpoints. Used to release a
 *   previously-issued schedule.
 * - `Schedule` instructs the appliance to follow the relative-schedule
 *   setpoint stream carried alongside the message.
 */
export enum EnyoStorageScheduleModeEnum {
    /** Hand control back to the appliance's own logic. */
    Auto = 'auto',
    /** Follow the relative schedule carried by the message. */
    Schedule = 'schedule',
}

/**
 * Direction of energy flow for one entry of a storage relative schedule.
 *
 * Direction is encoded as an explicit enum rather than a signed `powerW`
 * to keep schedule entries unambiguous on the wire: `powerW` is always
 * non-negative, and consumers never have to disambiguate `0` from
 * "direction-of-zero" or interpret sign conventions per integration.
 *
 * `Idle` is the explicit "no energy flow" marker — use it to insert
 * idle slots between charge / discharge periods. An entry with
 * `direction = Idle` must carry `powerW = 0`.
 */
export enum EnyoStorageScheduleDirectionEnum {
    /** Power should flow from the grid into the battery (charging). */
    Charge = 'charge',
    /** Power should flow from the battery into the grid / home (discharging). */
    Discharge = 'discharge',
    /**
     * No energy flow — the battery holds its current state-of-charge.
     * Use to mark idle periods between charge / discharge entries. The
     * entry's `powerW` must be `0`.
     */
    Idle = 'idle',
}

/**
 * A single setpoint within a storage relative schedule. The setpoint
 * becomes active {@link seconds} after the receiving appliance processes
 * the carrying {@link EnyoDataBusSetStorageScheduleV1} message and stays
 * active until the next entry's `seconds` is reached, or — for the final
 * entry — until a new schedule arrives.
 */
export interface EnyoStorageScheduleEntry {
    /**
     * Seconds from the moment the appliance receives the schedule message
     * at which this setpoint becomes active. The first entry of a schedule
     * should have `seconds = 0` so the appliance has a setpoint for "right
     * now"; entries thereafter must be strictly increasing.
     */
    seconds: number;
    /**
     * Direction of energy flow for this setpoint
     * ({@link EnyoStorageScheduleDirectionEnum.Charge},
     * {@link EnyoStorageScheduleDirectionEnum.Discharge}, or
     * {@link EnyoStorageScheduleDirectionEnum.Idle}).
     */
    direction: EnyoStorageScheduleDirectionEnum;
    /**
     * Target power for this setpoint in Watts. Always non-negative —
     * direction is carried by {@link direction}, never by sign. A
     * `powerW` of `0` together with a `Charge` or `Discharge` direction
     * means "hold at zero in the named direction" (effectively idle
     * until the next entry); prefer the explicit
     * {@link EnyoStorageScheduleDirectionEnum.Idle} direction for
     * unambiguous idle slots, in which case `powerW` must also be `0`.
     */
    powerW: number;
}

/**
 * Command message that prescribes a storage/battery's full control plan
 * over a short relative horizon.
 *
 * Replaces the legacy start / stop / limit message family
 * ({@link EnyoDataBusStartStorageGridChargeV1},
 * {@link EnyoDataBusStopStorageGridChargeV1},
 * {@link EnyoDataBusStartStorageGridDischargeV1},
 * {@link EnyoDataBusStopStorageGridDischargeV1},
 * {@link EnyoDataBusSetStorageDischargeLimitV1},
 * {@link EnyoDataBusSetStorageChargeLimitV1}) with a single shape that
 * carries the full control intent — direction + power — at every
 * scheduled instant.
 *
 * When {@link data.mode} is {@link EnyoStorageScheduleModeEnum.Auto} the
 * appliance regains full control of its own logic and the
 * {@link data.relativeSchedule} field is omitted. When `mode` is
 * {@link EnyoStorageScheduleModeEnum.Schedule} the appliance follows the
 * provided schedule; the schedule MUST be sorted ascending by
 * {@link EnyoStorageScheduleEntry.seconds} and SHOULD start at
 * `seconds = 0` so the appliance has an authoritative setpoint
 * immediately.
 *
 * The receiving integration should answer with an
 * {@link EnyoDataBusCommandAcknowledgeV1} message that references this
 * message's `id` to indicate whether the schedule was accepted, rejected,
 * or is not supported.
 */
export interface EnyoDataBusSetStorageScheduleV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.SetStorageScheduleV1;
    /** ID of the battery/storage appliance the schedule applies to. */
    applianceId: string;
    data: {
        /**
         * Control mode. `Auto` releases the appliance back to its own
         * logic; `Schedule` instructs it to follow {@link relativeSchedule}.
         */
        mode: EnyoStorageScheduleModeEnum;
        /**
         * The relative schedule the appliance should follow, sorted
         * ascending by {@link EnyoStorageScheduleEntry.seconds}. Present
         * only when {@link mode} is
         * {@link EnyoStorageScheduleModeEnum.Schedule}; omitted when
         * `mode` is {@link EnyoStorageScheduleModeEnum.Auto}. The first
         * entry should be at `seconds = 0` so the appliance has a
         * setpoint for "right now".
         */
        relativeSchedule?: EnyoStorageScheduleEntry[];
        /** Optional reason why this command was issued. */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Control mode carried by {@link EnyoDataBusSetStorageControlV2}.
 *
 * - `Controlled` — the energy manager prescribes an explicit direction and
 *   power setpoint (see {@link EnyoDataBusSetStorageControlV2.data.control}).
 * - `Auto` — control is handed back to the battery's own logic; no setpoint is
 *   prescribed.
 */
export enum EnyoStorageControlModeEnum {
    /** The EMS prescribes direction + power via the `control` field. */
    Controlled = 'controlled',
    /** Hand control back to the battery's own logic. */
    Auto = 'auto',
}

/**
 * Direction of energy flow for a {@link EnyoDataBusSetStorageControlV2} setpoint.
 *
 * Direction is encoded explicitly (rather than via a signed `powerW`) so the
 * setpoint is unambiguous on the wire: `powerW` is always non-negative.
 */
export enum EnyoStorageControlDirectionEnum {
    /** Power should flow into the battery (charging). */
    Charge = 'charge',
    /** Power should flow out of the battery (discharging). */
    Discharge = 'discharge',
    /**
     * The battery should hold its current state-of-charge (no energy flow).
     * The accompanying `powerW` must be `0`.
     */
    Hold = 'hold',
}

/**
 * V2 command prescribing a single-setpoint control plan for a battery/storage
 * appliance — the immediate-control counterpart to the horizon-based
 * {@link EnyoDataBusSetStorageScheduleV1} (which remains available for
 * multi-setpoint plans).
 *
 * When {@link data.mode} is {@link EnyoStorageControlModeEnum.Auto} the battery
 * regains full control of its own logic and {@link data.control} is omitted.
 * When `mode` is {@link EnyoStorageControlModeEnum.Controlled} the appliance
 * must apply the prescribed {@link data.control} direction and power until a
 * new command arrives.
 *
 * The receiving integration should answer with an
 * {@link EnyoDataBusCommandAcknowledgeV1} message referencing this message's
 * `id`.
 */
export interface EnyoDataBusSetStorageControlV2 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.SetStorageControlV2;
    /** ID of the battery/storage appliance the control applies to. */
    applianceId: string;
    data: {
        /**
         * Control mode. `Controlled` prescribes {@link control}; `Auto`
         * releases the appliance back to its own logic.
         */
        mode: EnyoStorageControlModeEnum;
        /**
         * The prescribed setpoint. Present only when {@link mode} is
         * {@link EnyoStorageControlModeEnum.Controlled}; omitted for
         * {@link EnyoStorageControlModeEnum.Auto}.
         */
        control?: {
            /** Direction of energy flow (charge / discharge / hold). */
            direction: EnyoStorageControlDirectionEnum;
            /**
             * Target power in Watts. Always non-negative — direction is carried
             * by {@link direction}, never by sign. Must be `0` when
             * {@link direction} is {@link EnyoStorageControlDirectionEnum.Hold}.
             */
            powerW: number;
        };
        /** Optional reason why this command was issued. */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Command message to set or reset the inverter's grid feed-in power limit.
 * When a limit is set, the inverter will not feed more than the specified power into the grid.
 * When set to null, the feed-in limit is removed and the inverter returns to default behavior.
 */
export interface EnyoDataBusSetInverterFeedInLimitV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.SetInverterFeedInLimitV1;
    /** ID of the inverter appliance to limit */
    applianceId: string;
    data: {
        /** Feed-in limit in watts, or null to reset to default (no limit) */
        feedInLimitW: number | null;
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Possible answers an appliance can give when acknowledging a command.
 */
export enum EnyoCommandAcknowledgeAnswerEnum {
    /** The command was accepted and will be executed */
    Accepted = 'Accepted',
    /** The command was rejected by the appliance */
    Rejected = 'Rejected',
    /** The command is not supported by this appliance */
    NotSupported = 'NotSupported'
}

/**
 * Acknowledgment message sent by an appliance in response to a command.
 * Contains the original message ID and the appliance's answer.
 */
export interface EnyoDataBusCommandAcknowledgeV1 extends EnyoDataBusMessage {
    type: 'answer';
    message: EnyoDataBusMessageEnum.CommandAcknowledgeV1;
    /** ID of the appliance acknowledging the command */
    applianceId: string;
    data: {
        /** ID of the original command message being acknowledged */
        messageId: string;
        /** The original message */
        acknowledgeMessage: EnyoDataBusMessageEnum;
        /** The appliance's acknowledgment answer */
        answer: EnyoCommandAcknowledgeAnswerEnum;
        /** Optional reason for rejection (relevant when answer is Rejected or NotSupported) */
        rejectionReason?: string;
    };
}

/**
 * A single temperature sensor reading within a temperature sensor values update.
 */
export interface EnyoTemperatureSensorValue {
    /** Unique sensor identifier */
    id: string;
    /** Current temperature in Celsius */
    temperatureC: number;
    /** Optional target temperature in Celsius */
    targetTemperatureC?: number;
}

/**
 * Data bus message for reporting temperature sensor values.
 * Contains an array of sensor readings from a temperature sensor appliance.
 */
export interface EnyoDataBusTemperatureSensorValuesV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.TemperatureSensorValuesUpdateV1;
    /** ID of the temperature sensor appliance that delivered these values */
    applianceId: string;
    data: {
        /** Array of temperature sensor readings */
        sensors: EnyoTemperatureSensorValue[];
    };
}

/**
 * Data bus message for reporting heatpump-specific temperature values.
 * Contains outdoor temperature, domestic hot water temperatures, flow temperature,
 * heating circuit temperatures, and buffer tank temperature from a heatpump appliance.
 */
export interface EnyoDataBusHeatpumpTemperaturesV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.HeatpumpTemperaturesUpdateV1;
    /** ID of the heatpump appliance that delivered these temperature values */
    applianceId: string;
    data: {
        /** Outdoor temperature in Celsius */
        outdoorTemperatureC?: number;
        /** Domestic hot water tank temperatures */
        domesticHotWater?: {
            /** Index of the domestic hot water tank */
            index: number;
            /**
             * Human-readable zone name (e.g. the `description` from SPINE
             * `Identification.identificationListData` for this zone index).
             * Omit when no identification is available.
             */
            name?: string;
            /** Target temperature in Celsius */
            targetTemperatureC: number;
            /** Current temperature in Celsius */
            temperatureC: number;
        }[];
        /** Heatpump flow temperature in Celsius */
        heatpumpFlowTemperatureC?: number;
        /** Heating circuit temperatures */
        heatingCircuits?: {
            /** Index of the heating circuit */
            index: number;
            /**
             * Human-readable zone name (e.g. the `description` from SPINE
             * `Identification.identificationListData` for this zone index).
             * Omit when no identification is available.
             */
            name?: string;
            /** Target temperature in Celsius */
            targetTemperatureC: number;
            /** Current temperature in Celsius */
            temperatureC: number;
            /** Target room temperature in Celsius */
            targetRoomTemperatureC?: number;
            /** Current room temperature in Celsius */
            roomTemperatureC?: number;
        }[];
        /** Buffer tank temperature */
        bufferTank?: {
            index: number;
            /** Current buffer tank temperature in Celsius */
            temperatureC: number;
        }[];
    };
}

/**
 * Informational message sent by an appliance when its maximum charging power has changed.
 * This allows the energy manager to adjust its optimization based on current appliance capabilities.
 */
export interface EnyoDataBusMaxChargingPowerChangedV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.MaxChargingPowerChangedV1;
    /** ID of the appliance reporting the change */
    applianceId: string;
    data: {
        /** Maximum charging power in kilowatts */
        maxChargingPowerKw: number;
    };
}

/**
 * Informational message sent by an appliance when its maximum discharge power has changed.
 * This allows the energy manager to adjust its optimization based on current appliance capabilities.
 */
export interface EnyoDataBusMaxDischargePowerChangedV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.MaxDischargePowerChangedV1;
    /** ID of the appliance reporting the change */
    applianceId: string;
    data: {
        /** Maximum discharge power in kilowatts */
        maxDischargePowerKw: number;
    };
}

/**
 * Command message for grid operator power limitations directed at the energy manager.
 * Communicates whether a power limitation is active, the power limit, and when it ends.
 * The energy manager should adjust its optimization strategy accordingly.
 */
export interface EnyoDataBusGridOperatorPowerLimitationV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.GridOperatorPowerLimitationV1;
    data: {
        /** Whether the grid operator power limitation is currently active */
        active: boolean;
        /** The power limitation in watts */
        powerLimitationW: number;
        /** ISO 8601 timestamp when the limitation ends */
        endTimestampIso: string;
    };
}

/**
 * Command message for grid operator power production limitations directed at the energy manager.
 * Communicates whether a production-side power limitation (i.e. how much power may be fed into
 * the grid) is active, the power limit, and when it ends. The energy manager should adjust its
 * optimization strategy accordingly (e.g. curtail PV feed-in, prefer self-consumption, charge
 * batteries from surplus).
 */
export interface EnyoDataBusGridOperatorPowerProductionLimitationV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.GridOperatorPowerProductionLimitationV1;
    data: {
        /** Whether the grid operator power production limitation is currently active */
        active: boolean;
        /** The power production limitation in watts (maximum allowed feed-in power) */
        powerLimitationW: number;
        /** ISO 8601 timestamp when the limitation ends */
        endTimestampIso: string;
    };
}

/**
 * Announcement message published by an appliance reporting the grid operator
 * power limitation it actually executed. Sent in response to a
 * `GridOperatorPowerLimitationV1` command (§14a EnWG) once the appliance has
 * applied the limit locally. Lets the energy manager, analytics and UI observe
 * the concrete cap that was enforced, when it ends and for how long.
 */
export interface EnyoDataBusGridOperatorPowerLimitationExecutedV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.GridOperatorPowerLimitationExecutedV1;
    /** ID of the appliance that executed the limitation */
    applianceId: string;
    data: EnyoGridOperatorLimit & {
        /** Optional reason why this limitation was executed */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Command message to reset a charger appliance.
 * Sends a reset command to the specified charger, which performs a soft reset
 * restoring the charger to its initial configuration without a full power cycle.
 */
export interface EnyoDataBusResetChargerV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.ResetChargerV1;
    /** ID of the charger appliance to reset */
    applianceId: string;
    data: {
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Command message to reboot a charger appliance.
 * Sends a reboot command to the specified charger, which performs a full power cycle
 * including hardware restart of the charger.
 */
export interface EnyoDataBusRebootChargerV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.RebootChargerV1;
    /** ID of the charger appliance to reboot */
    applianceId: string;
    data: {
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Command message to request diagnostic logs from a charger appliance for a specific day.
 * The charger should upload its logs to the provided upload URL.
 */
export interface EnyoDataBusRequestChargerLogsV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.RequestChargerLogsV1;
    /** ID of the charger appliance to request logs from */
    applianceId: string;
    data: {
        /** URL where the charger should upload its logs */
        uploadUrl: string;
        /** Optional date for which to retrieve logs (format: yyyy-mm-dd). If omitted, the charger should upload all available logs. */
        date?: string;
    };
}

/**
 * Enum representing the type of charging profile to clear.
 * Maps to OCPP charging profile purpose types.
 */
export enum EnyoChargingProfileTypeEnum {
    /** Maximum charging profile for the entire charge point */
    ChargePointMaxProfile = 'ChargePointMaxProfile',
    /** Default charging profile for transactions */
    TxDefaultProfile = 'TxDefaultProfile',
    /** Charging profile for a specific transaction */
    TxProfile = 'TxProfile',
}

/**
 * Command message to clear charging profiles from a charger appliance.
 * Instructs the charger to remove one or more charging profiles, optionally filtered by profile type.
 */
export interface EnyoDataBusClearChargingProfilesV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.ClearChargingProfilesV1;
    /** ID of the charger appliance to clear charging profiles from */
    applianceId: string;
    data: {
        /** Optional charging profile type to clear. If omitted, all charging profiles are cleared. */
        profileType?: EnyoChargingProfileTypeEnum;
    };
}

/**
 * Overheating configuration for a single zone (room, buffer tank, or DHW).
 * Defines the temperature delta and duration for which the heatpump should overheat.
 */
export interface EnyoHeatpumpOverheatingConfig {
    /** Temperature delta in Kelvin to overheat above the current target temperature */
    deltaK: number;
    /** Duration in minutes for which the overheating should be applied */
    durationMinutes: number;
    /** Optional index of the heating circuit or DHW tank this config applies to */
    index?: number;
}

/**
 * Command message to instruct a heatpump to overheat one or more zones.
 *
 * Supports room overheating (via heating circuits), buffer tank overheating,
 * and domestic hot water (DHW) overheating, each with their own temperature delta and duration.
 */
export interface EnyoDataBusHeatpumpOverheatingV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.HeatpumpOverheatingV1;
    /** ID of the heatpump appliance to overheat */
    applianceId: string;
    data: {
        /** Optional room overheating configuration for a heating circuit */
        room?: EnyoHeatpumpOverheatingConfig;
        /** Optional buffer tank overheating configuration */
        bufferTank?: EnyoHeatpumpOverheatingConfig;
        /** Optional domestic hot water overheating configuration */
        dhw?: EnyoHeatpumpOverheatingConfig;
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Data bus message announcing available power for a heatpump appliance.
 * Used to inform the heatpump about how much power is available for consumption.
 */
/**
 * @deprecated Use {@link EnyoDataBusSetHeatpumpAvailablePowerV2} instead, which
 * adds optional purpose and power-source context to the announced envelope.
 */
export interface EnyoDataBusHeatpumpAvailablePowerAnnouncementV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.HeatpumpAvailablePowerAnnouncementV1;
    /** ID of the heatpump appliance */
    applianceId: string;
    data: {
        /** Available power for the heatpump to use (in Watt) */
        powerW: number;
        /** Optional reason why this announcement was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * The intended purpose a heatpump should apply an announced available-power
 * envelope to. Lets the appliance decide how to spend the granted power (e.g.
 * boost domestic hot water vs. pre-heat the building).
 */
export enum EnyoHeatpumpControlPurposeEnum {
    /** Use the power for normal space (room) heating */
    RoomHeating = 'room-heating',
    /** Use the power to boost the domestic hot water tank */
    DomesticHotWaterBoost = 'domestic-hot-water-boost',
    /** Use the power to pre-heat ahead of an anticipated demand or price rise */
    PreHeating = 'pre-heating',
    /** Use the power to charge a heating buffer tank */
    BufferTankCharge = 'buffer-tank-charge',
    /** Use the power for space cooling (reversible heatpumps) */
    Cooling = 'cooling',
}

/**
 * Where an announced available-power envelope is expected to originate from.
 * Used to give appliances (and analytics) insight into whether the granted
 * power is PV surplus, battery discharge, or grid import.
 */
export enum EnyoPowerSourceEnum {
    /** Power originates from PV production surplus */
    Pv = 'pv',
    /** Power originates from battery discharge */
    Battery = 'battery',
    /** Power originates from grid import */
    Grid = 'grid',
}

/**
 * Per-source breakdown of an announced available-power envelope. The sum of all
 * shares' {@link powerW} should equal the command's total `powerW`.
 */
export interface EnyoPowerSourceShare {
    /** The source this share of power comes from */
    source: EnyoPowerSourceEnum;
    /** The amount of power attributed to this source, in Watts (non-negative) */
    powerW: number;
}

/**
 * V2 command announcing the available / maximum active-power envelope (in
 * Watts) a heatpump may draw, together with optional context describing what
 * the power should be used for ({@link EnyoHeatpumpControlPurposeEnum}) and
 * where it comes from ({@link EnyoPowerSourceShare}). Supersedes the deprecated
 * {@link EnyoDataBusHeatpumpAvailablePowerAnnouncementV1}.
 *
 * The receiving integration should answer with an
 * {@link EnyoDataBusCommandAcknowledgeV1} message referencing this message's
 * `id`.
 */
export interface EnyoDataBusSetHeatpumpAvailablePowerV2 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.SetHeatpumpAvailablePowerV2;
    /** ID of the heatpump appliance this power envelope applies to */
    applianceId: string;
    data: EnyoAvailablePowerCommandData & {
        /**
         * What the heatpump should use the announced power for (e.g. DHW boost,
         * pre-heating). Advisory — the appliance may still apply its own logic.
         */
        purpose?: EnyoHeatpumpControlPurposeEnum;
        /**
         * Optional breakdown of the announced envelope by source (PV / battery /
         * grid). When present, the shares should sum to {@link data.powerW}.
         */
        powerSources?: EnyoPowerSourceShare[];
    };
}

/**
 * Data bus message announcing available power for a heating rod appliance.
 * Used to inform the heating rod about how much power is available for consumption.
 */
/**
 * @deprecated Use {@link EnyoDataBusSetHeatingRodAvailablePowerV2} instead.
 */
export interface EnyoDataBusHeatingRodAvailablePowerAnnouncementV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.HeatingRodAvailablePowerAnnouncementV1;
    /** ID of the heating rod appliance */
    applianceId: string;
    data: {
        /** Available power for the heating rod to use (in Watt) */
        powerW: number;
        /** Optional reason why this announcement was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * V2 command announcing the available / maximum active-power envelope (in
 * Watts) a heating rod may draw. Supersedes the deprecated
 * {@link EnyoDataBusHeatingRodAvailablePowerAnnouncementV1}.
 *
 * The receiving integration should answer with an
 * {@link EnyoDataBusCommandAcknowledgeV1} message referencing this message's
 * `id`.
 */
export interface EnyoDataBusSetHeatingRodAvailablePowerV2 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.SetHeatingRodAvailablePowerV2;
    /** ID of the heating rod appliance this power envelope applies to */
    applianceId: string;
    data: EnyoAvailablePowerCommandData;
}

/**
 * Data bus message for reporting air conditioning power values.
 * Contains the current operating mode and power consumption.
 */
export interface EnyoDataBusAirConditioningValuesV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.AirConditioningValuesUpdateV1;
    /** ID of the air conditioning appliance that delivered these values */
    applianceId: string;
    data: {
        values: {
            /** Current operating mode of the air conditioning unit */
            operationMode: EnyoAirConditioningApplianceModeEnum;
            /** Current power consumption in Watts */
            powerW?: number;
            /** Cumulative energy consumed by the air conditioning unit in Watt-hours */
            meterValueWh?: number;
        };
        /** Grid operator power limitation currently applied by the air conditioning unit, if any */
        gridOperatorLimit?: EnyoGridOperatorLimit;
    };
}

/**
 * Data bus message for reporting air conditioning temperature values.
 * Contains per-room temperature readings from an air conditioning appliance.
 */
export interface EnyoDataBusAirConditioningTemperaturesV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.AirConditioningTemperaturesUpdateV1;
    /** ID of the air conditioning appliance that delivered these temperature values */
    applianceId: string;
    data: {
        /** Room temperature readings, indexed per room */
        rooms?: {
            /** Index of the room */
            index: number;
            /** Target temperature in Celsius */
            targetTemperatureC: number;
            /** Current temperature in Celsius */
            temperatureC: number;
        }[];
    };
}

/**
 * Command message to start an air conditioning appliance in a specified mode.
 * This message instructs the air conditioning unit to begin operating in
 * either heating or cooling mode.
 */
export interface EnyoDataBusStartAirConditioningV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.StartAirConditioningV1;
    /** ID of the air conditioning appliance to start */
    applianceId: string;
    data: {
        /** The operating mode to start the air conditioning unit in (Heating or Cooling) */
        mode: EnyoAirConditioningApplianceModeEnum;
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Command message to stop an air conditioning appliance.
 * This message instructs the air conditioning unit to stop operating.
 * The mode indicates which operating mode (heating or cooling) should be stopped.
 */
export interface EnyoDataBusStopAirConditioningV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.StopAirConditioningV1;
    /** ID of the air conditioning appliance to stop */
    applianceId: string;
    data: {
        /** The operating mode to stop (Heating or Cooling) */
        mode: EnyoAirConditioningApplianceModeEnum;
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Command message to change the energy-optimization mode of an air conditioning
 * appliance (e.g. between PV surplus and boost). This controls how the unit is
 * driven with respect to available energy, independent of its physical
 * operating mode.
 */
export interface EnyoDataBusChangeAirConditioningOptimizationModeV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.ChangeAirConditioningOptimizationModeV1;
    /** ID of the air conditioning appliance whose optimization mode should change */
    applianceId: string;
    data: {
        /** The optimization mode to switch to (e.g. PV surplus, boost) */
        optimizationMode: EnyoAirConditioningOptimizationModeEnum;
        /** Optional reason why this command was issued */
        reason?: EnyoDataBusCommandReason;
    };
}

/**
 * Informational message reporting the current state of charge of an electric vehicle.
 * Published whenever an updated SoC reading becomes available — typically while the
 * vehicle is plugged in or when the vehicle reports its SoC via a connected service.
 */
export interface EnyoDataBusVehicleSocUpdateV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.VehicleSocUpdateV1;
    data: {
        /** ID of the vehicle the SoC reading belongs to */
        vehicleId: string;
        /** Current state of charge of the vehicle's traction battery in percent (0-100) */
        socPercent: number;
        /** Total usable capacity of the vehicle's traction battery in kWh, if known */
        batterySizeKwh?: number;
    };
}
