import {EnyoForecastResolution} from "./enyo-data-bus-value.js";
import {MqttQos} from "./enyo-mqtt.js";

/**
 * The kinds of trigger an automation can be built on.
 *
 * A trigger is registered by an app holding the `EnergyManager` permission,
 * which is responsible for evaluating the condition and publishing the live
 * trigger state as an `AutomationTriggerV1` data-bus message (see
 * {@link EnyoAutomationTriggerData}). Registration is by enum value only — all
 * user-facing wording is handled by the platform UI.
 */
export enum EnyoAutomationTriggerTypeEnum {
    /**
     * Fires while the current PV surplus is above a user-configured threshold
     * (see {@link EnyoAutomationPvSurplusThresholdTrigger}). The automation is
     * activated when surplus rises above the threshold and deactivated when it
     * falls below.
     */
    PvSurplusThreshold = 'pv-surplus-threshold',
}

/**
 * The kinds of action an automation can perform when its trigger is active.
 */
export enum EnyoAutomationActionTypeEnum {
    /** Publish a user-defined message to an MQTT topic (see {@link EnyoAutomationMqttAction}). */
    Mqtt = 'mqtt',
    /** Switch a smart plug / relay appliance on and off (see {@link EnyoAutomationSmartPlugSwitchAction}). */
    SmartPlugSwitch = 'smart-plug-switch',
}

/**
 * Whether the target of an action is a real electrical load or only a control
 * signal.
 *
 * - `Load`: the target consumes power (e.g. a pool pump). The Energy Manager
 *   must account for it in the energy balance; the actual power is observed
 *   from the meter (no configured figure).
 * - `Signal`: the target is a control signal with negligible power draw (e.g. a
 *   potential-free contact) and does not affect the energy balance.
 */
export enum EnyoAutomationTargetKindEnum {
    Load = 'load',
    Signal = 'signal',
}

/**
 * How much freedom the Energy Manager has in scheduling an action.
 *
 * - `Mandatory`: the action runs exactly while the trigger is active.
 * - `Flexible`: the Energy Manager may decide whether and when to run the
 *   action within the window in which the trigger is active (e.g. to optimise
 *   for the largest surplus).
 */
export enum EnyoAutomationSchedulingModeEnum {
    Mandatory = 'mandatory',
    Flexible = 'flexible',
}

/**
 * Placeholders that the platform substitutes inside an MQTT action's
 * {@link EnyoAutomationMqttAction.payloadTemplate} immediately before
 * publishing. Reference these constants from both the platform and app code so
 * there is a single source of truth for the supported tokens.
 */
export enum EnyoAutomationMqttPlaceholderEnum {
    /** Replaced with `on` when the trigger became active, `off` when it deactivated. */
    State = '{{state}}',
    /** Replaced with the current PV surplus in Watts at the moment of publishing. */
    SurplusW = '{{surplusW}}',
    /** Replaced with the ISO 8601 timestamp of the event. */
    TimestampIso = '{{timestampIso}}',
    /** Replaced with the id of the automation that fired. */
    AutomationId = '{{automationId}}',
}

/**
 * Trigger configuration for {@link EnyoAutomationTriggerTypeEnum.PvSurplusThreshold}.
 */
export interface EnyoAutomationPvSurplusThresholdTrigger {
    /** Discriminator identifying this trigger variant. */
    type: EnyoAutomationTriggerTypeEnum.PvSurplusThreshold;
    /**
     * PV surplus threshold in Watts. The automation activates when the measured
     * surplus rises above this value and deactivates when it falls below it.
     */
    thresholdW: number;
}

/**
 * Union of all supported trigger configurations. Additional trigger variants
 * (e.g. price- or time-based) can be added to this union in later iterations.
 */
export type EnyoAutomationTrigger = EnyoAutomationPvSurplusThresholdTrigger;

/**
 * Fields shared by every automation action, independent of its
 * {@link EnyoAutomationActionTypeEnum}.
 */
export interface EnyoAutomationActionBase {
    /** Unique id of this action within its automation. */
    id: string;
    /** How much freedom the Energy Manager has to schedule this action. */
    schedulingMode: EnyoAutomationSchedulingModeEnum;
    /** Whether the target of this action is a real load or a control signal only. */
    targetKind: EnyoAutomationTargetKindEnum;
}

/**
 * Action that publishes a user-defined message to an MQTT topic when the
 * trigger changes state. The `payloadTemplate` may contain any of the
 * {@link EnyoAutomationMqttPlaceholderEnum} tokens, which the platform
 * substitutes before publishing.
 */
export interface EnyoAutomationMqttAction extends EnyoAutomationActionBase {
    /** Discriminator identifying this action variant. */
    type: EnyoAutomationActionTypeEnum.Mqtt;
    /** User-defined MQTT topic to publish to. */
    topic: string;
    /**
     * Whether firing this action should update the Energy Manager's tracked
     * charging PV surplus (i.e. whether the resulting load should be reflected
     * in the surplus available to other consumers such as EV charging).
     */
    updateChargingPvSurplus: boolean;
    /**
     * JSON message template published when the trigger changes state. May
     * contain {@link EnyoAutomationMqttPlaceholderEnum} placeholders that the
     * platform resolves at publish time.
     */
    payloadTemplate: string;
    /** Optional MQTT publish options (quality of service, retain flag). */
    publishOptions?: {
        /** MQTT quality-of-service level for the publish. */
        qos?: MqttQos;
        /** Whether the broker should retain the message as the last known value. */
        retain?: boolean;
    };
}

/**
 * Action that switches a smart plug / relay appliance (e.g. a Shelly channel)
 * on while the trigger is active and off when it deactivates. The target must
 * be an existing appliance whose `supportedAutomationActions` list includes
 * {@link EnyoAutomationActionTypeEnum.SmartPlugSwitch}.
 */
export interface EnyoAutomationSmartPlugSwitchAction extends EnyoAutomationActionBase {
    /** Discriminator identifying this action variant. */
    type: EnyoAutomationActionTypeEnum.SmartPlugSwitch;
    /** Id of the smart plug / switch appliance to control. */
    applianceId: string;
    /**
     * Minimum on-duration in minutes once the plug has been switched on. Valid
     * range is 5 to 360 (6 hours) in steps of 5 minutes (enforced by the
     * automation validators).
     */
    minDurationMinutes: number;
}

/**
 * Union of all supported automation actions. Narrow on the `type` discriminator
 * to access variant-specific fields.
 */
export type EnyoAutomationAction = EnyoAutomationMqttAction | EnyoAutomationSmartPlugSwitchAction;

/**
 * A user-configured automation: when its {@link EnyoAutomationTrigger} is
 * active, its {@link EnyoAutomationAction actions} are performed.
 */
export interface EnyoAutomation {
    /** Unique identifier of the automation. */
    id: string;
    /** User-facing name of the automation (e.g. "Pool pump on solar"). */
    name: string;
    /** Whether the automation is currently enabled by the user. */
    enabled: boolean;
    /** The trigger condition that activates the automation. */
    trigger: EnyoAutomationTrigger;
    /** One or more actions performed while the trigger is active. */
    actions: EnyoAutomationAction[];
    /** ISO 8601 timestamp of when the automation was created. */
    createdAtIso?: string;
    /** ISO 8601 timestamp of when the automation was last updated. */
    updatedAtIso?: string;
}

/**
 * Trigger-type-specific metadata carried by the `AutomationTriggerV1` data-bus
 * message for a {@link EnyoAutomationTriggerTypeEnum.PvSurplusThreshold} trigger.
 */
export interface EnyoAutomationPvSurplusThresholdTriggerData {
    /** Discriminator identifying the trigger variant this metadata belongs to. */
    triggerType: EnyoAutomationTriggerTypeEnum.PvSurplusThreshold;
    /**
     * Current PV surplus in Watts at the time of evaluation. Provides context
     * and feeds the {@link EnyoAutomationMqttPlaceholderEnum.SurplusW}
     * placeholder.
     */
    surplusW: number;
    /** The configured threshold in Watts that was crossed. */
    thresholdW: number;
}

/**
 * Union of trigger-type-specific metadata carried by the `AutomationTriggerV1`
 * data-bus message (see `EnyoDataBusAutomationTriggerV1`). Narrow on the
 * `triggerType` discriminator to access variant-specific fields. Additional
 * trigger variants extend this union as they are added.
 */
export type EnyoAutomationTriggerData = EnyoAutomationPvSurplusThresholdTriggerData;

/**
 * A single interval in an {@link EnyoAutomationForecast}. Marks whether the
 * automation's trigger is predicted to be active during the interval. No power
 * figure is carried — the forecast marks occupied windows only.
 */
export interface EnyoAutomationForecastEntry {
    /** ISO 8601 timestamp for the start of this interval. */
    timestampIso: string;
    /** Whether the automation's trigger is predicted to be active during this interval. */
    active: boolean;
    /**
     * Whether an action would run mandatorily during this interval (`true`) or
     * is flexible and may be shifted/skipped by the Energy Manager (`false`).
     */
    mandatory?: boolean;
    /** Whether the automation's target is a load (vs. a signal only). */
    hasLoad?: boolean;
}

/**
 * A prediction of when an automation's trigger will be active in the future,
 * produced by combining the PV-surplus forecast with the automation's
 * threshold. Published by the `EnergyManager` app via
 * {@link EnergyAppAutomation.publishAutomationForecast} so the rest of the
 * system can plan around upcoming automation activity.
 */
export interface EnyoAutomationForecast {
    /** Id of the automation this forecast applies to. */
    automationId: string;
    /** Resolution of the forecast intervals. */
    resolution: EnyoForecastResolution;
    /** Ordered, non-overlapping forecast intervals. */
    entries: EnyoAutomationForecastEntry[];
    /** ISO 8601 timestamp of when the forecast was generated. */
    generatedAtIso?: string;
}
