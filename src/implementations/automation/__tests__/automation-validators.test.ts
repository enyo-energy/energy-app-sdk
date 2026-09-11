import {describe, expect, it} from 'vitest';
import {
    AutomationValidationError,
    validateAction,
    validateAutomation,
    validateAutomationForecast,
    validateAutomationTriggerData,
    validateTrigger,
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
import {EnyoCurrencyEnum} from '../../../types/enyo-currency.js';

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

    it('accepts short runtimes down to one minute', () => {
        expect(() => validateAction(build(1))).not.toThrow();
        expect(() => validateAction(build(2))).not.toThrow();
        expect(() => validateAction(build(4))).not.toThrow();
    });

    it('rejects values below the minimum, above the maximum, or off-step', () => {
        expect(() => validateAction(build(0))).toThrow(AutomationValidationError);
        expect(() => validateAction(build(1.5))).toThrow(AutomationValidationError);
        expect(() => validateAction(build(365))).toThrow(AutomationValidationError);
        expect(() => validateAction(build(7))).toThrow(/multiple of 5/);
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

describe('validateTrigger - pv surplus below threshold', () => {
    it('accepts a "turn off at X Watt" trigger', () => {
        const automation = baseAutomation();
        automation.trigger = {
            type: EnyoAutomationTriggerTypeEnum.PvSurplusBelowThreshold,
            thresholdW: 3000,
        };
        expect(() => validateAutomation(automation)).not.toThrow();
    });

    it('rejects a negative threshold', () => {
        const automation = baseAutomation();
        automation.trigger = {
            type: EnyoAutomationTriggerTypeEnum.PvSurplusBelowThreshold,
            thresholdW: -1,
        };
        expect(() => validateAutomation(automation)).toThrow(/PvSurplusBelowThreshold/);
    });
});

describe('validateTrigger - below price limit', () => {
    it('accepts a limit with and without an explicit currency', () => {
        expect(() =>
            validateTrigger({
                type: EnyoAutomationTriggerTypeEnum.BelowPriceLimit,
                limitPerKwh: 0.2,
            }),
        ).not.toThrow();
        expect(() =>
            validateTrigger({
                type: EnyoAutomationTriggerTypeEnum.BelowPriceLimit,
                limitPerKwh: 0.2,
                currency: EnyoCurrencyEnum.EUR,
            }),
        ).not.toThrow();
    });

    it('accepts a negative limit, since dynamic prices can turn negative', () => {
        expect(() =>
            validateTrigger({
                type: EnyoAutomationTriggerTypeEnum.BelowPriceLimit,
                limitPerKwh: -0.05,
            }),
        ).not.toThrow();
    });

    it('rejects a non-finite limit and an unknown currency', () => {
        expect(() =>
            validateTrigger({
                type: EnyoAutomationTriggerTypeEnum.BelowPriceLimit,
                limitPerKwh: Number.NaN,
            }),
        ).toThrow(/limitPerKwh/);
        expect(() =>
            validateTrigger({
                type: EnyoAutomationTriggerTypeEnum.BelowPriceLimit,
                limitPerKwh: 0.2,
                currency: 'XXX' as EnyoCurrencyEnum,
            }),
        ).toThrow(/currency/);
    });
});

describe('validateTrigger - cheapest share of day', () => {
    it('accepts the cheapest 25 % of the day', () => {
        expect(() =>
            validateTrigger({
                type: EnyoAutomationTriggerTypeEnum.CheapestShareOfDay,
                sharePercent: 25,
            }),
        ).not.toThrow();
    });

    it('rejects shares outside 1-100 and non-integers', () => {
        expect(() =>
            validateTrigger({
                type: EnyoAutomationTriggerTypeEnum.CheapestShareOfDay,
                sharePercent: 0,
            }),
        ).toThrow(/sharePercent/);
        expect(() =>
            validateTrigger({
                type: EnyoAutomationTriggerTypeEnum.CheapestShareOfDay,
                sharePercent: 101,
            }),
        ).toThrow(/sharePercent/);
        expect(() =>
            validateTrigger({
                type: EnyoAutomationTriggerTypeEnum.CheapestShareOfDay,
                sharePercent: 25.5,
            }),
        ).toThrow(/sharePercent/);
    });
});

describe('validateTrigger - schedule (Zeitplan)', () => {
    it('accepts multiple windows with per-weekday selections', () => {
        expect(() =>
            validateTrigger({
                type: EnyoAutomationTriggerTypeEnum.Schedule,
                windows: [
                    {startTimeOfDay: '06:00', endTimeOfDay: '08:00', daysOfWeek: [1, 2, 3, 4, 5]},
                    {startTimeOfDay: '18:00', endTimeOfDay: '22:00', daysOfWeek: [1, 2, 3, 4, 5]},
                    {startTimeOfDay: '00:00', endTimeOfDay: '23:59', daysOfWeek: [0]},
                ],
                timezone: 'Europe/Berlin',
            }),
        ).not.toThrow();
    });

    it('accepts a window without weekdays and one that wraps past midnight', () => {
        expect(() =>
            validateTrigger({
                type: EnyoAutomationTriggerTypeEnum.Schedule,
                windows: [{startTimeOfDay: '22:00', endTimeOfDay: '06:00'}],
            }),
        ).not.toThrow();
    });

    it('rejects an empty window list', () => {
        expect(() =>
            validateTrigger({type: EnyoAutomationTriggerTypeEnum.Schedule, windows: []}),
        ).toThrow(/at least one window/);
    });

    it('rejects malformed times and zero-length windows', () => {
        expect(() =>
            validateTrigger({
                type: EnyoAutomationTriggerTypeEnum.Schedule,
                windows: [{startTimeOfDay: '6:00', endTimeOfDay: '08:00'}],
            }),
        ).toThrow(/startTimeOfDay/);
        expect(() =>
            validateTrigger({
                type: EnyoAutomationTriggerTypeEnum.Schedule,
                windows: [{startTimeOfDay: '06:00', endTimeOfDay: '24:00'}],
            }),
        ).toThrow(/endTimeOfDay/);
        expect(() =>
            validateTrigger({
                type: EnyoAutomationTriggerTypeEnum.Schedule,
                windows: [{startTimeOfDay: '06:00', endTimeOfDay: '06:00'}],
            }),
        ).toThrow(/same time of day/);
    });

    it('rejects invalid, empty or duplicated weekday lists', () => {
        expect(() =>
            validateTrigger({
                type: EnyoAutomationTriggerTypeEnum.Schedule,
                windows: [{startTimeOfDay: '06:00', endTimeOfDay: '08:00', daysOfWeek: []}],
            }),
        ).toThrow(/must not be empty/);
        expect(() =>
            validateTrigger({
                type: EnyoAutomationTriggerTypeEnum.Schedule,
                windows: [{startTimeOfDay: '06:00', endTimeOfDay: '08:00', daysOfWeek: [7]}],
            }),
        ).toThrow(/0 \(Sunday\) to 6 \(Saturday\)/);
        expect(() =>
            validateTrigger({
                type: EnyoAutomationTriggerTypeEnum.Schedule,
                windows: [{startTimeOfDay: '06:00', endTimeOfDay: '08:00', daysOfWeek: [1, 1]}],
            }),
        ).toThrow(/duplicate day/);
    });

    it('rejects an unknown timezone', () => {
        expect(() =>
            validateTrigger({
                type: EnyoAutomationTriggerTypeEnum.Schedule,
                windows: [{startTimeOfDay: '06:00', endTimeOfDay: '08:00'}],
                timezone: 'Mars/Olympus_Mons',
            }),
        ).toThrow(/IANA time zone/);
    });
});

describe('validateAutomationTriggerData - price triggers', () => {
    it('accepts below-price-limit metadata', () => {
        expect(() =>
            validateAutomationTriggerData({
                triggerType: EnyoAutomationTriggerTypeEnum.BelowPriceLimit,
                pricePerKwh: -0.01,
                limitPerKwh: 0.2,
                currency: EnyoCurrencyEnum.EUR,
            }),
        ).not.toThrow();
    });

    it('accepts cheapest-share-of-day metadata', () => {
        expect(() =>
            validateAutomationTriggerData({
                triggerType: EnyoAutomationTriggerTypeEnum.CheapestShareOfDay,
                pricePerKwh: 0.12,
                sharePercent: 25,
                thresholdPricePerKwh: 0.15,
                currency: EnyoCurrencyEnum.EUR,
            }),
        ).not.toThrow();
    });

    it('accepts pv-surplus-below-threshold metadata', () => {
        expect(() =>
            validateAutomationTriggerData({
                triggerType: EnyoAutomationTriggerTypeEnum.PvSurplusBelowThreshold,
                surplusW: 500,
                thresholdW: 3000,
            }),
        ).not.toThrow();
    });

    it('accepts schedule metadata and rejects a negative window index', () => {
        expect(() =>
            validateAutomationTriggerData({
                triggerType: EnyoAutomationTriggerTypeEnum.Schedule,
                windowIndex: 0,
                windowStartIso: '2026-07-03T06:00:00.000Z',
                windowEndIso: '2026-07-03T08:00:00.000Z',
            }),
        ).not.toThrow();
        expect(() =>
            validateAutomationTriggerData({
                triggerType: EnyoAutomationTriggerTypeEnum.Schedule,
                windowIndex: -1,
            }),
        ).toThrow(/windowIndex/);
        expect(() =>
            validateAutomationTriggerData({
                triggerType: EnyoAutomationTriggerTypeEnum.Schedule,
                windowStartIso: 'not-a-date',
            }),
        ).toThrow(/windowStartIso/);
    });

    it('rejects a missing currency on price metadata', () => {
        expect(() =>
            validateAutomationTriggerData({
                triggerType: EnyoAutomationTriggerTypeEnum.BelowPriceLimit,
                pricePerKwh: 0.1,
                limitPerKwh: 0.2,
                currency: undefined as unknown as EnyoCurrencyEnum,
            }),
        ).toThrow(/currency/);
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

    it('accepts a 1-minute resolution forecast', () => {
        expect(() =>
            validateAutomationForecast({
                automationId: 'pool-pump',
                resolution: '1m',
                entries: [
                    {timestampIso: '2026-07-03T10:00:00.000Z', active: true},
                    {timestampIso: '2026-07-03T10:01:00.000Z', active: false},
                ],
            }),
        ).not.toThrow();
    });

    it('rejects an invalid timestamp', () => {
        expect(() =>
            validateAutomationForecast(forecast([{timestampIso: 'not-a-date', active: true}])),
        ).toThrow(/ISO 8601/);
    });
});
