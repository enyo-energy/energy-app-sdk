import {describe, expect, it} from 'vitest';
import {
    EnyoOnboardingV2StartVariant,
    type EnyoOnboardingV2Guide,
} from '../../../types/enyo-onboarding-v2.js';
import type {EnyoOnboardingV2GuidesResult} from '../../../types/enyo-onboarding-v2-provider.js';
import {
    defineOnboardingGuideV2,
    onboardingV2Block,
    onboardingV2Target,
    onContinueV2,
} from '../define-onboarding-guide-v2.js';
import {
    assertValidOnboardingV2GuidesResult,
    OnboardingV2GuidesValidationError,
    validateOnboardingV2GuidesResult,
} from '../onboarding-v2-provider-validators.js';

/** Translated content pair, as every author-facing string requires. */
const t = (de: string, en: string) => [
    {language: 'de', value: de},
    {language: 'en', value: en},
];

/** A minimal, structurally valid guide with one step that ends in success. */
const guide = (
    overrides: Partial<EnyoOnboardingV2Guide> = {},
): EnyoOnboardingV2Guide =>
    defineOnboardingGuideV2({
        title: t('Einrichtung', 'Setup'),
        startVariant: EnyoOnboardingV2StartVariant.DeviceFoundConfig,
        startStepId: 's1',
        vendorId: 'acme',
        modelIds: ['ac22'],
        steps: [
            {
                id: 's1',
                name: 'intro',
                title: t('Los geht’s', 'Get started'),
                blocks: [onboardingV2Block.text('b1', t('Hallo', 'Hello'))],
                transitions: [onContinueV2(onboardingV2Target.success())],
            },
        ],
        ...overrides,
    });

const result = (guides: EnyoOnboardingV2Guide[]): EnyoOnboardingV2GuidesResult => ({
    requestId: 'req-1',
    guides,
});

describe('validateOnboardingV2GuidesResult', () => {
    it('accepts a well-formed answer without warnings', () => {
        const {ok, errors, warnings} = validateOnboardingV2GuidesResult(result([guide()]));

        expect(ok).toBe(true);
        expect(errors).toEqual([]);
        expect(warnings).toEqual([]);
    });

    it('requires a requestId echoing the request', () => {
        const {ok, errors} = validateOnboardingV2GuidesResult({
            ...result([guide()]),
            requestId: '',
        });

        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('requestId'))).toBe(true);
    });

    it('rejects a non-array `guides` rather than treating it as "nothing"', () => {
        const {ok, errors} = validateOnboardingV2GuidesResult({
            requestId: 'req-1',
        } as unknown as EnyoOnboardingV2GuidesResult);

        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('`guides` must be an array'))).toBe(true);
    });

    it('warns that an empty answer retires the cached guides', () => {
        const {ok, warnings} = validateOnboardingV2GuidesResult(result([]));

        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('retires every guide'))).toBe(true);
    });

    it('surfaces a guide-level error prefixed with the guide position', () => {
        const {ok, errors} = validateOnboardingV2GuidesResult(
            result([guide({startStepId: 'nope'})]),
        );

        expect(ok).toBe(false);
        expect(errors.some((e) => e.startsWith('guides[0] ("Einrichtung"): '))).toBe(true);
        expect(errors.some((e) => e.includes('startStepId'))).toBe(true);
    });

    it('errors when two guides claim the same vendor, model and start variant', () => {
        const {ok, errors} = validateOnboardingV2GuidesResult(result([guide(), guide()]));

        expect(ok).toBe(false);
        expect(
            errors.some((e) => e.includes('binding "acme|ac22|device-found-config" is already claimed')),
        ).toBe(true);
    });

    it('allows the same vendor and model on different start variants', () => {
        const {ok} = validateOnboardingV2GuidesResult(
            result([
                guide(),
                guide({startVariant: EnyoOnboardingV2StartVariant.DeviceNotFound}),
            ]),
        );

        expect(ok).toBe(true);
    });

    it('detects a collision on a single overlapping model', () => {
        const {ok, errors} = validateOnboardingV2GuidesResult(
            result([guide({modelIds: ['ac11', 'ac22']}), guide({modelIds: ['ac22', 'ac33']})]),
        );

        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('acme|ac22|device-found-config'))).toBe(true);
    });

    it('warns about a guide that names no vendor, since it can never be selected', () => {
        const {ok, warnings} = validateOnboardingV2GuidesResult(
            result([guide({vendorId: undefined})]),
        );

        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('no vendorId'))).toBe(true);
    });

    it('warns about a vendor-wide guide and collides it with another vendor-wide one', () => {
        const vendorWide = guide({modelIds: undefined});
        const single = validateOnboardingV2GuidesResult(result([vendorWide]));
        expect(single.ok).toBe(true);
        expect(single.warnings.some((w) => w.includes('no modelIds'))).toBe(true);

        const pair = validateOnboardingV2GuidesResult(result([vendorWide, guide({modelIds: undefined})]));
        expect(pair.ok).toBe(false);
        expect(pair.errors.some((e) => e.includes('acme|*|device-found-config'))).toBe(true);
    });
});

describe('assertValidOnboardingV2GuidesResult', () => {
    it('returns the answer unchanged when it is valid', () => {
        const answer = result([guide()]);
        expect(assertValidOnboardingV2GuidesResult(answer)).toBe(answer);
    });

    it('throws with every blocking error attached', () => {
        expect(() => assertValidOnboardingV2GuidesResult(result([guide(), guide()]))).toThrow(
            OnboardingV2GuidesValidationError,
        );

        try {
            assertValidOnboardingV2GuidesResult(result([guide(), guide()]));
        } catch (error) {
            expect((error as OnboardingV2GuidesValidationError).errors.length).toBeGreaterThan(0);
        }
    });

    it('does not throw on warnings alone', () => {
        expect(() => assertValidOnboardingV2GuidesResult(result([]))).not.toThrow();
    });
});
