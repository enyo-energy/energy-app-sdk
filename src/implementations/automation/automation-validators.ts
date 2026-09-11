import {
    EnyoAutomation,
    EnyoAutomationAction,
    EnyoAutomationActionTypeEnum,
    EnyoAutomationForecast,
    EnyoAutomationMqttAction,
    EnyoAutomationMqttPlaceholderEnum,
    EnyoAutomationSchedulingModeEnum,
    EnyoAutomationSmartPlugSwitchAction,
    EnyoAutomationScheduleTrigger,
    EnyoAutomationTargetKindEnum,
    EnyoAutomationTriggerData,
    EnyoAutomationTriggerTypeEnum,
} from '../../types/enyo-automation.js';
import {EnyoCurrencyEnum} from '../../types/enyo-currency.js';
import {EnyoForecastResolution} from '../../types/enyo-data-bus-value.js';
import {MqttQos} from '../../types/enyo-mqtt.js';
import {parseTimeOfDay} from '../pricing/price-schedule-resolver.js';

/**
 * Thrown when an automation, action or automation forecast violates one of the
 * invariants enforced by this module. The message names the offending field /
 * index so callers can surface it directly to the user.
 */
export class AutomationValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AutomationValidationError';
    }
}

/**
 * Minimum smart-plug on-duration, in minutes. Short runtimes below
 * {@link AUTOMATION_DURATION_STEP_MINUTES} are allowed at a one-minute
 * granularity, so a one-minute runtime is valid.
 */
export const AUTOMATION_MIN_DURATION_MINUTES = 1;
/** Maximum smart-plug on-duration, in minutes (6 hours). */
export const AUTOMATION_MAX_DURATION_MINUTES = 360;
/**
 * Step size the smart-plug on-duration must be a multiple of, in minutes, once
 * it exceeds {@link AUTOMATION_DURATION_STEP_MINUTES}. Durations at or below
 * this value are free to use any whole minute (1, 2, 3, 4, 5).
 */
export const AUTOMATION_DURATION_STEP_MINUTES = 5;

/** Minimum share of the day, in percent, a cheapest-share trigger may select. */
export const AUTOMATION_MIN_CHEAPEST_SHARE_PERCENT = 1;
/** Maximum share of the day, in percent, a cheapest-share trigger may select. */
export const AUTOMATION_MAX_CHEAPEST_SHARE_PERCENT = 100;

/** Duration in seconds of each {@link EnyoForecastResolution} value. */
const FORECAST_RESOLUTION_SECONDS: Record<EnyoForecastResolution, number> = {
    '10s': 10,
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
};

/**
 * Validates a complete {@link EnyoAutomation}. Throws on the first violation.
 *
 * When `knownSmartPlugApplianceIds` is provided, every smart-plug action's
 * `applianceId` must be a member of it — use this to ensure the action targets
 * an appliance that actually supports {@link EnyoAutomationActionTypeEnum.SmartPlugSwitch}.
 *
 * @param automation - The automation to validate.
 * @param knownSmartPlugApplianceIds - Optional set/array of appliance ids that
 *   support the smart-plug-switch action; when given, smart-plug action targets
 *   are checked against it.
 * @throws {AutomationValidationError} On the first invariant violation.
 */
export function validateAutomation(
    automation: EnyoAutomation,
    knownSmartPlugApplianceIds?: Iterable<string>,
): void {
    if (!automation || typeof automation !== 'object') {
        throw new AutomationValidationError('Automation must be an object.');
    }
    requireNonEmptyString(automation.id, 'Automation.id');
    requireNonEmptyString(automation.name, 'Automation.name');
    if (typeof automation.enabled !== 'boolean') {
        throw new AutomationValidationError('Automation.enabled must be a boolean.');
    }

    validateTrigger(automation.trigger);

    if (!Array.isArray(automation.actions) || automation.actions.length === 0) {
        throw new AutomationValidationError('Automation.actions must contain at least one action.');
    }

    const knownIds = knownSmartPlugApplianceIds ? new Set(knownSmartPlugApplianceIds) : undefined;
    const seenActionIds = new Set<string>();
    automation.actions.forEach((action, index) => {
        requireNonEmptyString(action?.id, `Automation.actions[${index}].id`);
        if (seenActionIds.has(action.id)) {
            throw new AutomationValidationError(
                `Automation.actions[${index}].id is not unique: ${action.id}.`,
            );
        }
        seenActionIds.add(action.id);
        validateAction(action, index, knownIds);
    });
}

/**
 * Validates the trigger of an automation. Throws on the first violation.
 *
 * @param trigger - The trigger configuration.
 * @throws {AutomationValidationError} On the first invariant violation.
 */
export function validateTrigger(trigger: EnyoAutomation['trigger']): void {
    if (!trigger || typeof trigger !== 'object') {
        throw new AutomationValidationError('Automation.trigger must be an object.');
    }
    switch (trigger.type) {
        case EnyoAutomationTriggerTypeEnum.PvSurplusThreshold:
            if (typeof trigger.thresholdW !== 'number' || !Number.isFinite(trigger.thresholdW) || trigger.thresholdW < 0) {
                throw new AutomationValidationError(
                    'PvSurplusThreshold trigger.thresholdW must be a finite number >= 0.',
                );
            }
            break;
        case EnyoAutomationTriggerTypeEnum.PvSurplusBelowThreshold:
            if (typeof trigger.thresholdW !== 'number' || !Number.isFinite(trigger.thresholdW) || trigger.thresholdW < 0) {
                throw new AutomationValidationError(
                    'PvSurplusBelowThreshold trigger.thresholdW must be a finite number >= 0.',
                );
            }
            break;
        case EnyoAutomationTriggerTypeEnum.BelowPriceLimit:
            // Negative limits are valid: dynamic prices can turn negative.
            if (typeof trigger.limitPerKwh !== 'number' || !Number.isFinite(trigger.limitPerKwh)) {
                throw new AutomationValidationError(
                    'BelowPriceLimit trigger.limitPerKwh must be a finite number.',
                );
            }
            if (trigger.currency !== undefined) {
                requireEnumMember(trigger.currency, EnyoCurrencyEnum, 'BelowPriceLimit trigger.currency');
            }
            break;
        case EnyoAutomationTriggerTypeEnum.CheapestShareOfDay:
            if (
                typeof trigger.sharePercent !== 'number' ||
                !Number.isInteger(trigger.sharePercent) ||
                trigger.sharePercent < AUTOMATION_MIN_CHEAPEST_SHARE_PERCENT ||
                trigger.sharePercent > AUTOMATION_MAX_CHEAPEST_SHARE_PERCENT
            ) {
                throw new AutomationValidationError(
                    `CheapestShareOfDay trigger.sharePercent must be an integer between ${AUTOMATION_MIN_CHEAPEST_SHARE_PERCENT} and ${AUTOMATION_MAX_CHEAPEST_SHARE_PERCENT}.`,
                );
            }
            break;
        case EnyoAutomationTriggerTypeEnum.Schedule:
            validateScheduleTrigger(trigger);
            break;
        default:
            throw new AutomationValidationError(
                `Automation.trigger.type is invalid: ${(trigger as {type?: unknown}).type}.`,
            );
    }
}

/**
 * Validates a single automation action. Throws on the first violation.
 *
 * @param action - The action to validate.
 * @param index - Index of the action within its automation (for error messages).
 * @param knownSmartPlugApplianceIds - Optional set of appliance ids that support
 *   the smart-plug-switch action.
 * @throws {AutomationValidationError} On the first invariant violation.
 */
export function validateAction(
    action: EnyoAutomationAction,
    index = 0,
    knownSmartPlugApplianceIds?: Set<string>,
): void {
    const label = `Automation.actions[${index}]`;
    if (!action || typeof action !== 'object') {
        throw new AutomationValidationError(`${label} must be an object.`);
    }
    requireEnumMember(action.schedulingMode, EnyoAutomationSchedulingModeEnum, `${label}.schedulingMode`);
    requireEnumMember(action.targetKind, EnyoAutomationTargetKindEnum, `${label}.targetKind`);

    switch (action.type) {
        case EnyoAutomationActionTypeEnum.Mqtt:
            validateMqttAction(action, label);
            break;
        case EnyoAutomationActionTypeEnum.SmartPlugSwitch:
            validateSmartPlugSwitchAction(action, label, knownSmartPlugApplianceIds);
            break;
        default:
            throw new AutomationValidationError(
                `${label}.type is invalid: ${(action as {type?: unknown}).type}.`,
            );
    }
}

/**
 * Validates an {@link EnyoAutomationForecast}: resolution must be known and the
 * entries must be chronologically ordered, non-overlapping, and spaced exactly
 * one resolution step apart. Throws on the first violation.
 *
 * @param forecast - The forecast to validate.
 * @throws {AutomationValidationError} On the first invariant violation.
 */
export function validateAutomationForecast(forecast: EnyoAutomationForecast): void {
    if (!forecast || typeof forecast !== 'object') {
        throw new AutomationValidationError('AutomationForecast must be an object.');
    }
    requireNonEmptyString(forecast.automationId, 'AutomationForecast.automationId');

    const stepSeconds = FORECAST_RESOLUTION_SECONDS[forecast.resolution];
    if (stepSeconds === undefined) {
        throw new AutomationValidationError(
            `AutomationForecast.resolution is invalid: ${forecast.resolution}.`,
        );
    }
    if (!Array.isArray(forecast.entries)) {
        throw new AutomationValidationError('AutomationForecast.entries must be an array.');
    }

    let previousMs: number | undefined;
    forecast.entries.forEach((entry, index) => {
        const entryLabel = `AutomationForecast.entries[${index}]`;
        if (!entry || typeof entry !== 'object') {
            throw new AutomationValidationError(`${entryLabel} must be an object.`);
        }
        if (typeof entry.active !== 'boolean') {
            throw new AutomationValidationError(`${entryLabel}.active must be a boolean.`);
        }
        const currentMs = Date.parse(entry.timestampIso);
        if (Number.isNaN(currentMs)) {
            throw new AutomationValidationError(
                `${entryLabel}.timestampIso is not a valid ISO 8601 timestamp: ${entry.timestampIso}.`,
            );
        }
        if (previousMs !== undefined) {
            const deltaSeconds = (currentMs - previousMs) / 1000;
            if (deltaSeconds !== stepSeconds) {
                throw new AutomationValidationError(
                    `${entryLabel} is spaced ${deltaSeconds}s from the previous entry; expected ${stepSeconds}s for resolution ${forecast.resolution}.`,
                );
            }
        }
        previousMs = currentMs;
    });
}

/**
 * Validates the trigger-type-specific metadata carried by the
 * `AutomationTriggerV1` data-bus message. Throws on the first violation.
 *
 * @param trigger - The trigger metadata payload.
 * @throws {AutomationValidationError} On the first invariant violation.
 */
export function validateAutomationTriggerData(trigger: EnyoAutomationTriggerData): void {
    if (!trigger || typeof trigger !== 'object') {
        throw new AutomationValidationError('AutomationTriggerData must be an object.');
    }
    switch (trigger.triggerType) {
        case EnyoAutomationTriggerTypeEnum.PvSurplusThreshold:
        case EnyoAutomationTriggerTypeEnum.PvSurplusBelowThreshold:
            requireFiniteNonNegative(trigger.surplusW, 'AutomationTriggerData.surplusW');
            requireFiniteNonNegative(trigger.thresholdW, 'AutomationTriggerData.thresholdW');
            break;
        case EnyoAutomationTriggerTypeEnum.BelowPriceLimit:
            requireFinite(trigger.pricePerKwh, 'AutomationTriggerData.pricePerKwh');
            requireFinite(trigger.limitPerKwh, 'AutomationTriggerData.limitPerKwh');
            requireEnumMember(trigger.currency, EnyoCurrencyEnum, 'AutomationTriggerData.currency');
            break;
        case EnyoAutomationTriggerTypeEnum.CheapestShareOfDay:
            requireFinite(trigger.pricePerKwh, 'AutomationTriggerData.pricePerKwh');
            requireFinite(trigger.thresholdPricePerKwh, 'AutomationTriggerData.thresholdPricePerKwh');
            if (
                typeof trigger.sharePercent !== 'number' ||
                !Number.isInteger(trigger.sharePercent) ||
                trigger.sharePercent < AUTOMATION_MIN_CHEAPEST_SHARE_PERCENT ||
                trigger.sharePercent > AUTOMATION_MAX_CHEAPEST_SHARE_PERCENT
            ) {
                throw new AutomationValidationError(
                    `AutomationTriggerData.sharePercent must be an integer between ${AUTOMATION_MIN_CHEAPEST_SHARE_PERCENT} and ${AUTOMATION_MAX_CHEAPEST_SHARE_PERCENT}.`,
                );
            }
            requireEnumMember(trigger.currency, EnyoCurrencyEnum, 'AutomationTriggerData.currency');
            break;
        case EnyoAutomationTriggerTypeEnum.Schedule:
            if (trigger.windowIndex !== undefined && (!Number.isInteger(trigger.windowIndex) || trigger.windowIndex < 0)) {
                throw new AutomationValidationError(
                    'AutomationTriggerData.windowIndex must be an integer >= 0.',
                );
            }
            requireOptionalIsoTimestamp(trigger.windowStartIso, 'AutomationTriggerData.windowStartIso');
            requireOptionalIsoTimestamp(trigger.windowEndIso, 'AutomationTriggerData.windowEndIso');
            break;
        default:
            throw new AutomationValidationError(
                `AutomationTriggerData.triggerType is invalid: ${(trigger as {triggerType?: unknown}).triggerType}.`,
            );
    }
}

/**
 * Validates the windows of a {@link EnyoAutomationTriggerTypeEnum.Schedule}
 * ("Zeitplan") trigger: at least one window, well-formed `HH:mm` times that do
 * not start and end at the same minute, weekday numbers in range, and a valid
 * IANA timezone when given. Windows are a union and may overlap, so no overlap
 * check is performed.
 */
function validateScheduleTrigger(trigger: EnyoAutomationScheduleTrigger): void {
    if (!Array.isArray(trigger.windows) || trigger.windows.length === 0) {
        throw new AutomationValidationError(
            'Schedule trigger.windows must contain at least one window.',
        );
    }
    trigger.windows.forEach((window, index) => {
        const label = `Schedule trigger.windows[${index}]`;
        if (!window || typeof window !== 'object') {
            throw new AutomationValidationError(`${label} must be an object.`);
        }
        const start = parseTimeOfDay(window.startTimeOfDay);
        if (start === null) {
            throw new AutomationValidationError(
                `${label}.startTimeOfDay must be a 24-hour 'HH:mm' time, got '${window.startTimeOfDay}'.`,
            );
        }
        const end = parseTimeOfDay(window.endTimeOfDay);
        if (end === null) {
            throw new AutomationValidationError(
                `${label}.endTimeOfDay must be a 24-hour 'HH:mm' time, got '${window.endTimeOfDay}'.`,
            );
        }
        if (start === end) {
            throw new AutomationValidationError(
                `${label} must not start and end at the same time of day.`,
            );
        }
        if (window.daysOfWeek !== undefined) {
            if (!Array.isArray(window.daysOfWeek) || window.daysOfWeek.length === 0) {
                throw new AutomationValidationError(
                    `${label}.daysOfWeek must not be empty — omit it for 'every day'.`,
                );
            }
            const seenDays = new Set<number>();
            for (const day of window.daysOfWeek) {
                if (!Number.isInteger(day) || day < 0 || day > 6) {
                    throw new AutomationValidationError(
                        `${label}.daysOfWeek must contain integers 0 (Sunday) to 6 (Saturday), got ${day}.`,
                    );
                }
                if (seenDays.has(day)) {
                    throw new AutomationValidationError(
                        `${label}.daysOfWeek contains the duplicate day ${day}.`,
                    );
                }
                seenDays.add(day);
            }
        }
    });
    if (trigger.timezone !== undefined) {
        requireNonEmptyString(trigger.timezone, 'Schedule trigger.timezone');
        try {
            new Intl.DateTimeFormat('en-US', {timeZone: trigger.timezone});
        } catch {
            throw new AutomationValidationError(
                `Schedule trigger.timezone must be a valid IANA time zone identifier, got '${trigger.timezone}'.`,
            );
        }
    }
}

function validateMqttAction(action: EnyoAutomationMqttAction, label: string): void {
    requireNonEmptyString(action.topic, `${label}.topic`);
    if (typeof action.updateChargingPvSurplus !== 'boolean') {
        throw new AutomationValidationError(`${label}.updateChargingPvSurplus must be a boolean.`);
    }
    if (typeof action.payloadTemplate !== 'string' || action.payloadTemplate.length === 0) {
        throw new AutomationValidationError(`${label}.payloadTemplate must be a non-empty string.`);
    }
    validatePayloadTemplate(action.payloadTemplate, `${label}.payloadTemplate`);
    const {qos} = action.publishOptions ?? {};
    if (qos !== undefined && qos !== MqttQos.AtMostOnce && qos !== MqttQos.AtLeastOnce && qos !== MqttQos.ExactlyOnce) {
        throw new AutomationValidationError(
            `${label}.publishOptions.qos must be one of 0, 1, 2.`,
        );
    }
    if (action.publishOptions?.retain !== undefined && typeof action.publishOptions.retain !== 'boolean') {
        throw new AutomationValidationError(`${label}.publishOptions.retain must be a boolean.`);
    }
}

function validateSmartPlugSwitchAction(
    action: EnyoAutomationSmartPlugSwitchAction,
    label: string,
    knownSmartPlugApplianceIds?: Set<string>,
): void {
    requireNonEmptyString(action.applianceId, `${label}.applianceId`);
    if (knownSmartPlugApplianceIds && !knownSmartPlugApplianceIds.has(action.applianceId)) {
        throw new AutomationValidationError(
            `${label}.applianceId does not reference a smart-plug appliance that supports the smart-plug-switch action: ${action.applianceId}.`,
        );
    }
    const {minDurationMinutes} = action;
    // Short runtimes (1-5 minutes) are allowed at whole-minute granularity so a
    // one-minute pulse can be configured; anything longer keeps the 5-minute step.
    const isWholeMinutesInRange =
        typeof minDurationMinutes === 'number' &&
        Number.isInteger(minDurationMinutes) &&
        minDurationMinutes >= AUTOMATION_MIN_DURATION_MINUTES &&
        minDurationMinutes <= AUTOMATION_MAX_DURATION_MINUTES;
    const matchesStep =
        minDurationMinutes <= AUTOMATION_DURATION_STEP_MINUTES ||
        minDurationMinutes % AUTOMATION_DURATION_STEP_MINUTES === 0;
    if (!isWholeMinutesInRange || !matchesStep) {
        throw new AutomationValidationError(
            `${label}.minDurationMinutes must be an integer between ${AUTOMATION_MIN_DURATION_MINUTES} and ${AUTOMATION_MAX_DURATION_MINUTES}; values above ${AUTOMATION_DURATION_STEP_MINUTES} must be a multiple of ${AUTOMATION_DURATION_STEP_MINUTES}.`,
        );
    }
}

/**
 * Ensures a payload template only references known placeholders and is
 * structurally valid JSON once its placeholders are neutralised.
 */
function validatePayloadTemplate(template: string, label: string): void {
    const knownPlaceholders = new Set<string>(Object.values(EnyoAutomationMqttPlaceholderEnum));
    const tokens = template.match(/{{[^}]*}}/g) ?? [];
    for (const token of tokens) {
        if (!knownPlaceholders.has(token)) {
            throw new AutomationValidationError(
                `${label} references an unknown placeholder: ${token}. Allowed: ${Object.values(
                    EnyoAutomationMqttPlaceholderEnum,
                ).join(', ')}.`,
            );
        }
    }
    // Replace every placeholder with a neutral JSON scalar so the surrounding
    // structure can be validated regardless of the placeholder's runtime value.
    const neutralised = template.replace(/{{[^}]*}}/g, '0');
    try {
        JSON.parse(neutralised);
    } catch {
        throw new AutomationValidationError(
            `${label} is not valid JSON once placeholders are substituted.`,
        );
    }
}

function requireOptionalIsoTimestamp(value: unknown, label: string): void {
    if (value === undefined) {
        return;
    }
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
        throw new AutomationValidationError(
            `${label} must be a valid ISO 8601 timestamp: ${String(value)}.`,
        );
    }
}

function requireFinite(value: unknown, label: string): void {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new AutomationValidationError(`${label} must be a finite number.`);
    }
}

function requireFiniteNonNegative(value: unknown, label: string): void {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new AutomationValidationError(`${label} must be a finite number >= 0.`);
    }
}

function requireNonEmptyString(value: unknown, label: string): void {
    if (typeof value !== 'string' || value.length === 0) {
        throw new AutomationValidationError(`${label} must be a non-empty string.`);
    }
}

function requireEnumMember(value: unknown, enumObject: Record<string, string>, label: string): void {
    const allowed = new Set<string>(Object.values(enumObject));
    if (typeof value !== 'string' && typeof value !== 'number') {
        throw new AutomationValidationError(`${label} is required.`);
    }
    if (!allowed.has(value as string)) {
        throw new AutomationValidationError(
            `${label} is invalid: ${value}. Allowed values: ${Object.values(enumObject).join(', ')}.`,
        );
    }
}
