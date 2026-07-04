import {describe, expect, it} from 'vitest';
import {
    AutomationValidationError,
    validateAction,
    validateAutomation,
    validateAutomationForecast,
    validateAutomationTriggerData,
} from '../automation-validators.js';
import {
    EnyoAutomation,
    EnyoAutomationActionTypeEnum,
    EnyoAutomationForecast,
    EnyoAutomationSchedulingModeEnum,
    EnyoAutomationSmartPlugSwitchAction,
    EnyoAutomationTargetKindEnum,
    EnyoAutomationTriggerTypeEnum,
} from '../../../types/enyo-automation.js';

const smartPlugAction: EnyoAutomationSmartPlugSwitchAction = {
    id: 'switch-pump',
    type: EnyoAutomationActionTypeEnum.SmartPlugSwitch,
    schedulingMode: EnyoAutomationSchedulingModeEnum.Flexible,
    targetKind: EnyoAutomationTargetKindEnum.Load,
    applianceId: 'shelly-pool-ch0',
    minDurationMinutes: 10,
};

function baseAutomation(): EnyoAutomation {
    return {
        id: 'pool-pump',
        name: 'Pool pump on solar',
        enabled: true,
        trigger: {type: EnyoAutomationTriggerTypeEnum.PvSurplusThreshold, thresholdW: 2000},
        actions: [{...smartPlugAction}],
    };
}

describe('validateAutomation', () => {
    it('accepts the pool-pump example', () => {
        expect(() => validateAutomation(baseAutomation())).not.toThrow();
    });

    it('rejects a negative surplus threshold', () => {
        const automation = baseAutomation();
        automation.trigger = {type: EnyoAutomationTriggerTypeEnum.PvSurplusThreshold, thresholdW: -1};
        expect(() => validateAutomation(automation)).toThrow(AutomationValidationError);
    });

    it('rejects an empty action list', () => {
        const automation = baseAutomation();
        automation.actions = [];
        expect(() => validateAutomation(automation)).toThrow(/at least one action/);
    });

    it('rejects duplicate action ids', () => {
        const automation = baseAutomation();
        automation.actions = [{...smartPlugAction}, {...smartPlugAction}];
        expect(() => validateAutomation(automation)).toThrow(/not unique/);
    });

    it('enforces smart-plug appliance membership when known ids are given', () => {
        const automation = baseAutomation();
        expect(() => validateAutomation(automation, ['some-other-plug'])).toThrow(/smart-plug/);
        expect(() => validateAutomation(automation, ['shelly-pool-ch0'])).not.toThrow();
    });
});

describe('validateAction - smart plug min duration', () => {
    const build = (minDurationMinutes: number): EnyoAutomationSmartPlugSwitchAction => ({
        ...smartPlugAction,
        minDurationMinutes,
    });

    it('accepts 5-minute multiples within range', () => {
        expect(() => validateAction(build(5))).not.toThrow();
        expect(() => validateAction(build(360))).not.toThrow();
    });

    it('rejects values below the minimum, above the maximum, or off-step', () => {
        expect(() => validateAction(build(1))).toThrow(AutomationValidationError);
        expect(() => validateAction(build(0))).toThrow(AutomationValidationError);
        expect(() => validateAction(build(365))).toThrow(AutomationValidationError);
        expect(() => validateAction(build(7))).toThrow(/steps of 5/);
    });
});

describe('validateAction - mqtt template', () => {
    const mqtt = (payloadTemplate: string) => ({
        id: 'publish',
        type: EnyoAutomationActionTypeEnum.Mqtt as const,
        schedulingMode: EnyoAutomationSchedulingModeEnum.Mandatory,
        targetKind: EnyoAutomationTargetKindEnum.Load,
        topic: 'home/pool/cmd',
        updateChargingPvSurplus: true,
        payloadTemplate,
    });

    it('accepts a template with known placeholders (quoted and unquoted)', () => {
        expect(() =>
            validateAction(mqtt('{ "on": {{state}}, "surplusW": {{surplusW}}, "ts": "{{timestampIso}}" }')),
        ).not.toThrow();
    });

    it('rejects an unknown placeholder', () => {
        expect(() => validateAction(mqtt('{ "x": {{unknownToken}} }'))).toThrow(/unknown placeholder/);
    });

    it('rejects structurally invalid JSON', () => {
        expect(() => validateAction(mqtt('{ "on": {{state}} '))).toThrow(/not valid JSON/);
    });

    it('rejects an empty topic', () => {
        const action = mqtt('{ "on": {{state}} }');
        action.topic = '';
        expect(() => validateAction(action)).toThrow(/topic/);
    });
});

describe('validateAutomationTriggerData', () => {
    it('accepts valid PV-surplus trigger metadata', () => {
        expect(() =>
            validateAutomationTriggerData({
                triggerType: EnyoAutomationTriggerTypeEnum.PvSurplusThreshold,
                surplusW: 2400,
                thresholdW: 2000,
            }),
        ).not.toThrow();
    });

    it('rejects negative or non-finite metrics', () => {
        expect(() =>
            validateAutomationTriggerData({
                triggerType: EnyoAutomationTriggerTypeEnum.PvSurplusThreshold,
                surplusW: -1,
                thresholdW: 2000,
            }),
        ).toThrow(AutomationValidationError);
        expect(() =>
            validateAutomationTriggerData({
                triggerType: EnyoAutomationTriggerTypeEnum.PvSurplusThreshold,
                surplusW: 2400,
                thresholdW: Number.NaN,
            }),
        ).toThrow(/thresholdW/);
    });
});

describe('validateAutomationForecast', () => {
    const forecast = (entries: EnyoAutomationForecast['entries']): EnyoAutomationForecast => ({
        automationId: 'pool-pump',
        resolution: '15m',
        entries,
    });

    it('accepts entries spaced exactly one resolution step apart', () => {
        expect(() =>
            validateAutomationForecast(
                forecast([
                    {timestampIso: '2026-07-03T10:00:00.000Z', active: true},
                    {timestampIso: '2026-07-03T10:15:00.000Z', active: false},
                    {timestampIso: '2026-07-03T10:30:00.000Z', active: true},
                ]),
            ),
        ).not.toThrow();
    });

    it('rejects mis-spaced entries', () => {
        expect(() =>
            validateAutomationForecast(
                forecast([
                    {timestampIso: '2026-07-03T10:00:00.000Z', active: true},
                    {timestampIso: '2026-07-03T10:10:00.000Z', active: false},
                ]),
            ),
        ).toThrow(/expected 900s/);
    });

    it('rejects an invalid timestamp', () => {
        expect(() =>
            validateAutomationForecast(forecast([{timestampIso: 'not-a-date', active: true}])),
        ).toThrow(/ISO 8601/);
    });
});
