import {EnyoCommandAcknowledgeAnswerEnum} from "../types/enyo-data-bus-value.js";
import {EnyoSourceEnum} from "../types/enyo-source.enum.js";
import {ApplianceManager} from "../implementations/appliances/appliance-manager.js";

/**
 * Response object an integration's command handler returns to indicate how a
 * received data bus command should be acknowledged. The base integration class
 * uses this to construct the matching `CommandAcknowledgeV1` message.
 */
export interface IntegrationCommandResponse {
    /** Whether the appliance accepts, rejects, or does not support the command. */
    answer: EnyoCommandAcknowledgeAnswerEnum;
    /**
     * Free-form reason why the command was rejected or is not supported.
     * Set this whenever `answer` is `Rejected` or `NotSupported` so the energy
     * manager has actionable diagnostics.
     */
    rejectionReason?: string;
}

/**
 * Response from a broadcast command handler (e.g. `GridOperatorPowerLimitationV1`)
 * that has to be acknowledged on behalf of one specific managed appliance.
 *
 * Returned in arrays from handlers that receive broadcast messages and need to
 * answer for multiple appliances individually.
 */
export interface IntegrationApplianceCommandResponse extends IntegrationCommandResponse {
    /** ID of the appliance this response is for. */
    applianceId: string;
}

/**
 * Constructor options shared by every appliance-oriented integration class
 * (Heatpump, Wallbox, Air Conditioning, Storage, Inverter).
 *
 * The integration must know which appliance IDs it is responsible for so it
 * can correctly target outgoing acknowledgments. Three resolution strategies
 * are supported, in priority order:
 *
 * 1. Pass an `ApplianceManager` and let the base class look up appliances by
 *    type via {@link ApplianceManager.getAppliancesByType}.
 * 2. Pass an explicit `applianceIds` array of pre-known IDs.
 * 3. Override `protected resolveManagedApplianceIds()` in a subclass to
 *    provide a fully custom resolution strategy.
 */
export interface IntegrationEnergyAppOptions {
    /**
     * Source identifier used when sending acknowledgments and outgoing
     * messages on the data bus. Typically `EnyoSourceEnum.Device` for
     * device-side integrations.
     */
    source: EnyoSourceEnum;
    /**
     * Optional `ApplianceManager` instance used to look up managed appliance
     * IDs by type. When provided, the base class filters appliances by the
     * subclass's `managedApplianceType`.
     */
    applianceManager?: ApplianceManager;
    /**
     * Optional explicit list of managed appliance IDs. Useful when the
     * integrator does not (yet) use {@link ApplianceManager}.
     */
    applianceIds?: string[];
    /**
     * When `true` (default), the constructor immediately subscribes to all
     * configured data bus listeners. Set to `false` to defer until you call
     * `start()` manually.
     */
    autoStart?: boolean;
    /**
     * When `true` (default), the integration registers an `onShutdown`
     * callback that calls `stop()` so listeners are torn down on process exit.
     */
    autoStopOnShutdown?: boolean;
}
