import {EnyoCurrencyEnum} from "./enyo-currency.js";
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

    /**
     * Fires while the current PV surplus is *below* a user-configured threshold
     * (see {@link EnyoAutomationPvSurplusBelowThresholdTrigger}). This is the
     * inverse of {@link PvSurplusThreshold} and expresses the "turn the target
     * off once the PV surplus reaches X Watt" use case: the automation is
     * active (target on) while the surplus stays below the threshold and is
     * deactivated (target off) as soon as the surplus reaches or exceeds it.
     */
    PvSurplusBelowThreshold = 'pv-surplus-below-threshold',

    /**
     * Fires while the current electricity price per kWh is below a
     * user-configured limit (see {@link EnyoAutomationBelowPriceLimitTrigger}).
     * The automation is activated when the price drops below the limit and
     * deactivated when it reaches or exceeds it again.
     */
    BelowPriceLimit = 'below-price-limit',

    /**
     * Fires during the cheapest share of the day — e.g. the cheapest 25 % of
     * the day's price intervals (see
     * {@link EnyoAutomationCheapestShareOfDayTrigger}). The provider ranks the
     * day's known prices and marks the cheapest intervals as active, so the
     * automation follows the price ranking rather than an absolute price.
     */
    CheapestShareOfDay = 'cheapest-share-of-day',

    /**
     * Fires during user-defined time windows — the "Zeitplan" trigger (see
     * {@link EnyoAutomationScheduleTrigger}). A schedule holds one or more
     * windows, each with a start and end time of day and an optional set of
     * weekdays it applies to, so "weekdays 06:00-08:00 and 18:00-22:00, and all
     * day on Sunday" is a single trigger.
     */
    Schedule = 'schedule',
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
    /**
     * Replaced with the current electricity price per kWh at the moment of
     * publishing. Only meaningful for price-based triggers
     * ({@link EnyoAutomationTriggerTypeEnum.BelowPriceLimit} and
     * {@link EnyoAutomationTriggerTypeEnum.CheapestShareOfDay}); resolves to
     * `null` when no price is known.
     */
    PricePerKwh = '{{pricePerKwh}}',
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
 * Trigger configuration for {@link EnyoAutomationTriggerTypeEnum.PvSurplusBelowThreshold}.
 *
 * Use this to express "turn the target off once the PV surplus reaches X Watt":
 * the trigger is active while the surplus is below `thresholdW` and turns
 * inactive as soon as the surplus reaches or exceeds it.
 */
export interface EnyoAutomationPvSurplusBelowThresholdTrigger {
    /** Discriminator identifying this trigger variant. */
    type: EnyoAutomationTriggerTypeEnum.PvSurplusBelowThreshold;
    /**
     * PV surplus threshold in Watts. The automation deactivates when the
     * measured surplus reaches or exceeds this value (`surplusW >= thresholdW`)
     * and activates again when it falls below it.
     */
    thresholdW: number;
}

/**
 * Trigger configuration for {@link EnyoAutomationTriggerTypeEnum.BelowPriceLimit}.
 */
export interface EnyoAutomationBelowPriceLimitTrigger {
    /** Discriminator identifying this trigger variant. */
    type: EnyoAutomationTriggerTypeEnum.BelowPriceLimit;
    /**
     * Price limit per kWh in the smallest unit of {@link currency} used by the
     * tariff (i.e. the same unit as `EnyoEnergyPriceEntry.consumptionPricePerKwh`).
     * Always compared against the full gross consumption price — including
     * taxes, grid fees and every other price component. The automation
     * activates while the current price is strictly below this value and
     * deactivates when it reaches or exceeds it. Negative limits are allowed,
     * since dynamic prices can turn negative.
     */
    limitPerKwh: number;
    /**
     * Currency the {@link limitPerKwh} is expressed in. Defaults to
     * {@link EnyoCurrencyEnum.EUR} when omitted.
     */
    currency?: EnyoCurrencyEnum;
}

/**
 * Trigger configuration for {@link EnyoAutomationTriggerTypeEnum.CheapestShareOfDay}.
 *
 * The provider ranks the price intervals known for the day and marks the
 * cheapest `sharePercent` of them as active — e.g. `sharePercent: 25` selects
 * the cheapest quarter of the day (6 hours when 24 hours of prices are known).
 */
export interface EnyoAutomationCheapestShareOfDayTrigger {
    /** Discriminator identifying this trigger variant. */
    type: EnyoAutomationTriggerTypeEnum.CheapestShareOfDay;
    /**
     * Share of the day to treat as cheap, in percent. Must be an integer
     * between 1 and 100 (enforced by the automation validators). The common
     * "cheapest 25 % of the day" setting is `25`.
     */
    sharePercent: number;
}

/**
 * A single window of an {@link EnyoAutomationScheduleTrigger}.
 *
 * Times are wall-clock times in the schedule's timezone, so a window survives
 * daylight-saving transitions: `'22:00'` stays 22:00 local time all year round.
 * The shape mirrors {@link EnyoRecurringPriceWindow} so both features use the
 * same weekday and time-of-day conventions.
 */
export interface EnyoAutomationScheduleWindow {
    /**
     * Inclusive start of the window as a local wall-clock time in `HH:mm`
     * 24-hour notation, e.g. `'06:00'`.
     */
    startTimeOfDay: string;
    /**
     * Exclusive end of the window as a local wall-clock time in `HH:mm`
     * notation. May be **earlier** than {@link startTimeOfDay}, in which case
     * the window wraps past midnight (e.g. `'22:00'` → `'06:00'`). Must differ
     * from {@link startTimeOfDay}.
     */
    endTimeOfDay: string;
    /**
     * Days of the week the window applies to, `0` = Sunday … `6` = Saturday.
     * Omit for "every day".
     *
     * For a window that wraps past midnight the day is evaluated against the
     * day the window **starts** — a Monday 22:00–06:00 window covers Monday
     * evening and the early hours of Tuesday.
     */
    daysOfWeek?: number[];
}

/**
 * Trigger configuration for {@link EnyoAutomationTriggerTypeEnum.Schedule} —
 * the "Zeitplan" trigger.
 *
 * The trigger is active whenever the current local time falls inside **any** of
 * its {@link windows}; windows are therefore a union and may overlap freely.
 *
 * @example
 * ```typescript
 * // Weekday mornings and evenings, plus all day on Sunday.
 * const trigger: EnyoAutomationScheduleTrigger = {
 *     type: EnyoAutomationTriggerTypeEnum.Schedule,
 *     windows: [
 *         {startTimeOfDay: '06:00', endTimeOfDay: '08:00', daysOfWeek: [1, 2, 3, 4, 5]},
 *         {startTimeOfDay: '18:00', endTimeOfDay: '22:00', daysOfWeek: [1, 2, 3, 4, 5]},
 *         {startTimeOfDay: '00:00', endTimeOfDay: '23:59', daysOfWeek: [0]},
 *     ],
 *     timezone: 'Europe/Berlin',
 * };
 * ```
 */
export interface EnyoAutomationScheduleTrigger {
    /** Discriminator identifying this trigger variant. */
    type: EnyoAutomationTriggerTypeEnum.Schedule;
    /**
     * The windows the automation should be active in. Must contain at least one
     * window. Windows may overlap — the trigger is active while any of them
     * covers the current time.
     */
    windows: EnyoAutomationScheduleWindow[];
    /**
     * IANA timezone identifier (e.g. `'Europe/Berlin'`) the window times are
     * interpreted in. Defaults to the Energy Manager's configured timezone when
     * omitted.
     */
    timezone?: string;
}

/**
 * Union of all supported trigger configurations. Narrow on the `type`
 * discriminator to access variant-specific fields. Additional trigger variants
 * can be added to this union in later iterations.
 */
export type EnyoAutomationTrigger =
    | EnyoAutomationPvSurplusThresholdTrigger
    | EnyoAutomationPvSurplusBelowThresholdTrigger
    | EnyoAutomationBelowPriceLimitTrigger
    | EnyoAutomationCheapestShareOfDayTrigger
    | EnyoAutomationScheduleTrigger;

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
     * values are the short runtimes 1 to 4 minutes and every multiple of 5
     * minutes up to 360 (6 hours) — enforced by the automation validators. Use
     * `1` for loads that only need a one-minute runtime pulse.
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
 * Trigger-type-specific metadata carried by the `AutomationTriggerV1` data-bus
 * message for a {@link EnyoAutomationTriggerTypeEnum.PvSurplusBelowThreshold}
 * trigger.
 */
export interface EnyoAutomationPvSurplusBelowThresholdTriggerData {
    /** Discriminator identifying the trigger variant this metadata belongs to. */
    triggerType: EnyoAutomationTriggerTypeEnum.PvSurplusBelowThreshold;
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
 * Trigger-type-specific metadata carried by the `AutomationTriggerV1` data-bus
 * message for a {@link EnyoAutomationTriggerTypeEnum.BelowPriceLimit} trigger.
 */
export interface EnyoAutomationBelowPriceLimitTriggerData {
    /** Discriminator identifying the trigger variant this metadata belongs to. */
    triggerType: EnyoAutomationTriggerTypeEnum.BelowPriceLimit;
    /**
     * Current full gross electricity price per kWh at the time of evaluation.
     * Feeds the {@link EnyoAutomationMqttPlaceholderEnum.PricePerKwh}
     * placeholder. May be negative when dynamic prices turn negative.
     */
    pricePerKwh: number;
    /** The configured price limit per kWh that was compared against. */
    limitPerKwh: number;
    /** Currency the prices are expressed in. */
    currency: EnyoCurrencyEnum;
}

/**
 * Trigger-type-specific metadata carried by the `AutomationTriggerV1` data-bus
 * message for a {@link EnyoAutomationTriggerTypeEnum.CheapestShareOfDay}
 * trigger.
 */
export interface EnyoAutomationCheapestShareOfDayTriggerData {
    /** Discriminator identifying the trigger variant this metadata belongs to. */
    triggerType: EnyoAutomationTriggerTypeEnum.CheapestShareOfDay;
    /**
     * Current electricity price per kWh at the time of evaluation. Feeds the
     * {@link EnyoAutomationMqttPlaceholderEnum.PricePerKwh} placeholder.
     */
    pricePerKwh: number;
    /** The configured share of the day treated as cheap, in percent. */
    sharePercent: number;
    /**
     * Highest price per kWh that still counts as "cheap" for the current day,
     * i.e. the price of the most expensive interval inside the selected share.
     * Lets consumers show why the trigger is (in)active.
     */
    thresholdPricePerKwh: number;
    /** Currency the prices are expressed in. */
    currency: EnyoCurrencyEnum;
}

/**
 * Trigger-type-specific metadata carried by the `AutomationTriggerV1` data-bus
 * message for a {@link EnyoAutomationTriggerTypeEnum.Schedule} trigger.
 */
export interface EnyoAutomationScheduleTriggerData {
    /** Discriminator identifying the trigger variant this metadata belongs to. */
    triggerType: EnyoAutomationTriggerTypeEnum.Schedule;
    /**
     * Index into {@link EnyoAutomationScheduleTrigger.windows} of the window
     * that caused the state change — the window that just started when the
     * trigger became active, or the one that just ended when it deactivated.
     * Omitted when no single window is responsible.
     */
    windowIndex?: number;
    /** ISO 8601 timestamp of when the reported window starts. */
    windowStartIso?: string;
    /** ISO 8601 timestamp of when the reported window ends. */
    windowEndIso?: string;
}

/**
 * Union of trigger-type-specific metadata carried by the `AutomationTriggerV1`
 * data-bus message (see `EnyoDataBusAutomationTriggerV1`). Narrow on the
 * `triggerType` discriminator to access variant-specific fields. Additional
 * trigger variants extend this union as they are added.
 */
export type EnyoAutomationTriggerData =
    | EnyoAutomationPvSurplusThresholdTriggerData
    | EnyoAutomationPvSurplusBelowThresholdTriggerData
    | EnyoAutomationBelowPriceLimitTriggerData
    | EnyoAutomationCheapestShareOfDayTriggerData
    | EnyoAutomationScheduleTriggerData;

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
