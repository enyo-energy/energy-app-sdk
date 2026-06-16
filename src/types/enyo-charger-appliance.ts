export enum EnyoChargerApplianceStatusEnum {
    Available = 'Available',
    Occupied = 'Occupied',
    Charging = 'Charging',
    Suspended = 'Suspended',
    Finishing = 'Finishing',
    Reserved = 'Reserved',
    Unavailable = 'Unavailable',
    Faulted = 'Faulted',
}

export enum EnyoChargerApplianceAuthorizationModeEnum {
    AuthorizationRequired = 'AuthorizationRequired',
    NoAuthorization = 'NoAuthorization',
}

/**
 * Represents a single OCPP configuration entry from the charger.
 */
export interface EnyoChargerApplianceOcppConfigurationEntry {
    /** Configuration key name */
    key: string;
    /** Configuration value */
    value: string;
    /** Whether this configuration entry is read-only */
    readonly: boolean;
}

/**
 * OCPP-specific metadata for a charger appliance.
 */
export interface EnyoChargerApplianceOcppMetadata {
    chargePointId: string;
    ocppVersion: '1.6' | '2.0.1';
    /** OCPP configuration entries retrieved from the charger */
    configuration?: EnyoChargerApplianceOcppConfigurationEntry[];
}

export enum EnyoChargerApplianceAvailableFeaturesEnum {
    /** If the charger can limit the power in Ampere or Watt*/
    PowerLimitation = 'PowerLimitation',
    /** If the charger is capable of smart charging to adjust the charging power in a pre-defined schedule */
    SmartChargingSchedule = 'SmartChargingSchedule',
    /** If the cable can be locked (only available for socket wallboxes */
    CableLocking = 'CableLocking',
    /** If the LED of the charger can be dimmed by the user */
    LedDimming = 'LedDimming',
    /** If the charger has a simple meter to collect the charged electricity consumption */
    SimpleMeter = 'SimpleMeter',
    /** If the charger has a mid certified meter to collect the charged electricity consumption */
    MidMeter = 'MidMeter',
    /** If the charger has an eichrecht certified meter to collect the charged electricity consumption */
    EichrechtMeter = 'EichrechtMeter',
    /** If the charger has a fixed cable attached */
    FixedCable = 'FixedCable',
    /** If the charger has a socket for charging cable */
    Socket = 'Socket',
    /** If the charger supports authorization via rfid reader*/
    RfidAuthorization = 'RfidAuthorization',
    /** If the charger supports being reset */
    ResetCharger = 'ResetCharger',
    /** If the charger supports being rebooted */
    RebootCharger = 'RebootCharger',
    /** If the charger supports requesting log file uploads */
    RequestLogFiles = 'RequestLogFiles',
    /** If the Charger supprots a pv surplus mode */
    PvSurplusMode = 'PvSurplusMode',
    /** If the charger supports switching between three-phase and one-phase charging */
    ThreeToOnePhaseSwitch = 'ThreeToOnePhaseSwitch'
}

/**
 * Phase configurations a charger can operate in.
 * - `1`: single-phase charging
 * - `3`: three-phase charging
 */
export type EnyoChargerAppliancePhase = 1 | 3;

export interface EnyoChargerApplianceMetadata {
    availableFeatures: EnyoChargerApplianceAvailableFeaturesEnum[];
    status: EnyoChargerApplianceStatusEnum;
    /** ISO Timestamp of the last heartbeat */
    lastHeartbeatAtIso?: string;
    ocpp?: EnyoChargerApplianceOcppMetadata;
    authorizationMode: EnyoChargerApplianceAuthorizationModeEnum;
    /** If cableType is Socket, the cable can be locked for theft protection */
    cableLocked?: boolean;
    /** Current charging power limit in kilowatts */
    currentChargingLimitKw?: number;
    /**
     * Hardware maximum charging power the charger can deliver, in
     * kilowatts. Derived from the device's nameplate / capability
     * report; treat as a physical ceiling that the EMS cannot exceed.
     */
    maxChargingPowerKw?: number;
    /**
     * Phase configurations the charger supports. Each value indicates
     * a phase mode the hardware can operate in:
     * - `[1]`: only single-phase charging supported
     * - `[3]`: only three-phase charging supported
     * - `[1, 3]`: both modes supported (the charger can switch between
     *   single- and three-phase; typically paired with the
     *   `ThreeToOnePhaseSwitch` feature)
     */
    availablePhases?: EnyoChargerAppliancePhase[];
}