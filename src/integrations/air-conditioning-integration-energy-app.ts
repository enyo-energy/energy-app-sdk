import {IntegrationEnergyApp} from "./integration-energy-app.js";
import {IntegrationCommandResponse, IntegrationEnergyAppOptions} from "./integration-types.js";
import {EnyoApplianceTypeEnum} from "../types/enyo-appliance.js";
import {
    EnyoDataBusAirConditioningTemperaturesV1,
    EnyoDataBusAirConditioningValuesV1,
    EnyoDataBusGridOperatorPowerLimitationV1,
    EnyoDataBusMessageEnum,
    EnyoDataBusStartAirConditioningV1,
    EnyoDataBusStopAirConditioningV1
} from "../types/enyo-data-bus-value.js";

/**
 * Abstract base class for air conditioning integrations.
 *
 * Subscribes to:
 *  - `StartAirConditioningV1` — start cooling or heating in the requested mode.
 *  - `StopAirConditioningV1` — stop the requested mode.
 *  - `GridOperatorPowerLimitationV1` — §14a EnWG broadcast (handled in base).
 */
export abstract class AirConditioningIntegrationEnergyApp extends IntegrationEnergyApp {
    /**
     * @param options - Standard integration options.
     */
    protected constructor(options: IntegrationEnergyAppOptions) {
        super(options);
    }

    protected get managedApplianceType(): EnyoApplianceTypeEnum {
        return EnyoApplianceTypeEnum.AirConditioning;
    }

    protected registerHandlers(): void {
        this.registerCommandHandler<EnyoDataBusStartAirConditioningV1>(
            EnyoDataBusMessageEnum.StartAirConditioningV1,
            (m) => this.handleStartAirConditioning(m)
        );
        this.registerCommandHandler<EnyoDataBusStopAirConditioningV1>(
            EnyoDataBusMessageEnum.StopAirConditioningV1,
            (m) => this.handleStopAirConditioning(m)
        );
    }

    /**
     * Handles a `StartAirConditioningV1` command. Implementers start the AC
     * unit in the requested `mode` (Heating or Cooling).
     */
    protected abstract handleStartAirConditioning(
        message: EnyoDataBusStartAirConditioningV1
    ): Promise<IntegrationCommandResponse>;

    /**
     * Handles a `StopAirConditioningV1` command. Implementers stop the AC
     * unit's currently active `mode`.
     */
    protected abstract handleStopAirConditioning(
        message: EnyoDataBusStopAirConditioningV1
    ): Promise<IntegrationCommandResponse>;

    /**
     * @inheritDoc
     */
    protected abstract handleGridOperatorPowerLimitation(
        message: EnyoDataBusGridOperatorPowerLimitationV1,
        applianceId: string
    ): Promise<IntegrationCommandResponse>;

    /**
     * Publishes an `AirConditioningValuesUpdateV1` message reporting the
     * current operation mode and power consumption.
     */
    public publishAirConditioningValues(
        applianceId: string,
        values: EnyoDataBusAirConditioningValuesV1['data']['values']
    ): void {
        const msg: EnyoDataBusAirConditioningValuesV1 = {
            id: this.generateMessageId(),
            type: 'message',
            message: EnyoDataBusMessageEnum.AirConditioningValuesUpdateV1,
            source: this.source,
            applianceId,
            timestampIso: new Date().toISOString(),
            data: {values}
        };
        this.useDataBus().sendMessage([msg]);
    }

    /**
     * Publishes an `AirConditioningTemperaturesUpdateV1` message with per-room
     * current and target temperatures.
     */
    public publishAirConditioningTemperatures(
        applianceId: string,
        data: EnyoDataBusAirConditioningTemperaturesV1['data']
    ): void {
        const msg: EnyoDataBusAirConditioningTemperaturesV1 = {
            id: this.generateMessageId(),
            type: 'message',
            message: EnyoDataBusMessageEnum.AirConditioningTemperaturesUpdateV1,
            source: this.source,
            applianceId,
            timestampIso: new Date().toISOString(),
            data
        };
        this.useDataBus().sendMessage([msg]);
    }
}
