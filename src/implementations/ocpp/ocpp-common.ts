export type OCPPVersion = '1.6' | '2.0.1';

export type MessageType = 2 | 3 | 4;

export const MESSAGE_TYPE = {
    CALL: 2 as const,
    CALLRESULT: 3 as const,
    CALLERROR: 4 as const,
} as const;

export interface OCPPMessage {
    messageType: MessageType;
    messageId: string;
    action?: string;
    payload?: any;
    errorCode?: string;
    errorDescription?: string;
    errorDetails?: any;
}

export interface CallMessage extends OCPPMessage {
    messageType: typeof MESSAGE_TYPE.CALL;
    action: string;
    payload: any;
}

export interface CallResultMessage extends OCPPMessage {
    messageType: typeof MESSAGE_TYPE.CALLRESULT;
    payload: any;
}

export interface CallErrorMessage extends OCPPMessage {
    messageType: typeof MESSAGE_TYPE.CALLERROR;
    errorCode: string;
    errorDescription: string;
    errorDetails?: any;
}

export type OCPPMessageUnion = CallMessage | CallResultMessage | CallErrorMessage;

export enum ErrorCode {
    NotImplemented = 'NotImplemented',
    NotSupported = 'NotSupported',
    InternalError = 'InternalError',
    ProtocolError = 'ProtocolError',
    SecurityError = 'SecurityError',
    FormationViolation = 'FormationViolation',
    PropertyConstraintViolation = 'PropertyConstraintViolation',
    OccurenceConstraintViolation = 'OccurenceConstraintViolation',
    TypeConstraintViolation = 'TypeConstraintViolation',
    GenericError = 'GenericError',
}

export enum GenericChargePointStatus {
    Available = 'Available',
    Occupied = 'Occupied',
    Suspended = 'Suspended',
    Finishing = 'Finishing',
    Reserved = 'Reserved',
    Unavailable = 'Unavailable',
    Faulted = 'Faulted',
}

import {
    ChargePointStatus,
    OCPP16MeterValueContext,
    OCPP16MeterValueMeasurand,
    OCPP16MeterValueSampledValue
} from './ocpp16.js';
import {ConnectorStatusEnumType, OCPP201TransactionEventRequest} from './ocpp201.js';

// Extract OCPP 2.0.1 sampled value type from the transaction event request
export type OCPP201MeterValueSampledValue = NonNullable<
    NonNullable<OCPP201TransactionEventRequest['meterValue']>[number]['sampledValue'][number]
>;

export function mapOCCP16StatusToGeneric(status: ChargePointStatus): GenericChargePointStatus {
    switch (status) {
        case ChargePointStatus.Available:
            return GenericChargePointStatus.Available;
        case ChargePointStatus.Preparing:
        case ChargePointStatus.Charging:
            return GenericChargePointStatus.Occupied;
        case ChargePointStatus.SuspendedEVSE:
        case ChargePointStatus.SuspendedEV:
            return GenericChargePointStatus.Suspended;
        case ChargePointStatus.Finishing:
            return GenericChargePointStatus.Finishing;
        case ChargePointStatus.Reserved:
            return GenericChargePointStatus.Reserved;
        case ChargePointStatus.Unavailable:
            return GenericChargePointStatus.Unavailable;
        case ChargePointStatus.Faulted:
            return GenericChargePointStatus.Faulted;
        default:
            return GenericChargePointStatus.Unavailable;
    }
}

export function mapOCCP201StatusToGeneric(
    connectorStatus: ConnectorStatusEnumType,
    chargingState?: 'Charging' | 'EVConnected' | 'SuspendedEV' | 'SuspendedEVSE' | 'Idle'
): GenericChargePointStatus {
    if (connectorStatus === ConnectorStatusEnumType.Available) {
        return GenericChargePointStatus.Available;
    }
    if (connectorStatus === ConnectorStatusEnumType.Reserved) {
        return GenericChargePointStatus.Reserved;
    }
    if (connectorStatus === ConnectorStatusEnumType.Unavailable) {
        return GenericChargePointStatus.Unavailable;
    }
    if (connectorStatus === ConnectorStatusEnumType.Faulted) {
        return GenericChargePointStatus.Faulted;
    }
    if (connectorStatus === ConnectorStatusEnumType.Occupied) {
        if (chargingState === 'SuspendedEV' || chargingState === 'SuspendedEVSE') {
            return GenericChargePointStatus.Suspended;
        }
        if (chargingState === 'Charging' || chargingState === 'EVConnected') {
            return GenericChargePointStatus.Occupied;
        }
        if (chargingState === 'Idle') {
            return GenericChargePointStatus.Finishing;
        }
        return GenericChargePointStatus.Occupied;
    }
    return GenericChargePointStatus.Unavailable;
}

export function mapGenericToOCCP16Status(status: GenericChargePointStatus): ChargePointStatus {
    switch (status) {
        case GenericChargePointStatus.Available:
            return ChargePointStatus.Available;
        case GenericChargePointStatus.Occupied:
            return ChargePointStatus.Charging;
        case GenericChargePointStatus.Suspended:
            return ChargePointStatus.SuspendedEVSE;
        case GenericChargePointStatus.Finishing:
            return ChargePointStatus.Finishing;
        case GenericChargePointStatus.Reserved:
            return ChargePointStatus.Reserved;
        case GenericChargePointStatus.Unavailable:
            return ChargePointStatus.Unavailable;
        case GenericChargePointStatus.Faulted:
            return ChargePointStatus.Faulted;
        default:
            return ChargePointStatus.Unavailable;
    }
}

export function mapGenericToOCCP201Status(status: GenericChargePointStatus): ConnectorStatusEnumType {
    switch (status) {
        case GenericChargePointStatus.Available:
            return ConnectorStatusEnumType.Available;
        case GenericChargePointStatus.Occupied:
        case GenericChargePointStatus.Suspended:
        case GenericChargePointStatus.Finishing:
            return ConnectorStatusEnumType.Occupied;
        case GenericChargePointStatus.Reserved:
            return ConnectorStatusEnumType.Reserved;
        case GenericChargePointStatus.Unavailable:
            return ConnectorStatusEnumType.Unavailable;
        case GenericChargePointStatus.Faulted:
            return ConnectorStatusEnumType.Faulted;
        default:
            return ConnectorStatusEnumType.Unavailable;
    }
}

export type GenericOcppMeterValueContext =
    'Transaction.Begin'
    | 'Transaction.End'
    | 'Sample.Clock'
    | 'Sample.Periodic'
    | 'Trigger'
    | 'Interruption.Begin'
    | 'Interruption.End';

export interface GenericOcppMeterValues {
    context?: GenericOcppMeterValueContext;
    outletVoltagePhase1: number;
    outletVoltagePhase2: number;
    outletVoltagePhase3: number;
    outletCurrentPhase1: number;
    outletCurrentPhase2: number;
    outletCurrentPhase3: number;
    powerImportByEvInWatt: number;
    evStateOfChargeInPercent: number;
    currentMeterValueInWattHours: number;
}

export function mapOCPP16MeterValueToGeneric(sampledValues: OCPP16MeterValueSampledValue[]): GenericOcppMeterValues {
    const currentMeterValueInWattHours = getOCPP16MeterValueByMeasurand(
        sampledValues,
        'Energy.Active.Import.Register',
    );
    const powerActiveImport = getOCPP16MeterValueByMeasurand(
        sampledValues,
        'Power.Active.Import',
    );
    const evSoC = getOCPP16MeterValueByMeasurand(sampledValues, 'SoC');
    const outletVoltage = getOCPP16OutletVoltage(sampledValues);
    const outletCurrent = getOCPP16OutletCurrent(sampledValues);
    return {
        context: mapOCPP16MeterValueContext(sampledValues),
        currentMeterValueInWattHours: convertToWattHours(
            currentMeterValueInWattHours,
        ),
        powerImportByEvInWatt: convertToWatt(powerActiveImport),
        evStateOfChargeInPercent: convertToPercent(evSoC),
        outletVoltagePhase1: convertToVoltage(outletVoltage.phase1),
        outletVoltagePhase2: convertToVoltage(outletVoltage.phase2),
        outletVoltagePhase3: convertToVoltage(outletVoltage.phase3),
        outletCurrentPhase1: convertToAmpere(outletCurrent.phase1),
        outletCurrentPhase2: convertToAmpere(outletCurrent.phase2),
        outletCurrentPhase3: convertToAmpere(outletCurrent.phase3),
    }
}

function mapOCPP16MeterValueContext(sampledValues: OCPP16MeterValueSampledValue[],): GenericOcppMeterValueContext | undefined {
    const valuesWithContext = sampledValues.filter(s => s.context !== undefined);
    if (valuesWithContext.length > 0) {
        switch (valuesWithContext[0].context) {
            case 'Transaction.Begin':
                return 'Transaction.Begin';
            case "Transaction.End":
                return 'Transaction.End';
            case "Sample.Clock":
                return 'Sample.Clock';
            case "Interruption.Begin":
                return 'Interruption.Begin';
            case "Interruption.End":
                return 'Interruption.End';
            case "Sample.Periodic":
                return 'Sample.Periodic';
            case "Trigger":
                return 'Trigger';
            default:
                return undefined;
        }
    }
    return undefined;
}

function getOCPP16MeterValueByMeasurand(
    sampledValues: OCPP16MeterValueSampledValue[],
    measurand: OCPP16MeterValueMeasurand,
    phase?: 'L1' | 'L2' | 'L3',
): { unit: string; value: number; context?: OCPP16MeterValueContext } | undefined {
    try {
        const meterValue = sampledValues.find(
            (sampledValue) =>
                sampledValue.measurand === measurand &&
                (!phase || sampledValue.phase === phase),
        );
        if (!meterValue) {
            return undefined;
        }
        return {
            unit: meterValue.unit,
            value: Number.parseFloat(meterValue.value),
            context: meterValue.context,
        };
    } catch (_) {
        return undefined;
    }
}

function getOCPP16OutletCurrent(sampledValues: OCPP16MeterValueSampledValue[]) {
    const phase1 = getOCPP16MeterValueByMeasurand(
        sampledValues,
        'Current.Import',
        'L1',
    );
    const phase2 = getOCPP16MeterValueByMeasurand(
        sampledValues,
        'Current.Import',
        'L2',
    );
    const phase3 = getOCPP16MeterValueByMeasurand(
        sampledValues,
        'Current.Import',
        'L3',
    );
    return {
        phase1,
        phase2,
        phase3,
    };
}

function getOCPP16OutletVoltage(sampledValues: OCPP16MeterValueSampledValue[]) {
    const phase1 = getOCPP16MeterValueByMeasurand(sampledValues, 'Voltage', 'L1');
    const phase2 = getOCPP16MeterValueByMeasurand(sampledValues, 'Voltage', 'L2');
    const phase3 = getOCPP16MeterValueByMeasurand(sampledValues, 'Voltage', 'L3');
    return {
        phase1,
        phase2,
        phase3,
    };
}

function convertToWattHours(instance: { unit?: string; value: number } | undefined): number {
    if (!instance) {
        return 0;
    }
    if (instance.unit === 'Wh') {
        return instance.value;
    }
    if (instance.unit === 'kWh') {
        return instance.value * 1000;
    }
    throw new Error(`Cannot convert ${instance.value} ${instance.unit} into Wh`);
}

function convertToWatt(instance: { unit?: string; value: number } | undefined): number {
    if (!instance) {
        return 0;
    }
    if (instance.unit === 'W') {
        return instance.value;
    }
    if (instance.unit === 'kW') {
        return instance.value * 1000;
    }
    throw new Error(`Cannot convert ${instance.value} ${instance.unit} into W`);
}

function convertToPercent(instance: { unit?: string; value: number } | undefined): number {
    if (!instance) {
        return 0;
    }
    if (instance.unit === 'Percent') {
        return instance.value;
    }
    throw new Error(
        `Cannot convert ${instance.value} ${instance.unit} into Percent`,
    );
}

function convertToVoltage(instance: { unit?: string; value: number } | undefined): number {
    if (!instance) {
        return 0;
    }
    if (instance.unit === 'V') {
        return instance.value;
    }
    throw new Error(`Cannot convert ${instance.value} ${instance.unit} into V`);
}

function convertToAmpere(instance: { unit?: string; value: number } | undefined): number {
    if (!instance) {
        return 0;
    }
    if (instance.unit === 'A') {
        return instance.value;
    }
    throw new Error(`Cannot convert ${instance.value} ${instance.unit} into A`);
}

// OCPP 2.0.1 meter value mapping functions

export function mapOCPP201MeterValueToGeneric(sampledValues: OCPP201MeterValueSampledValue[]): GenericOcppMeterValues {
    const currentMeterValueInWattHours = getOCPP201MeterValueByMeasurand(
        sampledValues,
        'Energy.Active.Import',
    );
    const powerActiveImport = getOCPP201MeterValueByMeasurand(
        sampledValues,
        'Power.Active.Import',
    );
    const evSoC = getOCPP201MeterValueByMeasurand(sampledValues,'SoC');
    const outletVoltage = getOCPP201OutletVoltage(sampledValues);
    const outletCurrent = getOCPP201OutletCurrent(sampledValues);
    return {
        context: mapOCPP201MeterValueContext(sampledValues),
        currentMeterValueInWattHours: convertToWattHours(
            currentMeterValueInWattHours,
        ),
        powerImportByEvInWatt: convertToWatt(powerActiveImport),
        evStateOfChargeInPercent: convertToPercent(evSoC),
        outletVoltagePhase1: convertToVoltage(outletVoltage.phase1),
        outletVoltagePhase2: convertToVoltage(outletVoltage.phase2),
        outletVoltagePhase3: convertToVoltage(outletVoltage.phase3),
        outletCurrentPhase1: convertToAmpere(outletCurrent.phase1),
        outletCurrentPhase2: convertToAmpere(outletCurrent.phase2),
        outletCurrentPhase3: convertToAmpere(outletCurrent.phase3),
    }
}

function mapOCPP201MeterValueContext(sampledValues: OCPP201MeterValueSampledValue[]): GenericOcppMeterValueContext | undefined {
    const valuesWithContext = sampledValues.filter(s => s.context !== undefined);
    if (valuesWithContext.length > 0) {
        switch (valuesWithContext[0].context) {
            case 'Transaction.Begin':
                return 'Transaction.Begin';
            case "Transaction.End":
                return 'Transaction.End';
            case "Sample.Clock":
                return 'Sample.Clock';
            case "Interruption.Begin":
                return 'Interruption.Begin';
            case "Interruption.End":
                return 'Interruption.End';
            case "Sample.Periodic":
                return 'Sample.Periodic';
            case "Trigger":
                return 'Trigger';
            default:
                return undefined;
        }
    }
    return undefined;
}

function getOCPP201MeterValueByMeasurand(
    sampledValues: OCPP201MeterValueSampledValue[],
    measurand: NonNullable<OCPP201MeterValueSampledValue['measurand']>,
    phase?: 'L1' | 'L2' | 'L3',
): { unit?: string; value: number; } | undefined {
    try {
        const meterValue = sampledValues.find(
            (sampledValue) =>
                sampledValue.measurand === measurand &&
                (!phase || sampledValue.phase === phase),
        );
        if (!meterValue) {
            return undefined;
        }
        return {
            unit: meterValue.unitOfMeasure?.unit,
            value: meterValue.value,
        };
    } catch (_) {
        return undefined;
    }
}

function getOCPP201OutletCurrent(sampledValues: OCPP201MeterValueSampledValue[]) {
    const phase1 = getOCPP201MeterValueByMeasurand(
        sampledValues,
        'Current.Import',
        'L1',
    );
    const phase2 = getOCPP201MeterValueByMeasurand(
        sampledValues,
        'Current.Import',
        'L2',
    );
    const phase3 = getOCPP201MeterValueByMeasurand(
        sampledValues,
        'Current.Import',
        'L3',
    );
    return {
        phase1,
        phase2,
        phase3,
    };
}

function getOCPP201OutletVoltage(sampledValues: OCPP201MeterValueSampledValue[]) {
    const phase1 = getOCPP201MeterValueByMeasurand(sampledValues, 'Voltage', 'L1');
    const phase2 = getOCPP201MeterValueByMeasurand(sampledValues, 'Voltage', 'L2');
    const phase3 = getOCPP201MeterValueByMeasurand(sampledValues, 'Voltage', 'L3');
    return {
        phase1,
        phase2,
        phase3,
    };
}
