import {IntegrationEnergyApp} from "./integration-energy-app.js";
import {IntegrationCommandResponse, IntegrationEnergyAppOptions} from "./integration-types.js";
import {EnyoApplianceTypeEnum} from "../types/enyo-appliance.js";
import {
    EnyoDataBusGridOperatorPowerLimitationV1,
    EnyoDataBusInverterValuesV1,
    EnyoDataBusMessageEnum,
    EnyoDataBusSetInverterFeedInLimitV1
} from "../types/enyo-data-bus-value.js";

/**
 * Abstract base class for PV inverter integrations.
 *
 * Subscribes to:
 *  - `SetInverterFeedInLimitV1` — set or clear the grid feed-in power limit.
 *  - `GridOperatorPowerLimitationV1` — §14a EnWG broadcast (handled in base).
 */
export abstract class InverterIntegrationEnergyApp extends IntegrationEnergyApp {
    /**
     * @param options - Standard integration options.
     */
    protected constructor(options: IntegrationEnergyAppOptions) {
        super(options);
    }

    protected get managedApplianceType(): EnyoApplianceTypeEnum {
        return EnyoApplianceTypeEnum.Inverter;
    }

    protected registerHandlers(): void {
        this.registerCommandHandler<EnyoDataBusSetInverterFeedInLimitV1>(
            EnyoDataBusMessageEnum.SetInverterFeedInLimitV1,
            (m) => this.handleSetInverterFeedInLimit(m)
        );
    }

    /**
     * Handles a `SetInverterFeedInLimitV1` command. Implementers either set
     * the inverter's grid feed-in cap to `data.feedInLimitW` watts, or clear
     * it (return to default behavior) when `data.feedInLimitW` is `null`.
     */
    protected abstract handleSetInverterFeedInLimit(
        message: EnyoDataBusSetInverterFeedInLimitV1
    ): Promise<IntegrationCommandResponse>;

    /**
     * @inheritDoc
     */
    protected abstract handleGridOperatorPowerLimitation(
        message: EnyoDataBusGridOperatorPowerLimitationV1,
        applianceId: string
    ): Promise<IntegrationCommandResponse>;

    /**
     * Publishes an `InverterValuesUpdateV1` message reporting the inverter's
     * current state, PV power, voltages, and string values.
     */
    public publishInverterValuesUpdate(
        applianceId: string,
        data: EnyoDataBusInverterValuesV1['data']
    ): void {
        const msg: EnyoDataBusInverterValuesV1 = {
            id: this.generateMessageId(),
            type: 'message',
            message: EnyoDataBusMessageEnum.InverterValuesUpdateV1,
            source: this.source,
            applianceId,
            timestampIso: new Date().toISOString(),
            data
        };
        this.useDataBus().sendMessage([msg]);
    }
}
