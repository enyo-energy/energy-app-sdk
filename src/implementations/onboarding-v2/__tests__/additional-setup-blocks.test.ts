import {describe, expect, it} from 'vitest';
import {
    EnyoOnboardingV2SetupFieldType,
    EnyoOnboardingV2StartVariant,
    type EnyoOnboardingV2AdditionalSetupBlock,
    type EnyoOnboardingV2Block,
    type EnyoOnboardingV2Guide,
    type EnyoOnboardingV2Transition,
} from '../../../types/enyo-onboarding-v2.js';
import {ENYO_ONBOARDING_V2_SETUP_FAILED_OUTCOME} from '../../../types/enyo-onboarding-v2-additional-setup.js';
import {
    defineOnboardingGuideV2,
    onboardingV2Block,
    onboardingV2Target,
    onOutcomeV2,
    onSkipV2,
} from '../define-onboarding-guide-v2.js';
import {validateOnboardingGuideV2} from '../onboarding-v2-validators.js';

const t = (de: string, en: string) => [
    {language: 'de', value: de},
    {language: 'en', value: en},
];

const OK = {id: 'ok', value: 'connected', label: t('Verbunden', 'Connected')};
const FAILED = {
    id: 'failed',
    value: ENYO_ONBOARDING_V2_SETUP_FAILED_OUTCOME,
    label: t('Fehlgeschlagen', 'Failed'),
};

const TOKEN_FIELD = {
    name: 'api-token',
    type: EnyoOnboardingV2SetupFieldType.Token,
    label: t('API-Token', 'API token'),
};

/** A setup block with everything wired, so a test isolates the rule it is about. */
const setup = (
    overrides: Partial<EnyoOnboardingV2AdditionalSetupBlock> = {},
): EnyoOnboardingV2Block => ({
    ...(onboardingV2Block.additionalSetup('cloud', 'vendor-cloud-token', {
        cta: t('Cloud verbinden', 'Connect the cloud'),
        description: t('Optional: bessere Prognosen.', 'Optional: better forecasts.'),
        fields: [TOKEN_FIELD],
        outcomes: [OK, FAILED],
    }) as EnyoOnboardingV2AdditionalSetupBlock),
    ...overrides,
});

/** Wraps a block in a one-step guide with the given transitions. */
const guideWith = (
    block: EnyoOnboardingV2Block,
    transitions: EnyoOnboardingV2Transition[],
): EnyoOnboardingV2Guide =>
    defineOnboardingGuideV2({
        title: t('Setup', 'Setup'),
        startVariant: EnyoOnboardingV2StartVariant.DeviceFoundConfig,
        startStepId: 's1',
        steps: [
            {
                id: 's1',
                name: 'extras',
                title: t('Zusätzliche Einrichtung', 'Additional setup'),
                blocks: [block],
                transitions,
            },
        ],
    });

const wiredGuide = (overrides: Partial<EnyoOnboardingV2AdditionalSetupBlock> = {}) => {
    const block = setup(overrides) as EnyoOnboardingV2AdditionalSetupBlock;
    const transitions = [
        ...block.outcomes.map((o) => onOutcomeV2('cloud', o.id, onboardingV2Target.success())),
        ...(block.skip ? [onSkipV2('cloud', block.skip.id, onboardingV2Target.success())] : []),
    ];
    return guideWith(block, transitions);
};

describe('additionalSetup — happy path', () => {
    it('validates a fully wired block with no errors or warnings', () => {
        const {ok, errors, warnings} = validateOnboardingGuideV2(wiredGuide());

        expect(ok).toBe(true);
        expect(errors).toEqual([]);
        expect(warnings).toEqual([]);
    });

    it('validates a block with a skip handle wired via onSkipV2', () => {
        const {ok, errors, warnings} = validateOnboardingGuideV2(
            wiredGuide({skip: {id: 'later', label: t('Später', 'Later')}}),
        );

        expect(ok).toBe(true);
        expect(errors).toEqual([]);
        expect(warnings).toEqual([]);
    });

    it('validates a fieldless "do it now" block', () => {
        const {ok, errors} = validateOnboardingGuideV2(wiredGuide({fields: undefined}));
        expect(ok).toBe(true);
        expect(errors).toEqual([]);
    });

    it('produces a distinct routing handle for the skip', () => {
        const skip = onSkipV2('cloud', 'later', onboardingV2Target.success());
        expect(skip.id).toBe('skip:cloud:later');
        expect(skip.source).toEqual({kind: 'skip', blockId: 'cloud', skipId: 'later'});
    });
});

describe('additionalSetup — the mandatory failed outcome', () => {
    it('errors when no outcome is valued `failed`', () => {
        const {ok, errors} = validateOnboardingGuideV2(
            wiredGuide({outcomes: [OK, {id: 'bad', value: 'invalid', label: t('Ungültig', 'Invalid')}]}),
        );

        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('has no "failed" outcome'))).toBe(true);
    });

    it('errors when there is only one outcome', () => {
        const {ok, errors} = validateOnboardingGuideV2(wiredGuide({outcomes: [FAILED]}));

        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('at least 2 outcomes'))).toBe(true);
    });
});

describe('additionalSetup — routing handles', () => {
    it('errors when an outcome has no transition', () => {
        const block = setup() as EnyoOnboardingV2AdditionalSetupBlock;
        const {ok, errors} = validateOnboardingGuideV2(
            guideWith(block, [onOutcomeV2('cloud', 'ok', onboardingV2Target.success())]),
        );

        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('outcome:cloud:failed') && e.includes('dead branch'))).toBe(true);
    });

    it('errors when a declared skip handle has no transition', () => {
        const block = setup({skip: {id: 'later', label: t('Später', 'Later')}}) as EnyoOnboardingV2AdditionalSetupBlock;
        const {ok, errors} = validateOnboardingGuideV2(
            guideWith(block, block.outcomes.map((o) => onOutcomeV2('cloud', o.id, onboardingV2Target.success()))),
        );

        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('skip:cloud:later') && e.includes('dead branch'))).toBe(true);
    });

    it('errors on a skip transition for a block that declares none', () => {
        const block = setup() as EnyoOnboardingV2AdditionalSetupBlock;
        const {ok, errors} = validateOnboardingGuideV2(
            guideWith(block, [
                ...block.outcomes.map((o) => onOutcomeV2('cloud', o.id, onboardingV2Target.success())),
                onSkipV2('cloud', 'later', onboardingV2Target.success()),
            ]),
        );

        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('matches no option/outcome'))).toBe(true);
    });

    it('errors when a skip id collides with an outcome id', () => {
        const {ok, errors} = validateOnboardingGuideV2(
            wiredGuide({skip: {id: 'ok', label: t('Später', 'Later')}}),
        );

        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('collides with an outcome id'))).toBe(true);
    });
});

describe('additionalSetup — block metadata', () => {
    it('errors on a missing or non-slug setupKey', () => {
        for (const setupKey of ['', 'Vendor Cloud', 'vendor_cloud']) {
            const {ok, errors} = validateOnboardingGuideV2(wiredGuide({setupKey}));
            expect(ok, setupKey).toBe(false);
            expect(errors.some((e) => e.includes('kebab-case setupKey'))).toBe(true);
        }
    });

    it('errors on a missing cta or description', () => {
        expect(validateOnboardingGuideV2(wiredGuide({cta: []})).errors
            .some((e) => e.includes('no cta caption'))).toBe(true);
        expect(validateOnboardingGuideV2(wiredGuide({description: []})).errors
            .some((e) => e.includes('no description'))).toBe(true);
    });

    it('errors on more than one setup block in a step', () => {
        const first = setup() as EnyoOnboardingV2AdditionalSetupBlock;
        const second = {...first, id: 'cloud2'} as EnyoOnboardingV2AdditionalSetupBlock;
        const guide = defineOnboardingGuideV2({
            title: t('Setup', 'Setup'),
            startVariant: EnyoOnboardingV2StartVariant.DeviceFoundConfig,
            startStepId: 's1',
            steps: [{
                id: 's1', name: 'extras', title: t('Extras', 'Extras'),
                blocks: [first, second],
                transitions: [
                    ...first.outcomes.map((o) => onOutcomeV2('cloud', o.id, onboardingV2Target.success())),
                    ...second.outcomes.map((o) => onOutcomeV2('cloud2', o.id, onboardingV2Target.success())),
                ],
            }],
        });

        const {ok, errors} = validateOnboardingGuideV2(guide);
        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('more than one additional-setup block'))).toBe(true);
    });
});

describe('additionalSetup — fields', () => {
    const withFields = (fields: EnyoOnboardingV2AdditionalSetupBlock['fields']) =>
        validateOnboardingGuideV2(wiredGuide({fields}));

    it('errors on a duplicate or non-slug field name', () => {
        expect(withFields([TOKEN_FIELD, TOKEN_FIELD]).errors
            .some((e) => e.includes('duplicate name'))).toBe(true);
        expect(withFields([{...TOKEN_FIELD, name: 'API Token'}]).errors
            .some((e) => e.includes('kebab-case slug'))).toBe(true);
    });

    it('errors on a select field with fewer than 2 options', () => {
        const {ok, errors} = withFields([{
            name: 'region',
            type: EnyoOnboardingV2SetupFieldType.Select,
            label: t('Region', 'Region'),
            options: [{value: 'eu', label: t('EU', 'EU')}],
        }]);

        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('at least 2 options'))).toBe(true);
    });

    it('errors on options attached to a non-select field', () => {
        const {ok, errors} = withFields([
            {...TOKEN_FIELD, options: [{value: 'a', label: t('A', 'A')}]},
        ]);

        expect(ok).toBe(false);
        expect(errors.some((e) => e.includes('only meaningful on a select field'))).toBe(true);
    });

    it('errors on a field with no label or an unknown type', () => {
        expect(withFields([{...TOKEN_FIELD, label: []}]).errors
            .some((e) => e.includes('has no label'))).toBe(true);
        expect(withFields([{...TOKEN_FIELD, type: 'biometric' as EnyoOnboardingV2SetupFieldType}]).errors
            .some((e) => e.includes('unknown type'))).toBe(true);
    });

    it('warns on an optional secret, which usually wants a skip handle instead', () => {
        const {ok, warnings} = withFields([{...TOKEN_FIELD, required: false}]);

        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('optional secret'))).toBe(true);
    });

    it('does not warn about an optional non-secret field', () => {
        const {ok, warnings} = withFields([
            {name: 'note', type: EnyoOnboardingV2SetupFieldType.Text, label: t('Notiz', 'Note'), required: false},
        ]);

        expect(ok).toBe(true);
        expect(warnings).toEqual([]);
    });

    it('warns when the block collects more than six fields', () => {
        const {ok, warnings} = withFields(
            Array.from({length: 7}, (_, i) => ({
                name: `field-${i}`,
                type: EnyoOnboardingV2SetupFieldType.Text,
                label: t(`Feld ${i}`, `Field ${i}`),
            })),
        );

        expect(ok).toBe(true);
        expect(warnings.some((w) => w.includes('splitting it across steps'))).toBe(true);
    });
});
