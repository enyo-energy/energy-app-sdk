import {describe, expect, it} from 'vitest';
import {
    EnyoCommandAcknowledgeAnswerEnum,
    EnyoDataBusMessageEnum,
    EnyoDataBusSetStorageControlV2,
    EnyoDataBusSetStorageScheduleV1,
    EnyoStorageControlDirectionEnum,
    EnyoStorageControlModeEnum,
    EnyoStorageScheduleDirectionEnum,
    EnyoStorageScheduleEntry,
    EnyoStorageScheduleModeEnum,
} from '../../../types/enyo-data-bus-value.js';
import {EnyoBatteryApplianceMetadata, EnyoBatteryFeature} from '../../../types/enyo-battery-appliance.js';
import {EnyoSourceEnum} from '../../../types/enyo-source.enum.js';
import {
    FullPowerGridChargeActionEnum,
    isFullPowerGridChargeOnly,
    isFullPowerGridChargeStoppable,
    validateFullPowerGridChargeControl,
    validateFullPowerGridChargeSchedule,
} from '../full-power-grid-charge-validators.js';

const {Accepted, NotSupported} = EnyoCommandAcknowledgeAnswerEnum;
const {StartGridCharge, Release} = FullPowerGridChargeActionEnum;

const senec: EnyoBatteryApplianceMetadata = {
    maxChargingPowerW: 2500,
    features: [EnyoBatteryFeature.GridChargeFullPowerOnly],
};

function control(
    mode: EnyoStorageControlModeEnum,
    ctrl?: {direction: EnyoStorageControlDirectionEnum; powerW: number},
): EnyoDataBusSetStorageControlV2 {
    return {
        id: 'cmd-1',
        type: 'message',
        message: EnyoDataBusMessageEnum.SetStorageControlV2,
        source: EnyoSourceEnum.Device,
        applianceId: 'battery-1',
        timestampIso: '2026-11-12T10:00:00.000Z',
        data: {mode, control: ctrl},
    };
}

function schedule(
    mode: EnyoStorageScheduleModeEnum,
    relativeSchedule?: EnyoStorageScheduleEntry[],
): EnyoDataBusSetStorageScheduleV1 {
    return {
        id: 'cmd-2',
        type: 'message',
        message: EnyoDataBusMessageEnum.SetStorageScheduleV1,
        source: EnyoSourceEnum.Device,
        applianceId: 'battery-1',
        timestampIso: '2026-11-12T10:00:00.000Z',
        data: {mode, relativeSchedule},
    };
}

describe('isFullPowerGridChargeOnly / isFullPowerGridChargeStoppable', () => {
    it('detects the feature', () => {
        expect(isFullPowerGridChargeOnly(senec)).toBe(true);
        expect(isFullPowerGridChargeOnly({features: [EnyoBatteryFeature.GridCharging]})).toBe(false);
        expect(isFullPowerGridChargeOnly(undefined)).toBe(false);
    });

    it('is only stoppable together with GridChargeFullPowerOnly', () => {
        expect(isFullPowerGridChargeStoppable(senec)).toBe(false);
        expect(isFullPowerGridChargeStoppable({
            features: [EnyoBatteryFeature.GridChargeFullPowerOnly, EnyoBatteryFeature.GridChargeFullPowerStoppable],
        })).toBe(true);
        expect(isFullPowerGridChargeStoppable({features: [EnyoBatteryFeature.GridChargeFullPowerStoppable]})).toBe(false);
    });
});

describe('validateFullPowerGridChargeControl', () => {
    it('accepts Auto as release', () => {
        expect(validateFullPowerGridChargeControl(control(EnyoStorageControlModeEnum.Auto), senec))
            .toEqual({answer: Accepted, action: Release});
    });

    it.each([2500, 3000])('accepts a charge at %s W as a full-power grid charge', (powerW) => {
        const result = validateFullPowerGridChargeControl(
            control(EnyoStorageControlModeEnum.Controlled, {direction: EnyoStorageControlDirectionEnum.Charge, powerW}),
            senec,
        );
        expect(result).toEqual({answer: Accepted, action: StartGridCharge});
    });

    it.each([0, 150, 2499, NaN])('does not support a charge at %s W', (powerW) => {
        const result = validateFullPowerGridChargeControl(
            control(EnyoStorageControlModeEnum.Controlled, {direction: EnyoStorageControlDirectionEnum.Charge, powerW}),
            senec,
        );
        expect(result.answer).toBe(NotSupported);
        expect(result.rejectionReason).toContain('full power');
    });

    it.each([
        {direction: EnyoStorageControlDirectionEnum.Hold, powerW: 0},
        {direction: EnyoStorageControlDirectionEnum.Discharge, powerW: 0},
        {direction: EnyoStorageControlDirectionEnum.Discharge, powerW: 2500},
    ])('does not support $direction at $powerW W', (ctrl) => {
        const result = validateFullPowerGridChargeControl(control(EnyoStorageControlModeEnum.Controlled, ctrl), senec);
        expect(result.answer).toBe(NotSupported);
        expect(result.action).toBeUndefined();
    });

    it('does not support Controlled without a control', () => {
        expect(validateFullPowerGridChargeControl(control(EnyoStorageControlModeEnum.Controlled), senec).answer)
            .toBe(NotSupported);
    });

    it('does not support a battery without the feature, even for Auto', () => {
        const result = validateFullPowerGridChargeControl(
            control(EnyoStorageControlModeEnum.Auto),
            {maxChargingPowerW: 2500, features: [EnyoBatteryFeature.GridCharging]},
        );
        expect(result.answer).toBe(NotSupported);
    });

    it.each([undefined, 0, -1, NaN])('does not support a maxChargingPowerW of %s', (maxChargingPowerW) => {
        const result = validateFullPowerGridChargeControl(
            control(EnyoStorageControlModeEnum.Auto),
            {...senec, maxChargingPowerW},
        );
        expect(result.answer).toBe(NotSupported);
        expect(result.rejectionReason).toContain('maxChargingPowerW');
    });
});

describe('validateFullPowerGridChargeSchedule', () => {
    it('accepts Auto as release', () => {
        expect(validateFullPowerGridChargeSchedule(schedule(EnyoStorageScheduleModeEnum.Auto), senec))
            .toEqual({answer: Accepted, action: Release});
    });

    it('accepts full-power charge and idle entries with one action per entry', () => {
        const result = validateFullPowerGridChargeSchedule(schedule(EnyoStorageScheduleModeEnum.Schedule, [
            {seconds: 0, direction: EnyoStorageScheduleDirectionEnum.Idle, powerW: 0},
            {seconds: 900, direction: EnyoStorageScheduleDirectionEnum.Charge, powerW: 2500},
            {seconds: 3600, direction: EnyoStorageScheduleDirectionEnum.Idle, powerW: 0},
        ]), senec);
        expect(result).toEqual({answer: Accepted, scheduleActions: [Release, StartGridCharge, Release]});
    });

    it.each([
        {direction: EnyoStorageScheduleDirectionEnum.Charge, powerW: 0},
        {direction: EnyoStorageScheduleDirectionEnum.Charge, powerW: 160},
        {direction: EnyoStorageScheduleDirectionEnum.Discharge, powerW: 0},
        {direction: EnyoStorageScheduleDirectionEnum.Discharge, powerW: 1000},
    ])('does not support a schedule containing $direction at $powerW W', (entry) => {
        const result = validateFullPowerGridChargeSchedule(schedule(EnyoStorageScheduleModeEnum.Schedule, [
            {seconds: 0, direction: EnyoStorageScheduleDirectionEnum.Charge, powerW: 2500},
            {seconds: 900, ...entry},
        ]), senec);
        expect(result.answer).toBe(NotSupported);
        expect(result.scheduleActions).toBeUndefined();
        expect(result.rejectionReason).toMatch(/^Entry 1:/);
    });

    it('does not support an empty schedule', () => {
        expect(validateFullPowerGridChargeSchedule(schedule(EnyoStorageScheduleModeEnum.Schedule, []), senec).answer)
            .toBe(NotSupported);
    });

    it('does not support a battery without the feature', () => {
        const result = validateFullPowerGridChargeSchedule(schedule(EnyoStorageScheduleModeEnum.Schedule, [
            {seconds: 0, direction: EnyoStorageScheduleDirectionEnum.Charge, powerW: 2500},
        ]), {maxChargingPowerW: 2500});
        expect(result.answer).toBe(NotSupported);
    });
});
