/**
 * Authoring and runtime helpers for subscription plans
 * ({@link EnergyAppPackageDefinition.subscriptionPlans}).
 *
 * `defineSubscriptionPlan()` is an identity helper that type-checks a plan
 * where it is written — mirroring `definePublicFile()` and
 * `defineFirmwareFile()`. `isSubscriptionActive()` and `isPlanActive()` hold
 * the single rule for which subscription statuses grant access, so every app
 * applies it the same way.
 *
 * Pair with `validatePackageSubscriptionPlans()`
 * (`./subscription-plan-validators.ts`) to fail fast before publishing.
 */

import type {EnergyAppPackageSubscriptionPlan} from '../../energy-app-package-definition.js';
import {
    EnyoSubscription,
    EnyoSubscriptionStatus,
    EnyoSubscriptionStatusEnum
} from '../../types/enyo-subscription.js';

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
