import type {EnergyAppSubscriptions} from '../../packages/energy-app-subscriptions.js';
import type {EnyoSubscription, EnyoSubscriptionChangeListener} from '../../types/enyo-subscription.js';

/**
 * In-memory implementation of {@link EnergyAppSubscriptions} for tests and
 * local development.
 *
 * It holds the subscriptions in memory and lets a test play the part of enyo:
 * {@link upsertSubscription} simulates a purchase, renewal, cancellation,
 * failed payment or expiry and notifies the registered listeners exactly like
 * the host would.
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
    private nextListenerId = 1;

    /**
     * @param initialSubscriptions - Subscriptions that exist before the app
     *   starts. They do not trigger listeners.
     */
    constructor(initialSubscriptions: EnyoSubscription[] = []) {
        for (const subscription of initialSubscriptions) {
            this.subscriptions.set(subscription.subscriptionId, {...subscription});
        }
    }

    /**
     * Returns copies of all stored subscriptions.
     *
     * @returns Promise that resolves to the subscriptions in insertion order
     */
    async getSubscriptions(): Promise<EnyoSubscription[]> {
        return [...this.subscriptions.values()].map(subscription => ({...subscription}));
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
        this.subscriptions.set(subscription.subscriptionId, {...subscription});

        for (const listener of [...this.listeners.values()]) {
            await listener({subscription: {...subscription}, previousStatus});
        }
    }
}
