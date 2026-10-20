import {describe, expect, it} from 'vitest';
import type {EnergyAppPackageSubscriptionPlan} from '../../../energy-app-package-definition.js';
import {EnergyAppPermissionTypeEnum} from '../../../energy-app-permission.type.js';
import {EnergyAppStateEnum} from '../../../enyo-energy-app-sdk.js';
import {EnyoCurrencyEnum} from '../../../types/enyo-currency.js';
import {
    EnyoSubscription,
    EnyoSubscriptionPaymentIntervalEnum,
    EnyoSubscriptionChangeEvent,
    EnyoSubscriptionCustomUnit,
    EnyoSubscriptionModeEnum,
    EnyoSubscriptionPricingModelEnum,
    EnyoSubscriptionStatusEnum,
    EnyoSubscriptionUnit,
    EnyoSubscriptionUnitTypeEnum
} from '../../../types/enyo-subscription.js';
import {
    defineSubscriptionPlan,
    isPlanActive,
    isSameSubscriptionUnit,
    isSubscriptionActive,
    isUnitActive
} from '../define-subscription-plan.js';
import {InMemorySubscriptions} from '../in-memory-subscriptions.js';
import {
    assertEnergyAppStateMatchesSubscriptionMode,
    assertValidPackageSubscriptionPlans,
    PackageSubscriptionPlansValidationError,
    validatePackageSubscriptionPlans,
    validateSubscriptionBilling,
    validateSubscriptionUnits,
} from '../subscription-plan-validators.js';

/** A valid plan, overridable field by field for the failure cases. */
const plan = (over: Partial<EnergyAppPackageSubscriptionPlan> = {}): EnergyAppPackageSubscriptionPlan =>
    defineSubscriptionPlan({
        planKey: 'premium',
        paymentInterval: EnyoSubscriptionPaymentIntervalEnum.Yearly,
        prices: [{amountWithoutTax: 41.18, currency: EnyoCurrencyEnum.EUR}],
        storeEntry: [
            {language: 'en', title: 'Premium', shortDescription: 'Optimises your heat pump.'},
            {language: 'de', title: 'Premium', shortDescription: 'Optimiert deine Wärmepumpe.'},
        ],
        ...over,
    });

/** Validates the given plans in a package that holds the `Subscriptions` permission. */
const validate = (...plans: EnergyAppPackageSubscriptionPlan[]) =>
    validatePackageSubscriptionPlans({
        subscriptionPlans: plans,
        subscriptionMode: EnyoSubscriptionModeEnum.Optional,
        permissions: [EnergyAppPermissionTypeEnum.Subscriptions],
    });

/** A per-unit plan, overridable field by field. */
const perUnitPlan = (over: Partial<EnergyAppPackageSubscriptionPlan> = {}): EnergyAppPackageSubscriptionPlan =>
    plan({planKey: 'smart-charging', pricingModel: EnyoSubscriptionPricingModelEnum.PerUnit, ...over});

/** A subscription, overridable field by field. */
const subscription = (over: Partial<EnyoSubscription> = {}): EnyoSubscription => ({
    subscriptionId: 'sub-1',
    planKey: 'premium',
    status: EnyoSubscriptionStatusEnum.Active,
    paymentInterval: EnyoSubscriptionPaymentIntervalEnum.Yearly,
    pricingModel: EnyoSubscriptionPricingModelEnum.PerPackage,
    price: {amountWithoutTax: 41.18, currency: EnyoCurrencyEnum.EUR},
    startedAtIso: '2026-01-01T00:00:00Z',
    currentPeriodStartIso: '2026-01-01T00:00:00Z',
    currentPeriodEndIso: '2027-01-01T00:00:00Z',
    ...over,
});

describe('validatePackageSubscriptionPlans', () => {
    it('accepts a package without plans', () => {
        expect(validatePackageSubscriptionPlans({permissions: []}).ok).toBe(true);
        expect(validatePackageSubscriptionPlans({subscriptionPlans: [], permissions: []}).ok).toBe(true);
    });

    it('accepts well-formed plans', () => {
        const result = validate(plan(), plan({planKey: 'heatpump-boost', trialDays: 30}));
        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('accepts the permission declared as an object', () => {
        const result = validatePackageSubscriptionPlans({
            subscriptionPlans: [plan()],
            subscriptionMode: 'required',
            permissions: [{permission: 'Subscriptions', internalComment: 'Reads bought plans'}],
        });
        expect(result.ok).toBe(true);
    });

    it('flags a missing Subscriptions permission', () => {
        const result = validatePackageSubscriptionPlans({
            subscriptionPlans: [plan()],
            subscriptionMode: 'optional',
            permissions: ['Storage'],
        });
        expect(result.errors.some((e) => e.includes('`Subscriptions` permission'))).toBe(true);
    });

    it('flags a non-slug and a duplicate plan key', () => {
        expect(validate(plan({planKey: 'Premium Plan'})).errors.some((e) => e.includes('kebab-case slug'))).toBe(true);
        expect(validate(plan(), plan()).errors.some((e) => e.includes('duplicate planKey'))).toBe(true);
    });

    it.each([
        [EnyoSubscriptionPaymentIntervalEnum.OneTime],
        [EnyoSubscriptionPaymentIntervalEnum.Monthly],
        [EnyoSubscriptionPaymentIntervalEnum.Yearly],
    ])('accepts the payment interval %s', (paymentInterval) => {
        expect(validate(plan({paymentInterval})).ok).toBe(true);
    });

    it('flags an unknown payment interval', () => {
        const result = validate(plan({paymentInterval: 'weekly' as never}));
        expect(result.errors.some((e) => e.includes('paymentInterval'))).toBe(true);
    });

    it('requires at least one price', () => {
        expect(validate(plan({prices: []})).errors.some((e) => e.includes('at least one price'))).toBe(true);
    });

    it.each([[0], [-5], [Number.NaN], [Number.POSITIVE_INFINITY]])('flags the amount %s', (amountWithoutTax) => {
        const result = validate(plan({prices: [{amountWithoutTax, currency: EnyoCurrencyEnum.EUR}]}));
        expect(result.errors.some((e) => e.includes('greater than 0'))).toBe(true);
    });

    it('flags more than two decimal places but accepts float noise', () => {
        const tooPrecise = validate(plan({prices: [{amountWithoutTax: 41.185, currency: EnyoCurrencyEnum.EUR}]}));
        expect(tooPrecise.errors.some((e) => e.includes('two decimal places'))).toBe(true);
        expect(validate(plan({prices: [{amountWithoutTax: 0.1 + 0.2, currency: EnyoCurrencyEnum.EUR}]})).ok).toBe(true);
    });

    it('flags a duplicate and an unknown currency', () => {
        const duplicate = validate(plan({
            prices: [
                {amountWithoutTax: 41.18, currency: EnyoCurrencyEnum.EUR},
                {amountWithoutTax: 39.99, currency: EnyoCurrencyEnum.EUR},
            ],
        }));
        expect(duplicate.errors.some((e) => e.includes('duplicate currency'))).toBe(true);

        const unknown = validate(plan({prices: [{amountWithoutTax: 10, currency: 'USD' as never}]}));
        expect(unknown.errors.some((e) => e.includes('not supported'))).toBe(true);
    });

    it.each([[0], [-1], [7.5]])('flags trialDays %s', (trialDays) => {
        expect(validate(plan({trialDays})).errors.some((e) => e.includes('trialDays'))).toBe(true);
    });

    it('flags a trial on a one-time plan', () => {
        const result = validate(plan({paymentInterval: EnyoSubscriptionPaymentIntervalEnum.OneTime, trialDays: 30}));
        expect(result.errors.some((e) => e.includes('not allowed for a one-time plan'))).toBe(true);
    });

    it('requires German and English store entries with title and description', () => {
        const missingDe = validate(plan({
            storeEntry: [{language: 'en', title: 'Premium', shortDescription: 'Optimises.'}],
        }));
        expect(missingDe.errors.some((e) => e.includes('language "de" is required'))).toBe(true);

        const empty = validate(plan({
            storeEntry: [
                {language: 'en', title: ' ', shortDescription: '', benefits: ['']},
                {language: 'de', title: 'Premium', shortDescription: 'Optimiert.'},
            ],
        }));
        expect(empty.errors.some((e) => e.includes('title is required'))).toBe(true);
        expect(empty.errors.some((e) => e.includes('shortDescription is required'))).toBe(true);
        expect(empty.errors.some((e) => e.includes('empty entries'))).toBe(true);
    });

    it('flags a duplicate store entry language', () => {
        const result = validate(plan({
            storeEntry: [
                {language: 'en', title: 'Premium', shortDescription: 'Optimises.'},
                {language: 'en', title: 'Premium', shortDescription: 'Optimises.'},
                {language: 'de', title: 'Premium', shortDescription: 'Optimiert.'},
            ],
        }));
        expect(result.errors.some((e) => e.includes('duplicate language'))).toBe(true);
    });
});

describe('validatePackageSubscriptionPlans pricingModel', () => {
    it.each([[undefined], [EnyoSubscriptionPricingModelEnum.PerPackage], [EnyoSubscriptionPricingModelEnum.PerUnit]])(
        'accepts the pricing model %s', (pricingModel) => {
            expect(validate(plan({pricingModel})).ok).toBe(true);
        });

    it('flags an unknown pricing model', () => {
        const result = validate(plan({pricingModel: 'per-user' as never}));
        expect(result.errors.some((e) => e.includes('pricingModel'))).toBe(true);
    });
});

/** A wallbox appliance unit. */
const wallbox: EnyoSubscriptionUnit = {type: EnyoSubscriptionUnitTypeEnum.Appliance, referenceId: 'wallbox-1'};
/** A custom unit with a German and English name. */
const room: EnyoSubscriptionCustomUnit = {
    type: EnyoSubscriptionUnitTypeEnum.Custom,
    referenceId: 'living-room',
    name: [{language: 'en', value: 'Living room'}, {language: 'de', value: 'Wohnzimmer'}],
};

describe('validateSubscriptionUnits', () => {
    it('accepts appliance, vehicle and custom units', () => {
        const units: EnyoSubscriptionUnit[] = [
            wallbox,
            {type: EnyoSubscriptionUnitTypeEnum.Vehicle, referenceId: 'vehicle-1'},
            room,
        ];
        expect(validateSubscriptionUnits(units)).toEqual({ok: true, errors: []});
        expect(validateSubscriptionUnits([]).ok).toBe(true);
    });

    it('allows the same reference for different types', () => {
        const vehicle: EnyoSubscriptionUnit = {type: EnyoSubscriptionUnitTypeEnum.Vehicle, referenceId: 'wallbox-1'};
        expect(validateSubscriptionUnits([wallbox, vehicle]).ok).toBe(true);
    });

    it('flags an empty reference, a duplicate unit and an unknown type', () => {
        const result = validateSubscriptionUnits([
            {type: EnyoSubscriptionUnitTypeEnum.Appliance, referenceId: ' '},
            wallbox,
            wallbox,
            {type: 'room' as never, referenceId: 'x'},
        ]);
        expect(result.errors.some((e) => e.includes('referenceId is required'))).toBe(true);
        expect(result.errors.some((e) => e.includes('duplicate unit'))).toBe(true);
        expect(result.errors.some((e) => e.includes('type "room"'))).toBe(true);
    });

    it('requires a German and English name for custom units', () => {
        const result = validateSubscriptionUnits([{
            type: EnyoSubscriptionUnitTypeEnum.Custom,
            referenceId: 'garage',
            name: [{language: 'en', value: 'Garage'}, {language: 'de', value: ''}],
        }]);
        expect(result.errors.some((e) => e.includes('language "de"'))).toBe(true);
    });
});

describe('validatePackageSubscriptionPlans subscriptionMode', () => {
    it('requires subscriptionMode when plans are declared', () => {
        const result = validatePackageSubscriptionPlans({subscriptionPlans: [plan()], permissions: ['Subscriptions']});
        expect(result.errors.some((e) => e.includes('subscriptionMode is required'))).toBe(true);
    });

    it('flags an unknown subscriptionMode', () => {
        const result = validatePackageSubscriptionPlans({
            subscriptionPlans: [plan()],
            subscriptionMode: 'sometimes' as never,
            permissions: ['Subscriptions'],
        });
        expect(result.errors.some((e) => e.includes('subscriptionMode "sometimes"'))).toBe(true);
    });

    it('warns about a subscriptionMode without plans', () => {
        const result = validatePackageSubscriptionPlans({subscriptionMode: 'required', permissions: []});
        expect(result.ok).toBe(true);
        expect(result.warnings.some((w) => w.includes('has no effect'))).toBe(true);
    });
});

describe('validateSubscriptionBilling', () => {
    const plans = [perUnitPlan(), plan()];

    it('accepts no mark and a mark naming a per-unit plan', () => {
        expect(validateSubscriptionBilling(undefined, plans)).toEqual([]);
        expect(validateSubscriptionBilling({billed: true, planKey: 'smart-charging'}, plans)).toEqual([]);
        expect(validateSubscriptionBilling({billed: false, planKey: 'smart-charging'}, plans)).toEqual([]);
    });

    it('flags an unknown plan, a per-package plan and a missing billed flag', () => {
        expect(validateSubscriptionBilling({billed: true, planKey: 'other'}, plans)[0]).toContain('not a plan of this package');
        expect(validateSubscriptionBilling({billed: true, planKey: 'premium'}, plans)[0]).toContain('not a per-unit plan');
        expect(validateSubscriptionBilling({planKey: 'smart-charging'} as never, plans)[0]).toContain('billed');
        expect(validateSubscriptionBilling({billed: true, planKey: 'smart-charging'}, undefined)).toHaveLength(1);
    });
});

describe('assertEnergyAppStateMatchesSubscriptionMode', () => {
    it('rejects subscription-required only for optional packages', () => {
        expect(() => assertEnergyAppStateMatchesSubscriptionMode('optional', EnergyAppStateEnum.SubscriptionRequired))
            .toThrow('must not report');
        expect(() => assertEnergyAppStateMatchesSubscriptionMode('optional', EnergyAppStateEnum.Running)).not.toThrow();
        expect(() => assertEnergyAppStateMatchesSubscriptionMode('required', 'subscription-required')).not.toThrow();
        expect(() => assertEnergyAppStateMatchesSubscriptionMode(undefined, 'subscription-required')).not.toThrow();
    });
});

describe('assertValidPackageSubscriptionPlans', () => {
    it('returns the plans when they are valid', () => {
        const plans = [plan()];
        expect(assertValidPackageSubscriptionPlans({
            subscriptionPlans: plans,
            subscriptionMode: 'optional',
            permissions: ['Subscriptions'],
        })).toBe(plans);
    });

    it('throws with every error when they are invalid', () => {
        expect(() => assertValidPackageSubscriptionPlans({subscriptionPlans: [plan({prices: []})], permissions: []}))
            .toThrow(PackageSubscriptionPlansValidationError);
    });
});

describe('isSubscriptionActive / isPlanActive', () => {
    it.each([
        [EnyoSubscriptionStatusEnum.Trialing, true],
        [EnyoSubscriptionStatusEnum.Active, true],
        [EnyoSubscriptionStatusEnum.CancelledUntilPeriodEnd, true],
        [EnyoSubscriptionStatusEnum.Grace, true],
        [EnyoSubscriptionStatusEnum.Expired, false],
    ])('treats %s as active: %s', (status, active) => {
        expect(isSubscriptionActive(subscription({status}))).toBe(active);
    });

    it('checks the plan key', () => {
        const subscriptions = [
            subscription({status: EnyoSubscriptionStatusEnum.Expired}),
            subscription({subscriptionId: 'sub-2', planKey: 'heatpump-boost'}),
        ];
        expect(isPlanActive(subscriptions, 'premium')).toBe(false);
        expect(isPlanActive(subscriptions, 'heatpump-boost')).toBe(true);
        expect(isPlanActive([], 'premium')).toBe(false);
    });
});

describe('isUnitActive', () => {
    const perUnit = (over: Partial<EnyoSubscription> = {}) => subscription({
        planKey: 'smart-charging',
        pricingModel: EnyoSubscriptionPricingModelEnum.PerUnit,
        units: [wallbox],
        ...over,
    });

    it('is true only for a paid unit of an active subscription', () => {
        expect(isUnitActive([perUnit()], 'smart-charging', wallbox)).toBe(true);
        expect(isUnitActive([perUnit()], 'smart-charging', {type: 'appliance', referenceId: 'wallbox-2'})).toBe(false);
        expect(isUnitActive([perUnit()], 'smart-charging', {type: 'vehicle', referenceId: 'wallbox-1'})).toBe(false);
        expect(isUnitActive([perUnit()], 'premium', wallbox)).toBe(false);
        expect(isUnitActive([perUnit({status: EnyoSubscriptionStatusEnum.Expired})], 'smart-charging', wallbox)).toBe(false);
        expect(isUnitActive([perUnit({units: undefined})], 'smart-charging', wallbox)).toBe(false);
    });

    it('compares units by type and reference only', () => {
        expect(isSameSubscriptionUnit(room, {...room, name: []} as EnyoSubscriptionUnit)).toBe(true);
    });
});

describe('InMemorySubscriptions', () => {
    it('stores reported custom units and billed units per plan', async () => {
        const kitchen: EnyoSubscriptionCustomUnit = {...room, referenceId: 'kitchen'};
        const subscriptions = new InMemorySubscriptions();
        await subscriptions.setUnits('smart-charging', [room, kitchen]);
        await subscriptions.setUnits('smart-charging', [room]);
        await subscriptions.setBilledUnits('smart-charging', [wallbox]);

        expect(await subscriptions.getUnits('smart-charging')).toEqual([wallbox, room]);
        expect(await subscriptions.getUnits('other')).toEqual([]);
    });

    it('rejects invalid units and plans that are not per-unit', async () => {
        const subscriptions = new InMemorySubscriptions([], [perUnitPlan(), plan()]);

        await expect(subscriptions.setUnits('smart-charging', [room, room])).rejects.toThrow('duplicate unit');
        await expect(subscriptions.setUnits('premium', [room])).rejects.toThrow('not a per-unit plan');
        await expect(subscriptions.setBilledUnits('premium', [wallbox])).rejects.toThrow('not a per-unit plan');
        await expect(subscriptions.setUnits('smart-charging', [room])).resolves.toBeUndefined();
    });

    it('keeps appliance and vehicle units out of setUnits and custom units out of setBilledUnits', async () => {
        const subscriptions = new InMemorySubscriptions();

        await expect(subscriptions.setUnits('smart-charging', [wallbox as never]))
            .rejects.toThrow('mark appliances and vehicles with `billing`');
        await expect(subscriptions.setBilledUnits('smart-charging', [room]))
            .rejects.toThrow('only takes appliance and vehicle units');
    });

    it('checks reported app states against the subscription mode', () => {
        const optional = new InMemorySubscriptions([], undefined, EnyoSubscriptionModeEnum.Optional);
        expect(() => optional.assertEnergyAppState(EnergyAppStateEnum.SubscriptionRequired)).toThrow();
        expect(() => optional.assertEnergyAppState(EnergyAppStateEnum.Running)).not.toThrow();

        const required = new InMemorySubscriptions([], undefined, EnyoSubscriptionModeEnum.Required);
        expect(() => required.assertEnergyAppState(EnergyAppStateEnum.SubscriptionRequired)).not.toThrow();
    });

    it('returns the initial subscriptions without notifying listeners', async () => {
        const subscriptions = new InMemorySubscriptions([subscription()]);
        expect(await subscriptions.getSubscriptions()).toEqual([subscription()]);
    });

    it('notifies listeners about new and changed subscriptions', async () => {
        const subscriptions = new InMemorySubscriptions();
        const events: EnyoSubscriptionChangeEvent[] = [];
        subscriptions.listenForSubscriptionChanges((event) => {
            events.push(event);
        });

        await subscriptions.upsertSubscription(subscription({status: EnyoSubscriptionStatusEnum.Trialing}));
        await subscriptions.upsertSubscription(subscription());

        expect(events.map((e) => [e.previousStatus, e.subscription.status])).toEqual([
            [undefined, EnyoSubscriptionStatusEnum.Trialing],
            [EnyoSubscriptionStatusEnum.Trialing, EnyoSubscriptionStatusEnum.Active],
        ]);
        expect(await subscriptions.getSubscriptions()).toHaveLength(1);
    });

    it('stops notifying removed listeners', async () => {
        const subscriptions = new InMemorySubscriptions();
        let calls = 0;
        const listenerId = subscriptions.listenForSubscriptionChanges(() => {
            calls++;
        });
        subscriptions.listenForSubscriptionChanges(() => {
            calls++;
        });

        subscriptions.removeListener(listenerId);
        await subscriptions.upsertSubscription(subscription());
        expect(calls).toBe(1);

        subscriptions.removeAllListeners();
        await subscriptions.upsertSubscription(subscription());
        expect(calls).toBe(1);
    });
});
