import {describe, expect, it} from 'vitest';
import {
    EnyoBatteryChargeNowStateEnum,
    EnyoBatteryChargeNowStopReasonEnum,
    EnyoDataBusMessageEnum,
    EnyoDataBusRequestBatteryChargeNowV1,
} from '../../../types/enyo-data-bus-value.js';
import {EnyoBatteryFeature} from '../../../types/enyo-battery-appliance.js';
import {EnyoSourceEnum} from '../../../types/enyo-source.enum.js';
import {
    resolveBatteryChargeNowTargetSoc,
    validateBatteryChargeNowRequest,
} from '../battery-charge-now-validators.js';

const {Accepted, Rejected} = EnyoBatteryChargeNowStateEnum;

function request(data: EnyoDataBusRequestBatteryChargeNowV1['data'] = {}): EnyoDataBusRequestBatteryChargeNowV1 {
    return {
        id: 'req-1',
        type: 'message',
        message: EnyoDataBusMessageEnum.RequestBatteryChargeNowV1,
        source: EnyoSourceEnum.Cloud,
        applianceId: 'battery-1',
        timestampIso: '2026-11-01T10:00:00.000Z',
        data,
    };
}

describe('validateBatteryChargeNowRequest', () => {
    it('accepts a bare request and charges to 100 %', () => {
        expect(validateBatteryChargeNowRequest(request())).toEqual({state: Accepted, effectiveTargetSocPercent: 100});
    });

    it.each([0, 101, NaN])('rejects targetSocPercent %s as invalid', (targetSocPercent) => {
        expect(validateBatteryChargeNowRequest(request({targetSocPercent}))).toEqual({
            state: Rejected,
            stopReason: EnyoBatteryChargeNowStopReasonEnum.InvalidRequest,
            effectiveTargetSocPercent: undefined,
        });
    });

    it.each([0, -5, Infinity])('rejects maxDurationMinutes %s as invalid', (maxDurationMinutes) => {
        expect(validateBatteryChargeNowRequest(request({maxDurationMinutes})).stopReason)
            .toBe(EnyoBatteryChargeNowStopReasonEnum.InvalidRequest);
    });

    it('rejects when control is not allowed', () => {
        expect(validateBatteryChargeNowRequest(request(), {controlAllowed: false}).stopReason)
            .toBe(EnyoBatteryChargeNowStopReasonEnum.ControlNotAllowed);
    });

    it('rejects when the features list lacks ManualCharge', () => {
        expect(validateBatteryChargeNowRequest(request(), {features: [EnyoBatteryFeature.GridCharging]}).stopReason)
            .toBe(EnyoBatteryChargeNowStopReasonEnum.ControlNotAllowed);
    });

    it('accepts a battery without a features list', () => {
        expect(validateBatteryChargeNowRequest(request(), {}).state).toBe(Accepted);
    });

    it('caps the target at maxSoC', () => {
        expect(validateBatteryChargeNowRequest(request(), {maxSoC: 90, features: [EnyoBatteryFeature.ManualCharge]}))
            .toEqual({state: Accepted, effectiveTargetSocPercent: 90});
    });

    it('rejects when the battery already is at the effective target', () => {
        expect(validateBatteryChargeNowRequest(request({targetSocPercent: 80}), undefined, 80)).toEqual({
            state: Rejected,
            stopReason: EnyoBatteryChargeNowStopReasonEnum.AlreadyAtTarget,
            effectiveTargetSocPercent: 80,
        });
        expect(validateBatteryChargeNowRequest(request(), {maxSoC: 95}, 96).stopReason)
            .toBe(EnyoBatteryChargeNowStopReasonEnum.AlreadyAtTarget);
    });

    it('accepts when the battery is below the target', () => {
        expect(validateBatteryChargeNowRequest(request(), undefined, 42).state).toBe(Accepted);
    });
});

describe('resolveBatteryChargeNowTargetSoc', () => {
    it('defaults to 100 and takes the lower of target and maxSoC', () => {
        expect(resolveBatteryChargeNowTargetSoc(undefined)).toBe(100);
        expect(resolveBatteryChargeNowTargetSoc(70, {maxSoC: 90})).toBe(70);
        expect(resolveBatteryChargeNowTargetSoc(undefined, {maxSoC: 90})).toBe(90);
    });
});
