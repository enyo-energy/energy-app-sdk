export enum EnyoChargerApplianceStatusEnum {
    Available = 'Available',
    Occupied = 'Occupied',
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

export interface EnyoChargerApplianceOcppMetadata {
    chargePointId: string;
    ocppVersion: '1.6' | '2.0.1';
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
}

export interface EnyoChargerApplianceMetadata {
    availableFeatures: EnyoChargerApplianceAvailableFeaturesEnum[];
    status: EnyoChargerApplianceStatusEnum;
    /** ISO Timestamp of the last heartbeat */
    lastHeartbeatAtIso?: string;
    ocpp?: EnyoChargerApplianceOcppMetadata;
    authorizationMode: EnyoChargerApplianceAuthorizationModeEnum;
    /** If cableType is Socket, the cable can be locked for theft protection */
    cableLocked?: boolean;
}