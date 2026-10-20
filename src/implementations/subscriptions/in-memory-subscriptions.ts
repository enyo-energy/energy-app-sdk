import type {EnergyAppPackageSubscriptionPlan} from '../../energy-app-package-definition.js';
import type {EnergyAppStateEnum} from '../../enyo-energy-app-sdk.js';
import type {EnergyAppSubscriptions} from '../../packages/energy-app-subscriptions.js';
import {
    EnyoSubscription,
    EnyoSubscriptionChangeListener,
    EnyoSubscriptionMode,
    EnyoSubscriptionPricingModelEnum,
    EnyoSubscriptionCustomUnit,
    EnyoSubscriptionUnit,
    EnyoSubscriptionUnitTypeEnum
} from '../../types/enyo-subscription.js';
import {
    assertEnergyAppStateMatchesSubscriptionMode,
    validateSubscriptionUnits
} from './subscription-plan-validators.js';

/**
 * In-memory implementation of {@link EnergyAppSubscriptions} for tests and
 * local development.
 *
 * It holds the subscriptions in memory and lets a test play the part of enyo:
 * {@link upsertSubscription} simulates a purchase, renewal, cancellation,
 * failed payment or expiry and notifies the registered listeners exactly like
 * the host would. Units reported with {@link setUnits} are kept per plan and
 * can be read back with {@link getUnits}, together with the billed appliance
 * and vehicle units a test sets with {@link setBilledUnits}. {@link assertEnergyAppState}
 * checks a reported app state against the package's subscription mode.
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
    private readonly customUnitsByPlan = new Map<string, EnyoSubscriptionCustomUnit[]>();
    private readonly billedUnitsByPlan = new Map<string, EnyoSubscriptionUnit[]>();
    private nextListenerId = 1;

    /**
     * @param initialSubscriptions - Subscriptions that exist before the app
     *   starts. They do not trigger listeners.
     * @param plans - Optional plans of the package. When given,
     *   {@link setUnits} and {@link setBilledUnits} reject plan keys that are
     *   not declared as `per-unit`, like the host does. When omitted, every
     *   plan key is accepted.
     * @param subscriptionMode - Optional subscription mode of the package,
     *   checked by {@link assertEnergyAppState}.
     */
    constructor(
        initialSubscriptions: EnyoSubscription[] = [],
        private readonly plans?: EnergyAppPackageSubscriptionPlan[],
        private readonly subscriptionMode?: EnyoSubscriptionMode,
    ) {
        for (const subscription of initialSubscriptions) {
            this.subscriptions.set(subscription.subscriptionId, structuredClone(subscription));
        }
    }

    /**
     * Stores the custom units reported for a `per-unit` plan, replacing
     * earlier ones.
     *
     * @param planKey - The key of the plan.
     * @param units - Every custom unit the app currently manages for the plan.
     * @returns Promise that resolves once the units are stored
     * @throws {Error} If a unit is not a custom unit or invalid, or `plans`
     *   were given and `planKey` is not a `per-unit` plan among them.
     */
    async setUnits(planKey: string, units: EnyoSubscriptionCustomUnit[]): Promise<void> {
        this.assertPerUnitPlan(planKey);

        const notCustom = units.filter(unit => unit.type !== EnyoSubscriptionUnitTypeEnum.Custom);
        if (notCustom.length > 0) {
            throw new Error(
                `setUnits() only takes custom units — mark appliances and vehicles with \`billing\` instead (got ${notCustom.map(unit => unit.type).join(', ')}).`,
            );
        }
        this.assertValidUnits(units);

        this.customUnitsByPlan.set(planKey, units.map(unit => structuredClone(unit)));
    }

    /**
     * Test helper: sets the appliance and vehicle units the host keeps for a
     * plan from their billing marks, replacing earlier ones — as if the app
     * had saved those appliances or paired those vehicles with
     * `billing: {billed: true, planKey}`.
     *
     * @param planKey - The key of the plan.
     * @param units - The billed appliance and vehicle units.
     * @returns Promise that resolves once the units are stored
     * @throws {Error} If a unit is a custom unit or invalid, or `plans` were
     *   given and `planKey` is not a `per-unit` plan among them.
     */
    async setBilledUnits(planKey: string, units: EnyoSubscriptionUnit[]): Promise<void> {
        this.assertPerUnitPlan(planKey);

        if (units.some(unit => unit.type === EnyoSubscriptionUnitTypeEnum.Custom)) {
            throw new Error('setBilledUnits() only takes appliance and vehicle units — report custom units with setUnits().');
        }
        this.assertValidUnits(units);

        this.billedUnitsByPlan.set(planKey, units.map(unit => structuredClone(unit)));
    }

    /**
     * Test helper: checks an app state against the subscription mode given to
     * the constructor. Call it wherever the app under test reports its state.
     *
     * @param state - The state the app reports.
     * @throws {Error} When the package's subscription mode is `optional` and
     *   the state is `subscription-required`.
     */
    assertEnergyAppState(state: EnergyAppStateEnum | `${EnergyAppStateEnum}`): void {
        assertEnergyAppStateMatchesSubscriptionMode(this.subscriptionMode, state);
    }

    /**
     * Returns copies of the current units of a plan: the billed appliances and
     * vehicles set with {@link setBilledUnits}, followed by the custom units
     * reported with {@link setUnits}.
     *
     * @param planKey - The key of the plan.
     * @returns Promise that resolves to the units; an empty list when none were reported
     */
    async getUnits(planKey: string): Promise<EnyoSubscriptionUnit[]> {
        return [
            ...(this.billedUnitsByPlan.get(planKey) ?? []),
            ...(this.customUnitsByPlan.get(planKey) ?? []),
        ].map(unit => structuredClone(unit));
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

    /**
     * Throws when `plans` were given and `planKey` is not a `per-unit` plan
     * among them.
     *
     * @param planKey - The key of the plan.
     */
    private assertPerUnitPlan(planKey: string): void {
        if (!this.plans) return;
        const plan = this.plans.find(candidate => candidate.planKey === planKey);
        if (plan?.pricingModel !== EnyoSubscriptionPricingModelEnum.PerUnit) {
            throw new Error(`Plan "${planKey}" is not a per-unit plan of this package.`);
        }
    }

    /**
     * Throws when the units break the host's rules.
     *
     * @param units - The units to check.
     */
    private assertValidUnits(units: EnyoSubscriptionUnit[]): void {
        const {ok, errors} = validateSubscriptionUnits(units);
        if (!ok) throw new Error(`Invalid subscription units:\n- ${errors.join('\n- ')}`);
    }
}
