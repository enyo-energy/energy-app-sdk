import {HemsOneApplianceTypeEnum, HemsOneApplianceStateEnum} from "./hems-one-appliance.js";
import {HemsOneSourceEnum} from "./hems-one-source.enum.js";

/**
 * Charging meter value context defining when the measurement was taken
 */
export enum HemsOneChargingMeterValueContext {
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
export enum HemsOneChargingStopReason {
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

export interface HemsOneAggregatedStateApplianceValues {
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

export enum HemsOneDataBusMessageEnum {
    InverterValuesUpdateV1 = 'InverterValuesUpdateV1',
    MeterValuesUpdateV1 = 'MeterValuesUpdateV1',
    BatteryValuesUpdateV1 = 'BatteryValuesUpdateV1',
    ApplianceFlexibilityAnnouncementV1 = 'ApplianceFlexibilityAnnouncementV1',
    HeatpumpValuesUpdateV1 = 'HeatpumpValuesUpdateV1',
    ChargingStartedV1 = 'ChargingStartedV1',
    ChargingMeterValuesUpdateV1 = 'ChargingMeterValuesUpdateV1',
    ChargingStoppedV1 = 'ChargingStoppedV1',
    PauseChargingV1 = 'PauseChargingV1',
    ResumeChargingV1 = 'ResumeChargingV1',
    ChangeChargingPowerV1 = 'ChangeChargingPowerV1',
    AggregatedStateUpdateV1 = 'AggregatedStateUpdateV1'
}

export interface HemsOneDataBusMessage {
    id: string;
    message: HemsOneDataBusMessageEnum;
    type: 'message' | 'answer';
    source: HemsOneSourceEnum;
    applianceId?: string;
    clockId?: string;
    timestampIso: string;
    /** If you just forward events that occur, use dynamic as resolution */
    resolution?: '10s' | '30s' | '1m' | '15m' | '1h' | '1d' | 'dynamic';
    data: object;
}

export interface HemsOneDataBusMessageAnswer extends HemsOneDataBusMessage {
    type: 'answer';
    data: {
        status: 'accepted' | 'rejected' | 'not-applicable';
    }
}

export interface HemsOneDataBusMeterValuesUpdateV1 extends HemsOneDataBusMessage {
    type: 'message';
    message: HemsOneDataBusMessageEnum.MeterValuesUpdateV1;
    /** ID of the appliance that delivered these values */
    applianceId: string;
    data: {
        /** Power from Grid (in Watt), negative: grid feed in, positive: grid consumption*/
        gridPowerW?: number;
        /** Grid Feed in (in Watt hours) */
        gridFeedInWh: number;
        /** Grid Feed in (in Watt hours) */
        gridConsumptionWh: number;
        /** current self consumption (in Watt) */
        selfConsumptionW?: number;
        /** Self consumed energy (in Watt hours) */
        selfConsumptionWh?: number;
    }
}

export interface HemsOneDataBusHeatpumpValuesV1 extends HemsOneDataBusMessage {
    type: 'message';
    message: HemsOneDataBusMessageEnum.HeatpumpValuesUpdateV1;
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

export interface HemsOneDataBusBatteryValuesUpdateV1 extends HemsOneDataBusMessage {
    type: 'message';
    message: HemsOneDataBusMessageEnum.BatteryValuesUpdateV1;
    /** ID of the appliance that delivered these values */
    applianceId: string;
    data: {
        /** Current Battery Power (in Watt). Positive = Consumption from the Battery, Negative = Feed in / charging of the battery. */
        batteryPowerW: number;
        /** Battery State of Charge. Value between 0 and 100 */
        batterySoC: number;
        /** Grid consumption Watt hours of battery */
        gridConsumptionWh?: number;
        /** Grid feed in Watt hours of battery */
        gridFeedInWh?: number;
    }
}

export interface HemsOneDataBusInverterValuesV1 extends HemsOneDataBusMessage {
    type: 'message';
    message: HemsOneDataBusMessageEnum.InverterValuesUpdateV1;
    /** ID of the appliance that delivered these values */
    applianceId: string;
    data: {
        /** Current PV Production (in Watt) */
        pvPowerW: number;
        /** Current in Ampere */
        currentA: number;
        /** voltage of Phase L1 to N*/
        voltageL1: number;
        /** voltage of Phase L2 to N*/
        voltageL2?: number;
        /** voltage of Phase L3 to N*/
        voltageL3?: number;
        /** Total pv production in Wh to measure the produced electricity in Wh*/
        pvProductionWh: number;
    }
}


export interface HemsOneDataBusApplianceFlexibilityAnnouncementV1 extends HemsOneDataBusMessage {
    type: 'message';
    message: HemsOneDataBusMessageEnum.ApplianceFlexibilityAnnouncementV1;
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

export interface HemsOneDataBusChargingStartedV1 extends HemsOneDataBusMessage {
    type: 'message';
    message: HemsOneDataBusMessageEnum.ChargingStartedV1;
    /** ID of the appliance (charger) that started the session */
    applianceId: string;
    data: {
        /** Connector ID on the charge point (usually 1) */
        connectorId: number;
        /** OCPP transaction identifier */
        transactionId: string;
        /** used charging card */
        chargingCardId?: string;
        /** vehicle that's charging */
        vehicleId?: string;
        /** Meter reading at session start in Watt hours */
        meterValueWh: number;
    };
}

export interface HemsOneDataBusChargingMeterValuesV1 extends HemsOneDataBusMessage {
    type: 'message';
    message: HemsOneDataBusMessageEnum.ChargingMeterValuesUpdateV1;
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
        context: HemsOneChargingMeterValueContext;
    };
}

export interface HemsOneDataBusChargingStoppedV1 extends HemsOneDataBusMessage {
    type: 'message';
    message: HemsOneDataBusMessageEnum.ChargingStoppedV1;
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
        stopReason: HemsOneChargingStopReason;
    };
}

export interface HemsOneDataBusAggregatedStateValuesV1 extends HemsOneDataBusMessage {
    type: 'message';
    message: HemsOneDataBusMessageEnum.AggregatedStateUpdateV1;
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
            type: HemsOneApplianceTypeEnum;
            /** Current connection state of the appliance */
            state: HemsOneApplianceStateEnum;
            /** ISO timestamp of the last update from this appliance */
            lastUpdateIso?: string;
            /** the current state values of the appliance */
            values: HemsOneAggregatedStateApplianceValues;
        }>;
    };
}

export interface HemsOneDataBusPauseChargingV1 extends HemsOneDataBusMessage {
    type: 'message';
    message: HemsOneDataBusMessageEnum.PauseChargingV1;
    data: {
        applianceId: string;
    };
}

export interface HemsOneDataBusResumeChargingV1 extends HemsOneDataBusMessage {
    type: 'message';
    message: HemsOneDataBusMessageEnum.ResumeChargingV1;
    data: {
        applianceId: string;
        maxChargingPowerKw: number;
    };
}

export interface HemsOneDataBusChangeChargingPowerV1 extends HemsOneDataBusMessage {
    type: 'message';
    message: HemsOneDataBusMessageEnum.ChangeChargingPowerV1;
    data: {
        applianceId: string;
        maxChargingPowerKw: number;
    };
}