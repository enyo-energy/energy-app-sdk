import {describe, expect, it} from 'vitest';
import {EnyoOnboardingV2DynamicKind} from '../../../types/enyo-onboarding-v2.js';
import type {
    EnyoOnboardingV2DynamicRequest,
    EnyoOnboardingV2DynamicResult,
} from '../../../types/enyo-onboarding-v2-dynamic.js';
import {
    assertValidOnboardingV2DynamicResult,
    OnboardingV2DynamicValidationError,
    validateOnboardingV2DynamicResult,
} from '../onboarding-v2-dynamic-validators.js';

const request = (
    kind: EnyoOnboardingV2DynamicKind = EnyoOnboardingV2DynamicKind.OcppUrl,
): EnyoOnboardingV2DynamicRequest => ({
    requestId: 'req-1',
    kind,
    blockId: 'url',
    stepName: 'enter-ocpp-url',
    timeoutMs: 2000,
});

const answer = (
    value: string,
    kind: EnyoOnboardingV2DynamicKind = EnyoOnboardingV2DynamicKind.OcppUrl,
): EnyoOnboardingV2DynamicResult => ({requestId: 'req-1', kind, value});

describe('validateOnboardingV2DynamicResult — envelope', () => {
    it('accepts a well-formed secure OCPP URL', () => {
        const {ok, errors, warnings} = validateOnboardingV2DynamicResult(
            answer('wss://csms.enyo.energy/ocpp/16/abc123'),
            request(),
        );

        expect(ok).toBe(true);
        expect(errors).toEqual([]);
        expect(warnings).toEqual([]);
    });

    it('rejects a missing result rather than reading it as "unavailable"', () => {
        const {ok, errors} = validateOnboardingV2DynamicResult(
            undefined as unknown as EnyoOnboardingV2DynamicResult,
        );

        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('`null`'))).toBe(true);
    });

    it('requires a requestId and cross-checks it against the request', () => {
        expect(validateOnboardingV2DynamicResult({...answer('wss://a/b'), requestId: ''}).ok).toBe(false);

        const {ok, errors} = validateOnboardingV2DynamicResult(
            {...answer('wss://a/b'), requestId: 'other'},
            request(),
        );
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('does not match the request'))).toBe(true);
    });

    it('rejects a kind that is not an enum member', () => {
        const {ok, errors} = validateOnboardingV2DynamicResult({
            ...answer('wss://a/b'),
            kind: 'mac-address' as EnyoOnboardingV2DynamicKind,
        });

        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('not an EnyoOnboardingV2DynamicKind member'))).toBe(true);
    });

    it('rejects a kind that answers a different slot than was asked for', () => {
        const {ok, errors} = validateOnboardingV2DynamicResult(
            answer('192.168.1.42', EnyoOnboardingV2DynamicKind.DeviceIp),
            request(EnyoOnboardingV2DynamicKind.OcppUrl),
        );

        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('wrong slot'))).toBe(true);
    });

    it('rejects an empty value instead of treating it as "unavailable"', () => {
        const {ok, errors} = validateOnboardingV2DynamicResult(answer('   '), request());

        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('return `null`'))).toBe(true);
    });
});

describe('validateOnboardingV2DynamicResult — whitespace', () => {
    it('rejects surrounding whitespace, which survives a copy but breaks a paste', () => {
        const {ok, errors} = validateOnboardingV2DynamicResult(answer(' wss://a/b '), request());

        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('leading or trailing whitespace'))).toBe(true);
    });

    it('rejects whitespace inside the value', () => {
        const {ok, errors} = validateOnboardingV2DynamicResult(answer('wss://a/b c'), request());

        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('copy target, not prose'))).toBe(true);
    });
});

describe('validateOnboardingV2DynamicResult — ocpp-url', () => {
    it('rejects a value that is not an absolute URL', () => {
        const {ok, errors} = validateOnboardingV2DynamicResult(answer('csms.enyo.energy/ocpp'), request());

        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('not an absolute ws/wss/http(s) URL'))).toBe(true);
    });

    it('warns on a plaintext scheme but still accepts it', () => {
        const {ok, warnings} = validateOnboardingV2DynamicResult(answer('ws://10.0.0.5:8080/ocpp'), request());

        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('wss://'))).toBe(true);
    });

    it('accepts an https URL for menus that derive the websocket scheme', () => {
        const {ok, warnings} = validateOnboardingV2DynamicResult(answer('https://csms.enyo.energy/ocpp'), request());

        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });
});

describe('validateOnboardingV2DynamicResult — device-ip', () => {
    const ipRequest = request(EnyoOnboardingV2DynamicKind.DeviceIp);
    const ip = (value: string) => answer(value, EnyoOnboardingV2DynamicKind.DeviceIp);

    it('accepts a bare IPv4 address', () => {
        const {ok, warnings} = validateOnboardingV2DynamicResult(ip('192.168.1.42'), ipRequest);

        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });

    it('accepts a link to the device UI', () => {
        const {ok, warnings} = validateOnboardingV2DynamicResult(ip('http://192.168.1.42/ui'), ipRequest);

        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });

    it('warns — but does not block — on a hostname it cannot check', () => {
        const {ok, warnings} = validateOnboardingV2DynamicResult(ip('inverter.local'), ipRequest);

        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('neither an IPv4 address nor an http(s) URL'))).toBe(true);
    });

    it('warns on an out-of-range octet rather than accepting it as an address', () => {
        const {ok, warnings} = validateOnboardingV2DynamicResult(ip('192.168.1.256'), ipRequest);

        expect(ok).toBe(true);
        expect(warnings.length).toBeGreaterThan(0);
    });
});

describe('assertValidOnboardingV2DynamicResult', () => {
    it('returns the value unchanged when it is valid', () => {
        const value = answer('wss://csms.enyo.energy/ocpp/16/abc123');
        expect(assertValidOnboardingV2DynamicResult(value, request())).toBe(value);
    });

    it('throws with every blocking error attached', () => {
        try {
            assertValidOnboardingV2DynamicResult(answer('not a url'), request());
            expect.unreachable('should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(OnboardingV2DynamicValidationError);
            expect((error as OnboardingV2DynamicValidationError).errors.length).toBeGreaterThan(0);
        }
    });

    it('does not throw on warnings alone', () => {
        expect(() =>
            assertValidOnboardingV2DynamicResult(answer('ws://10.0.0.5/ocpp'), request()),
        ).not.toThrow();
    });
});
