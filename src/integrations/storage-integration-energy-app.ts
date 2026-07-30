import {IntegrationEnergyApp} from "./integration-energy-app.js";
import {IntegrationCommandResponse, IntegrationEnergyAppOptions} from "./integration-types.js";
import {EnyoApplianceTypeEnum} from "../types/enyo-appliance.js";
import {
    EnyoDataBusBatteryValuesUpdateV1,
    EnyoDataBusGridOperatorPowerLimitationV1,
    EnyoDataBusMaxDischargePowerChangedV1,
    EnyoDataBusMessageEnum,
    EnyoDataBusSetStorageControlV2,
    EnyoDataBusSetStorageScheduleV1
} from "../types/enyo-data-bus-value.js";

/**
 * Abstract base class for battery / storage integrations.
 *
 * Subscribes to:
 *  - `SetStorageScheduleV1` — full storage control plan (mode + relative
 *    schedule of direction/power setpoints). Replaces the legacy
 *    start/stop/limit message family.
 *  - `SetStorageControlV2` — single-setpoint control (mode + direction/power),
 *    the immediate-control counterpart to the schedule message.
 *  - `GridOperatorPowerLimitationV1` — §14a EnWG broadcast (handled in base).
 */
export abstract class StorageIntegrationEnergyApp extends IntegrationEnergyApp {
    /**
     * @param options - Standard integration options.
     */
    protected constructor(options: IntegrationEnergyAppOptions) {
        super(options);
    }

    protected get managedApplianceType(): EnyoApplianceTypeEnum {
        return EnyoApplianceTypeEnum.Storage;
    }

    protected registerHandlers(): void {
        this.registerCommandHandler<EnyoDataBusSetStorageScheduleV1>(
            EnyoDataBusMessageEnum.SetStorageScheduleV1,
            (m) => this.handleSetStorageSchedule(m)
        );
        this.registerCommandHandler<EnyoDataBusSetStorageControlV2>(
            EnyoDataBusMessageEnum.SetStorageControlV2,
            (m) => this.handleSetStorageControl(m)
        );
    }

    /**
     * Handles a `SetStorageScheduleV1` command — apply the prescribed
     * storage control plan to the battery appliance.
     *
     * When `data.mode` is `'auto'` the integration should release the
     * appliance back to its own logic. When `data.mode` is `'schedule'`
     * the integration should follow `data.relativeSchedule`: each entry
     * carries an explicit `direction` (`'charge'` or `'discharge'`) and
     * a non-negative `powerW` setpoint that becomes active `seconds`
     * after message receipt, and stays active until the next entry's
     * `seconds` is reached.
     */
    protected abstract handleSetStorageSchedule(
        message: EnyoDataBusSetStorageScheduleV1
    ): Promise<IntegrationCommandResponse>;

    /**
     * Handles a `SetStorageControlV2` command — apply a single-setpoint control
     * plan to the battery appliance.
     *
     * When `data.mode` is `'auto'` the integration should release the appliance
     * back to its own logic. When `data.mode` is `'controlled'` the integration
     * should apply `data.control`: an explicit `direction` (`'charge'`,
     * `'discharge'`, or `'hold'`) with a non-negative `powerW` setpoint
     * (`0` for `'hold'`), held until a new command arrives.
     *
     * @param message - The V2 storage control command.
     * @returns `Accepted` when the battery will apply the setpoint, `Rejected`
     *   if it cannot, `NotSupported` if the integration does not support direct
     *   control.
     */
    protected abstract handleSetStorageControl(
        message: EnyoDataBusSetStorageControlV2
    ): Promise<IntegrationCommandResponse>;

    /**
     * @inheritDoc
     */
    protected abstract handleGridOperatorPowerLimitation(
        message: EnyoDataBusGridOperatorPowerLimitationV1,
        applianceId: string
    ): Promise<IntegrationCommandResponse>;

    /**
     * Publishes a `BatteryValuesUpdateV1` message with the battery's current
     * state, power, and SoC.
     */
    public publishBatteryValuesUpdate(
        applianceId: string,
        data: EnyoDataBusBatteryValuesUpdateV1['data']
    ): void {
        const msg: EnyoDataBusBatteryValuesUpdateV1 = {
            id: this.generateMessageId(),
            type: 'message',
            message: EnyoDataBusMessageEnum.BatteryValuesUpdateV1,
            source: this.source,
            applianceId,
            timestampIso: new Date().toISOString(),
            data
        };
        this.useDataBus().sendMessage([msg]);
    }

    /**
     * Publishes a `MaxDischargePowerChangedV1` informational message when the
     * battery's max discharge power has changed.
     */
    public publishMaxDischargePowerChanged(
        applianceId: string,
        maxDischargePowerKw: number
    ): void {
        const msg: EnyoDataBusMaxDischargePowerChangedV1 = {
            id: this.generateMessageId(),
            type: 'message',
            message: EnyoDataBusMessageEnum.MaxDischargePowerChangedV1,
            source: this.source,
            applianceId,
            timestampIso: new Date().toISOString(),
            data: {maxDischargePowerKw}
        };
        this.useDataBus().sendMessage([msg]);
    }
}
