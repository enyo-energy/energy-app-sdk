import {EnyoSubscription, EnyoSubscriptionChangeListener} from "../types/enyo-subscription.js";

/**
 * Interface for reading the subscriptions a customer bought for this energy
 * app on this device.
 *
 * The plans an app sells, and their prices, are declared in the package
 * definition ({@link EnergyAppPackageDefinition.subscriptionPlans}). Buying,
 * renewing, cancelling and refunding are handled entirely by enyo, never by
 * the app: the app only reads the result and reacts to it. To point the user
 * to an offer, send a notification with a `subscription-offer` target, or set
 * the app state to `SubscriptionRequired` when the whole app needs a plan.
 *
 * Subscriptions belong to the device the app runs on. The host keeps the last
 * known state on the device, so {@link getSubscriptions} keeps working while
 * the device is offline, and status changes that only depend on time — a trial
 * or grace period ending, a cancelled subscription expiring — are reported even
 * without a connection.
 *
 * When a plan stops being active, the app must fall back to a safe behaviour.
 * For example, release any control it holds over a heat pump, wallbox or
 * battery instead of leaving the appliance in the last commanded state.
 *
 * Access to this API requires the `Subscriptions` permission
 * ({@link EnergyAppPermissionType}); {@link EnergyApp.useSubscriptions} throws
 * when it has not been granted.
 *
 * @example
 * ```typescript
 * const subscriptions = energyApp.useSubscriptions();
 *
 * // On boot: read the current state.
 * applyPlan(isPlanActive(await subscriptions.getSubscriptions(), 'premium'));
 *
 * // Afterwards: react to purchases, renewals, cancellations and expiry.
 * subscriptions.listenForSubscriptionChanges(async () => {
 *     applyPlan(isPlanActive(await subscriptions.getSubscriptions(), 'premium'));
 * });
 * ```
 */
export interface EnergyAppSubscriptions {
    /**
     * Returns every subscription of this app on this device, including
     * cancelled and expired ones, so the app can tell "never bought" from
     * "expired".
     *
     * @returns Promise that resolves to the subscriptions, in no particular order
     * @throws {EnergyAppPermissionNotGrantedError} If the `Subscriptions`
     *   permission is not granted.
     */
    getSubscriptions(): Promise<EnyoSubscription[]>;

    /**
     * Registers a listener that is called whenever a subscription of this app
     * on this device is created or changes — a purchase, a renewal, a
     * cancellation, a failed payment, or the end of a trial, grace or paid
     * period.
     *
     * The listener is not called for the state that exists when it is
     * registered. Read that with {@link getSubscriptions} on boot.
     *
     * @param listener - Callback invoked for every new or changed subscription. May be async.
     * @returns The listener ID, to be passed to {@link removeListener}
     * @throws {EnergyAppPermissionNotGrantedError} If the `Subscriptions`
     *   permission is not granted.
     */
    listenForSubscriptionChanges(listener: EnyoSubscriptionChangeListener): string;

    /**
     * Removes a listener previously registered with
     * {@link listenForSubscriptionChanges}.
     *
     * @param listenerId - The ID returned by {@link listenForSubscriptionChanges}
     */
    removeListener(listenerId: string): void;

    /**
     * Removes every subscription listener registered by this app.
     */
    removeAllListeners(): void;
}
