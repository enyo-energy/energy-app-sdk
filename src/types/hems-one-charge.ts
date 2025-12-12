/**
 * Status of a charging session
 */
export enum HemsOneChargeStatus {
    /** Charging session is active */
    Charging = 'Charging',
    /** Charging session completed successfully */
    Completed = 'Completed',
    /** Charging session ended due to fault */
    Failed = 'Failed'
}

/**
 * Meter values recorded during a charging session
 */
export interface ChargeMeterValue {
    /** Timestamp when the value was recorded */
    timestamp: Date;
    /** Energy value in Watt hours */
    valueWh: number;
    /** Price per kWh at the time of measurement */
    pricePerKwh?: number;
    /** Charging cost in Euro for this measurement */
    chargingCostEuro?: number;
    /** Current on phase 1 in Amperes */
    currentPhase1: number;
    /** Current on phase 2 in Amperes */
    currentPhase2?: number;
    /** Current on phase 3 in Amperes */
    currentPhase3?: number;
}

/**
 * Represents a charging session in the HEMS one system.
 * Contains all relevant information about an EV charging transaction.
 */
export interface HemsOneCharge {
    /** Unique identifier for the charging session */
    id: string;
    /** Transaction ID for the charging session */
    transactionId: string;
    /** ID of the appliance (charger) handling this session */
    applianceId: string;
    /** ID of the charging card used for this session */
    chargingCardId?: string;
    /** Connector ID on the charge point */
    connectorId?: number;
    /** ID of the vehicle being charged */
    vehicleId?: string;
    /** Current status of the charging session */
    status: HemsOneChargeStatus;
    /** Meter reading at session start in Watt hours */
    meterStartValueWh?: number;
    /** Meter reading at session end in Watt hours */
    meterEndValueWh?: number;
    /** Paid price in Euro cents */
    paidPriceEuroCent?: number;
    /** Total energy delivered in kWh */
    totalEnergyKwh?: number;
    /** Timestamp when charging started */
    startTime?: Date;
    /** Timestamp when charging ended */
    endTime?: Date;
    /** Array of meter values recorded during the session */
    meterValues?: ChargeMeterValue[];
    /** Number of phases used for charging */
    numberOfPhases: number;
}

export interface HemsOneChargeFilter {
    /** Filter by specific appliance ID */
    applianceId?: string;
    /** Filter by specific charge point ID */
    chargePointId?: string;
    /** Filter sessions starting after this ISO timestamp */
    startDate?: string;
    /** Filter sessions ending before this ISO timestamp */
    endDate?: string;
    /** Filter by charging session status */
    status?: HemsOneChargeStatus;
    /** Filter by chargingCard */
    chargingCardId?: string;
    /** Filter by vehicle */
    vehicleId?: string;
}