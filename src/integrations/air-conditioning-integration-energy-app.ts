import {IntegrationEnergyApp} from "./integration-energy-app.js";
import {IntegrationCommandResponse, IntegrationEnergyAppOptions} from "./integration-types.js";
import {EnyoApplianceTypeEnum} from "../types/enyo-appliance.js";
import {
    EnyoCommandAcknowledgeAnswerEnum,
    EnyoDataBusAirConditioningTemperaturesV1,
    EnyoDataBusAirConditioningValuesV1,
    EnyoDataBusGridOperatorPowerLimitationV1,
    EnyoDataBusMessageEnum,
    EnyoDataBusSetAirConditioningTargetTemperatureV1,
    EnyoDataBusStartAirConditioningV1,
    EnyoDataBusStopAirConditioningV1
} from "../types/enyo-data-bus-value.js";

/**
 * Abstract base class for air conditioning integrations.
 *
 * Subscribes to:
 *  - `StartAirConditioningV1` — start cooling or heating in the requested mode.
 *  - `StopAirConditioningV1` — stop the requested mode.
 *  - `SetAirConditioningTargetTemperatureV1` — set the target temperature of a
 *    mode; answered `NotSupported` unless {@link handleSetAirConditioningTargetTemperature}
 *    is overridden.
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
        this.registerCommandHandler<EnyoDataBusSetAirConditioningTargetTemperatureV1>(
            EnyoDataBusMessageEnum.SetAirConditioningTargetTemperatureV1,
            (m) => this.handleSetAirConditioningTargetTemperature(m)
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
     * Handles a `SetAirConditioningTargetTemperatureV1` command — the energy
     * manager's boost (pre-heating / pre-cooling) and the restore of the
     * customer's setpoint afterwards. Override it, and declare
     * `EnyoAirConditioningApplianceAvailableFeaturesEnum.TemperatureControllable`
     * on the appliance, when the unit can take a setpoint: set
     * `targetTemperatureC` for `mode` (and `roomIndex`, when given). The two
     * go together — the feature is how the energy manager learns it may send
     * the command.
     *
     * The default answers `NotSupported`, so existing integrations keep
     * compiling and the energy manager learns the unit cannot be boosted by
     * setpoint.
     *
     * @param message - The command.
     * @returns The answer for the command acknowledgement.
     */
    protected async handleSetAirConditioningTargetTemperature(
        message: EnyoDataBusSetAirConditioningTargetTemperatureV1
    ): Promise<IntegrationCommandResponse> {
        return {
            answer: EnyoCommandAcknowledgeAnswerEnum.NotSupported,
            rejectionReason: `Setting the target temperature is not implemented for ${message.applianceId}.`,
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
