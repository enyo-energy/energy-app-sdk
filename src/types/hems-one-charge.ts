// TODO: implement as new data type (add vehicle and charging cards as well)
/**
 * Status of a charging session
 */
export enum HemsOneChargeStatus {
    /** Charging session is active */
    Active = 'active',
    /** Charging session completed successfully */
    Completed = 'completed',
    /** Charging session was stopped manually */
    Stopped = 'stopped',
    /** Charging session ended due to fault */
    Faulted = 'faulted',
    /** Charging session is suspended */
    Suspended = 'suspended'
}

/**
 * Represents a charging session in the HEMS one system.
 * Contains all relevant information about an EV charging transaction.
 */
export interface HemsOneCharge {
    /** Unique identifier for the charging session */
    id: string;
    /** ID of the appliance (charger) handling this session */
    applianceId: string;
    /** OCPP charge point identifier */
    chargePointId: string;
    /** Connector ID on the charge point (usually 1 or 2) */
    connectorId: number;
    /** ISO timestamp when charging started */
    startTime: string;
    /** ISO timestamp when charging ended (undefined if still active) */
    endTime?: string;
    /** Total energy delivered in Watt hours */
    energyDelivered: number;
    /** Current status of the charging session */
    status: HemsOneChargeStatus;
    /** Authorization identifier used to start the session */
    idTag: string;
    /** Meter reading at session start in Watt hours */
    meterStart: number;
    /** Meter reading at session end in Watt hours (undefined if still active) */
    meterStop?: number;
    /** Optional reason for session termination */
    stopReason?: string;
    /** Transaction ID from OCPP protocol */
    transactionId?: number;
    /** Additional metadata from the charging session */
    metadata?: Record<string, any>;
}

export interface HemsOneChargeFilter {
    /** Filter by specific appliance ID */
    applianceId?: string;
    /** Filter by specific charge point ID */
    chargePointId?: string;
    /** Filter by specific connector ID */
    connectorId?: number;
    /** Filter sessions starting after this ISO timestamp */
    startDate?: string;
    /** Filter sessions ending before this ISO timestamp */
    endDate?: string;
    /** Filter by charging session status */
    status?: HemsOneChargeStatus;
    /** Filter by authorization identifier */
    idTag?: string;
    /** Maximum number of results to return */
    limit?: number;
    /** Number of results to skip (for pagination) */
    offset?: number;
}