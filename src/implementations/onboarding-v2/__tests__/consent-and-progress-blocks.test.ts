import {describe, expect, it} from 'vitest';
import {
    EnyoOnboardingV2ConsentOutcome,
    EnyoOnboardingV2StartVariant,
    type EnyoOnboardingV2AdditionalSetupBlock,
    type EnyoOnboardingV2Block,
    type EnyoOnboardingV2ConsentBlock,
    type EnyoOnboardingV2Guide,
    type EnyoOnboardingV2Transition,
} from '../../../types/enyo-onboarding-v2.js';
import {ENYO_ONBOARDING_V2_SETUP_FAILED_OUTCOME} from '../../../types/enyo-onboarding-v2-additional-setup.js';
import {ENYO_ONBOARDING_V2_SETUP_MAX_DURATION_MS} from '../../../types/enyo-onboarding-v2-progress.js';
import {EnyoConsentGrantorEnum, type EnergyAppPackageConsent} from '../../../types/enyo-consent.js';
import {
    defineOnboardingGuideV2,
    onboardingV2Block,
    onboardingV2Target,
    onOptionV2,
    onOutcomeV2,
} from '../define-onboarding-guide-v2.js';
import {validateOnboardingGuideV2} from '../onboarding-v2-validators.js';
import {validatePackageOnboardingGuide} from '../package-onboarding-guide-validators.js';

const t = (de: string, en: string) => [
    {language: 'de' as const, value: de},
    {language: 'en' as const, value: en},
];

const consentDecl = (consentKey: string, required: boolean): EnergyAppPackageConsent => ({
    consentKey,
    version: '1',
    required,
    grantableBy: [EnyoConsentGrantorEnum.Customer],
    label: t('Ich stimme zu', 'I agree'),
    title: t('Titel', 'Title'),
    legalText: {sections: [{heading: t('Abschnitt', 'Section'), content: t('Text', 'Text')}]},
});

const CONSENTS = [consentDecl('hcu-backup', true), consentDecl('share-usage-data', false)];

const GIVEN = {id: 'given', value: EnyoOnboardingV2ConsentOutcome.Given, label: t('Zugestimmt', 'Agreed')};
const DECLINED = {id: 'declined', value: EnyoOnboardingV2ConsentOutcome.Declined, label: t('Abgelehnt', 'Declined')};

/** Wraps blocks in a one-step guide whose every handle leads to success. */
const guideWith = (blocks: EnyoOnboardingV2Block[], transitions: EnyoOnboardingV2Transition[]): EnyoOnboardingV2Guide =>
    defineOnboardingGuideV2({
        title: t('Setup', 'Setup'),
        startVariant: EnyoOnboardingV2StartVariant.ManualSetup,
        requiresNetworkScan: false,
        startStepId: 's1',
        steps: [{id: 's1', name: 'step', title: t('Schritt', 'Step'), blocks, transitions}],
    });

const consentGuide = (overrides: Partial<EnyoOnboardingV2ConsentBlock> = {}) => {
    const block = {
        ...(onboardingV2Block.consent('consent', ['hcu-backup', 'share-usage-data'], {
            cta: t('Zustimmen', 'Agree'),
            outcomes: [GIVEN, DECLINED],
        }) as EnyoOnboardingV2ConsentBlock),
        ...overrides,
    };
    return guideWith(
        [block],
        block.outcomes.map((o) => onOutcomeV2('consent', o.id, onboardingV2Target.success())),
    );
};

const setupGuide = (overrides: Partial<EnyoOnboardingV2AdditionalSetupBlock> = {}) => {
    const block = {
        ...(onboardingV2Block.additionalSetup('connect', 'connect-hcu', {
            cta: t('HCU verbinden', 'Connect the HCU'),
            description: t('Verbindet die HCU.', 'Connects the HCU.'),
            outcomes: [
                {id: 'ok', value: 'connected', label: t('Verbunden', 'Connected')},
                {id: 'failed', value: ENYO_ONBOARDING_V2_SETUP_FAILED_OUTCOME, label: t('Fehler', 'Failed')},
            ],
            consentKeys: ['hcu-backup'],
            progressPhases: [
                {key: 'backup', label: t('Backup', 'Backup')},
                {key: 'developer-mode', label: t('Entwicklermodus', 'Developer mode')},
                {key: 'verify', label: t('Prüfen', 'Verify')},
            ],
            maxDurationMs: 5 * 60_000,
        }) as EnyoOnboardingV2AdditionalSetupBlock),
        ...overrides,
    };
    return guideWith(
        [block],
        block.outcomes.map((o) => onOutcomeV2('connect', o.id, onboardingV2Target.success())),
    );
};

describe('consent block', () => {
    it('validates a fully wired block against the package consents', () => {
        const {ok, errors, warnings} = validateOnboardingGuideV2(consentGuide(), {consents: CONSENTS});
        expect(errors).toEqual([]);
        expect(warnings).toEqual([]);
        expect(ok).toBe(true);
    });

    it('requires the given outcome', () => {
        const guide = guideWith(
            [onboardingV2Block.consent('consent', ['hcu-backup'], {cta: t('Ok', 'Ok'), outcomes: [DECLINED]})],
            [onOutcomeV2('consent', 'declined', onboardingV2Target.support())],
        );
        const {errors} = validateOnboardingGuideV2(guide);
        expect(errors.some((e) => e.includes('no "given" outcome'))).toBe(true);
    });

    it('accepts a block without a declined outcome', () => {
        const {ok} = validateOnboardingGuideV2(consentGuide({outcomes: [GIVEN]}), {consents: CONSENTS});
        expect(ok).toBe(true);
    });

    it('rejects an outcome value that is not a consent outcome', () => {
        const {errors} = validateOnboardingGuideV2(
            consentGuide({outcomes: [GIVEN, {id: 'x', value: 'maybe', label: t('Vielleicht', 'Maybe')}]}),
        );
        expect(errors.some((e) => e.includes('"maybe"'))).toBe(true);
    });

    it('rejects an empty, duplicate or malformed key list', () => {
        expect(validateOnboardingGuideV2(consentGuide({consentKeys: []})).ok).toBe(false);
        expect(validateOnboardingGuideV2(consentGuide({consentKeys: ['a', 'a']})).ok).toBe(false);
        expect(validateOnboardingGuideV2(consentGuide({consentKeys: ['Not A Slug']})).ok).toBe(false);
    });

    it('rejects a key the package does not declare, but only when the consents are known', () => {
        const guide = consentGuide({consentKeys: ['unknown-consent']});
        expect(validateOnboardingGuideV2(guide).ok).toBe(true);
        const {errors} = validateOnboardingGuideV2(guide, {consents: CONSENTS});
        expect(errors.some((e) => e.includes('"unknown-consent"'))).toBe(true);
    });

    it('warns when declined can never fire because every consent is voluntary', () => {
        const {warnings} = validateOnboardingGuideV2(consentGuide({consentKeys: ['share-usage-data']}), {
            consents: CONSENTS,
        });
        expect(warnings.some((w) => w.includes('can never fire'))).toBe(true);
    });

    it('owns its step', () => {
        const consent = onboardingV2Block.consent('consent', ['hcu-backup'], {cta: t('Ok', 'Ok'), outcomes: [GIVEN]});
        const choice = onboardingV2Block.choice('pick', [
            {id: 'a', label: t('A', 'A')},
            {id: 'b', label: t('B', 'B')},
        ]);
        const guide = guideWith(
            [consent, choice],
            [
                onOutcomeV2('consent', 'given', onboardingV2Target.success()),
                onOptionV2('pick', 'a', onboardingV2Target.success()),
                onOptionV2('pick', 'b', onboardingV2Target.success()),
            ],
        );
        const {errors} = validateOnboardingGuideV2(guide);
        expect(errors.some((e) => e.includes('the consent owns its step'))).toBe(true);
    });

    it('demands a transition for each outcome', () => {
        const guide = guideWith(
            [onboardingV2Block.consent('consent', ['hcu-backup'], {cta: t('Ok', 'Ok'), outcomes: [GIVEN, DECLINED]})],
            [onOutcomeV2('consent', 'given', onboardingV2Target.success())],
        );
        const {errors} = validateOnboardingGuideV2(guide);
        expect(errors.some((e) => e.includes('outcome:consent:declined'))).toBe(true);
    });

    it('cannot appear in the static package guide', () => {
        const {errors} = validatePackageOnboardingGuide({onboardingGuide: consentGuide(), consents: CONSENTS});
        expect(errors.some((e) => e.toLowerCase().includes('consent'))).toBe(true);
    });
});

describe('additional-setup block — consents, progress phases and duration', () => {
    it('validates consent keys, progress phases and a duration within the limit', () => {
        const {ok, errors, warnings} = validateOnboardingGuideV2(setupGuide(), {consents: CONSENTS});
        expect(errors).toEqual([]);
        expect(warnings).toEqual([]);
        expect(ok).toBe(true);
    });

    it('resolves consent keys against the package consents', () => {
        const {errors} = validateOnboardingGuideV2(setupGuide({consentKeys: ['nope']}), {consents: CONSENTS});
        expect(errors.some((e) => e.includes('"nope"'))).toBe(true);
    });

    it('rejects an empty consent key list', () => {
        expect(validateOnboardingGuideV2(setupGuide({consentKeys: []})).ok).toBe(false);
    });

    it('rejects a single progress phase', () => {
        const {errors} = validateOnboardingGuideV2(
            setupGuide({progressPhases: [{key: 'only', label: t('Einzig', 'Only')}]}),
        );
        expect(errors.some((e) => e.includes('fewer than 2 progressPhases'))).toBe(true);
    });

    it('rejects duplicate or malformed phase keys', () => {
        const label = t('X', 'X');
        expect(
            validateOnboardingGuideV2(setupGuide({progressPhases: [{key: 'a', label}, {key: 'a', label}]})).ok,
        ).toBe(false);
        expect(
            validateOnboardingGuideV2(setupGuide({progressPhases: [{key: 'A B', label}, {key: 'b', label}]})).ok,
        ).toBe(false);
    });

    it('rejects a duration above the limit or not a positive whole number', () => {
        expect(validateOnboardingGuideV2(setupGuide({maxDurationMs: ENYO_ONBOARDING_V2_SETUP_MAX_DURATION_MS + 1})).ok).toBe(
            false,
        );
        expect(validateOnboardingGuideV2(setupGuide({maxDurationMs: 0})).ok).toBe(false);
        expect(validateOnboardingGuideV2(setupGuide({maxDurationMs: 1.5})).ok).toBe(false);
        expect(validateOnboardingGuideV2(setupGuide({maxDurationMs: ENYO_ONBOARDING_V2_SETUP_MAX_DURATION_MS})).ok).toBe(
            true,
        );
    });

    it('passes the new options through the builder', () => {
        const block = onboardingV2Block.additionalSetup('connect', 'connect-hcu', {
            cta: t('Los', 'Go'),
            description: t('Beschreibung', 'Description'),
            outcomes: [],
            consentKeys: ['hcu-backup'],
            progressPhases: [],
            maxDurationMs: 1000,
        }) as EnyoOnboardingV2AdditionalSetupBlock;
        expect(block.consentKeys).toEqual(['hcu-backup']);
        expect(block.progressPhases).toEqual([]);
        expect(block.maxDurationMs).toBe(1000);
    });
});
