import {describe, expect, it} from 'vitest';
import type {EnergyAppPackageSubscriptionPlan} from '../../../energy-app-package-definition.js';
import {EnergyAppPermissionTypeEnum} from '../../../energy-app-permission.type.js';
import {EnyoCurrencyEnum} from '../../../types/enyo-currency.js';
import {EnyoSubscriptionModeEnum, EnyoSubscriptionPaymentIntervalEnum} from '../../../types/enyo-subscription.js';
import {
    EnyoSubscriptionFeature,
    EnyoSubscriptionFreeTier,
    EnyoSubscriptionOfferBlock,
    EnyoSubscriptionOfferHintKindEnum,
    EnyoSubscriptionOfferIconEnum,
    EnyoSubscriptionPlanHighlightEnum
} from '../../../types/enyo-subscription-offer.js';
import {
    defineSubscriptionFeature,
    defineSubscriptionOfferScreen,
    defineSubscriptionPlan,
    getIncludedFeatureKey
} from '../define-subscription-plan.js';
import {validatePackageSubscriptionOffer, PackageSubscriptionOfferSource} from '../subscription-offer-validators.js';
import {validatePackageSubscriptionPlans} from '../subscription-plan-validators.js';

/** A feature of the catalog, overridable field by field. */
const feature = (featureKey: string, over: Partial<EnyoSubscriptionFeature> = {}): EnyoSubscriptionFeature =>
    defineSubscriptionFeature({
        featureKey,
        icon: EnyoSubscriptionOfferIconEnum.PiggyBank,
        storeEntry: [
            {language: 'en', title: `${featureKey} (en)`},
            {language: 'de', title: `${featureKey} (de)`},
        ],
        ...over,
    });

/** A valid plan, overridable field by field. */
const plan = (over: Partial<EnergyAppPackageSubscriptionPlan> = {}): EnergyAppPackageSubscriptionPlan =>
    defineSubscriptionPlan({
        planKey: 'premium',
        paymentInterval: EnyoSubscriptionPaymentIntervalEnum.Yearly,
        prices: [{amountWithoutTax: 41.18, currency: EnyoCurrencyEnum.EUR}],
        storeEntry: [
            {language: 'en', title: 'Premium', shortDescription: 'Optimises your heat pump.'},
            {language: 'de', title: 'Premium', shortDescription: 'Optimiert deine Wärmepumpe.'},
        ],
        includedFeatures: ['basic-control', 'price-optimisation'],
        ...over,
    });

/** A valid free tier, overridable field by field. */
const freeTier = (over: Partial<EnyoSubscriptionFreeTier> = {}): EnyoSubscriptionFreeTier => ({
    storeEntry: [
        {language: 'en', title: 'Basic'},
        {language: 'de', title: 'Basis'},
    ],
    includedFeatures: ['basic-control'],
    ...over,
});

/** A hint explaining why the app costs money. */
const pricingHint: EnyoSubscriptionOfferBlock = {
    type: 'hint',
    kind: EnyoSubscriptionOfferHintKindEnum.PricingReason,
    storeEntry: [
        {language: 'en', title: 'Why does this cost money?', text: 'The car vendors charge us for every vehicle.'},
        {language: 'de', title: 'Warum kostet das Geld?', text: 'Die Fahrzeughersteller berechnen uns jedes Fahrzeug.'},
    ],
};

/** A valid, optional package with features, a free tier and an offer screen. */
const source = (over: Partial<PackageSubscriptionOfferSource> = {}): PackageSubscriptionOfferSource => ({
    subscriptionMode: EnyoSubscriptionModeEnum.Optional,
    subscriptionPlans: [plan()],
    subscriptionFeatures: [feature('basic-control'), feature('price-optimisation')],
    subscriptionFreeTier: freeTier(),
    subscriptionOfferScreen: defineSubscriptionOfferScreen({
        blocks: [
            {type: 'hero', icon: 'piggy-bank', storeEntry: [
                {language: 'en', title: 'Save money'},
                {language: 'de', title: 'Geld sparen'},
            ]},
            {type: 'features'},
            {type: 'comparison'},
            pricingHint,
            {type: 'plans'},
        ],
    }),
    ...over,
});

describe('validatePackageSubscriptionOffer', () => {
    it('accepts a complete offer', () => {
        expect(validatePackageSubscriptionOffer(source())).toEqual({ok: true, errors: [], warnings: []});
    });

    it('accepts a package without offer declarations', () => {
        const result = validatePackageSubscriptionOffer({subscriptionPlans: [plan({includedFeatures: undefined})]});
        expect(result).toEqual({ok: true, errors: [], warnings: []});
    });

    it('warns about offer declarations without plans', () => {
        const result = validatePackageSubscriptionOffer(source({subscriptionPlans: []}));
        expect(result.ok).toBe(true);
        expect(result.warnings).toEqual([expect.stringContaining('no subscriptionPlans')]);
    });

    it('flags malformed and duplicate feature keys, unknown icons and missing translations', () => {
        const {errors} = validatePackageSubscriptionOffer(source({
            subscriptionFeatures: [
                feature('basic-control'),
                feature('price-optimisation'),
                feature('price-optimisation'),
                feature('Not A Slug'),
                feature('boost', {icon: 'unicorn' as EnyoSubscriptionOfferIconEnum, storeEntry: [{language: 'en', title: ''}]}),
            ],
        }));
        expect(errors).toEqual(expect.arrayContaining([
            expect.stringContaining('duplicate featureKey "price-optimisation"'),
            expect.stringContaining('featureKey must be a kebab-case slug'),
            expect.stringContaining('icon "unicorn" is not supported'),
            expect.stringContaining('title is required'),
            expect.stringContaining('entry for language "de" is required'),
        ]));
    });

    it('flags unknown and duplicate included features and untranslated values', () => {
        const {errors} = validatePackageSubscriptionOffer(source({
            subscriptionPlans: [plan({
                includedFeatures: [
                    'basic-control',
                    'basic-control',
                    'missing',
                    {featureKey: 'price-optimisation', value: [{language: 'en', value: 'up to 5 vehicles'}]},
                ],
            })],
        }));
        expect(errors).toEqual(expect.arrayContaining([
            expect.stringContaining('feature "basic-control" is listed twice'),
            expect.stringContaining('"missing" is not a feature of subscriptionFeatures'),
            expect.stringContaining('value: entry for language "de" is required'),
        ]));
    });

    it('allows one highlighted plan and flags a second or an unknown highlight', () => {
        const recommended = plan({highlight: EnyoSubscriptionPlanHighlightEnum.Recommended});
        expect(validatePackageSubscriptionOffer(source({subscriptionPlans: [recommended, plan({planKey: 'pro'})]})).ok).toBe(true);

        const {errors} = validatePackageSubscriptionOffer(source({
            subscriptionPlans: [recommended, plan({planKey: 'pro', highlight: 'cheapest' as EnyoSubscriptionPlanHighlightEnum})],
        }));
        expect(errors).toEqual(expect.arrayContaining([
            expect.stringContaining('highlight "cheapest" is not supported'),
            expect.stringContaining('Only one plan may be highlighted'),
        ]));
    });

    it('rejects a free tier for a required package', () => {
        const {errors} = validatePackageSubscriptionOffer(source({subscriptionMode: EnyoSubscriptionModeEnum.Required}));
        expect(errors).toEqual([expect.stringContaining('subscriptionFreeTier is not allowed with subscriptionMode "required"')]);
    });

    it('warns about features no tier includes', () => {
        const {ok, warnings} = validatePackageSubscriptionOffer(source({
            subscriptionFeatures: [feature('basic-control'), feature('price-optimisation'), feature('unused')],
            subscriptionOfferScreen: {blocks: [{type: 'plans'}]},
        }));
        expect(ok).toBe(true);
        expect(warnings).toEqual(['Feature "unused" is not included in any plan or the free tier.']);
    });

    it('requires at least one block and at most one plans block', () => {
        expect(validatePackageSubscriptionOffer(source({subscriptionOfferScreen: {blocks: []}})).errors)
            .toEqual([expect.stringContaining('at least one block')]);
        expect(validatePackageSubscriptionOffer(source({subscriptionOfferScreen: {blocks: [{type: 'plans'}, {type: 'plans'}]}})).errors)
            .toEqual([expect.stringContaining('at most one "plans" block')]);
    });

    it('flags unknown blocks, a hero without title and a hint without kind or text', () => {
        const {errors} = validatePackageSubscriptionOffer(source({
            subscriptionOfferScreen: {
                blocks: [
                    {type: 'video'} as unknown as EnyoSubscriptionOfferBlock,
                    {type: 'hero', storeEntry: [{language: 'en', text: 'x'}, {language: 'de', title: 'x'}]},
                    {type: 'hint', kind: 'joke' as EnyoSubscriptionOfferHintKindEnum, storeEntry: [{language: 'en', title: 'x'}, {language: 'de', title: 'x'}]},
                ],
            },
        }));
        expect(errors).toEqual(expect.arrayContaining([
            expect.stringContaining('block type "video" is not supported'),
            expect.stringMatching(/blocks\[1\] \(hero\)\.storeEntry\[0\] \(en\): title is required/),
            expect.stringContaining('kind "joke" is not supported'),
            expect.stringMatching(/blocks\[2\] \(hint\)\.storeEntry\[0\] \(en\): text is required/),
        ]));
    });

    it('flags unknown feature and plan keys in blocks', () => {
        const {errors} = validatePackageSubscriptionOffer(source({
            subscriptionOfferScreen: {
                blocks: [
                    {type: 'features', featureKeys: ['missing']},
                    {type: 'comparison', planKeys: ['gold'], featureKeys: []},
                ],
            },
        }));
        expect(errors).toEqual(expect.arrayContaining([
            expect.stringContaining('"missing" is not a declared feature'),
            expect.stringContaining('"gold" is not a declared plan'),
            expect.stringContaining('featureKeys must not be empty'),
        ]));
    });

    it('needs a free tier for the free column and at least two columns', () => {
        expect(validatePackageSubscriptionOffer(source({
            subscriptionFreeTier: undefined,
            subscriptionOfferScreen: {blocks: [{type: 'comparison', includeFreeTier: true}]},
        })).errors).toEqual([expect.stringContaining('includeFreeTier needs subscriptionFreeTier')]);

        expect(validatePackageSubscriptionOffer(source({
            subscriptionOfferScreen: {blocks: [{type: 'comparison', includeFreeTier: false}]},
        })).errors).toEqual([expect.stringContaining('at least two columns')]);

        expect(validatePackageSubscriptionOffer(source({
            subscriptionFreeTier: undefined,
            subscriptionPlans: [plan(), plan({planKey: 'pro'})],
            subscriptionOfferScreen: {blocks: [{type: 'comparison'}]},
        })).ok).toBe(true);
    });

    it('needs features for features and comparison blocks', () => {
        const {errors} = validatePackageSubscriptionOffer({
            subscriptionMode: EnyoSubscriptionModeEnum.Optional,
            subscriptionPlans: [plan({includedFeatures: undefined}), plan({planKey: 'pro', includedFeatures: undefined})],
            subscriptionOfferScreen: {blocks: [{type: 'features'}, {type: 'comparison'}]},
        });
        expect(errors).toEqual([
            expect.stringContaining('a features block needs subscriptionFeatures'),
            expect.stringContaining('a comparison block needs subscriptionFeatures'),
        ]);
    });

    it('warns about comparison rows no compared column includes', () => {
        const {ok, warnings} = validatePackageSubscriptionOffer(source({
            subscriptionOfferScreen: {blocks: [{type: 'comparison', includeFreeTier: true, planKeys: ['premium'], featureKeys: ['basic-control']}]},
            subscriptionPlans: [plan({includedFeatures: ['price-optimisation']})],
            subscriptionFreeTier: freeTier({includedFeatures: []}),
        }));
        expect(ok).toBe(true);
        expect(warnings).toEqual(expect.arrayContaining([expect.stringContaining('feature "basic-control" is not included in any compared column')]));
    });

    it('requires de and en for optional block texts once they are set', () => {
        const {errors} = validatePackageSubscriptionOffer(source({
            subscriptionOfferScreen: {blocks: [{type: 'plans', storeEntry: [{language: 'en', title: 'Choose a plan'}]}]},
        }));
        expect(errors).toEqual([expect.stringContaining('entry for language "de" is required')]);
    });
});

describe('validatePackageSubscriptionPlans with an offer', () => {
    it('merges the offer errors and warnings', () => {
        const result = validatePackageSubscriptionPlans({
            ...source({subscriptionOfferScreen: {blocks: []}}),
            permissions: [EnergyAppPermissionTypeEnum.Subscriptions],
        });
        expect(result.ok).toBe(false);
        expect(result.errors).toEqual([expect.stringContaining('at least one block')]);
    });
});

describe('getIncludedFeatureKey', () => {
    it('returns the key of plain and valued features', () => {
        expect(getIncludedFeatureKey('boost')).toBe('boost');
        expect(getIncludedFeatureKey({featureKey: 'vehicles', value: []})).toBe('vehicles');
    });
});
