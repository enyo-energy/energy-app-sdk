import {describe, expect, it} from 'vitest';
import {
    EnyoDeviceTestApplianceDispositionEnum,
    EnyoDeviceTestOriginEnum,
    EnyoDeviceTestOutcomeEnum,
    type EnyoDeviceTestRequest,
    type EnyoDeviceTestResult,
} from '../../../types/enyo-device-test.js';
import {EnyoApplianceTypeEnum} from '../../../types/enyo-appliance.js';
import type {EnyoNetworkDevice} from '../../../types/enyo-network-device.js';
import {
    aggregateDeviceTestOutcome,
    assertValidDeviceTestResult,
    DeviceTestValidationError,
    validateDeviceTestResult,
} from '../device-test-validators.js';

/** Minimal detected device fixture. */
const device = (id: string): EnyoNetworkDevice => ({
    id,
    hostname: `${id}.local`,
    ipAddress: '192.168.1.10',
    isOnline: true,
    lastSeen: new Date(0),
    accessStatus: 'granted',
    detectedAt: [],
});

const request = (...ids: string[]): EnyoDeviceTestRequest => ({
    requestId: 'req-1',
    devices: ids.map(device),
    origin: EnyoDeviceTestOriginEnum.OnboardingGuide,
    timeoutMs: 30_000,
});

/** A result in which one device produced one freshly created appliance. */
function createdResult(): EnyoDeviceTestResult {
    return {
        requestId: 'req-1',
        outcome: EnyoDeviceTestOutcomeEnum.AppliancesCreated,
        devices: [{networkDeviceId: 'dev-1', outcome: EnyoDeviceTestOutcomeEnum.AppliancesCreated}],
        appliances: [
            {
                applianceId: 'app-1',
                applianceType: EnyoApplianceTypeEnum.Inverter,
                disposition: EnyoDeviceTestApplianceDispositionEnum.Created,
                networkDeviceId: 'dev-1',
            },
        ],
    };
}

describe('aggregateDeviceTestOutcome', () => {
    it('lets a success dominate a sibling device failure', () => {
        expect(
            aggregateDeviceTestOutcome([
                {networkDeviceId: 'a', outcome: EnyoDeviceTestOutcomeEnum.Unreachable},
                {networkDeviceId: 'b', outcome: EnyoDeviceTestOutcomeEnum.AppliancesCreated},
            ]),
        ).toBe(EnyoDeviceTestOutcomeEnum.AppliancesCreated);
    });

    it('prefers an actionable outcome over an unactionable one', () => {
        expect(
            aggregateDeviceTestOutcome([
                {networkDeviceId: 'a', outcome: EnyoDeviceTestOutcomeEnum.NotSupported},
                {networkDeviceId: 'b', outcome: EnyoDeviceTestOutcomeEnum.AuthenticationRequired},
            ]),
        ).toBe(EnyoDeviceTestOutcomeEnum.AuthenticationRequired);
    });

    it('ranks a created appliance above one that already existed', () => {
        expect(
            aggregateDeviceTestOutcome([
                {networkDeviceId: 'a', outcome: EnyoDeviceTestOutcomeEnum.AppliancesAlreadyExisted},
                {networkDeviceId: 'b', outcome: EnyoDeviceTestOutcomeEnum.AppliancesCreated},
            ]),
        ).toBe(EnyoDeviceTestOutcomeEnum.AppliancesCreated);
    });

    it('treats an empty device list as a failure', () => {
        expect(aggregateDeviceTestOutcome([])).toBe(EnyoDeviceTestOutcomeEnum.Failed);
    });
});

describe('validateDeviceTestResult', () => {
    it('accepts a consistent result', () => {
        const {ok, errors, warnings} = validateDeviceTestResult(createdResult(), request('dev-1'));
        expect(errors).toEqual([]);
        expect(warnings).toEqual([]);
        expect(ok).toBe(true);
    });

    it('rejects appliances-created without a created appliance', () => {
        const result = createdResult();
        result.appliances[0].disposition = EnyoDeviceTestApplianceDispositionEnum.AlreadyExisted;
        const {ok, errors} = validateDeviceTestResult(result);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('no appliance has disposition `created`'))).toBe(true);
    });

    it('rejects appliances-already-existed when something was created', () => {
        const result = createdResult();
        result.outcome = EnyoDeviceTestOutcomeEnum.AppliancesAlreadyExisted;
        const {ok, errors} = validateDeviceTestResult(result);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('use `appliances-created`'))).toBe(true);
    });

    it('rejects appliances reported under a failure outcome', () => {
        const result = createdResult();
        result.outcome = EnyoDeviceTestOutcomeEnum.Unreachable;
        result.devices[0].outcome = EnyoDeviceTestOutcomeEnum.Unreachable;
        const {ok, errors} = validateDeviceTestResult(result);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('contradictory'))).toBe(true);
    });

    it('rejects an appliance pointing at an untested device', () => {
        const result = createdResult();
        result.appliances[0].networkDeviceId = 'dev-9';
        const {ok, errors} = validateDeviceTestResult(result);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('not among the tested devices'))).toBe(true);
    });

    it('rejects a requestId that does not match the request', () => {
        const {ok, errors} = validateDeviceTestResult(createdResult(), {
            ...request('dev-1'),
            requestId: 'other',
        });
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('does not match'))).toBe(true);
    });

    it('rejects a verdict for a device that was not requested', () => {
        const result = createdResult();
        const {ok, errors} = validateDeviceTestResult(result, request('dev-2'));
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('was not part of the request'))).toBe(true);
    });

    it('rejects an empty devices array', () => {
        const {ok, errors} = validateDeviceTestResult({...createdResult(), devices: []});
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('one entry per tested device'))).toBe(true);
    });

    it('rejects duplicate device verdicts', () => {
        const result = createdResult();
        result.devices.push({...result.devices[0]});
        const {ok, errors} = validateDeviceTestResult(result);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('duplicate networkDeviceId'))).toBe(true);
    });

    it('warns about a device left without a verdict', () => {
        const {ok, warnings} = validateDeviceTestResult(createdResult(), request('dev-1', 'dev-2'));
        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('no verdict reported for requested device "dev-2"'))).toBe(true);
    });

    it('warns when the aggregate disagrees with the per-device verdicts', () => {
        const result = createdResult();
        result.devices[0].outcome = EnyoDeviceTestOutcomeEnum.AppliancesAlreadyExisted;
        const {warnings} = validateDeviceTestResult(result);
        expect(warnings.some((w) => w.includes('aggregateDeviceTestOutcome'))).toBe(true);
    });

    it('warns when an actionable outcome carries no installer-facing message', () => {
        const {warnings} = validateDeviceTestResult({
            requestId: 'req-1',
            outcome: EnyoDeviceTestOutcomeEnum.UserActionRequired,
            devices: [{networkDeviceId: 'dev-1', outcome: EnyoDeviceTestOutcomeEnum.UserActionRequired}],
            appliances: [],
        });
        expect(warnings.some((w) => w.includes('no translated `message`'))).toBe(true);
    });
});

describe('assertValidDeviceTestResult', () => {
    it('returns the result when valid', () => {
        const result = createdResult();
        expect(assertValidDeviceTestResult(result)).toBe(result);
    });

    it('throws DeviceTestValidationError with the errors when invalid', () => {
        let thrown: unknown;
        try {
            assertValidDeviceTestResult({...createdResult(), devices: []});
        } catch (e) {
            thrown = e;
        }
        expect(thrown).toBeInstanceOf(DeviceTestValidationError);
        expect((thrown as DeviceTestValidationError).errors.length).toBeGreaterThan(0);
    });
});
