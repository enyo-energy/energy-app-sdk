/**
 * Authoring and runtime helpers for subscription plans
 * ({@link EnergyAppPackageDefinition.subscriptionPlans}).
 *
 * `defineSubscriptionPlan()` is an identity helper that type-checks a plan
 * where it is written — mirroring `definePublicFile()` and
 * `defineFirmwareFile()`. `isSubscriptionActive()` and `isPlanActive()` hold
 * the single rule for which subscription statuses grant access, so every app
 * applies it the same way; `isUnitActive()` applies it to one unit of a
 * `per-unit` plan.
 *
 * Pair with `validatePackageSubscriptionPlans()`
 * (`./subscription-plan-validators.ts`) to fail fast before publishing.
 */

import type {EnergyAppPackageSubscriptionPlan} from '../../energy-app-package-definition.js';
import {
    EnyoSubscription,
    EnyoSubscriptionStatus,
    EnyoSubscriptionStatusEnum,
    EnyoSubscriptionUnit
} from '../../types/enyo-subscription.js';
import type {
    EnyoSubscriptionFeature,
    EnyoSubscriptionIncludedFeature,
    EnyoSubscriptionOfferScreen
} from '../../types/enyo-subscription-offer.js';

/**
 * Subscription statuses in which the customer may use what a plan unlocks.
 *
 * A cancelled subscription stays usable until its paid period ends, and a
 * subscription whose renewal payment failed stays usable during the grace
 * period.
 */
export const ACTIVE_SUBSCRIPTION_STATUSES: readonly EnyoSubscriptionStatus[] = [
    EnyoSubscriptionStatusEnum.Trialing,
    EnyoSubscriptionStatusEnum.Active,
    EnyoSubscriptionStatusEnum.CancelledUntilPeriodEnd,
    EnyoSubscriptionStatusEnum.Grace,
];

/**
 * Identity helper that type-checks a subscription plan at definition time
 * (mirrors `defineEnergyAppPackage`). Prefer this over a bare object literal so
 * mistakes surface where the plan is written.
 *
 * @param plan - The subscription plan to declare.
 * @returns The same plan, typed as {@link EnergyAppPackageSubscriptionPlan}.
 *
 * @example
 * ```typescript
 * defineSubscriptionPlan({
 *     planKey: 'premium',
 *     paymentInterval: EnyoSubscriptionPaymentIntervalEnum.Yearly,
 *     prices: [{amountWithoutTax: 41.18, currency: EnyoCurrencyEnum.EUR}],
 *     storeEntry: [
 *         {language: 'en', title: 'Premium', shortDescription: 'Optimises your heat pump with dynamic prices.'},
 *         {language: 'de', title: 'Premium', shortDescription: 'Optimiert deine Wärmepumpe mit dynamischen Preisen.'}
 *     ]
 * })
 * ```
 */
export function defineSubscriptionPlan(
    plan: EnergyAppPackageSubscriptionPlan,
): EnergyAppPackageSubscriptionPlan {
    return plan;
}

/**
 * Tests whether a subscription currently grants access, i.e. whether its
 * status is one of {@link ACTIVE_SUBSCRIPTION_STATUSES}.
 *
 * @param subscription - The subscription to check.
 * @returns True when the customer may use what the subscription's plan unlocks.
 */
export function isSubscriptionActive(subscription: EnyoSubscription): boolean {
    return ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status);
}

/**
 * Tests whether the customer has an active subscription for a plan.
 *
 * @param subscriptions - The subscriptions, as returned by
 *   {@link EnergyAppSubscriptions.getSubscriptions}.
 * @param planKey - The {@link EnergyAppPackageSubscriptionPlan.planKey} to check.
 * @returns True when at least one subscription for the plan is active.
 *
 * @example
 * ```typescript
 * const subscriptions = await energyApp.useSubscriptions().getSubscriptions();
 * if (isPlanActive(subscriptions, 'premium')) {
 *     enableOptimisation();
 * }
 * ```
 */
export function isPlanActive(subscriptions: EnyoSubscription[], planKey: string): boolean {
    return subscriptions.some(subscription => subscription.planKey === planKey && isSubscriptionActive(subscription));
}

/**
 * Tests whether two units are the same unit, i.e. have the same `type` and
 * `referenceId`. The name of a custom unit is not compared.
 *
 * @param a - The first unit.
 * @param b - The second unit.
 * @returns True when both identify the same unit.
 */
export function isSameSubscriptionUnit(
    a: Pick<EnyoSubscriptionUnit, 'type' | 'referenceId'>,
    b: Pick<EnyoSubscriptionUnit, 'type' | 'referenceId'>,
): boolean {
    return a.type === b.type && a.referenceId === b.referenceId;
}

/**
 * Tests whether one unit of a `per-unit` plan is paid for, i.e. whether an
 * active subscription for the plan lists the unit in
 * {@link EnyoSubscription.units}.
 *
 * @param subscriptions - The subscriptions, as returned by
 *   {@link EnergyAppSubscriptions.getSubscriptions}.
 * @param planKey - The {@link EnergyAppPackageSubscriptionPlan.planKey} to check.
 * @param unit - The unit to check, identified by `type` and `referenceId`.
 * @returns True when the unit is covered by an active subscription for the plan.
 *
 * @example
 * ```typescript
 * const subscriptions = await energyApp.useSubscriptions().getSubscriptions();
 * if (isUnitActive(subscriptions, 'smart-charging', {type: 'appliance', referenceId: wallbox.id})) {
 *     enableSmartCharging(wallbox);
 * }
 * ```
 */
export function isUnitActive(
    subscriptions: EnyoSubscription[],
    planKey: string,
    unit: Pick<EnyoSubscriptionUnit, 'type' | 'referenceId'>,
): boolean {
    return subscriptions.some(subscription =>
        subscription.planKey === planKey
        && isSubscriptionActive(subscription)
        && (subscription.units ?? []).some(paid => isSameSubscriptionUnit(paid, unit)));
}

/**
 * Identity helper that type-checks a feature of the package's feature catalog
 * ({@link EnergyAppPackageDefinition.subscriptionFeatures}) where it is
 * written.
 *
 * @param feature - The feature declaration.
 * @returns The same feature, unchanged.
 *
 * @example
 * ```typescript
 * defineSubscriptionFeature({
 *     featureKey: 'price-optimisation',
 *     icon: EnyoSubscriptionOfferIconEnum.PiggyBank,
 *     storeEntry: [
 *         {language: 'en', title: 'Dynamic price optimisation'},
 *         {language: 'de', title: 'Optimierung nach dynamischen Preisen'}
 *     ]
 * })
 * ```
 */
export function defineSubscriptionFeature(feature: EnyoSubscriptionFeature): EnyoSubscriptionFeature {
    return feature;
}

/**
 * Identity helper that type-checks the package's offer screen
 * ({@link EnergyAppPackageDefinition.subscriptionOfferScreen}) where it is
 * written.
 *
 * @param screen - The offer screen declaration.
 * @returns The same offer screen, unchanged.
 */
export function defineSubscriptionOfferScreen(screen: EnyoSubscriptionOfferScreen): EnyoSubscriptionOfferScreen {
    return screen;
}

/**
 * Returns the feature key of an included feature, whether it was declared as
 * a plain key or with a value.
 *
 * @param feature - An entry of {@link EnergyAppPackageSubscriptionPlan.includedFeatures}
 *   or {@link EnyoSubscriptionFreeTier.includedFeatures}.
 * @returns Its {@link EnyoSubscriptionFeature.featureKey}.
 */
export function getIncludedFeatureKey(feature: EnyoSubscriptionIncludedFeature): string {
    return typeof feature === 'string' ? feature : feature.featureKey;
}
