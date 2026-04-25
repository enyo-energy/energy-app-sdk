import {IntegrationEnergyApp} from "./integration-energy-app.js";
import {IntegrationCommandResponse, IntegrationEnergyAppOptions} from "./integration-types.js";
import {EnyoApplianceTypeEnum} from "../types/enyo-appliance.js";
import {
    EnyoDataBusGridOperatorPowerLimitationV1,
    EnyoDataBusHeatpumpAvailablePowerAnnouncementV1,
    EnyoDataBusHeatpumpOverheatingV1,
    EnyoDataBusHeatpumpTemperaturesV1,
    EnyoDataBusHeatpumpValuesV1,
    EnyoDataBusMessageEnum
} from "../types/enyo-data-bus-value.js";

/**
 * Abstract base class for heatpump integrations.
 *
 * Subscribes to:
 *  - `HeatpumpOverheatingV1` — overheating commands (room / buffer tank / DHW).
 *  - `HeatpumpAvailablePowerAnnouncementV1` — available power announcements.
 *  - `GridOperatorPowerLimitationV1` — §14a EnWG broadcast (handled in base).
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
 *   protected async handleHeatpumpOverheating(msg) {
 *     // ... drive the physical heatpump
 *     return {answer: EnyoCommandAcknowledgeAnswerEnum.Accepted};
 *   }
 *   protected async handleHeatpumpAvailablePowerAnnouncement(msg) {
 *     return {answer: EnyoCommandAcknowledgeAnswerEnum.Accepted};
 *   }
 *   protected async handleGridOperatorPowerLimitation(msg, applianceId) {
 *     return {answer: EnyoCommandAcknowledgeAnswerEnum.Accepted};
 *   }
 * }
 * ```
 */
export abstract class HeatpumpIntegrationEnergyApp extends IntegrationEnergyApp {
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
     */
    protected abstract handleHeatpumpAvailablePowerAnnouncement(
        message: EnyoDataBusHeatpumpAvailablePowerAnnouncementV1
    ): Promise<IntegrationCommandResponse>;

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
     * temperatures (outdoor, flow, DHW, heating circuits, buffer tank).
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
}
