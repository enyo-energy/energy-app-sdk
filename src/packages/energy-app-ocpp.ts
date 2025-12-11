import {HemsOneWebsocketConnection} from "../types/hems-one-websocket-connection.js";

export interface HemsOneOcppAvailableConnectionDetail {
    url: string;
}

export interface HemsOneOcppAvailableConnectionDetails {
    cloud?: HemsOneOcppAvailableConnectionDetail;
    local?: HemsOneOcppAvailableConnectionDetail;
}

export type HemsOneOCPPVersion = '1.6' | '2.0.1';

export interface HemsOneOcppConnectionInfo {
    chargePointId: string;
    protocol: string;
    remoteAddress?: string;
    headers?: Record<string, string>;
}

export interface HemsOneOcppChargePointConnection {
    id: string;
    connection: HemsOneWebsocketConnection;
    version: HemsOneOCPPVersion;
    lastSeen: Date;
    isConnected: boolean;
    info: HemsOneOcppConnectionInfo;
    accessToken?: string;
}

export interface EnergyAppOcppMessageContext {
    chargePointId: string;
    messageId: string;
    connection: HemsOneWebsocketConnection;
    version: HemsOneOCPPVersion;
    timestamp: Date;
}

export interface EnergyAppOcppMessageHandler<TRequest = any, TResponse = any> {
    (request: TRequest, context: EnergyAppOcppMessageContext): Promise<TResponse>;
}

/**
 * Interface for OCPP functionality in HEMS one packages.
 */
export interface EnergyAppOcpp {
    getAvailableConnectionDetails: () => Promise<HemsOneOcppAvailableConnectionDetails>;

    listenForChargePointConnected: (connection: HemsOneOcppChargePointConnection) => void;

    listenForChargePointDisconnected: (chargePointId: string) => void;

    registerHandler: <TRequest, TResponse>(
        action: string,
        handler: EnergyAppOcppMessageHandler<TRequest, TResponse>,
        version?: HemsOneOCPPVersion
    ) => void;

    sendCall: <TRequest>(
        chargePointId: string,
        action: string,
        payload: TRequest,
        messageId?: string
    ) => void;

    sendCallResult: (
        chargePointId: string,
        messageId: string,
        payload: any
    ) => void;

    sendCallError: (
        chargePointId: string,
        messageId: string,
        errorCode: string,
        errorDescription: string,
        errorDetails?: any
    ) => void;

    getConnectedChargePoints: () => HemsOneOcppChargePointConnection[];

    getChargePoint: (chargePointId: string) => HemsOneOcppChargePointConnection | undefined;

    disconnectChargePoint: (chargePointId: string, reason?: string) => Promise<void>;
}