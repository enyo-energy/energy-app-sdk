import {IntegrationEnergyApp} from "./integration-energy-app.js";
import {IntegrationCommandResponse, IntegrationEnergyAppOptions} from "./integration-types.js";
import {EnyoApplianceTypeEnum} from "../types/enyo-appliance.js";
import {
    EnyoDataBusChangeChargingPowerV1,
    EnyoDataBusChargerStatusChangedV1,
    EnyoDataBusChargingMeterValuesV1,
    EnyoDataBusChargingStartedV1,
    EnyoDataBusChargingStoppedV1,
    EnyoDataBusClearChargingProfilesV1,
    EnyoDataBusEnergyManagementChargingStateV1,
    EnyoDataBusGridOperatorPowerLimitationV1,
    EnyoDataBusMaxChargingPowerChangedV1,
    EnyoDataBusMessage,
    EnyoDataBusMessageEnum,
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

/**
 * Abstract base class for wallbox / charger integrations.
 *
 * Subscribes to every command the energy manager can issue against a charger:
 *  - Session control: `StartChargeV1`, `StopChargeV1`, `PauseChargingV1`,
 *    `ResumeChargingV1`, `ChangeChargingPowerV1`, `SetChargingScheduleV1`.
 *  - Operations: `ResetChargerV1`, `RebootChargerV1`, `RequestChargerLogsV1`,
 *    `ClearChargingProfilesV1`.
 *  - `GridOperatorPowerLimitationV1` (handled in base, dispatched per
 *    managed appliance).
 *
 * Each command has a corresponding abstract `handle*` method that subclasses
 * implement.
 *
 * Note: `PauseChargingV1` and `ResumeChargingV1` carry their `applianceId` in
 * the `data` object (not at the top level). The base class extracts it
 * correctly via {@link IntegrationEnergyApp.extractApplianceId}.
 */
export abstract class WallboxIntegrationEnergyApp extends IntegrationEnergyApp {
    /**
     * @param options - Standard integration options.
     */
    protected constructor(options: IntegrationEnergyAppOptions) {
        super(options);
    }

    protected get managedApplianceType(): EnyoApplianceTypeEnum {
        return EnyoApplianceTypeEnum.Charger;
    }

    protected registerHandlers(): void {
        this.registerCommandHandler<EnyoDataBusStartChargeV1>(
            EnyoDataBusMessageEnum.StartChargeV1,
            (m) => this.handleStartCharge(m)
        );
        this.registerCommandHandler<EnyoDataBusStopChargeV1>(
            EnyoDataBusMessageEnum.StopChargeV1,
            (m) => this.handleStopCharge(m)
        );
        this.registerCommandHandler<EnyoDataBusPauseChargingV1>(
            EnyoDataBusMessageEnum.PauseChargingV1,
            (m) => this.handlePauseCharging(m)
        );
        this.registerCommandHandler<EnyoDataBusResumeChargingV1>(
            EnyoDataBusMessageEnum.ResumeChargingV1,
            (m) => this.handleResumeCharging(m)
        );
        this.registerCommandHandler<EnyoDataBusChangeChargingPowerV1>(
            EnyoDataBusMessageEnum.ChangeChargingPowerV1,
            (m) => this.handleChangeChargingPower(m)
        );
        this.registerCommandHandler<EnyoDataBusSetChargerAvailablePowerV2>(
            EnyoDataBusMessageEnum.SetChargerAvailablePowerV2,
            (m) => this.handleSetChargerAvailablePower(m)
        );
        this.registerCommandHandler<EnyoDataBusSetChargingScheduleV1>(
            EnyoDataBusMessageEnum.SetChargingScheduleV1,
            (m) => this.handleSetChargingSchedule(m)
        );
        this.registerCommandHandler<EnyoDataBusResetChargerV1>(
            EnyoDataBusMessageEnum.ResetChargerV1,
            (m) => this.handleResetCharger(m)
        );
        this.registerCommandHandler<EnyoDataBusRebootChargerV1>(
            EnyoDataBusMessageEnum.RebootChargerV1,
            (m) => this.handleRebootCharger(m)
        );
        this.registerCommandHandler<EnyoDataBusRequestChargerLogsV1>(
            EnyoDataBusMessageEnum.RequestChargerLogsV1,
            (m) => this.handleRequestChargerLogs(m)
        );
        this.registerCommandHandler<EnyoDataBusClearChargingProfilesV1>(
            EnyoDataBusMessageEnum.ClearChargingProfilesV1,
            (m) => this.handleClearChargingProfiles(m)
        );
    }

    /**
     * Handles a `StartChargeV1` command. Implementers start a charging session
     * on the specified connector with the provided idTag and charge mode.
     */
    protected abstract handleStartCharge(
        message: EnyoDataBusStartChargeV1
    ): Promise<IntegrationCommandResponse>;

    /**
     * Handles a `StopChargeV1` command. Implementers terminate the
     * charging session identified by `message.data.transactionId`; when
     * that field is omitted, terminate the currently active session on
     * `message.applianceId`.
     */
    protected abstract handleStopCharge(
        message: EnyoDataBusStopChargeV1
    ): Promise<IntegrationCommandResponse>;

    /**
     * Handles a `PauseChargingV1` command — pause an active session without
     * ending it.
     */
    protected abstract handlePauseCharging(
        message: EnyoDataBusPauseChargingV1
    ): Promise<IntegrationCommandResponse>;

    /**
     * Handles a `ResumeChargingV1` command — resume a paused session, capped
     * at `maxChargingPowerKw`.
     */
    protected abstract handleResumeCharging(
        message: EnyoDataBusResumeChargingV1
    ): Promise<IntegrationCommandResponse>;

    /**
     * Handles a `ChangeChargingPowerV1` command — adjust the cap on the
     * current session.
     *
     * @deprecated Implement {@link handleSetChargerAvailablePower} instead; the
     *   V2 command carries the envelope in Watts. This handler remains for the
     *   deprecated {@link EnyoDataBusChangeChargingPowerV1} during the
     *   transition window.
     */
    protected abstract handleChangeChargingPower(
        message: EnyoDataBusChangeChargingPowerV1
    ): Promise<IntegrationCommandResponse>;

    /**
     * Handles a `SetChargerAvailablePowerV2` command — apply the announced
     * available/max active-power envelope (in Watts) to the charger. The
     * charger must not draw more than `message.data.powerW`.
     *
     * @param message - The available-power command.
     * @returns `Accepted` when the charger will honor the envelope, `Rejected`
     *   if it cannot, `NotSupported` if power limitation is not supported.
     */
    protected abstract handleSetChargerAvailablePower(
        message: EnyoDataBusSetChargerAvailablePowerV2
    ): Promise<IntegrationCommandResponse>;

    /**
     * Handles a `SetChargingScheduleV1` command — install (or update) an OCPP
     * charging profile / schedule on the charger.
     */
    protected abstract handleSetChargingSchedule(
        message: EnyoDataBusSetChargingScheduleV1
    ): Promise<IntegrationCommandResponse>;

    /**
     * Handles a `ResetChargerV1` command — soft reset the charger.
     */
    protected abstract handleResetCharger(
        message: EnyoDataBusResetChargerV1
    ): Promise<IntegrationCommandResponse>;

    /**
     * Handles a `RebootChargerV1` command — full hardware power cycle.
     */
    protected abstract handleRebootCharger(
        message: EnyoDataBusRebootChargerV1
    ): Promise<IntegrationCommandResponse>;

    /**
     * Handles a `RequestChargerLogsV1` command — upload diagnostic logs for
     * the requested day to the provided URL.
     */
    protected abstract handleRequestChargerLogs(
        message: EnyoDataBusRequestChargerLogsV1
    ): Promise<IntegrationCommandResponse>;

    /**
     * Handles a `ClearChargingProfilesV1` command — remove charging profiles
     * (optionally filtered by `profileType`).
     */
    protected abstract handleClearChargingProfiles(
        message: EnyoDataBusClearChargingProfilesV1
    ): Promise<IntegrationCommandResponse>;

    /**
     * @inheritDoc
     */
    protected abstract handleGridOperatorPowerLimitation(
        message: EnyoDataBusGridOperatorPowerLimitationV1,
        applianceId: string
    ): Promise<IntegrationCommandResponse>;

    /**
     * `PauseChargingV1` and `ResumeChargingV1` carry their applianceId inside
     * `data` rather than at the top level — the base class falls back to that
     * automatically, so this override exists for documentation only.
     */
    protected extractApplianceId(message: EnyoDataBusMessage): string | undefined {
        return super.extractApplianceId(message);
    }

    /**
     * Publishes a `ChargingStartedV1` message — emit when the charger has
     * begun a session.
     */
    public publishChargingStarted(
        applianceId: string,
        data: EnyoDataBusChargingStartedV1['data']
    ): void {
        const msg: EnyoDataBusChargingStartedV1 = {
            id: this.generateMessageId(),
            type: 'message',
            message: EnyoDataBusMessageEnum.ChargingStartedV1,
            source: this.source,
            applianceId,
            timestampIso: new Date().toISOString(),
            data
        };
        this.useDataBus().sendMessage([msg]);
    }

    /**
     * Publishes a `ChargingMeterValuesUpdateV1` message — periodic meter
     * sample during an active session.
     */
    public publishChargingMeterValues(
        applianceId: string,
        data: EnyoDataBusChargingMeterValuesV1['data']
    ): void {
        const msg: EnyoDataBusChargingMeterValuesV1 = {
            id: this.generateMessageId(),
            type: 'message',
            message: EnyoDataBusMessageEnum.ChargingMeterValuesUpdateV1,
            source: this.source,
            applianceId,
            timestampIso: new Date().toISOString(),
            data
        };
        this.useDataBus().sendMessage([msg]);
    }

    /**
     * Publishes a `ChargingStoppedV1` message — emit when the charger has
     * ended a session.
     */
    public publishChargingStopped(
        applianceId: string,
        data: EnyoDataBusChargingStoppedV1['data']
    ): void {
        const msg: EnyoDataBusChargingStoppedV1 = {
            id: this.generateMessageId(),
            type: 'message',
            message: EnyoDataBusMessageEnum.ChargingStoppedV1,
            source: this.source,
            applianceId,
            timestampIso: new Date().toISOString(),
            data
        };
        this.useDataBus().sendMessage([msg]);
    }

    /**
     * Publishes a `MaxChargingPowerChangedV1` informational message when the
     * charger's max charging power has changed (e.g. due to thermal derating).
     */
    public publishMaxChargingPowerChanged(
        applianceId: string,
        maxChargingPowerKw: number
    ): void {
        const msg: EnyoDataBusMaxChargingPowerChangedV1 = {
            id: this.generateMessageId(),
            type: 'message',
            message: EnyoDataBusMessageEnum.MaxChargingPowerChangedV1,
            source: this.source,
            applianceId,
            timestampIso: new Date().toISOString(),
            data: {maxChargingPowerKw}
        };
        this.useDataBus().sendMessage([msg]);
    }

    /**
     * Publishes an `EnergyManagementChargingStateV1` message: the app's own
     * state — the phase count in force, whether a phase switch is possible
     * right now, the limit actually applied and the verdict on the last
     * request — reported to the energy manager.
     *
     * This is a continuously updated state, not an event. Call it whenever
     * anything in the payload changes (a phase switch starts or finishes, a
     * cool-down expires, a new limit is applied) and periodically as a
     * heartbeat, always passing the **complete** picture: an omitted field
     * means "unknown", never "unchanged".
     *
     * Report facts, never advice: the phase count, the applied limit and the
     * power it implies, the request verdict, the measurement timestamp — no
     * recommended minimum power, no suggested setpoint, nothing derived from
     * the energy manager's own plan.
     *
     * @param applianceId - The charger appliance the state describes.
     * @param data - The full charging state; see
     *   {@link EnyoDataBusEnergyManagementChargingStateV1}.
     */
    public publishEnergyManagementChargingState(
        applianceId: string,
        data: EnyoDataBusEnergyManagementChargingStateV1['data']
    ): void {
        const msg: EnyoDataBusEnergyManagementChargingStateV1 = {
            id: this.generateMessageId(),
            type: 'message',
            message: EnyoDataBusMessageEnum.EnergyManagementChargingStateV1,
            source: this.source,
            applianceId,
            timestampIso: new Date().toISOString(),
            resolution: 'dynamic',
            data
        };
        this.useDataBus().sendMessage([msg]);
    }

    /**
     * Publishes a `ChargerStatusChangedV1` message reporting the current OCPP
     * status (Available, Preparing, Charging, …).
     */
    public publishChargerStatusChanged(
        applianceId: string,
        data: EnyoDataBusChargerStatusChangedV1['data']
    ): void {
        const msg: EnyoDataBusChargerStatusChangedV1 = {
            id: this.generateMessageId(),
            type: 'message',
            message: EnyoDataBusMessageEnum.ChargerStatusChangedV1,
            source: this.source,
            applianceId,
            timestampIso: new Date().toISOString(),
            data
        };
        this.useDataBus().sendMessage([msg]);
    }
}
