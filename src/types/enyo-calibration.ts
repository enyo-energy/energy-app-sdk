/**
 * Calibration — an app proving what a device can actually do, and saying so.
 *
 * An appliance's `availableFeatures` is a **claim**: the app writes it from a
 * model database, a register map or a nameplate. A calibration run is the
 * **proof**: the app exercises the device and reports which of those
 * capabilities survived contact with the hardware. A wallbox that advertises
 * phase switching and fails to switch, a battery whose grid-charge register
 * accepts writes and ignores them, a heat pump wired for SG Ready with nothing
 * on the terminals — these are the cases the claim cannot catch and a run can.
 *
 * Both survive on purpose. The claim tells an onboarding flow what to expect
 * before anything is plugged in; the run tells an energy manager what it may
 * rely on afterwards.
 *
 * **A run has a lifetime, not a return value.** Unlike a device test
 * ({@link EnyoDeviceTestResult}), where the handler's promise is the whole
 * protocol, a calibration can span hours — a battery charge/discharge cycle, a
 * heat pump's heating cycle. The app opens a run, reports progress against it,
 * and closes it with a verdict; the host stores the latest run per appliance.
 *
 * Not to be confused with a **learning phase**
 * ({@link EnyoLearningPhase}), which is open-ended data gathering with no
 * pass/fail and no feature list. The two compose: a calibration run may open a
 * learning phase while it settles.
 *
 * Pure type declarations (no runtime logic). Validate a run before publishing
 * it with `validateCalibrationRun()`
 * (`../implementations/calibration/calibration-validators.ts`).
 */

import type {EnyoApplianceTypeEnum} from './enyo-appliance.js';
import type {EnyoOnboardingTranslatedContent} from './enyo-onboarding.js';

/**
 * Where an appliance stands with respect to calibration.
 *
 * The members separate states that lead a consumer somewhere different:
 * {@link NotSupported} means stop asking, {@link NotCalibrated} means a run is
 * possible but something is missing, {@link Ready} means it could start now,
 * and {@link Stale} means a past success no longer describes the device.
 * Collapsing them leaves a UI with nothing to say but "not calibrated".
 */
export enum EnyoCalibrationStatusEnum {
    /**
     * This appliance cannot be calibrated at all — the app has no run to offer
     * for this device class or model. Permanent; a consumer should not present
     * calibration for it.
     */
    NotSupported = 'not-supported',
    /**
     * Calibration is possible but has never succeeded, and something is still
     * missing. What is missing is listed in
     * {@link EnyoCalibrationRun.requirements} — do not present this as a fault.
     */
    NotCalibrated = 'not-calibrated',
    /**
     * Every prerequisite is met and a run could start now. The state a "start
     * calibration" control should be enabled in.
     */
    Ready = 'ready',
    /** A run is in progress. See {@link EnyoCalibrationRun.progressPercent}. */
    Running = 'running',
    /**
     * The run finished and its findings are in
     * {@link EnyoCalibrationRun.confirmedFeatures}.
     *
     * Success does not mean every claimed feature was confirmed — it means the
     * run completed and its answer can be trusted. A successful run confirming
     * nothing is a meaningful result about the device.
     */
    Succeeded = 'succeeded',
    /**
     * The run did not complete. {@link EnyoCalibrationRun.failureReason} says
     * why, and whether it is worth retrying.
     */
    Failed = 'failed',
    /**
     * A past run succeeded, but its result no longer describes the device —
     * the firmware was updated, the hardware was swapped, the wiring changed.
     *
     * The old {@link EnyoCalibrationRun.confirmedFeatures} are kept so a
     * consumer can show what used to hold, but nothing should be relied on
     * until a new run succeeds.
     */
    Stale = 'stale',
}

/**
 * Why a calibration run did not complete.
 *
 * Split the way {@link EnyoDeviceTestOutcomeEnum} is split — by what the
 * consumer should do next — rather than by where in the code it went wrong.
 */
export enum EnyoCalibrationFailureReasonEnum {
    /**
     * A prerequisite stopped holding mid-run: the vehicle was unplugged, the
     * battery fell below the state of charge the run needed, the heating season
     * ended. Retryable once the condition returns.
     */
    PrerequisitesNotMet = 'prerequisites-not-met',
    /** The device stopped answering. Transient — a later run may succeed. */
    DeviceUnreachable = 'device-unreachable',
    /** The run exceeded the time the app allowed it. */
    TimedOut = 'timed-out',
    /**
     * The run completed its steps but the readings were too noisy or too few to
     * conclude anything. Distinct from {@link DeviceUnreachable}: the device
     * answered, the answers just did not settle.
     */
    InsufficientData = 'insufficient-data',
    /** The user or installer stopped the run. Not an error — do not alarm anyone. */
    UserAborted = 'user-aborted',
    /**
     * The device turned out not to be one this run applies to — a model swap
     * behind the same IP, a firmware that removed the interface the run needs.
     */
    UnsupportedDevice = 'unsupported-device',
    /**
     * The run was cut off by something outside it — the app restarted, the host
     * rebooted, the package was updated mid-run. Retryable immediately.
     */
    Interrupted = 'interrupted',
    /**
     * No more specific reason applies. Prefer any member above; this exists so
     * a sender never has to omit the field.
     */
    Unknown = 'unknown',
}

/**
 * Capabilities a calibration run can confirm, across every device class that
 * supports one.
 *
 * Deliberately its own vocabulary rather than the per-type `availableFeatures`
 * enums: those describe what an appliance *claims*, are shaped by what a model
 * database happens to record, and change for reasons that have nothing to do
 * with what a run can prove. Members are prefixed by device class because the
 * list is flat — a run reports features belonging to its own appliance type,
 * which `validateCalibrationRun()` enforces.
 */
export enum EnyoCalibratedFeatureEnum {

    // ── Battery / storage ──────────────────────────────────────────────────

    /** The battery accepted a grid-charge instruction and actually charged from the grid. */
    BatteryGridCharging = 'battery-grid-charging',
    /** The battery discharged into the grid on instruction. */
    BatteryGridDischarging = 'battery-grid-discharging',
    /** A charge power limit was applied and observed to hold. */
    BatteryChargePowerLimitation = 'battery-charge-power-limitation',
    /** A discharge power limit was applied and observed to hold. */
    BatteryDischargePowerLimitation = 'battery-discharge-power-limitation',
    /** The reported state of charge tracked the energy actually moved. */
    BatterySocAccuracy = 'battery-soc-accuracy',
    /** Usable capacity was measured, rather than taken from the nameplate. */
    BatteryUsableCapacity = 'battery-usable-capacity',

    // ── Wallbox / charger ──────────────────────────────────────────────────

    /** A session was started and stopped remotely. */
    ChargerStartStop = 'charger-start-stop',
    /** A charging power or current limit was applied and observed to hold. */
    ChargerPowerLimitation = 'charger-power-limitation',
    /** The charger switched between single- and three-phase charging under instruction. */
    ChargerPhaseSwitching = 'charger-phase-switching',
    /** The charger reported meter values that tracked the energy delivered. */
    ChargerMeterAccuracy = 'charger-meter-accuracy',
    /** The charger identified the connected vehicle. */
    ChargerVehicleIdentification = 'charger-vehicle-identification',
    /** The charger reported the vehicle's state of charge. */
    ChargerVehicleSocReadout = 'charger-vehicle-soc-readout',

    // ── Inverter / PV ──────────────────────────────────────────────────────

    /** An active power limit was applied to the inverter and observed to hold. */
    InverterPowerLimitation = 'inverter-power-limitation',
    /** Grid feed-in was curtailed on instruction. */
    InverterFeedInLimitation = 'inverter-feed-in-limitation',
    /** Per-DC-string values were read and matched the inverter's total. */
    InverterDcStringReadout = 'inverter-dc-string-readout',
    /** Reactive power was controlled. */
    InverterReactivePowerControl = 'inverter-reactive-power-control',

    // ── Heat pump ──────────────────────────────────────────────────────────

    /** An SG Ready signal reached the heat pump and changed its behaviour. */
    HeatpumpSgReady = 'heatpump-sg-ready',
    /** A temperature setpoint was written and the heat pump followed it. */
    HeatpumpTemperatureSetpoint = 'heatpump-temperature-setpoint',
    /** Output power was modulated under instruction, rather than only switched. */
    HeatpumpPowerModulation = 'heatpump-power-modulation',
    /** A domestic hot water boost was triggered on demand. */
    HeatpumpDhwBoost = 'heatpump-dhw-boost',
    /** A consumption limit was applied and observed to hold. */
    HeatpumpPowerLimitation = 'heatpump-power-limitation',
    /** Reported temperatures tracked what the run drove them to. */
    HeatpumpTemperatureReadout = 'heatpump-temperature-readout',

    // ── Heating rod ────────────────────────────────────────────────────────

    /** The rod switched on and off under instruction. */
    HeatingRodSwitching = 'heating-rod-switching',
    /** The rod ran at intermediate power, not only fully on or fully off. */
    HeatingRodPowerModulation = 'heating-rod-power-modulation',
    /** Discrete power steps were selected and observed. */
    HeatingRodStepControl = 'heating-rod-step-control',
    /** The rod honoured an available-power announcement. */
    HeatingRodAvailablePowerAnnouncement = 'heating-rod-available-power-announcement',
    /** The rod's tank temperature sensor tracked the heat the run put in. */
    HeatingRodDhwSensor = 'heating-rod-dhw-sensor',
}

/**
 * Something that must hold before a run can start, and whether it does.
 *
 * The reason {@link EnyoCalibrationStatusEnum.NotCalibrated} is not a dead end:
 * "needs at least 30 % state of charge" or "needs the vehicle plugged in" is
 * something a user can act on, where a bare "not calibrated" is not.
 */
export interface EnyoCalibrationRequirement {
    /** App-defined key, stable across runs, e.g. `min-soc`, `vehicle-connected`. */
    key: string;
    /** Whether this requirement is currently satisfied. */
    satisfied: boolean;
    /** Translated, user-facing description of what is needed (de/en). */
    description: EnyoOnboardingTranslatedContent[];
}

/**
 * One calibration run — the record a consumer reads to answer "is this device
 * calibrated, and what did we learn?".
 *
 * The latest run per appliance is the appliance's calibration status; earlier
 * runs are history. A run exists from the moment the app opens it, so a
 * consumer sees {@link EnyoCalibrationStatusEnum.Running} rather than nothing
 * while it works.
 */
export interface EnyoCalibrationRun {
    /** Unique identifier for this run. */
    id: string;
    /** The appliance this run is about. */
    applianceId: string;
    /**
     * The appliance's category. Determines which
     * {@link EnyoCalibratedFeatureEnum} members may appear in
     * {@link confirmedFeatures}.
     */
    applianceType: EnyoApplianceTypeEnum;
    /** Where the run stands. */
    status: EnyoCalibrationStatusEnum;
    /** ISO 8601 timestamp of when the run was opened. */
    startedAtIso: string;
    /** ISO 8601 timestamp of the last change to this record. */
    updatedAtIso: string;
    /** ISO 8601 timestamp of when the run reached a terminal status, if it has. */
    completedAtIso?: string;
    /**
     * Progress through the run, 0-100. Only meaningful while
     * {@link status} is {@link EnyoCalibrationStatusEnum.Running}.
     *
     * Omit it rather than inventing one: a progress bar that jumps from 10 % to
     * 100 % after three hours is worse than a spinner and an honest
     * {@link currentStep}.
     */
    progressPercent?: number;
    /**
     * Translated description of what the run is doing right now (de/en) — e.g.
     * "Batterie wird entladen". Shown while {@link progressPercent} cannot be
     * given, which for a long run is most of the time.
     */
    currentStep?: EnyoOnboardingTranslatedContent[];
    /**
     * What must hold before the run can start, and whether it does. Carried
     * while {@link status} is {@link EnyoCalibrationStatusEnum.NotCalibrated}
     * or {@link EnyoCalibrationStatusEnum.Ready}; omitted once a run is under
     * way.
     */
    requirements?: EnyoCalibrationRequirement[];
    /**
     * The capabilities the run actually proved. Only on
     * {@link EnyoCalibrationStatusEnum.Succeeded} and
     * {@link EnyoCalibrationStatusEnum.Stale}.
     *
     * An empty array is a real answer — the run completed and confirmed
     * nothing — and is not the same as the field being absent, which means the
     * run never got far enough to say.
     */
    confirmedFeatures?: EnyoCalibratedFeatureEnum[];
    /**
     * Why the run did not complete. Only on
     * {@link EnyoCalibrationStatusEnum.Failed}.
     */
    failureReason?: EnyoCalibrationFailureReasonEnum;
    /**
     * Translated, user-facing explanation (de/en). Most valuable on the
     * failures a user can do something about — which button to press, which
     * condition to wait for.
     */
    message?: EnyoOnboardingTranslatedContent[];
    /**
     * Untranslated technical detail for support and debugging, e.g.
     * `"phase switch: register 40021 accepted 1, read back 3"`. Never shown to
     * the user.
     */
    detail?: string;
}

/**
 * Who asked for a calibration run.
 *
 * One handler serves every caller, so an app implements its run once; this
 * field lets it adjust where that genuinely matters — an installer standing at
 * the device can be asked to do things a background run cannot.
 */
export enum EnyoCalibrationRequestOriginEnum {
    /** A user or installer pressed "calibrate" in the enyo cockpit. */
    UserRequest = 'user-request',
    /** An onboarding guide reached a calibration step. */
    OnboardingGuide = 'onboarding-guide',
    /** The host asked on its own — after a firmware update, or to refresh a stale result. */
    Host = 'host',
}

/**
 * The host asking an app to start a calibration run.
 *
 * The handler answers whether the run was **accepted**, not whether it
 * succeeded — the run itself is reported through
 * {@link EnergyAppCalibration.reportProgress} and closed later. Refusing is a
 * normal answer: prerequisites may not hold, and saying so with
 * {@link EnyoCalibrationRequestAcceptance.requirements} is more useful than
 * starting a run that is bound to fail.
 */
export interface EnyoCalibrationRequest {
    /** Correlates this request with its answer. Unique per request. */
    requestId: string;
    /** The appliance to calibrate. */
    applianceId: string;
    /** Who asked. */
    origin: EnyoCalibrationRequestOriginEnum;
    /**
     * Whether the user is present at the device and can be asked to act.
     * A run that needs someone to plug a car in is worth offering during an
     * onboarding guide and pointless in the background.
     */
    userPresent?: boolean;
}

/**
 * An app's answer to a {@link EnyoCalibrationRequest}: whether a run started.
 */
export interface EnyoCalibrationRequestAcceptance {
    /** The {@link EnyoCalibrationRequest.requestId} this answers. */
    requestId: string;
    /** Whether a run was opened. */
    accepted: boolean;
    /**
     * The {@link EnyoCalibrationRun.id} that was opened. Present only when
     * {@link accepted} is `true`; follow the run through its status updates.
     */
    runId?: string;
    /**
     * Why no run was opened, in terms the caller can act on. Present when
     * {@link accepted} is `false` — an unsatisfied entry here is what a UI
     * shows instead of a bare refusal.
     */
    requirements?: EnyoCalibrationRequirement[];
    /** Translated, user-facing explanation of the refusal (de/en). */
    message?: EnyoOnboardingTranslatedContent[];
    /** Untranslated technical detail for support. Not shown to the user. */
    detail?: string;
}

/**
 * Handler the host calls to start a calibration run.
 *
 * Answer promptly — this is an acceptance, not the run. Open the run, return
 * {@link EnyoCalibrationRequestAcceptance.accepted} `true` with its id, and
 * report the rest through the run's own lifecycle. A handler that blocks for
 * the duration of a three-hour battery cycle is the mistake this shape exists
 * to prevent.
 *
 * @param request - Which appliance to calibrate, who asked, and whether a user is present.
 * @returns Whether a run was opened, and if not, what is missing.
 */
export type EnyoCalibrationHandler = (
    request: EnyoCalibrationRequest
) => Promise<EnyoCalibrationRequestAcceptance>;

/**
 * Filter for querying calibration runs.
 */
export interface EnyoCalibrationRunFilter {
    /** Only runs for this appliance. */
    applianceId?: string;
    /** Only runs for appliances of this category. */
    applianceType?: EnyoApplianceTypeEnum;
    /** Only runs in this status. */
    status?: EnyoCalibrationStatusEnum;
    /** Only runs opened at or after this ISO 8601 timestamp. */
    startedAfterIso?: string;
}
