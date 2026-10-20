import type {EnergyAppPackageSubscriptionPlan} from '../../energy-app-package-definition.js';
import type {EnergyAppSubscriptions} from '../../packages/energy-app-subscriptions.js';
import {
    EnyoSubscription,
    EnyoSubscriptionChangeListener,
    EnyoSubscriptionPricingModelEnum,
    EnyoSubscriptionUnit
} from '../../types/enyo-subscription.js';
import {validateSubscriptionUnits} from './subscription-plan-validators.js';

/**
 * In-memory implementation of {@link EnergyAppSubscriptions} for tests and
 * local development.
 *
 * It holds the subscriptions in memory and lets a test play the part of enyo:
 * {@link upsertSubscription} simulates a purchase, renewal, cancellation,
 * failed payment or expiry and notifies the registered listeners exactly like
 * the host would. Units reported with {@link setUnits} are kept per plan and
 * can be read back with {@link getUnits}.
 *
 * @example
 * ```typescript
 * const subscriptions = new InMemorySubscriptions();
 * const app = new MyApp(subscriptions);
 *
 * await subscriptions.upsertSubscription({
 *     subscriptionId: 'sub-1',
 *     planKey: 'premium',
 *     status: EnyoSubscriptionStatusEnum.Active,
 *     paymentInterval: EnyoSubscriptionPaymentIntervalEnum.Yearly,
 *     pricingModel: EnyoSubscriptionPricingModelEnum.PerPackage,
 *     price: {amountWithoutTax: 41.18, currency: EnyoCurrencyEnum.EUR},
 *     startedAtIso: '2026-01-01T00:00:00Z',
 *     currentPeriodStartIso: '2026-01-01T00:00:00Z',
 *     currentPeriodEndIso: '2027-01-01T00:00:00Z'
 * });
 * expect(app.isOptimising()).toBe(true);
 * ```
 */
export class InMemorySubscriptions implements EnergyAppSubscriptions {
    private readonly subscriptions = new Map<string, EnyoSubscription>();
    private readonly listeners = new Map<string, EnyoSubscriptionChangeListener>();
    private readonly unitsByPlan = new Map<string, EnyoSubscriptionUnit[]>();
    private nextListenerId = 1;

    /**
     * @param initialSubscriptions - Subscriptions that exist before the app
     *   starts. They do not trigger listeners.
     * @param plans - Optional plans of the package. When given, {@link setUnits}
     *   rejects plan keys that are not declared as `per-unit`, like the host
     *   does. When omitted, every plan key is accepted.
     */
    constructor(
        initialSubscriptions: EnyoSubscription[] = [],
        private readonly plans?: EnergyAppPackageSubscriptionPlan[],
    ) {
        for (const subscription of initialSubscriptions) {
            this.subscriptions.set(subscription.subscriptionId, structuredClone(subscription));
        }
    }

    /**
     * Stores the units reported for a `per-unit` plan, replacing earlier ones.
     *
     * @param planKey - The key of the plan.
     * @param units - Every unit the app currently manages for the plan.
     * @returns Promise that resolves once the units are stored
     * @throws {Error} If the units are invalid, or `plans` were given and
     *   `planKey` is not a `per-unit` plan among them.
     */
    async setUnits(planKey: string, units: EnyoSubscriptionUnit[]): Promise<void> {
        if (this.plans) {
            const plan = this.plans.find(candidate => candidate.planKey === planKey);
            if (plan?.pricingModel !== EnyoSubscriptionPricingModelEnum.PerUnit) {
                throw new Error(`Plan "${planKey}" is not a per-unit plan of this package.`);
            }
        }

        const {ok, errors} = validateSubscriptionUnits(units);
        if (!ok) throw new Error(`Invalid subscription units:\n- ${errors.join('\n- ')}`);

        this.unitsByPlan.set(planKey, units.map(unit => structuredClone(unit)));
    }

    /**
     * Returns copies of the units last reported for a plan.
     *
     * @param planKey - The key of the plan.
     * @returns Promise that resolves to the units; an empty list when none were reported
     */
    async getUnits(planKey: string): Promise<EnyoSubscriptionUnit[]> {
        return (this.unitsByPlan.get(planKey) ?? []).map(unit => structuredClone(unit));
    }

    /**
     * Returns copies of all stored subscriptions.
     *
     * @returns Promise that resolves to the subscriptions in insertion order
     */
    async getSubscriptions(): Promise<EnyoSubscription[]> {
        return [...this.subscriptions.values()].map(subscription => structuredClone(subscription));
    }

    /**
     * Registers a listener for new or changed subscriptions.
     *
     * @param listener - Callback invoked by {@link upsertSubscription}.
     * @returns The listener ID, to be passed to {@link removeListener}
     */
    listenForSubscriptionChanges(listener: EnyoSubscriptionChangeListener): string {
        const listenerId = `subscription-listener-${this.nextListenerId++}`;
        this.listeners.set(listenerId, listener);
        return listenerId;
    }

    /**
     * Removes a listener previously registered with
     * {@link listenForSubscriptionChanges}.
     *
     * @param listenerId - The ID returned by {@link listenForSubscriptionChanges}
     */
    removeListener(listenerId: string): void {
        this.listeners.delete(listenerId);
    }

    /**
     * Removes every registered listener.
     */
    removeAllListeners(): void {
        this.listeners.clear();
    }

    /**
     * Test helper: creates or replaces a subscription, keyed by
     * {@link EnyoSubscription.subscriptionId}, and notifies every listener —
     * with `previousStatus` unset for a new subscription.
     *
     * @param subscription - The subscription as it is after the change.
     * @returns Promise that resolves once every listener has completed
     */
    async upsertSubscription(subscription: EnyoSubscription): Promise<void> {
        const previousStatus = this.subscriptions.get(subscription.subscriptionId)?.status;
        this.subscriptions.set(subscription.subscriptionId, structuredClone(subscription));

        for (const listener of [...this.listeners.values()]) {
            await listener({subscription: structuredClone(subscription), previousStatus});
        }
    }
}
