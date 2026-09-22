import {
    EnyoCalibratedFeatureEnum,
    EnyoCalibrationFailureReasonEnum,
    EnyoCalibrationHandler,
    EnyoCalibrationRequirement,
    EnyoCalibrationRun,
    EnyoCalibrationRunFilter,
} from "../types/enyo-calibration.js";
import {EnyoOnboardingTranslatedContent} from "../types/enyo-onboarding.js";

/**
 * How a run is opened.
 */
export interface EnyoCalibrationStartOptions {
    /** The appliance to calibrate. */
    applianceId: string;
    /**
     * Translated description of the first step (de/en). Set it when the run
     * starts with something worth naming — "Batterie wird geladen" tells a
     * waiting user more than a spinner.
     */
    currentStep?: EnyoOnboardingTranslatedContent[];
    /**
     * The {@link EnyoCalibrationRequest.requestId} this run answers, when it
     * was started from a host request. Lets the host tie the run it asked for
     * to the run it now sees.
     */
    requestId?: string;
}

/**
 * How a running run reports where it has got to.
 */
export interface EnyoCalibrationProgress {
    /**
     * Progress through the run, 0-100. Omit it rather than guessing: an honest
     * {@link currentStep} beats a bar that sits at 10 % for three hours.
     */
    progressPercent?: number;
    /** Translated description of the current step (de/en). */
    currentStep?: EnyoOnboardingTranslatedContent[];
}

/**
 * How a run ends successfully.
 */
export interface EnyoCalibrationSuccess {
    /**
     * The capabilities the run actually proved. Pass `[]` when the run
     * completed and confirmed nothing — that is a real finding about the
     * device, and the host records it as such.
     *
     * Must belong to the appliance's category; a charger run reporting a
     * heatpump feature is rejected by `validateCalibrationRun()`.
     */
    confirmedFeatures: EnyoCalibratedFeatureEnum[];
    /** Translated, user-facing summary (de/en). */
    message?: EnyoOnboardingTranslatedContent[];
    /** Untranslated technical detail for support. Not shown to the user. */
    detail?: string;
}

/**
 * How a run ends unsuccessfully.
 */
export interface EnyoCalibrationFailure {
    /** Why it did not complete, and thus whether retrying is worthwhile. */
    reason: EnyoCalibrationFailureReasonEnum;
    /** Translated, user-facing explanation (de/en) — especially what to do about it. */
    message?: EnyoOnboardingTranslatedContent[];
    /** Untranslated technical detail for support. Not shown to the user. */
    detail?: string;
}

/**
 * Interface for reporting device calibration — an app proving what an appliance
 * can actually do, and publishing the result.
 *
 * Covers batteries, wallboxes, inverters, heat pumps and heating rods. See
 * {@link EnyoCalibrationRun} for how this differs from an appliance's claimed
 * `availableFeatures` and from a learning phase.
 *
 * **A run is a lifecycle, not a call.** Open it, report progress against it
 * while it takes however long it takes, then close it with a verdict:
 *
 * ```typescript
 * const calibration = energyApp.useCalibration();
 *
 * const runId = await calibration.startRun({applianceId: 'battery-1'});
 * await calibration.reportProgress(runId, {
 *     progressPercent: 40,
 *     currentStep: [
 *         {language: 'de', value: 'Batterie wird entladen'},
 *         {language: 'en', value: 'Discharging the battery'},
 *     ],
 * });
 * await calibration.completeRun(runId, {
 *     confirmedFeatures: [
 *         EnyoCalibratedFeatureEnum.BatteryGridCharging,
 *         EnyoCalibratedFeatureEnum.BatteryUsableCapacity,
 *     ],
 * });
 * ```
 *
 * An app that can be asked to calibrate registers a handler as well — see
 * {@link listenForCalibrationRequest}. One that only calibrates on its own
 * schedule can ignore it.
 *
 * **Required permission:** `Calibration` for everything that writes; reading
 * status needs none.
 */
export interface EnergyAppCalibration {
    /**
     * Opens a calibration run and puts the appliance into
     * {@link EnyoCalibrationStatusEnum.Running}.
     *
     * Call it when the work actually begins, not when it is queued: the run is
     * visible to users from this moment, and a run that sits at 0 % for an hour
     * because it is waiting for a precondition should be
     * {@link reportRequirements} instead.
     *
     * @param options - The appliance, an optional first step, and the request being answered.
     * @returns The new {@link EnyoCalibrationRun.id}.
     */
    startRun(options: EnyoCalibrationStartOptions): Promise<string>;

    /**
     * Updates a running run. Cheap to call, but it is written and fanned out to
     * subscribers each time — report meaningful steps, not every poll.
     *
     * @param runId - The run to update.
     * @param progress - Where the run has got to.
     */
    reportProgress(runId: string, progress: EnyoCalibrationProgress): Promise<void>;

    /**
     * Closes a run as {@link EnyoCalibrationStatusEnum.Succeeded} and records
     * what it proved.
     *
     * @param runId - The run to close.
     * @param result - The confirmed features and any user-facing summary.
     */
    completeRun(runId: string, result: EnyoCalibrationSuccess): Promise<void>;

    /**
     * Closes a run as {@link EnyoCalibrationStatusEnum.Failed}.
     *
     * Always close a run you opened. An app that crashes mid-run leaves it
     * {@link EnyoCalibrationStatusEnum.Running} forever, which reads to a user
     * as a device that has been calibrating for three days; report
     * {@link EnyoCalibrationFailureReasonEnum.Interrupted} on restart when you
     * find one of your own runs still open.
     *
     * @param runId - The run to close.
     * @param failure - Why it did not complete.
     */
    failRun(runId: string, failure: EnyoCalibrationFailure): Promise<void>;

    /**
     * Declares an appliance's calibration prerequisites without opening a run,
     * putting it into {@link EnyoCalibrationStatusEnum.NotCalibrated} or
     * {@link EnyoCalibrationStatusEnum.Ready} depending on whether all of them
     * are satisfied.
     *
     * This is what makes "not calibrated" actionable — call it whenever the
     * answer changes, so a user sees "needs at least 30 % state of charge"
     * rather than a dead end.
     *
     * @param applianceId - The appliance the requirements belong to.
     * @param requirements - Each prerequisite and whether it currently holds.
     */
    reportRequirements(applianceId: string, requirements: EnyoCalibrationRequirement[]): Promise<void>;

    /**
     * Declares that an appliance cannot be calibrated at all, putting it into
     * {@link EnyoCalibrationStatusEnum.NotSupported}.
     *
     * Worth saying explicitly: without it a consumer cannot tell a device that
     * will never calibrate from one whose app has not got round to it, and
     * offers a control that can only disappoint.
     *
     * @param applianceId - The appliance that has no calibration to offer.
     */
    reportNotSupported(applianceId: string): Promise<void>;

    /**
     * Marks a previously succeeded run as
     * {@link EnyoCalibrationStatusEnum.Stale} — its findings no longer describe
     * the device.
     *
     * Call it after a firmware update, a hardware swap, or a rewiring. The old
     * confirmed features are kept for display; nothing should be relied on
     * until a new run succeeds.
     *
     * @param applianceId - The appliance whose latest result no longer holds.
     * @param reason - Untranslated technical note on what changed.
     */
    markStale(applianceId: string, reason?: string): Promise<void>;

    /**
     * The latest run for an appliance — its current calibration status.
     *
     * Resolves to `undefined` when the appliance has never been reported on.
     * That is not the same as {@link EnyoCalibrationStatusEnum.NotSupported}:
     * one means nobody has said anything, the other means someone said no.
     *
     * @param applianceId - The appliance to read.
     * @returns The latest run, or `undefined` when there is none.
     */
    getStatus(applianceId: string): Promise<EnyoCalibrationRun | undefined>;

    /**
     * Lists calibration runs, most recent first.
     *
     * @param filter - Optional narrowing by appliance, category, status or start time.
     * @returns The matching runs.
     */
    list(filter?: EnyoCalibrationRunFilter): Promise<EnyoCalibrationRun[]>;

    /**
     * Registers the handler the host calls to start a run — the cockpit's
     * "calibrate now", an onboarding step, or the host refreshing a stale
     * result.
     *
     * At most one handler per package; registering again replaces it. Answer
     * promptly with an acceptance and report the run itself through its
     * lifecycle — see {@link EnyoCalibrationHandler}.
     *
     * @param handler - Called with each request; returns whether a run was opened.
     */
    listenForCalibrationRequest(handler: EnyoCalibrationHandler): void;

    /**
     * Listens for changes to any calibration run the package can see, including
     * runs opened by other packages.
     *
     * @param listener - Callback invoked with the changed run.
     * @returns A listener ID for {@link removeListener}.
     */
    listenForCalibrationStatusChange(
        listener: (run: EnyoCalibrationRun) => void | Promise<void>
    ): string;

    /**
     * Removes a listener registered with
     * {@link listenForCalibrationStatusChange}.
     *
     * @param listenerId - The ID returned when the listener was registered.
     */
    removeListener(listenerId: string): void;
}
