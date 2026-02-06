import {OCPPMessage} from "../implementations/ocpp/ocpp-common.js";
import {OCPP16Action} from "../implementations/ocpp/ocpp16.js";
import {OCPP201Action} from "../implementations/ocpp/ocpp201.js";

export interface EnyoOcppAvailableConnectionDetail {
    url: string;
    path: string;
    host: string;
    secure: boolean;
    port: number;
}

export interface EnyoOcppAvailableConnectionDetails {
    cloud?: EnyoOcppAvailableConnectionDetail;
    local?: EnyoOcppAvailableConnectionDetail;
}

export type EnyoOCPPVersion = '1.6' | '2.0.1';

export interface EnyoOcppChargePointConnection {
    chargePointId: string;
    remoteAddress?: string;
    protocolVersion: EnyoOCPPVersion;
}

export interface EnergyAppOcppMessageContext {
    chargePointId: string;
    messageId: string;
    version: EnyoOCPPVersion;
    timestamp: Date;
}

export enum EnyoOcppErrorCode {
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

export interface EnergyAppOcppMessageHandler<TRequest = any, TResponse = any> {
    (request: TRequest, context: EnergyAppOcppMessageContext): Promise<TResponse>;
}

/**
 * Interface for OCPP functionality in enyo packages.
 */
export interface EnergyAppOcpp {
    getAvailableConnectionDetails: () => Promise<EnyoOcppAvailableConnectionDetails>;

    listenForChargePointConnected: (listener: (connection: EnyoOcppChargePointConnection) => void) => string;

    listenForChargePointDisconnected: (listener: (chargePointId: string) => void) => string;

    registerHandler: <TRequest, TResponse>(
        action: OCPP16Action | OCPP201Action | string,
        handler: EnergyAppOcppMessageHandler<TRequest, TResponse>,
        version?: EnyoOCPPVersion
    ) => string;

    sendCall: <TRequest, TResponse>(
        chargePointId: string,
        message: string,
        payload: TRequest,
        messageId?: string
    ) => Promise<TResponse>;

    getConnectedChargePoints: () => EnyoOcppChargePointConnection[];

    getChargePoint: (chargePointId: string) => EnyoOcppChargePointConnection | undefined;

    disconnectChargePoint: (chargePointId: string, reason?: string) => void;

    unsubscribe: (id: string) => void;
}