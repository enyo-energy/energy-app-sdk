export interface HemsOneOcppAvailableConnectionDetail {
    url: string;
    path: string;
    host: string;
    secure: boolean;
    port: number;
}

export interface HemsOneOcppAvailableConnectionDetails {
    cloud?: HemsOneOcppAvailableConnectionDetail;
    local?: HemsOneOcppAvailableConnectionDetail;
}

export type HemsOneOCPPVersion = '1.6' | '2.0.1';

export interface HemsOneOcppChargePointConnection {
    chargePointId: string;
    remoteAddress?: string;
    protocolVersion: HemsOneOCPPVersion;
}

export interface EnergyAppOcppMessageContext {
    chargePointId: string;
    messageId: string;
    version: HemsOneOCPPVersion;
    timestamp: Date;
}

export enum HemsOneOcppErrorCode {
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
 * Interface for OCPP functionality in HEMS one packages.
 */
export interface EnergyAppOcpp {
    getAvailableConnectionDetails: () => Promise<HemsOneOcppAvailableConnectionDetails>;

    listenForChargePointConnected: (listener: (connection: HemsOneOcppChargePointConnection) => void) => string;

    listenForChargePointDisconnected: (listener: (chargePointId: string) => void) => string;

    registerHandler: <TRequest, TResponse>(
        action: string,
        handler: EnergyAppOcppMessageHandler<TRequest, TResponse>,
        version?: HemsOneOCPPVersion
    ) => string;

    sendCall: <TRequest, TResponse>(
        chargePointId: string,
        message: string,
        payload: TRequest,
        messageId?: string
    ) => Promise<TResponse>;

    getConnectedChargePoints: () => HemsOneOcppChargePointConnection[];

    getChargePoint: (chargePointId: string) => HemsOneOcppChargePointConnection | undefined;

    disconnectChargePoint: (chargePointId: string, reason?: string) => void;

    unsubscribe: (id: string) => void;
}