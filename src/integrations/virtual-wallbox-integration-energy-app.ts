import {WallboxIntegrationEnergyApp} from "./wallbox-integration-energy-app.js";
import {IntegrationCommandResponse, IntegrationEnergyAppOptions} from "./integration-types.js";
import {ApplianceManager} from "../implementations/appliances/appliance-manager.js";
import {
    EnyoChargeInitiatorEnum,
    EnyoChargeModeEnum,
    EnyoChargingMeterValueContext,
    EnyoChargingStopReason,
    EnyoCommandAcknowledgeAnswerEnum,
    EnyoDataBusChangeChargingPowerV1,
    EnyoDataBusClearChargingProfilesV1,
    EnyoDataBusGridOperatorPowerLimitationV1,
    EnyoDataBusPauseChargingV1,
    EnyoDataBusRebootChargerV1,
    EnyoDataBusRequestChargerLogsV1,
    EnyoDataBusResetChargerV1,
    EnyoDataBusResumeChargingV1,
    EnyoDataBusSetChargerAvailablePowerV2,
    EnyoDataBusSetChargingScheduleV1,
    EnyoDataBusStartChargeV1,
    EnyoDataBusStopChargeV1
} from "../types/enyo-data-bus-value.js";
import {
    EnyoChargerApplianceAuthorizationModeEnum,
    EnyoChargerApplianceAvailableFeaturesEnum,
    EnyoChargerApplianceMetadata,
    EnyoChargerAppliancePhase,
    EnyoChargerApplianceStatusEnum,
    EnyoChargerApplianceSuspendedReasonEnum
} from "../types/enyo-charger-appliance.js";

/**
 * Defaults keep a virtual wallbox sluggish — one charging block per plug-in:
 * every switch is a command to the car through its manufacturer's cloud, which
 * costs per call and is throttled.
 */
/** Default for {@link VirtualWallboxIntegrationEnergyAppOptions.minSwitchIntervalMinutes}. */
export const VIRTUAL_WALLBOX_DEFAULT_MIN_SWITCH_INTERVAL_MINUTES = 60;
/** Default for {@link VirtualWallboxIntegrationEnergyAppOptions.maxBlocksPerPlugIn}. */
export const VIRTUAL_WALLBOX_DEFAULT_MAX_BLOCKS_PER_PLUG_IN = 1;
/** Default for {@link VirtualWallboxIntegrationEnergyAppOptions.meterHeartbeatSeconds}: below the energy manager's 90 s. */
export const VIRTUAL_WALLBOX_DEFAULT_METER_HEARTBEAT_SECONDS = 60;
/** Default for {@link VirtualWallboxIntegrationEnergyAppOptions.maxSwitchesPerDay}: two blocks. */
export const VIRTUAL_WALLBOX_DEFAULT_MAX_SWITCHES_PER_DAY = 4;

/** The single connector a virtual wallbox reports its sessions on. */
const CONNECTOR_ID = 1;
/** A virtual wallbox measures no voltage; meter values carry the nominal one. */
const NOMINAL_VOLTAGE_V = 230;
const DAY_MS = 24 * 60 * 60 * 1000;
/** How often the appliance registry's status is re-asserted although it did not change. */
const STATUS_SYNC_HEARTBEAT_MS = 5 * 60 * 1000;
/**
 * How long after a switch on a car that reports "not charging" is taken as not
 * charging *yet* (suspended by the car) rather than as stopped by itself: cars
 * take a while to start, and a report taken before the switch can arrive after it.
 */
const START_GRACE_MS = 3 * 60 * 1000;
/** `useStorage()` key of the switches per wallbox — the budgets outlast a restart. */
export const VIRTUAL_WALLBOX_SWITCH_HISTORY_KEY = 'virtual-wallbox-switch-history';

const {Accepted, Rejected, NotSupported} = EnyoCommandAcknowledgeAnswerEnum;

/**
 * Options of a {@link VirtualWallboxIntegrationEnergyApp}.
 */
export interface VirtualWallboxIntegrationEnergyAppOptions extends IntegrationEnergyAppOptions {
    /**
     * Shortest time, in minutes, between two switches the energy manager
     * causes. An explicit start or stop is never held back.
     *
     * @default 60
     */
    minSwitchIntervalMinutes?: number;
    /**
     * Most charging blocks — starts — from one plug-in to the unplug, explicit
     * starts included. A start the energy manager wants beyond it waits for the
     * next plug-in; an explicit start is still sent. Never holds back a switch
     * off: a car the energy manager wants off is not left charging.
     *
     * @default 1
     */
    maxBlocksPerPlugIn?: number;
    /**
     * Most switches in any 24-hour window, explicit ones included — a cap for a
     * car that is plugged in and out often. A start the energy manager wants
     * beyond it waits until a switch leaves the window; a switch off does not.
     *
     * @default 4
     */
    maxSwitchesPerDay?: number;
    /**
     * How often, in seconds, the last meter value of an open session is
     * published again when the vehicle reports nothing new. Vehicle clouds
     * report on change only, while the energy manager takes a charger's draw
     * as stale after 90 seconds and the host a charge without readings as
     * dead. Local only — it costs no call to the vehicle.
     *
     * @default 60
     */
    meterHeartbeatSeconds?: number;
}

/**
 * What the vehicle reports about its charging, handed to
 * {@link VirtualWallboxIntegrationEnergyApp.updateVehicleState} whenever it
 * changes (e.g. from a webhook or a poll of the manufacturer's cloud).
 */
export interface VirtualWallboxVehicleState {
    /** Whether a charging cable is plugged into the vehicle. */
    pluggedIn: boolean;
    /** Whether the vehicle is taking energy right now. */
    charging: boolean;
    /** Power the vehicle is charging with, in Watts, when it reports one. */
    chargingPowerW?: number;
    /**
     * Energy the vehicle has taken in during its current charge, in Wh, as the
     * vehicle counts it. Only differences between two reports are used, so a
     * counter the vehicle resets for a new charge is fine.
     */
    sessionEnergyWh?: number;
    /** The vehicle's state of charge in percent, when known. */
    socPercent?: number;
    /** The enyo vehicle id, put on a session the vehicle starts on its own. */
    vehicleId?: string;
}

/**
 * The vehicle's answer to a switch, returned by
 * {@link VirtualWallboxIntegrationEnergyApp.switchVehicleCharging}.
 */
export interface VirtualWallboxSwitchResult {
    /** `true` when the vehicle (or its manufacturer's cloud) accepted the command. */
    accepted: boolean;
    /** Why it was refused; passed on to the energy manager. */
    reason?: string;
}

/**
 * What is known about the charge a switch serves, handed to
 * {@link VirtualWallboxIntegrationEnergyApp.switchVehicleCharging}.
 */
export interface VirtualWallboxSwitchContext {
    /**
     * The state of charge, in percent, the charge is to reach — as the last
     * `StartChargeV1` for it stated. Absent when none did; the integration may
     * then fall back to the running charge's or the vehicle's own target.
     */
    targetSocPercent?: number;
}

/**
 * Input of {@link virtualWallboxChargerMetadata}.
 */
export interface VirtualWallboxChargerMetadataOptions {
    /** The power the vehicle charges with on this wallbox, in kilowatts. */
    chargingPowerKw: number;
    /**
     * The phases the vehicle charges on.
     *
     * @default 3
     */
    phases?: EnyoChargerAppliancePhase;
    /** The status to store; carry the registry's current one on a re-create. */
    status?: EnyoChargerApplianceStatusEnum;
    /** See {@link VirtualWallboxIntegrationEnergyAppOptions.minSwitchIntervalMinutes}. */
    minSwitchIntervalMinutes?: number;
    /** See {@link VirtualWallboxIntegrationEnergyAppOptions.maxBlocksPerPlugIn}. */
    maxBlocksPerPlugIn?: number;
    /** See {@link VirtualWallboxIntegrationEnergyAppOptions.maxSwitchesPerDay}. */
    maxSwitchesPerDay?: number;
}

/**
 * The charger metadata of a virtual wallbox, for creating its appliance.
 *
 * Declares {@link EnyoChargerApplianceAvailableFeaturesEnum.VirtualWallbox}
 * and {@link EnyoChargerApplianceAvailableFeaturesEnum.SmartChargingSchedule} —
 * schedules are emulated as on/off, and without it the energy manager does not
 * steer a charger at all — but nothing it cannot do: no power limitation, no
 * phase switching, no meter, no authorization. Minimum and maximum power are
 * both the vehicle's charging power, and so is the minimum current — the
 * energy manager derives its power band from the current — so it plans only
 * "off" or "on at full power".
 *
 * Pass the same switching limits as to the integration, or leave both at their
 * defaults.
 *
 * @param options - The vehicle's charging power and optional overrides.
 * @returns The `charger` block of the appliance.
 */
export function virtualWallboxChargerMetadata(options: VirtualWallboxChargerMetadataOptions): EnyoChargerApplianceMetadata {
    const phases = options.phases ?? 3;
    return {
        availableFeatures: [
            EnyoChargerApplianceAvailableFeaturesEnum.VirtualWallbox,
            EnyoChargerApplianceAvailableFeaturesEnum.SmartChargingSchedule,
        ],
        status: options.status ?? EnyoChargerApplianceStatusEnum.Available,
        authorizationMode: EnyoChargerApplianceAuthorizationModeEnum.NoAuthorization,
        minChargingPowerKw: options.chargingPowerKw,
        maxChargingPowerKw: options.chargingPowerKw,
        minChargingCurrentAmpere: Math.round(options.chargingPowerKw * 1000 / (phases * NOMINAL_VOLTAGE_V)),
        availablePhases: [phases],
        phaseSwitchDisabled: true,
        virtualWallbox: {
            minSwitchIntervalMinutes: options.minSwitchIntervalMinutes ?? VIRTUAL_WALLBOX_DEFAULT_MIN_SWITCH_INTERVAL_MINUTES,
            maxBlocksPerPlugIn: options.maxBlocksPerPlugIn ?? VIRTUAL_WALLBOX_DEFAULT_MAX_BLOCKS_PER_PLUG_IN,
            maxSwitchesPerDay: options.maxSwitchesPerDay ?? VIRTUAL_WALLBOX_DEFAULT_MAX_SWITCHES_PER_DAY,
        },
    };
}

/** An open charging session, as announced with `ChargingStartedV1`. */
interface VirtualSession {
    transactionId: string;
    chargeMode: EnyoChargeModeEnum;
    /** From the `StartChargeV1` that opened or changed it. */
    targetSocPercent?: number;
    /** The virtual meter when the session opened. */
    startMeterWh: number;
}

/** Everything the integration tracks for one virtual wallbox. */
interface VirtualWallboxState {
    vehicle?: VirtualWallboxVehicleState;
    /** An explicit stop holds until an explicit start or an unplug. */
    stopped: boolean;
    /** Whether the energy manager wants the vehicle to charge; `undefined` until it said so. */
    wantsOn?: boolean;
    /** The last switch the vehicle accepted; `undefined` while unknown. */
    switchedOn?: boolean;
    /** When the last switch on was accepted, ms since epoch. */
    switchedOnAt?: number;
    /** Whether the charge the host still holds open was looked up after the start of this run. */
    openChargeChecked: boolean;
    /** When accepted switches happened, ms since epoch, within the last 24 h. */
    switches: number[];
    /** Accepted starts since the car was last plugged in. */
    startsSincePlugIn: number;
    /** Applies a held-back wish once switching is allowed again. */
    retryTimer?: ReturnType<typeof setTimeout>;
    /** Publishes the last meter value again while a session is open. */
    meterHeartbeat?: ReturnType<typeof setInterval>;
    /** Future entries of the last charging schedule. */
    scheduleTimers: ReturnType<typeof setTimeout>[];
    /** Serialises switches and vehicle updates of this wallbox. */
    queue: Promise<unknown>;
    session?: VirtualSession;
    /** Staged by `StartChargeV1` for the session the next charge opens. */
    pendingStart?: {chargeMode: EnyoChargeModeEnum; vehicleId?: string; targetSocPercent?: number};
    /** Energy of all sessions so far, Wh — the wallbox has no meter of its own. */
    meterWh: number;
    /** The vehicle's last {@link VirtualWallboxVehicleState.sessionEnergyWh}. */
    lastVehicleEnergyWh?: number;
    reportedStatus?: EnyoChargerApplianceStatusEnum;
    reportedSuspendedReason?: EnyoChargerApplianceSuspendedReasonEnum;
    syncedStatus?: EnyoChargerApplianceStatusEnum;
    lastSyncAtMs: number;
    syncInFlight: boolean;
}

/** What {@link VIRTUAL_WALLBOX_SWITCH_HISTORY_KEY} holds per wallbox. */
interface StoredSwitches {
    switches?: number[];
    sincePlugIn?: number;
    /** The last switch the vehicle accepted, so a paused charge stays paused across a restart. */
    switchedOn?: boolean;
}

/** What became of a switch request. */
type SwitchOutcome =
    | {kind: 'unchanged'}
    | {kind: 'switched'}
    | {kind: 'deferred'}
    | {kind: 'not-plugged'}
    | {kind: 'refused'; reason: string};

/**
 * Base class for a **virtual wallbox**: a vehicle whose charging is switched
 * on and off in the car itself, through its manufacturer's cloud, because the
 * wallbox it hangs on cannot be controlled (no interface at all).
 *
 * To the energy manager it is an ordinary charger appliance, so it plans for
 * the car like for any wallbox. This class turns that into what the car can
 * do:
 *
 *  - **Commands become on/off.** `StartChargeV1`, `ResumeChargingV1` and any
 *    non-zero power (`SetChargingScheduleV1`, `SetChargerAvailablePowerV2`,
 *    `ChangeChargingPowerV1`) switch on; `StopChargeV1`, `PauseChargingV1`
 *    and a zero power switch off. A subclass implements only
 *    {@link switchVehicleCharging}.
 *  - **Switching stays rare.** Only a change of on/off is sent. Between two
 *    switches the energy manager causes lie at least
 *    {@link VirtualWallboxIntegrationEnergyAppOptions.minSwitchIntervalMinutes};
 *    one plug-in allows
 *    {@link VirtualWallboxIntegrationEnergyAppOptions.maxBlocksPerPlugIn}
 *    charging block(s) and 24 hours no more than
 *    {@link VirtualWallboxIntegrationEnergyAppOptions.maxSwitchesPerDay}
 *    switches. Both budgets hold back starts only, never a switch off. A wish
 *    held back is applied as soon as it may be — beyond the plug-in budget,
 *    not before the next plug-in. Explicit starts and stops go out at once.
 *  - **A stop stays stopped.** After `StopChargeV1`, power, schedule and
 *    resume commands are rejected until a new `StartChargeV1` or an unplug.
 *  - **The vehicle's state becomes the charger's.** The subclass hands every
 *    report of the car to {@link updateVehicleState}; this class derives the
 *    OCPP status, opens and closes sessions (`ChargingStartedV1`,
 *    `ChargingStoppedV1`), publishes meter values from the energy the car
 *    reports, and — when given an {@link ApplianceManager} — keeps the
 *    appliance registry's status in step.
 *
 * Create the appliance with {@link virtualWallboxChargerMetadata}. Reset,
 * reboot and log requests are not supported, and so far neither is a
 * grid-operator limitation (§14a): override
 * {@link handleGridOperatorPowerLimitation} to act on it.
 *
 * The switches of the last 24 hours and the last switch are kept in
 * `useStorage()`, so a restart neither refills the budget nor resumes a paused
 * charge; the charge the host still holds open is taken over again (needs the
 * `Charge` permission). The virtual meter lives in memory: after a restart the
 * meter starts at 0 again and a charge in progress is announced anew.
 *
 * @example
 * ```ts
 * class SmartcarWallbox extends VirtualWallboxIntegrationEnergyApp {
 *     protected async switchVehicleCharging(applianceId: string, on: boolean, context: VirtualWallboxSwitchContext) {
 *         const result = on ? await api.startCharge(carOf(applianceId)) : await api.stopCharge(carOf(applianceId));
 *         return {accepted: result.status === 'SUCCESS', reason: result.error?.detail};
 *     }
 * }
 * const wallbox = new SmartcarWallbox({source: EnyoSourceEnum.Device, applianceManager});
 * // on every webhook:
 * await wallbox.updateVehicleState(applianceId, {pluggedIn, charging, chargingPowerW, sessionEnergyWh});
 * ```
 */
export abstract class VirtualWallboxIntegrationEnergyApp extends WallboxIntegrationEnergyApp {
    private readonly minSwitchIntervalMs: number;
    private readonly maxBlocksPerPlugIn: number;
    private readonly maxSwitchesPerDay: number;
    private readonly meterHeartbeatMs: number;
    private readonly applianceManager?: ApplianceManager;
    private readonly wallboxes = new Map<string, VirtualWallboxState>();
    private switchHistory?: Promise<void>;

    /**
     * @param options - Standard integration options plus the switching limits.
     */
    protected constructor(options: VirtualWallboxIntegrationEnergyAppOptions) {
        super(options);
        this.minSwitchIntervalMs = (options.minSwitchIntervalMinutes ?? VIRTUAL_WALLBOX_DEFAULT_MIN_SWITCH_INTERVAL_MINUTES) * 60_000;
        this.maxBlocksPerPlugIn = options.maxBlocksPerPlugIn ?? VIRTUAL_WALLBOX_DEFAULT_MAX_BLOCKS_PER_PLUG_IN;
        this.maxSwitchesPerDay = options.maxSwitchesPerDay ?? VIRTUAL_WALLBOX_DEFAULT_MAX_SWITCHES_PER_DAY;
        this.meterHeartbeatMs = (options.meterHeartbeatSeconds ?? VIRTUAL_WALLBOX_DEFAULT_METER_HEARTBEAT_SECONDS) * 1000;
        this.applianceManager = options.applianceManager;
    }

    /**
     * Switches charging in the vehicle on or off — e.g. a charge start or stop
     * command to the manufacturer's cloud.
     *
     * Called only when on/off actually changes, never for two commands of the
     * same wallbox at once. Throwing counts as a refusal.
     *
     * @param applianceId - The virtual wallbox, i.e. the vehicle.
     * @param on - `true` to start charging, `false` to stop it.
     * @param context - What is known about the charge, e.g. its target state of charge.
     * @returns Whether the vehicle accepted the command.
     */
    protected abstract switchVehicleCharging(
        applianceId: string,
        on: boolean,
        context: VirtualWallboxSwitchContext
    ): Promise<VirtualWallboxSwitchResult>;

    /**
     * Hands over what the vehicle reports. Derives the charger status and
     * opens or closes sessions from it; call it on every report, also
     * unchanged ones, so meter values keep flowing during a charge.
     *
     * @param applianceId - The virtual wallbox, i.e. the vehicle.
     * @param state - The vehicle's charging state.
     * @returns Resolves once the resulting messages are published.
     */
    public updateVehicleState(applianceId: string, state: VirtualWallboxVehicleState): Promise<void> {
        const wallbox = this.wallbox(applianceId);
        return this.enqueue(wallbox, () => this.applyVehicleState(applianceId, wallbox, state));
    }

    /**
     * Unsubscribes like every integration and clears the timers of held-back
     * switches and charging schedules.
     */
    public stop(): void {
        for (const wallbox of this.wallboxes.values()) {
            this.clearRetry(wallbox);
            this.clearSchedule(wallbox);
            clearInterval(wallbox.meterHeartbeat);
            wallbox.meterHeartbeat = undefined;
        }
        super.stop();
    }

    /**
     * An explicit start: lifts a stop and switches on at once. The session is
     * announced when the vehicle actually charges, with this command's charge
     * mode.
     *
     * For a session already open it is only a change of its settings — the
     * app sends one for every change of the charge mode — so the switch it
     * asks for stays within the switching limits.
     */
    protected async handleStartCharge(message: EnyoDataBusStartChargeV1): Promise<IntegrationCommandResponse> {
        const wallbox = this.wallbox(message.applianceId);
        wallbox.stopped = false;
        wallbox.wantsOn = true;
        if (wallbox.session) {
            wallbox.session.chargeMode = message.data.chargeMode;
            if (message.data.targetSocPercent !== undefined) wallbox.session.targetSocPercent = message.data.targetSocPercent;
            return this.answer(await this.requestSwitch(message.applianceId, wallbox, false), false);
        }
        wallbox.pendingStart = {
            chargeMode: message.data.chargeMode,
            vehicleId: message.data.vehicleId,
            targetSocPercent: message.data.targetSocPercent,
        };
        return this.answer(await this.requestSwitch(message.applianceId, wallbox, true), true);
    }

    /**
     * An explicit stop: switches off at once and holds until the next start
     * or an unplug. The session ends when the vehicle has stopped charging.
     */
    protected async handleStopCharge(message: EnyoDataBusStopChargeV1): Promise<IntegrationCommandResponse> {
        const wallbox = this.wallbox(message.applianceId);
        wallbox.stopped = true;
        wallbox.wantsOn = false;
        wallbox.pendingStart = undefined;
        this.clearSchedule(wallbox);
        const answer = this.answer(await this.requestSwitch(message.applianceId, wallbox, true), true);
        // A car that is not charging ends its session now, not with its next report — which
        // may be long in coming when no command was needed.
        const vehicle = wallbox.vehicle;
        if (vehicle && !vehicle.charging) await this.updateVehicleState(message.applianceId, vehicle);
        return answer;
    }

    /** A pause: switches off, keeping the session; held back by the switching limits. */
    protected async handlePauseCharging(message: EnyoDataBusPauseChargingV1): Promise<IntegrationCommandResponse> {
        const wallbox = this.wallbox(message.data.applianceId);
        if (wallbox.stopped) return {answer: Accepted};
        return this.setWish(message.data.applianceId, wallbox, false);
    }

    /** A resume: switches on unless the charge was stopped. */
    protected async handleResumeCharging(message: EnyoDataBusResumeChargingV1): Promise<IntegrationCommandResponse> {
        return this.setWish(message.data.applianceId, this.wallbox(message.data.applianceId), message.data.maxChargingPowerKw > 0);
    }

    /** @deprecated in the base class; any non-zero power switches on. */
    protected async handleChangeChargingPower(message: EnyoDataBusChangeChargingPowerV1): Promise<IntegrationCommandResponse> {
        return this.setWish(message.applianceId, this.wallbox(message.applianceId), message.data.maxChargingPowerKw > 0);
    }

    /** The power envelope: any non-zero power switches on, zero switches off. */
    protected async handleSetChargerAvailablePower(message: EnyoDataBusSetChargerAvailablePowerV2): Promise<IntegrationCommandResponse> {
        return this.setWish(message.applianceId, this.wallbox(message.applianceId), message.data.powerW > 0);
    }

    /**
     * A charging schedule, emulated: each entry switches at its offset, a
     * non-zero limit on and zero off. A new schedule replaces the previous one.
     */
    protected async handleSetChargingSchedule(message: EnyoDataBusSetChargingScheduleV1): Promise<IntegrationCommandResponse> {
        const applianceId = message.applianceId;
        const wallbox = this.wallbox(applianceId);
        if (wallbox.stopped) return this.stoppedAnswer();
        this.clearSchedule(wallbox);
        const entries = [...message.data.relativeSchedule].sort((a, b) => a.seconds - b.seconds);
        const due = entries.filter((entry) => entry.seconds <= 0).pop();
        for (const entry of entries.filter((candidate) => candidate.seconds > 0)) {
            wallbox.scheduleTimers.push(setTimeout(() => {
                if (wallbox.stopped) return;
                wallbox.wantsOn = entry.chargingPowerLimitW > 0;
                void this.requestSwitch(applianceId, wallbox, false);
            }, entry.seconds * 1000));
        }
        if (!due) return {answer: Accepted};
        return this.setWish(applianceId, wallbox, due.chargingPowerLimitW > 0);
    }

    /** Clears the emulated schedule. */
    protected async handleClearChargingProfiles(message: EnyoDataBusClearChargingProfilesV1): Promise<IntegrationCommandResponse> {
        this.clearSchedule(this.wallbox(message.applianceId));
        return {answer: Accepted};
    }

    /** A vehicle cannot be reset. */
    protected async handleResetCharger(_message: EnyoDataBusResetChargerV1): Promise<IntegrationCommandResponse> {
        return {answer: NotSupported, rejectionReason: 'A virtual wallbox cannot be reset'};
    }

    /** A vehicle cannot be rebooted. */
    protected async handleRebootCharger(_message: EnyoDataBusRebootChargerV1): Promise<IntegrationCommandResponse> {
        return {answer: NotSupported, rejectionReason: 'A virtual wallbox cannot be rebooted'};
    }

    /** A virtual wallbox keeps no logs to upload. */
    protected async handleRequestChargerLogs(_message: EnyoDataBusRequestChargerLogsV1): Promise<IntegrationCommandResponse> {
        return {answer: NotSupported, rejectionReason: 'A virtual wallbox has no logs'};
    }

    /**
     * Not supported by default: the vehicle can only be switched, not held
     * below a power limit. Override to switch it off during a limitation.
     */
    protected async handleGridOperatorPowerLimitation(
        _message: EnyoDataBusGridOperatorPowerLimitationV1,
        _applianceId: string
    ): Promise<IntegrationCommandResponse> {
        return {answer: NotSupported, rejectionReason: 'A virtual wallbox can only switch the vehicle on or off'};
    }

    /** The tracked state of one wallbox, created on first use. */
    private wallbox(applianceId: string): VirtualWallboxState {
        let wallbox = this.wallboxes.get(applianceId);
        if (!wallbox) {
            wallbox = {
                stopped: false,
                switches: [],
                startsSincePlugIn: 0,
                openChargeChecked: false,
                scheduleTimers: [],
                queue: Promise.resolve(),
                meterWh: 0,
                lastSyncAtMs: 0,
                syncInFlight: false,
            };
            this.wallboxes.set(applianceId, wallbox);
        }
        return wallbox;
    }

    /** Runs `task` after everything queued for this wallbox. */
    private enqueue<T>(wallbox: VirtualWallboxState, task: () => Promise<T>): Promise<T> {
        const run = wallbox.queue.then(task, task);
        wallbox.queue = run.catch(() => undefined);
        return run;
    }

    /** Records the energy manager's wish and applies it within the switching limits. */
    private async setWish(applianceId: string, wallbox: VirtualWallboxState, on: boolean): Promise<IntegrationCommandResponse> {
        if (wallbox.stopped) return this.stoppedAnswer();
        wallbox.wantsOn = on;
        return this.answer(await this.requestSwitch(applianceId, wallbox, false), false);
    }

    /** Sends the switch the current wish calls for, queued behind other work on this wallbox. */
    private requestSwitch(applianceId: string, wallbox: VirtualWallboxState, explicit: boolean): Promise<SwitchOutcome> {
        return this.enqueue(wallbox, () => this.switchIfNeeded(applianceId, wallbox, explicit));
    }

    private async switchIfNeeded(applianceId: string, wallbox: VirtualWallboxState, explicit: boolean): Promise<SwitchOutcome> {
        await this.restoreSwitchHistory();
        this.clearRetry(wallbox);
        const target = wallbox.stopped ? false : wallbox.wantsOn;
        if (target === undefined || target === wallbox.switchedOn) return {kind: 'unchanged'};
        if (wallbox.vehicle && !wallbox.vehicle.pluggedIn) return {kind: 'not-plugged'};

        const now = Date.now();
        wallbox.switches = wallbox.switches.filter((at) => at > now - DAY_MS);
        if (!explicit) {
            if (target && wallbox.startsSincePlugIn >= this.maxBlocksPerPlugIn) {
                console.log(`Virtual wallbox ${applianceId}: switching on held back until the car is plugged in again`);
                return {kind: 'deferred'};
            }
            const allowedAt = this.nextSwitchAllowedAt(wallbox, target);
            if (allowedAt > now) {
                wallbox.retryTimer = setTimeout(() => void this.requestSwitch(applianceId, wallbox, false), allowedAt - now);
                console.log(`Virtual wallbox ${applianceId}: switching ${target ? 'on' : 'off'} held back until ${new Date(allowedAt).toISOString()}`);
                return {kind: 'deferred'};
            }
        }

        let result: VirtualWallboxSwitchResult;
        try {
            const targetSocPercent = wallbox.session?.targetSocPercent ?? wallbox.pendingStart?.targetSocPercent;
            result = await this.switchVehicleCharging(applianceId, target,
                targetSocPercent !== undefined ? {targetSocPercent} : {});
        } catch (error) {
            result = {accepted: false, reason: String(error)};
        }
        if (!result.accepted) {
            const reason = result.reason ?? 'the vehicle refused';
            console.warn(`Virtual wallbox ${applianceId}: switching ${target ? 'on' : 'off'} failed: ${reason}`);
            return {kind: 'refused', reason};
        }
        wallbox.switchedOn = target;
        if (target) wallbox.switchedOnAt = now;
        wallbox.switches.push(now);
        if (target) wallbox.startsSincePlugIn++;
        this.saveSwitchHistory();
        console.log(`Virtual wallbox ${applianceId}: switched ${target ? 'on' : 'off'}`);
        return {kind: 'switched'};
    }

    /** Reads the switches stored before a restart, once. Without storage the budget starts empty. */
    private restoreSwitchHistory(): Promise<void> {
        this.switchHistory ??= (async () => {
            try {
                const stored = await this.useStorage().load<Record<string, StoredSwitches>>(VIRTUAL_WALLBOX_SWITCH_HISTORY_KEY);
                for (const [applianceId, entry] of Object.entries(stored ?? {})) {
                    const wallbox = this.wallbox(applianceId);
                    // Restored before the first switch of this run, so nothing is counted twice.
                    wallbox.switches = [...(entry.switches ?? []), ...wallbox.switches].sort((a, b) => a - b);
                    wallbox.startsSincePlugIn += entry.sincePlugIn ?? 0;
                    wallbox.switchedOn ??= entry.switchedOn;
                }
            } catch (error) {
                console.warn(`Virtual wallbox: could not read the switch history, the daily budget starts empty: ${String(error)}`);
            }
        })();
        return this.switchHistory;
    }

    /** Stores, per wallbox, the switches of the last 24 hours and those since the plug-in. */
    private saveSwitchHistory(): void {
        const cutoff = Date.now() - DAY_MS;
        const history: Record<string, StoredSwitches> = Object.fromEntries([...this.wallboxes]
            .map(([applianceId, wallbox]) => [applianceId, {
                switches: wallbox.switches.filter((at) => at > cutoff),
                sincePlugIn: wallbox.startsSincePlugIn,
                ...(wallbox.switchedOn !== undefined ? {switchedOn: wallbox.switchedOn} : {}),
            }] as const)
            .filter(([, entry]) => entry.switches.length > 0 || entry.sincePlugIn > 0 || entry.switchedOn !== undefined));
        Promise.resolve()
            .then(() => this.useStorage().save(VIRTUAL_WALLBOX_SWITCH_HISTORY_KEY, history))
            .catch((error: unknown) => console.warn(`Virtual wallbox: could not store the switch history: ${String(error)}`));
    }

    /**
     * When the switching limits next allow a switch, ms since epoch. The daily
     * cap holds back only a start: a car the energy manager wants off is not
     * left charging for a day.
     */
    private nextSwitchAllowedAt(wallbox: VirtualWallboxState, on: boolean): number {
        const last = wallbox.switches[wallbox.switches.length - 1];
        const afterInterval = last === undefined ? 0 : last + this.minSwitchIntervalMs;
        const afterBudget = on && wallbox.switches.length >= this.maxSwitchesPerDay
            ? wallbox.switches[wallbox.switches.length - this.maxSwitchesPerDay] + DAY_MS
            : 0;
        return Math.max(afterInterval, afterBudget);
    }

    /** The acknowledgment for a switch request. */
    private answer(outcome: SwitchOutcome, explicit: boolean): IntegrationCommandResponse {
        switch (outcome.kind) {
            case 'refused':
                return {answer: Rejected, rejectionReason: outcome.reason};
            case 'not-plugged':
                // A wish of the energy manager waits for the next plug-in; an explicit command cannot.
                return explicit ? {answer: Rejected, rejectionReason: 'The vehicle is not plugged in'} : {answer: Accepted};
            default:
                return {answer: Accepted};
        }
    }

    private stoppedAnswer(): IntegrationCommandResponse {
        return {answer: Rejected, rejectionReason: 'Charging was stopped explicitly; only a new start resumes it'};
    }

    private clearRetry(wallbox: VirtualWallboxState): void {
        if (wallbox.retryTimer) clearTimeout(wallbox.retryTimer);
        wallbox.retryTimer = undefined;
    }

    private clearSchedule(wallbox: VirtualWallboxState): void {
        for (const timer of wallbox.scheduleTimers) clearTimeout(timer);
        wallbox.scheduleTimers = [];
    }

    private async applyVehicleState(applianceId: string, wallbox: VirtualWallboxState, state: VirtualWallboxVehicleState): Promise<void> {
        await this.restoreSwitchHistory();
        if (!wallbox.openChargeChecked) {
            wallbox.openChargeChecked = true;
            await this.adoptOpenCharge(applianceId, wallbox);
        }
        wallbox.vehicle = state;
        // A charging car is switched on — whether enyo did it, the owner did, or it was
        // already charging when this integration started. Saves a needless start.
        if (state.charging) wallbox.switchedOn = true;
        this.countEnergy(wallbox, state);

        const {status, suspendedReason} = this.statusOf(wallbox, state);
        const sessionStatus = status === EnyoChargerApplianceStatusEnum.Charging
            || status === EnyoChargerApplianceStatusEnum.Suspended;
        if (wallbox.session && !sessionStatus) {
            // A car that stopped by itself (target reached, full, its own timer) is off:
            // a later "0 W" from the energy manager then costs no stop command.
            if (state.pluggedIn && !state.charging && !wallbox.stopped) wallbox.switchedOn = false;
            this.closeSession(applianceId, wallbox, state);
        }
        if (!wallbox.session && status === EnyoChargerApplianceStatusEnum.Charging) {
            await this.openSession(applianceId, wallbox, state);
        } else if (wallbox.session) {
            this.publishMeter(applianceId, wallbox, state, EnyoChargingMeterValueContext.SamplePeriodic);
        }

        if (status !== wallbox.reportedStatus || suspendedReason !== wallbox.reportedSuspendedReason) {
            wallbox.reportedStatus = status;
            wallbox.reportedSuspendedReason = suspendedReason;
            this.publishChargerStatusChanged(applianceId, {
                status, connectorId: CONNECTOR_ID, ...(suspendedReason ? {suspendedReason} : {}),
            });
        }
        this.syncRegistryStatus(applianceId, wallbox, status, suspendedReason);
        this.keepMeterFresh(applianceId, wallbox);

        if (!state.pluggedIn) this.forgetCharge(wallbox);
    }

    /**
     * Runs the meter heartbeat while a session is open: the last meter value
     * again every {@link VirtualWallboxIntegrationEnergyAppOptions.meterHeartbeatSeconds},
     * so a car that reports only on change does not read as gone.
     */
    private keepMeterFresh(applianceId: string, wallbox: VirtualWallboxState): void {
        if (wallbox.session && !wallbox.meterHeartbeat) {
            wallbox.meterHeartbeat = setInterval(() => void this.enqueue(wallbox, async () => {
                if (wallbox.session && wallbox.vehicle) {
                    this.publishMeter(applianceId, wallbox, wallbox.vehicle, EnyoChargingMeterValueContext.SamplePeriodic);
                }
            }), this.meterHeartbeatMs);
        } else if (!wallbox.session && wallbox.meterHeartbeat) {
            clearInterval(wallbox.meterHeartbeat);
            wallbox.meterHeartbeat = undefined;
        }
    }

    /**
     * The OCPP status for the vehicle's state. A session exists while
     * `Charging` or `Suspended`; a car that stops by itself (full, its own
     * timer) while switched on ends it.
     */
    private statusOf(wallbox: VirtualWallboxState, state: VirtualWallboxVehicleState): {
        status: EnyoChargerApplianceStatusEnum;
        suspendedReason?: EnyoChargerApplianceSuspendedReasonEnum;
    } {
        if (!state.pluggedIn) return {status: EnyoChargerApplianceStatusEnum.Available};
        if (state.charging) return {status: EnyoChargerApplianceStatusEnum.Charging};
        if (wallbox.stopped) return {status: EnyoChargerApplianceStatusEnum.Finishing};
        const starting = wallbox.switchedOn === true && wallbox.switchedOnAt !== undefined
            && Date.now() - wallbox.switchedOnAt < START_GRACE_MS;
        if (wallbox.session && starting) {
            return {
                status: EnyoChargerApplianceStatusEnum.Suspended,
                suspendedReason: EnyoChargerApplianceSuspendedReasonEnum.Ev,
            };
        }
        if (wallbox.session && wallbox.switchedOn === false) {
            return {
                status: EnyoChargerApplianceStatusEnum.Suspended,
                suspendedReason: EnyoChargerApplianceSuspendedReasonEnum.Evse,
            };
        }
        return {status: EnyoChargerApplianceStatusEnum.Occupied};
    }

    /**
     * After a restart: the charge the host still holds open for this wallbox
     * becomes the session again — "hydrate, don't reopen". The rules below then
     * keep it (the car charges or is paused) or close it (the car stopped or
     * was unplugged meanwhile). Without the `Charge` permission there is
     * nothing to take over.
     */
    private async adoptOpenCharge(applianceId: string, wallbox: VirtualWallboxState): Promise<void> {
        if (wallbox.session) return;
        try {
            const charge = await this.useCharge().findActiveCharge(applianceId);
            if (!charge?.transactionId) return;
            const startMeterWh = charge.meterStartValueWh ?? wallbox.meterWh;
            const deliveredWh = Math.round((charge.totalEnergyKwh ?? 0) * 1000);
            wallbox.meterWh = Math.max(wallbox.meterWh, startMeterWh + deliveredWh);
            wallbox.session = {
                transactionId: charge.transactionId,
                chargeMode: charge.chargeMode ?? EnyoChargeModeEnum.Immediate,
                startMeterWh,
            };
            console.log(`Virtual wallbox ${applianceId}: took over the open charge ${charge.transactionId}`);
        } catch (error) {
            console.warn(`Virtual wallbox ${applianceId}: could not look up an open charge: ${String(error)}`);
        }
    }

    /** Adds what the vehicle charged since its last report to the virtual meter. */
    private countEnergy(wallbox: VirtualWallboxState, state: VirtualWallboxVehicleState): void {
        const energy = state.sessionEnergyWh;
        if (energy === undefined) return;
        const last = wallbox.lastVehicleEnergyWh;
        // A smaller value is a new count by the vehicle, which started from zero.
        const delta = last === undefined ? 0 : energy >= last ? energy - last : energy;
        wallbox.meterWh += delta;
        wallbox.lastVehicleEnergyWh = energy;
    }

    private async openSession(applianceId: string, wallbox: VirtualWallboxState, state: VirtualWallboxVehicleState): Promise<void> {
        const pending = wallbox.pendingStart;
        wallbox.pendingStart = undefined;
        const chargeMode = pending?.chargeMode ?? await this.defaultChargeMode(applianceId);
        const vehicleId = pending?.vehicleId ?? state.vehicleId;
        wallbox.session = {
            transactionId: this.generateMessageId(),
            chargeMode,
            startMeterWh: wallbox.meterWh,
            ...(pending?.targetSocPercent !== undefined ? {targetSocPercent: pending.targetSocPercent} : {}),
        };
        this.publishChargingStarted(applianceId, {
            connectorId: CONNECTOR_ID,
            transactionId: wallbox.session.transactionId,
            initiator: pending ? EnyoChargeInitiatorEnum.App : EnyoChargeInitiatorEnum.Charger,
            chargeMode,
            meterValueWh: wallbox.meterWh,
            ...(vehicleId ? {vehicleId} : {}),
        });
        this.publishMeter(applianceId, wallbox, state, EnyoChargingMeterValueContext.TransactionBegin);
    }

    private closeSession(applianceId: string, wallbox: VirtualWallboxState, state: VirtualWallboxVehicleState): void {
        const session = wallbox.session;
        if (!session) return;
        this.publishMeter(applianceId, wallbox, state, EnyoChargingMeterValueContext.TransactionEnd);
        const stopReason = !state.pluggedIn
            ? EnyoChargingStopReason.EVDisconnected
            : wallbox.stopped ? EnyoChargingStopReason.Remote : EnyoChargingStopReason.Other;
        this.publishChargingStopped(applianceId, {
            connectorId: CONNECTOR_ID,
            transactionId: session.transactionId,
            meterValueWh: wallbox.meterWh,
            energyDeliveredWh: wallbox.meterWh - session.startMeterWh,
            stopReason,
        });
        wallbox.session = undefined;
    }

    /**
     * Publishes a meter value of the open session. Skipped while the vehicle
     * charges without telling its power: a made-up 0 W would read as a fact.
     */
    private publishMeter(
        applianceId: string,
        wallbox: VirtualWallboxState,
        state: VirtualWallboxVehicleState,
        context: EnyoChargingMeterValueContext
    ): void {
        const session = wallbox.session;
        if (!session) return;
        const chargingPowerW = state.charging ? state.chargingPowerW : 0;
        if (chargingPowerW === undefined) return;
        this.publishChargingMeterValues(applianceId, {
            connectorId: CONNECTOR_ID,
            transactionId: session.transactionId,
            meterValueWh: wallbox.meterWh,
            chargingPowerW,
            voltageL1: NOMINAL_VOLTAGE_V,
            energyDeliveredWh: wallbox.meterWh - session.startMeterWh,
            context,
            ...(state.socPercent !== undefined ? {evStateOfChargePercent: state.socPercent} : {}),
        });
    }

    /** The wallbox's configured default mode for a charge the vehicle started on its own. */
    private async defaultChargeMode(applianceId: string): Promise<EnyoChargeModeEnum> {
        try {
            const appliance = await this.useAppliances().getById(applianceId);
            return appliance?.charger?.defaultChargeMode ?? EnyoChargeModeEnum.Immediate;
        } catch (error) {
            console.warn(`Virtual wallbox ${applianceId}: could not read the default charge mode, using Immediate: ${String(error)}`);
            return EnyoChargeModeEnum.Immediate;
        }
    }

    /**
     * Keeps the registry's `charger.status` in step: `ChargerStatusChangedV1`
     * does not update it. Written on change and re-asserted every few minutes;
     * a failed write is retried on the next report.
     */
    private syncRegistryStatus(
        applianceId: string,
        wallbox: VirtualWallboxState,
        status: EnyoChargerApplianceStatusEnum,
        suspendedReason: EnyoChargerApplianceSuspendedReasonEnum | undefined
    ): void {
        const manager = this.applianceManager;
        if (!manager || wallbox.syncInFlight) return;
        const heartbeatDue = Date.now() - wallbox.lastSyncAtMs >= STATUS_SYNC_HEARTBEAT_MS;
        if (status === wallbox.syncedStatus && !heartbeatDue) return;
        wallbox.syncInFlight = true;
        manager.updateAppliance(applianceId, {charger: {status, suspendedReason}})
            .then(() => {
                wallbox.syncedStatus = status;
                wallbox.lastSyncAtMs = Date.now();
            })
            .catch((error: unknown) => console.warn(`Virtual wallbox ${applianceId}: status sync failed, retrying: ${String(error)}`))
            .finally(() => { wallbox.syncInFlight = false; });
    }

    /** After an unplug: every wish and stop belonged to the charge that ended. */
    private forgetCharge(wallbox: VirtualWallboxState): void {
        wallbox.stopped = false;
        wallbox.wantsOn = undefined;
        wallbox.switchedOn = undefined;
        wallbox.pendingStart = undefined;
        wallbox.lastVehicleEnergyWh = undefined;
        this.clearRetry(wallbox);
        this.clearSchedule(wallbox);
        // The next plug-in gets a charging block of its own.
        if (wallbox.startsSincePlugIn > 0) {
            wallbox.startsSincePlugIn = 0;
            this.saveSwitchHistory();
        }
    }
}
