import type {EnyoChargePreferences} from "./enyo-charge-preferences.js";

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
    ThreeToOnePhaseSwitch = 'ThreeToOnePhaseSwitch',
    /**
     * If the charger requires the vehicle to be disconnected before a new charge can be started.
     * Once the charger is in {@link EnyoChargerApplianceStatusEnum.Finishing}, no new charge can be
     * started remotely; the customer has to unplug the vehicle and plug it in again.
     */
    DisconnectToRestartCharge = 'DisconnectToRestartCharge',
    /**
     * If the charger is a DC charger (e.g. CCS or CHAdeMO), converting to DC
     * itself instead of feeding AC to the vehicle's on-board charger.
     *
     * A DC charger is controlled by power in Watts, not by current per phase:
     * the EMS uses {@link EnyoChargerApplianceMetadata.minChargingPowerKw},
     * {@link EnyoChargerApplianceMetadata.maxChargingPowerKw} and
     * {@link EnyoChargerApplianceMetadata.powerStepW}, and ignores the
     * Ampere-based fields ({@link EnyoChargerApplianceMetadata.minChargingCurrentAmpere},
     * {@link EnyoChargerApplianceMetadata.ampereStep}) and phase switching
     * ({@link EnyoChargerApplianceMetadata.availablePhases}).
     */
    DcCharger = 'DcCharger',
    /**
     * The charger is not a device of its own but a vehicle: a wallbox enyo
     * cannot talk to supplies the power, and charging is switched on and off
     * in the car itself through its manufacturer's cloud (e.g. Smartcar).
     *
     * Such a charger can only be **switched**, never throttled: while on, the
     * car draws its own full power. It reports this as
     * {@link EnyoChargerApplianceMetadata.minChargingPowerKw} equal to
     * {@link EnyoChargerApplianceMetadata.maxChargingPowerKw}, so any non-zero
     * setpoint means full power. It may only be switched rarely, see
     * {@link EnyoChargerApplianceMetadata.virtualWallbox}, and it has no meter:
     * power and energy are what the vehicle reports, with a delay.
     *
     * Declared together with {@link SmartChargingSchedule}: schedules are
     * emulated as on/off, and the energy manager steers only chargers that
     * accept one. The switching logic lives in the app that controls the
     * vehicle (e.g. the Smartcar app), not in this SDK.
     */
    VirtualWallbox = 'VirtualWallbox',
    /**
     * The charger applies a whole charging plan itself — written once into the
     * device or the vehicle (e.g. a charge window in the car via Smartcar) —
     * instead of following live setpoints. The energy manager sends every
     * planned block of the session in one {@link EnyoDataBusSetChargingScheduleV1}
     * with `scheduleKind: 'plan'` and sends it again only when the plan
     * changes; it sends no live on/off in between.
     *
     * Declared together with {@link SmartChargingSchedule}. Limits for the plan
     * are given in {@link EnyoChargerApplianceMetadata.fullChargingSchedule}.
     * A charger that turns out not to support it drops the feature again; the
     * energy manager then falls back to setpoints.
     */
    FullChargingSchedule = 'FullChargingSchedule'
}

/**
 * Phase configurations a charger can operate in.
 * - `1`: single-phase charging
 * - `3`: three-phase charging
 */
export type EnyoChargerAppliancePhase = 1 | 3;

/**
 * Metadata of a charger (wallbox) appliance.
 *
 * Extends {@link EnyoChargePreferences}: the wallbox's default charge mode,
 * charge limit, price ceiling, immediate reserve and departure time are stored
 * here and nowhere else — neither the energy manager settings nor a separate
 * charge API carries a copy. They are the fallback for a car that is not
 * recognised or has no preference of its own; a value on the vehicle or the
 * session takes precedence.
 */
export interface EnyoChargerApplianceMetadata extends EnyoChargePreferences {
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
     * Lowest power the charger can hold a session at, in kilowatts.
     *
     * The floor below which a session cannot be throttled but only paused —
     * typically 6 A on one phase (≈ 1.4 kW) on an AC charger. A DC charger
     * ({@link EnyoChargerApplianceAvailableFeaturesEnum.DcCharger}) states its
     * own DC minimum here, often several kW. Consumers mark it on the power
     * scale so an owner can see why a plan pauses instead of trickling, and
     * the EMS must not issue a non-zero setpoint below it.
     */
    minChargingPowerKw?: number;
    /**
     * Surplus at which the EMS switches this charger to three phases, in
     * kilowatts.
     *
     * The threshold the manager itself applies (typically ≈ 4.1 kW, the point
     * at which three-phase minimum current becomes coverable). Stated on the
     * appliance so a consumer can mark it on the same scale as
     * {@link minChargingPowerKw} and {@link maxChargingPowerKw} rather than
     * hard-coding a number that only the EMS knows. Absent on chargers that
     * cannot switch phases.
     */
    phaseSwitchThresholdKw?: number;
    /**
     * Lowest charging current, in Amperes per phase, the charger can hold a
     * session at — typically `6` (the IEC 61851 minimum), higher on chargers
     * that cannot regulate down that far.
     *
     * The EMS must not issue a non-zero current limit below it; a session is
     * held at the higher of this value and the vehicle's
     * {@link EnyoVehicle.minChargingCurrentAmpere}. Omit when unknown.
     */
    minChargingCurrentAmpere?: number;
    /**
     * Whether a charging session on this charger must not be paused once it
     * has started — e.g. chargers that end the session or need a re-plug
     * when the current is set to `0`.
     *
     * When `true`, the EMS must not pause the session (setpoint `0`) but hold
     * it at least at its minimum current until it is complete. Applies if
     * either this or the vehicle's {@link EnyoVehicle.cannotBePaused} is
     * `true`. Omitted means `false`.
     * The command holding the session states
     * {@link EnyoDataBusCommandReasonTypeEnum.CannotBePaused}.
     *
     * @default false
     */
    cannotBePaused?: boolean;
    /**
     * Whether the EMS must not switch phases (1 ↔ 3) on this charger, even
     * though the hardware supports it (see {@link availablePhases}) — e.g.
     * because the installer disabled it or switching proved unreliable.
     *
     * When `true`, sessions stay in the phase configuration they started in,
     * and {@link phaseSwitchThresholdKw}, {@link phaseSwitchDelaySeconds} and
     * {@link phaseSwitchIntervalSeconds} are not used. Applies if either this
     * or the vehicle's {@link EnyoVehicle.phaseSwitchDisabled} is `true`.
     * Omitted means `false`.
     *
     * @default false
     */
    phaseSwitchDisabled?: boolean;
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
     * Granularity, in Watts, at which the charging power can be set on this
     * charger. Any non-zero power the EMS issues
     * ({@link EnyoDataBusSetChargerAvailablePowerV2}) should be a multiple of
     * this step, e.g. `500` for a DC charger that regulates in 0.5 kW steps.
     *
     * The power counterpart of {@link ampereStep}, used by chargers controlled
     * by power rather than current — above all DC chargers
     * ({@link EnyoChargerApplianceAvailableFeaturesEnum.DcCharging}). Omit when
     * the charger accepts any Watt value.
     */
    powerStepW?: number;
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
     * Time, in seconds, the charger needs to carry out a phase switch after it
     * has been triggered (e.g. 1 → 3 phases or 3 → 1 phase).
     *
     * During this delay the charger is still operating in the previous phase
     * configuration; the EMS should not expect the new phase count to be in
     * effect until it has elapsed. Only meaningful on chargers that can switch
     * phases (see {@link availablePhases}). Omit when unknown.
     */
    phaseSwitchDelaySeconds?: number;
    /**
     * Minimum time, in seconds, the charger has to stay in a phase
     * configuration after a phase switch before another phase switch is
     * possible.
     *
     * The EMS must not trigger a new phase switch until this interval has
     * passed since the last switch. Only meaningful on chargers that can switch
     * phases (see {@link availablePhases}). Omit when unknown.
     */
    phaseSwitchIntervalSeconds?: number;
    /**
     * Whether the energy manager is allowed to actively control (steer) this
     * charger. When `false`, the charger is treated as read-only/monitor-only
     * and the EMS must not issue control commands to it. When omitted,
     * consumers should fall back to their configured default behaviour.
     */
    controlAllowed?: boolean;
    /**
     * Whether home/site batteries should be blocked from discharging while this
     * charger is actively charging. When `true`, the EMS should prevent battery
     * discharge during a charging session so the vehicle is charged from PV or
     * grid rather than from stored battery energy.
     */
    blockBatteriesOnCharging?: boolean;
    /**
     * Switching limits of a virtual wallbox. Present exactly when
     * {@link availableFeatures} contains
     * {@link EnyoChargerApplianceAvailableFeaturesEnum.VirtualWallbox}.
     */
    virtualWallbox?: EnyoChargerApplianceVirtualWallboxMetadata;
    /**
     * Limits for whole charging plans. Present when {@link availableFeatures}
     * contains
     * {@link EnyoChargerApplianceAvailableFeaturesEnum.FullChargingSchedule}.
     */
    fullChargingSchedule?: EnyoChargerApplianceFullScheduleMetadata;
    /**
     * The potential-free control inputs of the wallbox, 0 to n — its enable
     * (release) input and a power reduction input, e.g. for §14a EnWG — each
     * with the function it acts on. The wallbox counterpart of the heat pump's
     * `sgReadyRelays`. Omit or leave empty when no input is wired.
     *
     * Validate with `validateChargerContactRelays()`.
     */
    contactRelays?: EnyoChargerApplianceContactRelay[];
}

/**
 * What a contact relay of a wallbox acts on
 * ({@link EnyoChargerApplianceContactRelay.function}).
 */
export enum EnyoChargerContactRelayFunctionEnum {
    /**
     * The enable (release) input. Active: the wallbox may charge; inactive:
     * charging stops. The energy manager switches it instead of sending
     * `StartChargeV1` / `StopChargeV1`.
     */
    ChargingEnable = 'charging-enable',
    /**
     * A power reduction input. Active: the wallbox charges with at most
     * {@link EnyoChargerApplianceContactRelay.limitKw}, e.g. the dimming input
     * for §14a EnWG.
     */
    PowerReduction = 'power-reduction',
}

/**
 * One potential-free control input of a wallbox, declared in
 * {@link EnyoChargerApplianceMetadata.contactRelays} — the wallbox counterpart
 * of the heat pump's SG Ready relay.
 *
 * A relay is switched either by the wallbox's own app, which reports
 * {@link active}, or by a smart plug of another app wired to the input
 * ({@link applianceId}) — e.g. a Shelly next to a wallbox without a network
 * interface.
 *
 * @example
 * ```typescript
 * contactRelays: [
 *     {index: 0, function: EnyoChargerContactRelayFunctionEnum.ChargingEnable, name: 'EN', applianceId: 'shelly-ch-0'},
 *     {index: 1, function: EnyoChargerContactRelayFunctionEnum.PowerReduction, limitKw: 4.2, applianceId: 'shelly-ch-1'},
 * ]
 * ```
 */
export interface EnyoChargerApplianceContactRelay {
    /**
     * Zero-based index of this relay, unique within the wallbox. Stable for as
     * long as the wiring stays the same, so commands and readings can refer to
     * the relay by it.
     */
    index: number;
    /** What the relay acts on. */
    function: EnyoChargerContactRelayFunctionEnum;
    /** Optional label for installers and the UI, e.g. the terminal name `'EN'`. */
    name?: string;
    /**
     * For {@link EnyoChargerContactRelayFunctionEnum.PowerReduction}: the
     * charging power in kW the wallbox holds at most while the relay is
     * active. Required there, not allowed on other functions.
     */
    limitKw?: number;
    /**
     * `true` when the input acts while the contact is **open** (a normally
     * closed input). Defaults to `false`: closing the contact makes the relay
     * active.
     */
    activeWhenOpen?: boolean;
    /**
     * Whether the relay is currently active, when the wallbox's own app
     * switches it and knows its state. Omit with {@link applianceId}: the state
     * is read from the plug.
     */
    active?: boolean;
    /**
     * Set when the relay is a smart plug of another energy app, e.g. a Shelly
     * on the enable input of a wallbox without a network interface: the `id` of
     * that {@link EnyoApplianceTypeEnum.SmartPlug} appliance. The energy
     * manager then switches the plug with {@link EnyoDataBusSetSmartPlugSwitchV1}
     * — plug On closes the contact — and reads the relay's state from the plug,
     * honouring {@link activeWhenOpen}.
     *
     * Only the energy app that owns the plug adds, changes and removes such an
     * entry, by saving the wallbox with `useAppliances().save()`. The enyo
     * platform keeps the entry when the wallbox's own app saves the wallbox
     * again without it, and moves it to a free {@link index} if that app now
     * uses its index.
     */
    applianceId?: string;
}

/**
 * Limits of a charger that applies whole charging plans
 * ({@link EnyoChargerApplianceAvailableFeaturesEnum.FullChargingSchedule}).
 * Every rewrite of the plan can be a paid cloud call, so the energy manager
 * keeps plans within these limits and replans rarely.
 */
export interface EnyoChargerApplianceFullScheduleMetadata {
    /** Shortest time, in minutes, between two plans sent; a change within it waits. */
    minRescheduleIntervalMinutes: number;
    /** Most charging blocks one plan may hold (a car often takes one window per day). */
    maxBlocksPerSchedule: number;
    /** Block boundaries are rounded to this grid, in minutes, e.g. `15` — a car takes HH:MM. */
    granularityMinutes: number;
    /** How far ahead the plan is wanted, in hours — at least to the session's deadline. */
    horizonHours?: number;
}

/**
 * How often a virtual wallbox
 * ({@link EnyoChargerApplianceAvailableFeaturesEnum.VirtualWallbox}) may be
 * switched. Every switch is a command to the vehicle through its
 * manufacturer's cloud: it can wake the car, costs per call and is throttled
 * by the manufacturer, so a plan for this charger should consist of few,
 * long charging blocks.
 *
 * The app that controls the vehicle enforces the limits itself: a switch the
 * energy manager asks for earlier is applied once the interval has passed, one
 * beyond the daily cap once a switch has left the 24-hour window, and a start
 * beyond the plug-in budget not before the car is plugged in again. A switch
 * off is held back only by the interval.
 */
export interface EnyoChargerApplianceVirtualWallboxMetadata {
    /** Shortest time, in minutes, between two switches (on → off or off → on). */
    minSwitchIntervalMinutes: number;
    /**
     * Most charging blocks (starts) from one plug-in to the unplug. A further
     * start waits for the next plug-in; switching off is never held back.
     */
    maxBlocksPerPlugIn: number;
    /** Most switches in any 24-hour window, a cap on starts for a car plugged in and out often. */
    maxSwitchesPerDay: number;
}