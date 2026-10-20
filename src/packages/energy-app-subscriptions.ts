import {
    EnyoSubscription,
    EnyoSubscriptionChangeListener,
    EnyoSubscriptionCustomUnit,
    EnyoSubscriptionUnit
} from "../types/enyo-subscription.js";

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
 * A `per-unit` plan is charged once per unit, and the quantity comes from
 * the app:
 *
 * - **Appliances and vehicles** are marked as billed where the app creates
 *   them — {@link EnyoAppliance.billing} when saving an appliance,
 *   {@link EnyoVehiclePairResult.billing} when pairing a vehicle. The host
 *   keeps these units in step with the appliances and vehicle links itself.
 * - **Anything else** is reported as custom units with {@link setUnits}.
 *
 * enyo offers and charges the plan for all of them.
 * {@link EnyoSubscription.units} lists the units that are paid for; check a
 * single unit with `isUnitActive()`.
 *
 * Because the host sees appliances and vehicles go away, it decides how a
 * removal is billed, by its reason:
 *
 * | Unit leaves because… | Billing |
 * |---|---|
 * | The customer disconnected or removed it in the enyo app, or deleted the vehicle | The quantity drops at the next renewal; removing the last unit cancels the subscription at the end of the period. Nothing is refunded. |
 * | The app unlinked the car because it is gone from the vendor account (`unpairVehicle(id, 'vehicle-not-found')`) | Same as above. |
 * | Vendor sign-out | Unchanged — usually followed by signing in again; a paid unit stays paid. |
 * | The app unlinked the car because the vendor revoked access (`unpairVehicle(id, 'access-revoked')`) | Unchanged — access is usually granted again. |
 * | Unknown reason, `unpairVehicle()` without a reason, or the app's own report shrinks | Unchanged. |
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
     * Reports the custom units the app currently manages for a `per-unit`
     * plan, replacing the previously reported list. Together with the
     * appliances and vehicles marked as billed under the plan, they make up the
     * quantity enyo offers the plan for.
     *
     * Only custom units are reported here. Appliances and vehicles are marked
     * with {@link EnyoAppliance.billing} and
     * {@link EnyoVehiclePairResult.billing} instead, and the host keeps those
     * units itself.
     *
     * Call it on boot and whenever a custom unit is added or removed, with the
     * full list each time. A unit is identified by its `referenceId`, so keep
     * it stable: a changed reference reads as a removed and a new, unpaid
     * unit. A shorter list never cancels or refunds anything the customer paid
     * for; how a removal is billed is decided by enyo.
     *
     * Reporting a unit does not pay for it. Once the customer has paid, the
     * unit appears in {@link EnyoSubscription.units} and the change listeners
     * are called.
     *
     * @param planKey - The key of a `per-unit` plan declared in the package definition.
     * @param units - Every custom unit the app currently manages for the
     *   plan; an empty list when there is none.
     * @returns Promise that resolves once the host has stored the units
     * @throws {Error} If `planKey` is not a `per-unit` plan of this package,
     *   or a unit is invalid (not a custom unit, empty reference, duplicate
     *   `referenceId`, no `de` and `en` name).
     * @throws {EnergyAppPermissionNotGrantedError} If the `Subscriptions`
     *   permission is not granted.
     *
     * @example
     * ```typescript
     * await subscriptions.setUnits('room-climate', rooms.map(room => ({
     *     type: EnyoSubscriptionUnitTypeEnum.Custom,
     *     referenceId: room.id,
     *     name: [{language: 'en', value: room.nameEn}, {language: 'de', value: room.nameDe}]
     * })));
     * ```
     */
    setUnits(planKey: string, units: EnyoSubscriptionCustomUnit[]): Promise<void>;

    /**
     * Returns the current units of a `per-unit` plan, whether paid for or
     * not: the appliances and vehicles marked as billed under the plan, plus
     * the custom units last reported with {@link setUnits}.
     *
     * @param planKey - The key of a `per-unit` plan declared in the package definition.
     * @returns Promise that resolves to the reported units; an empty list when
     *   none were reported yet
     * @throws {EnergyAppPermissionNotGrantedError} If the `Subscriptions`
     *   permission is not granted.
     */
    getUnits(planKey: string): Promise<EnyoSubscriptionUnit[]>;

    /**
     * Registers a listener that is called whenever a subscription of this app
     * on this device is created or changes — a purchase, a renewal, a
     * cancellation, a failed payment, units paid for or removed, or the end of
     * a trial, grace or paid period.
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
