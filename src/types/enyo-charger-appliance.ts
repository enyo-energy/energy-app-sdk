import {EnyoChargeModeEnum} from "./enyo-data-bus-value.js";

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
 * When a charger reports the {@link EnyoChargerApplianceStatusEnum.Suspended}
 * status, this indicates which side of the charging session caused the
 * suspension. Mirrors the OCPP distinction between the `SuspendedEVSE` and
 * `SuspendedEV` status notifications:
 *
 * - `Evse` — the charging station (EVSE) is not delivering energy to the EV
 *   (e.g. the EMS/backend paused it, load management, or the station is
 *   waiting). The vehicle is ready but the station is holding.
 * - `Ev` — the electric vehicle is not taking energy (e.g. the vehicle's
 *   battery is full or the EV itself paused charging). The station is ready
 *   but the vehicle is holding.
 */
export enum EnyoChargerApplianceSuspendedReasonEnum {
    /** Charging suspended by the charging station / EVSE (OCPP `SuspendedEVSE`) */
    Evse = 'evse',
    /** Charging suspended by the electric vehicle (OCPP `SuspendedEV`) */
    Ev = 'ev',
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
    /**
     * Detailed cause of a suspended charging session. Only meaningful while the
     * charger's {@link EnyoChargerApplianceMetadata.status} is
     * {@link EnyoChargerApplianceStatusEnum.Suspended}; distinguishes an
     * EVSE-side suspension (OCPP `SuspendedEVSE`) from an EV-side suspension
     * (OCPP `SuspendedEV`). Omit when the charger is not suspended or the cause
     * is unknown.
     */
    suspendedReason?: EnyoChargerApplianceSuspendedReasonEnum;
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
     * Granularity, in Amperes, at which the charging current limit can be set
     * on this charger. Any current limit the EMS issues should be a multiple of
     * this step.
     *
     * Most chargers accept whole Amperes (`1`), which is the default when the
     * field is omitted. Chargers with finer-grained control report a smaller
     * step — typically `0.1` — allowing the EMS to track a PV surplus far more
     * precisely instead of rounding to the next full Ampere.
     *
     * @default 1
     */
    ampereStep?: number;
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
    /**
     * Whether the energy manager is allowed to actively control (steer) this
     * charger. When `false`, the charger is treated as read-only/monitor-only
     * and the EMS must not issue control commands to it. When omitted,
     * consumers should fall back to their configured default behaviour.
     */
    controlAllowed?: boolean;
    /**
     * Default charge mode to apply for charging sessions on this charger when
     * no explicit mode is selected by the user. References the shared
     * {@link EnyoChargeModeEnum} (e.g. immediate, cost-optimized, price-limit).
     */
    defaultChargeMode?: EnyoChargeModeEnum;
    /**
     * Whether home/site batteries should be blocked from discharging while this
     * charger is actively charging. When `true`, the EMS should prevent battery
     * discharge during a charging session so the vehicle is charged from PV or
     * grid rather than from stored battery energy.
     */
    blockBatteriesOnCharging?: boolean;
}