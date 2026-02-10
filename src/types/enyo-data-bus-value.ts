import {EnyoApplianceStateEnum, EnyoApplianceTypeEnum} from "./enyo-appliance.js";
import {EnyoSourceEnum} from "./enyo-source.enum.js";
import {EnergyTariffInfo} from "./enyo-energy-tariff.js";
import {EnyoOcppRelativeSchedule} from "./enyo-ocpp.js";
import {EnyoChargerApplianceStatusEnum} from "./enyo-charger-appliance.js";
import {PreviewChargingSchedule, PreviewChargingScheduleCostComparison, PreviewChargingScheduleUnavailableReasonEnum} from "./enyo-energy-manager.js";
import {PvForecast} from "./enyo-pv-forecast.js";

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
}

export interface EnyoAggregatedStateApplianceValues {
    gridPowerW?: number;
    gridFeedInWh?: number;
    gridConsumptionWh?: number;
    selfConsumptionW?: number;
    selfConsumptionWh?: number;
    batteryPowerW?: number;
    batterySoC?: number;
    pvPowerW?: number;
    currentA?: number;
    voltageL1?: number;
    voltageL2?: number;
    voltageL3?: number;
    pvProductionWh?: number;
    powerConsumptionHeatingWh?: number;
    powerConsumptionDomesticHotWaterWh?: number;
    heatGenerationHeatingWh?: number;
    heatGenerationDomesticHotWaterWh?: number;
    flexibility?: {
        kWh?: number;
        availableUntilIsoTimestamp?: string;
    },
    outdoorTemperatureC?: number;
    heatpumpFlowTemperatureC?: number;
    domesticHotWater?: {
        index: number;
        targetTemperatureC: number;
        temperatureC: number;
    }[],
    heatingCircuits?: {
        index: number;
        targetTemperatureC: number;
        temperatureC: number;
    }[],
    bufferTank?: {
        temperatureC: number;
    }
}

export enum EnyoDataBusMessageEnum {
    InverterValuesUpdateV1 = 'InverterValuesUpdateV1',
    MeterValuesUpdateV1 = 'MeterValuesUpdateV1',
    BatteryValuesUpdateV1 = 'BatteryValuesUpdateV1',
    ApplianceFlexibilityAnnouncementV1 = 'ApplianceFlexibilityAnnouncementV1',
    HeatpumpValuesUpdateV1 = 'HeatpumpValuesUpdateV1',
    ChargingStartedV1 = 'ChargingStartedV1',
    ChargingMeterValuesUpdateV1 = 'ChargingMeterValuesUpdateV1',
    ChargingStoppedV1 = 'ChargingStoppedV1',
    StartChargingFailedV1 = 'StartChargingFailedV1',
    PauseChargingV1 = 'PauseChargingV1',
    ResumeChargingV1 = 'ResumeChargingV1',
    ChangeChargingPowerV1 = 'ChangeChargingPowerV1',
    SetChargingScheduleV1 = 'SetChargingScheduleV1',
    StartChargeV1 = 'StartChargeV1',
    StopChargeV1 = 'StopChargeV1',
    AggregatedStateUpdateV1 = 'AggregatedStateUpdateV1',
    EnergyTariffUpdateV1 = 'EnergyTariffUpdateV1',
    ChargeFinishedV1 = 'ChargeFinishedV1',
    ChargerStatusChangedV1 = 'ChargerStatusChangedV1',
    RequestPreviewChargingScheduleV1 = 'RequestPreviewChargingScheduleV1',
    PreviewChargingScheduleResponseV1 = 'PreviewChargingScheduleResponseV1',
    PvForecastV1 = 'PvForecastV1'
}

export type EnyoDataBusMessageResolution = '10s' | '30s' | '1m' | '15m' | '1h' | '1d' | 'dynamic';

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
        values?: {
            /** Power consumption for heating in Wh (meter value)*/
            powerConsumptionHeatingWh?: number;
            /** Power consumption for domestic hot water in Wh (meter value)*/
            powerConsumptionDomesticHotWaterWh?: number;
            /** Power generation for heating in Wh (meter value)*/
            heatGenerationHeatingWh?: number;
            /** Power generation for domestic hot water in Wh (meter value)*/
            heatGenerationDomesticHotWaterWh?: number;
        };
        temperatures?: {
            outdoorTemperatureC?: number;
            /** The current temperature of the domestic hot water tank */
            domesticHotWater?: {
                index: number;
                targetTemperatureC: number;
                temperatureC: number;
            }[],
            /** The current flow temperature of the heatpump */
            heatpumpFlowTemperatureC?: number;
            heatingCircuits?: {
                index: number;
                targetTemperatureC: number;
                temperatureC: number;
            }[];
            bufferTank?: {
                temperatureC: number;
            }
        }
    }
}

export interface EnyoDataBusBatteryValuesUpdateV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.BatteryValuesUpdateV1;
    /** ID of the appliance that delivered these values */
    applianceId: string;
    data: {
        state?: EnyoBatteryStateEnum;
        /** Current Battery Power (in Watt). Positive = Consumption from the Battery, Negative = Feed in / charging of the battery. */
        batteryPowerW?: number;
        /** Battery State of Charge. Value between 0 and 100 */
        batterySoC: number;
    }
}

export interface EnyoDataBusInverterValuesV1String {
    index: number;
    name?: string;
    voltage?: number;
    powerW?: number;
    current?: number;
    state?: EnyoStringStateEnum;
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
        /** DC String values. Please only provide active strings */
        strings?: EnyoDataBusInverterValuesV1String[];
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

export interface EnyoDataBusAggregatedStateValuesV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.AggregatedStateUpdateV1;
    clockId: string;
    data: {
        /** Total grid power from all appliances (in Watt). Negative: grid feed in, positive: grid consumption */
        totalGridPowerW?: number;
        /** Total grid feed in from all appliances (in Watt hours) */
        totalGridFeedInWh?: number;
        /** Total grid consumption from all appliances (in Watt hours) */
        totalGridConsumptionWh?: number;
        /** Total self consumption from all appliances (in Watt) */
        totalSelfConsumptionW?: number;
        /** Total self consumed energy from all appliances (in Watt hours) */
        totalSelfConsumptionWh?: number;
        /** Total battery power from all appliances (in Watt). Positive = consumption, negative = charging */
        totalBatteryPowerW?: number;
        /** Total PV production from all appliances (in Watt) */
        totalPvPowerW?: number;
        /** Total PV production from all appliances (in Watt hours) */
        totalPvProductionWh?: number;
        /** Total power consumption for heating from all appliances (in Watt hours) */
        totalPowerConsumptionHeatingWh?: number;
        /** Total power consumption for domestic hot water from all appliances (in Watt hours) */
        totalPowerConsumptionDomesticHotWaterWh?: number;
        /** Total heat generation for heating from all appliances (in Watt hours) */
        totalHeatGenerationHeatingWh?: number;
        /** Total heat generation for domestic hot water from all appliances (in Watt hours) */
        totalHeatGenerationDomesticHotWaterWh?: number;

        /** Array of all appliances with their individual values and current state */
        appliances: Array<{
            /** ID of the appliance */
            applianceId: string;
            /** Type of the appliance */
            type: EnyoApplianceTypeEnum;
            /** Current connection state of the appliance */
            state: EnyoApplianceStateEnum;
            /** ISO timestamp of the last update from this appliance */
            lastUpdateIso?: string;
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
    };
}

export interface EnyoDataBusResumeChargingV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.ResumeChargingV1;
    data: {
        applianceId: string;
        maxChargingPowerKw: number;
    };
}

export interface EnyoDataBusChangeChargingPowerV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.ChangeChargingPowerV1;
    data: {
        applianceId: string;
        maxChargingPowerKw: number;
    };
}

export interface EnyoDataBusSetChargingScheduleV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.SetChargingScheduleV1;
    data: {
        applianceId: string;
        relativeSchedule: EnyoOcppRelativeSchedule[];
    };
}
/**
 * Command message to start a charging session on a specific charger.
 * This message triggers the charge point to begin charging.
 */
export interface EnyoDataBusStartChargeV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.StartChargeV1;
    data: {
        /** ID of the appliance (charger) to start charging on */
        applianceId: string;
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
    };
}

/**
 * Command message to stop an active charging session.
 * This message triggers the charge point to end the specified transaction.
 */
export interface EnyoDataBusStopChargeV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.StopChargeV1;
    data: {
        /** ID of the appliance (charger) to stop */
        applianceId: string;
        /** OCPP transaction identifier of the session to stop */
        transactionId: string;
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
        tariffInfo: EnergyTariffInfo;
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
        vehicleId?: number;
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
    data: {
        /** The request ID this response corresponds to */
        requestId: string;
        /** ID of the appliance this schedule is for */
        applianceId: string;
        /** Whether a preview charging schedule is available */
        available: boolean;
        /** The preview charging schedule (only present if available=true) */
        schedule?: PreviewChargingSchedule;
        /** Cost comparison data (only present if requested and available) */
        costComparison?: PreviewChargingScheduleCostComparison;
        /** Reason why preview is not available (only present if available=false) */
        unavailableReason?: PreviewChargingScheduleUnavailableReasonEnum;
    };
}

/**
 * Message for delivering PV production forecast data.
 * Contains forecasted power and energy values in 15-minute intervals.
 */
export interface EnyoDataBusPvForecastV1 extends EnyoDataBusMessage {
    type: 'message';
    message: EnyoDataBusMessageEnum.PvForecastV1;
    /** Optional ID of the specific PV appliance this forecast applies to */
    applianceId?: string;
    data: {
        /** The PV forecast data including time range and 15-minute buckets */
        forecast: PvForecast;
    };
}