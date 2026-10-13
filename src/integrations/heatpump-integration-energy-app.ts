import {IntegrationEnergyApp} from "./integration-energy-app.js";
import {IntegrationCommandResponse, IntegrationEnergyAppOptions} from "./integration-types.js";
import {EnyoApplianceTypeEnum} from "../types/enyo-appliance.js";
import {
    EnyoCommandAcknowledgeActionResult,
    EnyoDataBusGridOperatorPowerLimitationV1,
    EnyoDataBusHeatpumpAvailablePowerAnnouncementV1,
    EnyoDataBusHeatpumpControlCancelV3,
    EnyoDataBusHeatpumpControlStatusV3,
    EnyoDataBusHeatpumpControlV3,
    EnyoDataBusHeatpumpFlexibilityAnnouncementV3,
    EnyoDataBusHeatpumpOverheatingV1,
    EnyoDataBusHeatpumpTemperaturesV1,
    EnyoDataBusHeatpumpValuesV1,
    EnyoCommandAcknowledgeAnswerEnum,
    EnyoDataBusMessageEnum,
    EnyoDataBusSetHeatpumpAvailablePowerV2,
    EnyoDataBusSetHeatpumpRoomTemperatureV1,
    EnyoHeatpumpFlexibilityOption
} from "../types/enyo-data-bus-value.js";
import {
    heatpumpFlexibilityOfferId,
    validateHeatpumpFlexibilityAnnouncement
} from "../implementations/heatpump/heatpump-flexibility-validators.js";
import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum,
    EnyoHeatpumpApplianceMetadata
} from "../types/enyo-heatpump-appliance.js";
import {validateHeatpumpControlAction} from "../implementations/heatpump/heatpump-control-validators.js";
import {
    HeatpumpControlEndCauseEnum,
    heatpumpControlActionsKey,
    HeatpumpControlSessionTracker
} from "../implementations/heatpump/heatpump-control-session.js";

/** Default validity of a published heatpump flexibility offer, in seconds. */
export const HEATPUMP_FLEXIBILITY_DEFAULT_VALID_FOR_SECONDS = 900;
/** Default interval at which a published heatpump flexibility offer is repeated, in seconds. */
export const HEATPUMP_FLEXIBILITY_DEFAULT_REPEAT_EVERY_SECONDS = 300;

/** Options for {@link HeatpumpIntegrationEnergyApp.publishHeatpumpFlexibility}. */
export interface HeatpumpFlexibilityPublishOptions {
    /**
     * How long each sent offer is valid, in seconds (sets `validUntilIso`).
     * Defaults to {@link HEATPUMP_FLEXIBILITY_DEFAULT_VALID_FOR_SECONDS}.
     */
    validForSeconds?: number;
    /**
     * How often the offer is repeated with a fresh `validUntilIso`, in
     * seconds. Must be shorter than {@link validForSeconds}, so the offer never
     * lapses while it holds. Defaults to
     * {@link HEATPUMP_FLEXIBILITY_DEFAULT_REPEAT_EVERY_SECONDS}.
     */
    repeatEverySeconds?: number;
}

/** The offer the base class keeps publishing for one appliance. */
interface PublishedHeatpumpFlexibility {
    data: EnyoDataBusHeatpumpFlexibilityAnnouncementV3['data'];
    timer?: ReturnType<typeof setInterval>;
}

/**
 * Combines the answers of a `HeatpumpControlV3` session — the power and each
 * action — into the session's top-level answer: `Accepted` as soon as one part
 * is accepted, `NotSupported` only when every part is not supported, otherwise
 * `Rejected`.
 *
 * @param answers - The answers of the power (if sent) and of every action.
 * @returns The session's answer. `Accepted` for an empty list.
 */
export function combineHeatpumpControlAnswers(answers: EnyoCommandAcknowledgeAnswerEnum[]): EnyoCommandAcknowledgeAnswerEnum {
    if (answers.length === 0 || answers.includes(EnyoCommandAcknowledgeAnswerEnum.Accepted)) {
        return EnyoCommandAcknowledgeAnswerEnum.Accepted;
    }
    if (answers.every((a) => a === EnyoCommandAcknowledgeAnswerEnum.NotSupported)) {
        return EnyoCommandAcknowledgeAnswerEnum.NotSupported;
    }
    return EnyoCommandAcknowledgeAnswerEnum.Rejected;
}

/**
 * Abstract base class for heatpump integrations.
 *
 * Subscribes to:
 *  - `HeatpumpControlV3` — one control session: power, power sources and
 *    "heat now" actions with a validity. Preferred over the deprecated
 *    messages below. Override {@link handleHeatpumpControl} and declare
 *    {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.ControlV3}; answers
 *    `NotSupported` by default. The base class tracks the session's liveness
 *    and calls {@link onHeatpumpControlEnded} when it ends.
 *  - `HeatpumpControlCancelV3` — cancel one `HeatpumpControlV3` session right
 *    away (optional: override {@link handleHeatpumpControlCancel}).
 *  - `HeatpumpOverheatingV1` — overheating commands (room / buffer tank / DHW).
 *    Deprecated in favour of `HeatpumpControlV3`.
 *  - `HeatpumpAvailablePowerAnnouncementV1` — available power announcements.
 *    Deprecated in favour of `HeatpumpControlV3`.
 *  - `SetHeatpumpAvailablePowerV2` — available power envelope with context.
 *    Deprecated in favour of `HeatpumpControlV3`.
 *  - `SetHeatpumpRoomTemperatureV1` — measured room temperature input
 *    (optional: override {@link handleSetHeatpumpRoomTemperature}; answers
 *    `NotSupported` by default).
 *  - `GridOperatorPowerLimitationV1` — §14a EnWG broadcast (handled in base).
 *
 * Publishes `HeatpumpFlexibilityAnnouncementV3` offers via
 * {@link publishHeatpumpFlexibility} (repeated automatically while they hold)
 * and the progress of control sessions via {@link publishHeatpumpControlStatus}.
 *
 * Subclasses implement the `handle*` async methods, returning `Accepted`,
 * `Rejected`, or `NotSupported` to acknowledge the command. The base class
 * sends the matching `CommandAcknowledgeV1` automatically.
 *
 * @example
 * ```ts
 * class MyHeatpump extends HeatpumpIntegrationEnergyApp {
 *   constructor(applianceManager: ApplianceManager) {
 *     super({source: EnyoSourceEnum.Device, applianceManager});
 *   }
 *
 *   protected async handleHeatpumpControl(msg) {
 *     const results = await this.checkHeatpumpControlActions(msg);
 *     // ... write setpoints for the accepted actions, fill in applied values
 *     return {answer: combineHeatpumpControlAnswers(results.map((r) => r.answer)), actionResults: results};
 *   }
 *   protected async handleHeatpumpOverheating(msg) {
 *     return {answer: EnyoCommandAcknowledgeAnswerEnum.Accepted};
 *   }
 *   protected async handleHeatpumpAvailablePowerAnnouncement(msg) {
 *     return {answer: EnyoCommandAcknowledgeAnswerEnum.Accepted};
 *   }
 *   protected async handleSetHeatpumpAvailablePower(msg) {
 *     return {answer: EnyoCommandAcknowledgeAnswerEnum.Accepted};
 *   }
 *   protected async handleGridOperatorPowerLimitation(msg, applianceId) {
 *     return {answer: EnyoCommandAcknowledgeAnswerEnum.Accepted};
 *   }
 * }
 * ```
 */
export abstract class HeatpumpIntegrationEnergyApp extends IntegrationEnergyApp {
    private readonly heatpumpFlexibilityOffers = new Map<string, PublishedHeatpumpFlexibility>();
    private readonly heatpumpControlSessions = new HeatpumpControlSessionTracker(
        (applianceId) => void this.notifyHeatpumpControlEnded(applianceId, HeatpumpControlEndCauseEnum.Expired)
    );

    /**
     * @param options - Standard integration options (see {@link IntegrationEnergyAppOptions}).
     */
    protected constructor(options: IntegrationEnergyAppOptions) {
        super(options);
    }

    protected get managedApplianceType(): EnyoApplianceTypeEnum {
        return EnyoApplianceTypeEnum.Heatpump;
    }

    protected registerHandlers(): void {
        this.registerCommandHandler<EnyoDataBusHeatpumpOverheatingV1>(
            EnyoDataBusMessageEnum.HeatpumpOverheatingV1,
            (msg) => this.handleHeatpumpOverheating(msg)
        );
        this.registerCommandHandler<EnyoDataBusHeatpumpAvailablePowerAnnouncementV1>(
            EnyoDataBusMessageEnum.HeatpumpAvailablePowerAnnouncementV1,
            (msg) => this.handleHeatpumpAvailablePowerAnnouncement(msg)
        );
        this.registerCommandHandler<EnyoDataBusSetHeatpumpAvailablePowerV2>(
            EnyoDataBusMessageEnum.SetHeatpumpAvailablePowerV2,
            (msg) => this.handleSetHeatpumpAvailablePower(msg)
        );
        this.registerCommandHandler<EnyoDataBusSetHeatpumpRoomTemperatureV1>(
            EnyoDataBusMessageEnum.SetHeatpumpRoomTemperatureV1,
            (msg) => this.handleSetHeatpumpRoomTemperature(msg)
        );
        this.registerCommandHandler<EnyoDataBusHeatpumpControlV3>(
            EnyoDataBusMessageEnum.HeatpumpControlV3,
            (msg) => this.dispatchHeatpumpControl(msg)
        );
        this.registerCommandHandler<EnyoDataBusHeatpumpControlCancelV3>(
            EnyoDataBusMessageEnum.HeatpumpControlCancelV3,
            (msg) => this.dispatchHeatpumpControlCancel(msg)
        );
    }

    /**
     * Stops the integration, drops every running `HeatpumpControlV3` session
     * and its expiry timer, and stops repeating published flexibility offers.
     * The offers already sent lapse at their `validUntilIso`.
     */
    public override stop(): void {
        super.stop();
        this.heatpumpControlSessions.dispose();
        for (const offer of this.heatpumpFlexibilityOffers.values()) {
            if (offer.timer !== undefined) clearInterval(offer.timer);
        }
        this.heatpumpFlexibilityOffers.clear();
    }

    /**
     * Publishes this heatpump's flexibility offer as a
     * `HeatpumpFlexibilityAnnouncementV3` and keeps repeating it, with a fresh
     * `validUntilIso` every {@link HeatpumpFlexibilityPublishOptions.repeatEverySeconds},
     * until the next call for the same appliance replaces it. Declare
     * {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.FlexibilityAnnouncementV3}
     * on the appliance.
     *
     * Call it again whenever what is offered changes; measured values
     * (`currentTemperatureC`, `progress`) may be updated the same way without
     * changing the `offerId`. Pass an empty `options` array to withdraw the
     * offer: it is sent once and no longer repeated.
     *
     * The offer is validated with {@link validateHeatpumpFlexibilityAnnouncement}
     * against the heatpump's metadata ({@link resolveHeatpumpMetadata}) before
     * it is sent. It also becomes the offer `HeatpumpControlV3` sessions naming
     * an `offerId` are checked against.
     *
     * @param applianceId - The heatpump making the offer.
     * @param options - One entry per zone that can be raised.
     * @param publishOptions - Validity and repeat interval.
     * @returns The sent `offerId`.
     * @throws {Error} When the offer is invalid, or `repeatEverySeconds` is not
     *   shorter than `validForSeconds`.
     *
     * @example
     * ```ts
     * await this.publishHeatpumpFlexibility('heatpump-1', [{
     *     target: EnyoHeatpumpControlTargetEnum.Dhw,
     *     index: 0,
     *     currentTemperatureC: 47,
     *     setpointC: 50,
     *     maxDeltaK: 10,
     *     heatSources: [{
     *         heatSource: EnyoHeatpumpHeatSourceEnum.Compressor,
     *         power: {minWatt: 800, maxWatt: 2300, stepWatt: 100},
     *         estimatedElectricalKwh: 1.4,
     *     }],
     * }]);
     * ```
     */
    public async publishHeatpumpFlexibility(
        applianceId: string,
        options: EnyoHeatpumpFlexibilityOption[],
        publishOptions: HeatpumpFlexibilityPublishOptions = {}
    ): Promise<string> {
        const validForSeconds = publishOptions.validForSeconds ?? HEATPUMP_FLEXIBILITY_DEFAULT_VALID_FOR_SECONDS;
        const repeatEverySeconds = publishOptions.repeatEverySeconds ?? HEATPUMP_FLEXIBILITY_DEFAULT_REPEAT_EVERY_SECONDS;
        if (!(repeatEverySeconds > 0 && repeatEverySeconds < validForSeconds)) {
            throw new Error(
                `repeatEverySeconds (${repeatEverySeconds}) must be positive and shorter than validForSeconds (${validForSeconds})`
            );
        }

        const offerId = heatpumpFlexibilityOfferId(options);
        const data: EnyoDataBusHeatpumpFlexibilityAnnouncementV3['data'] = {
            offerId,
            validUntilIso: new Date(Date.now() + validForSeconds * 1000).toISOString(),
            options,
        };
        const metadata = await this.resolveHeatpumpMetadata(applianceId);
        const {ok, errors} = validateHeatpumpFlexibilityAnnouncement(data, metadata);
        if (!ok) {
            throw new Error(`Invalid heatpump flexibility offer: ${errors.join('; ')}`);
        }

        const previous = this.heatpumpFlexibilityOffers.get(applianceId);
        if (previous?.timer !== undefined) clearInterval(previous.timer);

        const published: PublishedHeatpumpFlexibility = {data};
        this.heatpumpFlexibilityOffers.set(applianceId, published);
        this.sendHeatpumpFlexibility(applianceId, data);

        if (options.length > 0) {
            published.timer = setInterval(() => {
                published.data = {
                    ...published.data,
                    validUntilIso: new Date(Date.now() + validForSeconds * 1000).toISOString(),
                };
                this.sendHeatpumpFlexibility(applianceId, published.data);
            }, repeatEverySeconds * 1000);
        }
        return offerId;
    }

    /**
     * The flexibility offer this integration currently holds for an
     * appliance — the last one published, if it has options and has not
     * lapsed.
     *
     * @param applianceId - The heatpump appliance.
     * @returns The offer's data, or `undefined`.
     */
    protected currentHeatpumpFlexibility(
        applianceId: string
    ): EnyoDataBusHeatpumpFlexibilityAnnouncementV3['data'] | undefined {
        const data = this.heatpumpFlexibilityOffers.get(applianceId)?.data;
        if (!data || data.options.length === 0 || Date.parse(data.validUntilIso) <= Date.now()) {
            return undefined;
        }
        return data;
    }

    /**
     * Handles a `HeatpumpControlV3` session message. Answers `NotSupported` by
     * default — the energy manager then uses the deprecated messages for this
     * heatpump. Override it, and declare
     * {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.ControlV3}, to support
     * V3.
     *
     * What an implementation must do (see {@link EnyoHeatpumpControlAction}):
     * - Treat each action as **"heat this zone now"**. Answer it `Accepted`
     *   only when the device will actually start heating; a setpoint-only
     *   device needs the new setpoint at least `hysteresisK` above the current
     *   temperature — {@link computeHeatpumpSetpointRaise} does that
     *   arithmetic. If the cap (`maxTemperatureC`) makes that impossible,
     *   answer `Rejected`.
     * - A room action's `deltaK` is Kelvin of room temperature: on an
     *   outdoor-controlled circuit translate it into a heating-curve shift, on a
     *   room-controlled one into a higher room setpoint.
     * - Report what was written in `actionResults` (`appliedTargetTemperatureC`,
     *   `appliedDeltaK`, `appliedHeatingCurveShiftK`), and the progress via
     *   {@link publishHeatpumpControlStatus}.
     * - Repeats arrive about every 10 s with the same `sessionId`; only apply
     *   the actions anew when {@link isHeatpumpControlChanged} says the session
     *   or its actions changed, and just update the power otherwise.
     *
     * {@link checkHeatpumpControlActions} validates every action against the
     * metadata and, when the session names an `offerId`, against the current
     * offer. The base class handles liveness: it rejects a message whose
     * `validUntilIso` is invalid or already past before calling this, and —
     * unless this answers `NotSupported` — tracks the session and calls
     * {@link onHeatpumpControlEnded} when it lapses, is ended by an empty
     * message (which is passed here first, so the device can be reset at
     * once), or is cancelled.
     *
     * @param _message - The control session message.
     * @returns The session's answer with one `actionResults` entry per action;
     *   {@link combineHeatpumpControlAnswers} derives the top-level answer.
     */
    protected async handleHeatpumpControl(
        _message: EnyoDataBusHeatpumpControlV3
    ): Promise<IntegrationCommandResponse> {
        return {
            answer: EnyoCommandAcknowledgeAnswerEnum.NotSupported,
            rejectionReason: 'Heatpump integration does not support HeatpumpControlV3',
        };
    }

    /**
     * Handles a `HeatpumpControlCancelV3` command — called before the base
     * class ends the named session and calls {@link onHeatpumpControlEnded}
     * with {@link HeatpumpControlEndCauseEnum.Cancelled}.
     *
     * The default answers `Accepted` for heatpumps declaring
     * {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.ControlV3} — cancelling
     * is idempotent, so also when the session is no longer running — and
     * `NotSupported` otherwise. Override it when withdrawing the control on the
     * device can fail, and answer `Rejected` then.
     *
     * @param message - The cancel command.
     * @returns `Accepted` once the session is no longer running.
     */
    protected async handleHeatpumpControlCancel(
        message: EnyoDataBusHeatpumpControlCancelV3
    ): Promise<IntegrationCommandResponse> {
        const metadata = await this.resolveHeatpumpMetadata(message.applianceId);
        if (!metadata?.availableFeatures?.includes(EnyoHeatpumpApplianceAvailableFeaturesEnum.ControlV3)) {
            return {
                answer: EnyoCommandAcknowledgeAnswerEnum.NotSupported,
                rejectionReason: 'Heatpump does not declare ControlV3',
            };
        }
        return {answer: EnyoCommandAcknowledgeAnswerEnum.Accepted};
    }

    /**
     * Called when a `HeatpumpControlV3` session ends, with why:
     * {@link HeatpumpControlEndCauseEnum.Expired} (no repeat by
     * `validUntilIso`), {@link HeatpumpControlEndCauseEnum.Ended} (a message with
     * no actions and no power) or {@link HeatpumpControlEndCauseEnum.Cancelled}
     * (`HeatpumpControlCancelV3`). Only for sessions
     * {@link handleHeatpumpControl} did not answer `NotSupported`.
     *
     * Override it to return the heatpump to its own behaviour — restore the
     * setpoints and heating curve written for the session, clear a PV surplus
     * register. The default does nothing.
     *
     * @param _applianceId - The heatpump whose session ended.
     * @param _cause - Why it ended.
     */
    protected async onHeatpumpControlEnded(
        _applianceId: string,
        _cause: HeatpumpControlEndCauseEnum
    ): Promise<void> {
        // Default: nothing to reset.
    }

    /**
     * Whether a `HeatpumpControlV3` message starts a new session or changes the
     * actions of the running one — i.e. whether its actions must be applied
     * anew, rather than only its power updated. Call it from
     * {@link handleHeatpumpControl}; the base class records the message only
     * after that returns.
     *
     * @param message - The control session message.
     * @returns `true` for a new session or changed actions, `false` for a
     *   repeat of the running session.
     */
    protected isHeatpumpControlChanged(message: EnyoDataBusHeatpumpControlV3): boolean {
        const current = this.heatpumpControlSessions.get(message.applianceId);
        return !current
            || current.sessionId !== message.data.sessionId
            || current.actionsKey !== heatpumpControlActionsKey(message.data.actions ?? []);
    }

    /**
     * Validates every action of a `HeatpumpControlV3` session with
     * {@link validateHeatpumpControlAction}: against the heatpump's metadata
     * ({@link resolveHeatpumpMetadata}) and — when the session names an
     * `offerId` — against the current offer from
     * {@link publishHeatpumpFlexibility}.
     *
     * @param message - The control session message.
     * @returns One result per action, in order; `Accepted` for the actions an
     *   implementation may go on to apply.
     */
    protected async checkHeatpumpControlActions(
        message: EnyoDataBusHeatpumpControlV3
    ): Promise<EnyoCommandAcknowledgeActionResult[]> {
        const metadata = await this.resolveHeatpumpMetadata(message.applianceId);
        const offer = message.data.offerId !== undefined
            ? this.currentHeatpumpFlexibility(message.applianceId)
            : undefined;
        return (message.data.actions ?? []).map((action) =>
            validateHeatpumpControlAction(action, metadata, message.data.powerSources, offer)
        );
    }

    /**
     * Publishes a `HeatpumpControlStatusV3` — how the actions of a
     * `HeatpumpControlV3` session are progressing (waiting, running,
     * completed, aborted). Send it whenever an action's state changes, and
     * once more when the session ends.
     *
     * @param applianceId - The heatpump the session runs on.
     * @param status - The session id and one entry per action. See
     *   {@link EnyoDataBusHeatpumpControlStatusV3.data}.
     *
     * @example
     * ```ts
     * this.publishHeatpumpControlStatus('heatpump-1', {
     *     sessionId: 'night-tariff-2026-10-15',
     *     actions: [{
     *         target: EnyoHeatpumpControlTargetEnum.Dhw,
     *         index: 0,
     *         state: EnyoHeatpumpControlActionStateEnum.Running,
     *         currentTemperatureC: 46.5,
     *         appliedTargetTemperatureC: 55,
     *         startedAtIso: '2026-10-15T00:02:00.000Z',
     *     }],
     * });
     * ```
     */
    public publishHeatpumpControlStatus(
        applianceId: string,
        status: EnyoDataBusHeatpumpControlStatusV3['data']
    ): void {
        const message: EnyoDataBusHeatpumpControlStatusV3 = {
            id: this.generateMessageId(),
            type: 'message',
            message: EnyoDataBusMessageEnum.HeatpumpControlStatusV3,
            source: this.source,
            applianceId,
            timestampIso: new Date().toISOString(),
            data: status,
        };
        this.useDataBus().sendMessage([message]);
    }

    /**
     * Reads the heatpump metadata used to validate `HeatpumpControlV3`
     * actions. Defaults to the appliance's stored `heatpump` metadata; override
     * it when the integration keeps fresher values (e.g. the live DHW setpoint).
     *
     * @param applianceId - The heatpump appliance.
     * @returns The metadata, or `undefined` when it cannot be read — actions
     *   are then validated without feature checks.
     */
    protected async resolveHeatpumpMetadata(
        applianceId: string
    ): Promise<EnyoHeatpumpApplianceMetadata | undefined> {
        try {
            const appliance = await this.useAppliances().getById(applianceId);
            return appliance?.heatpump;
        } catch {
            return undefined;
        }
    }

    /**
     * Handles a `HeatpumpOverheatingV1` command. Implementers should drive the
     * physical heatpump to overheat the requested zones (room / buffer tank /
     * DHW) by the configured deltas for the configured durations.
     *
     * @param message - The overheating command.
     * @returns `Accepted` on success, `Rejected` (with `rejectionReason`) when
     *   the heatpump cannot honor the command (e.g. already overheating, in
     *   error state), `NotSupported` when the appliance does not implement
     *   overheating at all.
     */
    protected abstract handleHeatpumpOverheating(
        message: EnyoDataBusHeatpumpOverheatingV1
    ): Promise<IntegrationCommandResponse>;

    /**
     * Handles a `HeatpumpAvailablePowerAnnouncementV1` command. Implementers
     * use the announced power to scale the heatpump's consumption to fit the
     * available envelope.
     *
     * @param message - The available power announcement.
     * @returns `Accepted` when the heatpump will adjust to the announced
     *   power, `Rejected` if it cannot, `NotSupported` if the integration does
     *   not support power announcements.
     * @deprecated Implement {@link handleSetHeatpumpAvailablePower} instead. This
     *   handler remains for the deprecated
     *   {@link EnyoDataBusHeatpumpAvailablePowerAnnouncementV1} during the
     *   transition window.
     */
    protected abstract handleHeatpumpAvailablePowerAnnouncement(
        message: EnyoDataBusHeatpumpAvailablePowerAnnouncementV1
    ): Promise<IntegrationCommandResponse>;

    /**
     * Handles a `SetHeatpumpAvailablePowerV2` command. Implementers use the
     * announced power (`message.data.powerW`) to scale the heatpump's
     * consumption to fit the available envelope, optionally taking the
     * `purpose` (e.g. DHW boost, pre-heating) and `powerSources` (PV / battery /
     * grid) context into account.
     *
     * @param message - The V2 available-power command.
     * @returns `Accepted` when the heatpump will adjust to the announced
     *   power, `Rejected` if it cannot, `NotSupported` if the integration does
     *   not support power announcements.
     */
    protected abstract handleSetHeatpumpAvailablePower(
        message: EnyoDataBusSetHeatpumpAvailablePowerV2
    ): Promise<IntegrationCommandResponse>;

    /**
     * Handles a `SetHeatpumpRoomTemperatureV1` command: writes the measured
     * room temperature (`message.data.roomTemperatureC`) into the heating
     * circuit `message.data.heatingCircuitIndex` of the physical heatpump, for
     * use in its room-temperature control.
     *
     * Override this in integrations whose heatpump declares
     * {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.RoomTemperatureInput}.
     * The default implementation answers `NotSupported`.
     *
     * @param _message - The room temperature command.
     * @returns `Accepted` when the temperature was written, `Rejected` (with
     *   `rejectionReason`) when the heatpump cannot take it right now (e.g.
     *   unknown circuit index), `NotSupported` when the heatpump does not
     *   accept room temperatures as input.
     */
    protected async handleSetHeatpumpRoomTemperature(
        _message: EnyoDataBusSetHeatpumpRoomTemperatureV1
    ): Promise<IntegrationCommandResponse> {
        return {
            answer: EnyoCommandAcknowledgeAnswerEnum.NotSupported,
            rejectionReason: 'Heatpump does not accept room temperatures as input',
        };
    }

    /**
     * @inheritDoc
     */
    protected abstract handleGridOperatorPowerLimitation(
        message: EnyoDataBusGridOperatorPowerLimitationV1,
        applianceId: string
    ): Promise<IntegrationCommandResponse>;

    /**
     * Publishes a `HeatpumpValuesUpdateV1` message reporting the heatpump's
     * current operation mode and energy values to the data bus.
     *
     * @param applianceId - The heatpump appliance ID this update is for.
     * @param values - The values payload (`operationMode` is required).
     */
    public publishHeatpumpValuesUpdate(
        applianceId: string,
        values: EnyoDataBusHeatpumpValuesV1['data']['values']
    ): void {
        const message: EnyoDataBusHeatpumpValuesV1 = {
            id: this.generateMessageId(),
            type: 'message',
            message: EnyoDataBusMessageEnum.HeatpumpValuesUpdateV1,
            source: this.source,
            applianceId,
            timestampIso: new Date().toISOString(),
            data: {values}
        };
        this.useDataBus().sendMessage([message]);
    }

    /**
     * Publishes a `HeatpumpTemperaturesUpdateV1` message with the current
     * temperatures (outdoor, flow / target flow / return, DHW, heating
     * circuits incl. room and per-circuit flow / return, buffer tank).
     *
     * @param applianceId - The heatpump appliance ID this update is for.
     * @param temperatures - Temperature payload — see
     *   {@link EnyoDataBusHeatpumpTemperaturesV1.data}.
     */
    public publishHeatpumpTemperatures(
        applianceId: string,
        temperatures: EnyoDataBusHeatpumpTemperaturesV1['data']
    ): void {
        const message: EnyoDataBusHeatpumpTemperaturesV1 = {
            id: this.generateMessageId(),
            type: 'message',
            message: EnyoDataBusMessageEnum.HeatpumpTemperaturesUpdateV1,
            source: this.source,
            applianceId,
            timestampIso: new Date().toISOString(),
            data: temperatures
        };
        this.useDataBus().sendMessage([message]);
    }

    private sendHeatpumpFlexibility(
        applianceId: string,
        data: EnyoDataBusHeatpumpFlexibilityAnnouncementV3['data']
    ): void {
        const message: EnyoDataBusHeatpumpFlexibilityAnnouncementV3 = {
            id: this.generateMessageId(),
            type: 'message',
            message: EnyoDataBusMessageEnum.HeatpumpFlexibilityAnnouncementV3,
            source: this.source,
            applianceId,
            timestampIso: new Date().toISOString(),
            data,
        };
        this.useDataBus().sendMessage([message]);
    }

    private async endHeatpumpControl(applianceId: string, cause: HeatpumpControlEndCauseEnum): Promise<void> {
        if (this.heatpumpControlSessions.end(applianceId)) {
            await this.notifyHeatpumpControlEnded(applianceId, cause);
        }
    }

    private async notifyHeatpumpControlEnded(applianceId: string, cause: HeatpumpControlEndCauseEnum): Promise<void> {
        try {
            await this.onHeatpumpControlEnded(applianceId, cause);
        } catch (error) {
            console.error(`HeatpumpIntegrationEnergyApp: onHeatpumpControlEnded failed for ${applianceId}`, error);
        }
    }

    private async dispatchHeatpumpControl(
        message: EnyoDataBusHeatpumpControlV3
    ): Promise<IntegrationCommandResponse> {
        const {applianceId, data} = message;
        const actions = data.actions ?? [];
        const rejectAll = (reason: string): IntegrationCommandResponse => ({
            answer: EnyoCommandAcknowledgeAnswerEnum.Rejected,
            rejectionReason: reason,
            actionResults: actions.map((action) => ({
                target: action.target,
                ...(action.index !== undefined ? {index: action.index} : {}),
                answer: EnyoCommandAcknowledgeAnswerEnum.Rejected,
                rejectionReason: reason,
            })),
        });

        const validUntilMs = Date.parse(data.validUntilIso);
        if (!Number.isFinite(validUntilMs)) {
            return rejectAll(`validUntilIso is not an ISO 8601 timestamp: ${data.validUntilIso}`);
        }
        if (validUntilMs <= Date.now()) {
            await this.endHeatpumpControl(applianceId, HeatpumpControlEndCauseEnum.Expired);
            return rejectAll('validUntilIso has already passed');
        }

        const response = await this.handleHeatpumpControl(message);
        if (response.answer === EnyoCommandAcknowledgeAnswerEnum.NotSupported) {
            return response;
        }
        if (actions.length === 0 && data.availablePowerW === undefined) {
            await this.endHeatpumpControl(applianceId, HeatpumpControlEndCauseEnum.Ended);
        } else {
            this.heatpumpControlSessions.track(applianceId, data);
        }
        return response;
    }

    private async dispatchHeatpumpControlCancel(
        message: EnyoDataBusHeatpumpControlCancelV3
    ): Promise<IntegrationCommandResponse> {
        const response = await this.handleHeatpumpControlCancel(message);
        if (response.answer !== EnyoCommandAcknowledgeAnswerEnum.NotSupported
            && this.heatpumpControlSessions.get(message.applianceId)?.sessionId === message.data.sessionId) {
            await this.endHeatpumpControl(message.applianceId, HeatpumpControlEndCauseEnum.Cancelled);
        }
        return response;
    }
}
