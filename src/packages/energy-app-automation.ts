import {
    EnyoAutomation,
    EnyoAutomationForecast,
    EnyoAutomationTriggerTypeEnum,
} from "../types/enyo-automation.js";

/**
 * Interface for interacting with user-configured automations.
 *
 * An automation is a "when a trigger is active, do one or more actions" rule
 * that the end-user composes in the platform UI from a registered trigger and
 * one or more actions.
 *
 * The API has two roles, gated by permission:
 *
 * - **Consumer** (any app): read automations and listen for their creation,
 *   update and removal. Requires the `Automation` permission.
 * - **Provider** (apps holding the `EnergyManager` permission): register the
 *   trigger types the app can evaluate and publish automation forecasts. The
 *   provider owns the condition evaluation — e.g. for the PV-surplus trigger it
 *   watches the surplus and publishes an `AutomationTriggerV1` data-bus message
 *   (via `useDataBus()`) whenever the configured threshold is crossed. Trigger
 *   state is a data-bus message, not a method on this package.
 *
 * @example
 * ```typescript
 * // A "pool pump on solar" automation the user created:
 * //   trigger: PV surplus > 2000 W
 * //   action:  switch the pool-pump smart plug, at least 10 minutes, flexible
 * const automation: EnyoAutomation = {
 *     id: 'pool-pump',
 *     name: 'Pool pump on solar',
 *     enabled: true,
 *     trigger: {type: EnyoAutomationTriggerTypeEnum.PvSurplusThreshold, thresholdW: 2000},
 *     actions: [
 *         {
 *             id: 'switch-pump',
 *             type: EnyoAutomationActionTypeEnum.SmartPlugSwitch,
 *             schedulingMode: EnyoAutomationSchedulingModeEnum.Flexible,
 *             targetKind: EnyoAutomationTargetKindEnum.Load,
 *             applianceId: 'shelly-pool-ch0',
 *             minDurationMinutes: 10,
 *         },
 *     ],
 * };
 *
 * // Energy Manager app: register the trigger type once...
 * const automations = sdk.useAutomations();
 * await automations.registerTrigger(EnyoAutomationTriggerTypeEnum.PvSurplusThreshold);
 *
 * // ...then publish live trigger state as an AutomationTriggerV1 data-bus message
 * // whenever the surplus crosses the threshold:
 * sdk.useDataBus().sendMessage([{
 *     type: 'message',
 *     message: EnyoDataBusMessageEnum.AutomationTriggerV1,
 *     automationId: 'pool-pump',
 *     data: {
 *         active: true,
 *         trigger: {
 *             triggerType: EnyoAutomationTriggerTypeEnum.PvSurplusThreshold,
 *             surplusW: 2400,
 *             thresholdW: 2000,
 *         },
 *     },
 * }]);
 * ```
 */
export interface EnergyAppAutomation {
    /**
     * Lists all automations visible to the app.
     *
     * @returns Promise resolving to the current automations.
     * @throws {EnergyAppPermissionNotGrantedError} If the `Automation` permission is not granted.
     */
    list(): Promise<EnyoAutomation[]>;

    /**
     * Retrieves a single automation by its id.
     *
     * @param id - The automation id.
     * @returns Promise resolving to the automation, or `null` if none exists with that id.
     * @throws {EnergyAppPermissionNotGrantedError} If the `Automation` permission is not granted.
     */
    getById(id: string): Promise<EnyoAutomation | null>;

    /**
     * Registers a listener invoked when a new automation is created.
     *
     * @param listener - Callback receiving the created automation.
     * @returns A listener id that can be passed to {@link removeListener}.
     */
    listenForAutomationCreated(listener: (automation: EnyoAutomation) => void | Promise<void>): string;

    /**
     * Registers a listener invoked when an existing automation is updated.
     *
     * @param listener - Callback receiving the updated automation.
     * @returns A listener id that can be passed to {@link removeListener}.
     */
    listenForAutomationUpdated(listener: (automation: EnyoAutomation) => void | Promise<void>): string;

    /**
     * Registers a listener invoked when an automation is removed.
     *
     * @param listener - Callback receiving the id of the removed automation.
     * @returns A listener id that can be passed to {@link removeListener}.
     */
    listenForAutomationRemoved(listener: (automationId: string) => void | Promise<void>): string;

    /**
     * Removes a previously registered listener.
     *
     * @param listenerId - The id returned by one of the `listenFor*` methods.
     */
    removeListener(listenerId: string): void;

    /**
     * Registers a trigger type that this app can evaluate. Registration is by
     * enum value only — the user-facing wording is provided by the platform UI.
     *
     * @param type - The trigger type to register.
     * @returns Promise that resolves once the trigger type is registered.
     * @throws {EnergyAppPermissionNotGrantedError} If the `EnergyManager` permission is not granted.
     */
    registerTrigger(type: EnyoAutomationTriggerTypeEnum): Promise<void>;

    /**
     * Deregisters a previously registered trigger type.
     *
     * @param type - The trigger type to deregister.
     * @returns Promise that resolves once the trigger type is deregistered.
     * @throws {EnergyAppPermissionNotGrantedError} If the `EnergyManager` permission is not granted.
     */
    deregisterTrigger(type: EnyoAutomationTriggerTypeEnum): Promise<void>;

    /**
     * Publishes a forecast of when an automation's trigger is predicted to be
     * active, so the rest of the system can plan around upcoming automation
     * activity.
     *
     * @param forecast - The automation forecast to publish.
     * @returns Promise that resolves once the forecast has been published.
     * @throws {EnergyAppPermissionNotGrantedError} If the `EnergyManager` permission is not granted.
     */
    publishAutomationForecast(forecast: EnyoAutomationForecast): Promise<void>;
}
