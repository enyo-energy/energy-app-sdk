import {IntegrationEnergyApp} from "./integration-energy-app.js";
import {IntegrationCommandResponse, IntegrationEnergyAppOptions} from "./integration-types.js";
import {EnyoApplianceTypeEnum} from "../types/enyo-appliance.js";
import {
    EnyoDataBusBatteryValuesUpdateV1,
    EnyoDataBusGridOperatorPowerLimitationV1,
    EnyoDataBusMaxDischargePowerChangedV1,
    EnyoDataBusMessageEnum,
    EnyoDataBusSetStorageDischargeLimitV1,
    EnyoDataBusStartStorageGridChargeV1,
    EnyoDataBusStopStorageGridChargeV1
} from "../types/enyo-data-bus-value.js";

/**
 * Abstract base class for battery / storage integrations.
 *
 * Subscribes to:
 *  - `StartStorageGridChargeV1` — start charging the battery from the grid.
 *  - `StopStorageGridChargeV1` — stop grid charging.
 *  - `SetStorageDischargeLimitV1` — set the maximum discharge power.
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
        this.registerCommandHandler<EnyoDataBusStartStorageGridChargeV1>(
            EnyoDataBusMessageEnum.StartStorageGridChargeV1,
            (m) => this.handleStartStorageGridCharge(m)
        );
        this.registerCommandHandler<EnyoDataBusStopStorageGridChargeV1>(
            EnyoDataBusMessageEnum.StopStorageGridChargeV1,
            (m) => this.handleStopStorageGridCharge(m)
        );
        this.registerCommandHandler<EnyoDataBusSetStorageDischargeLimitV1>(
            EnyoDataBusMessageEnum.SetStorageDischargeLimitV1,
            (m) => this.handleSetStorageDischargeLimit(m)
        );
    }

    /**
     * Handles a `StartStorageGridChargeV1` command — start charging the
     * battery from the grid up to `data.powerLimitW`.
     */
    protected abstract handleStartStorageGridCharge(
        message: EnyoDataBusStartStorageGridChargeV1
    ): Promise<IntegrationCommandResponse>;

    /**
     * Handles a `StopStorageGridChargeV1` command — end an active grid charge.
     */
    protected abstract handleStopStorageGridCharge(
        message: EnyoDataBusStopStorageGridChargeV1
    ): Promise<IntegrationCommandResponse>;

    /**
     * Handles a `SetStorageDischargeLimitV1` command — set the maximum
     * discharge power in watts.
     */
    protected abstract handleSetStorageDischargeLimit(
        message: EnyoDataBusSetStorageDischargeLimitV1
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
