import {EnyoCurrencyEnum} from "./enyo-currency.js";

/**
 * How often a plan is paid for.
 *
 * The plan's price is always the total for one interval: the amount per
 * month, the amount per year, or the single amount of a one-time purchase.
 */
export enum EnyoSubscriptionPaymentIntervalEnum {
    /**
     * Paid once and never renewed. The purchase stays `active` with no end
     * date; it only becomes `expired` if enyo refunds it.
     */
    OneTime = 'one-time',
    /** Charged once per month and renewed automatically until cancelled. */
    Monthly = 'monthly',
    /** Charged once per year and renewed automatically until cancelled. */
    Yearly = 'yearly',
}

/**
 * String union of every payment interval, derived from
 * {@link EnyoSubscriptionPaymentIntervalEnum} so both spellings stay
 * interchangeable.
 */
export type EnyoSubscriptionPaymentInterval = `${EnyoSubscriptionPaymentIntervalEnum}`;

/**
 * The price of a subscription plan in one currency.
 *
 * The amount is always the **total for one payment interval** — per month
 * for `monthly`, per year for `yearly`, and the single amount for `one-time`.
 * It is never converted between intervals: a yearly plan for 41.18 € is
 * charged 41.18 € once per year.
 *
 * The amount is **net**: enyo adds the VAT that applies to the customer at
 * checkout and on the invoice.
 */
export interface EnyoSubscriptionPrice {
    /**
     * Net total per payment interval in the price's currency (not cent), e.g.
     * `41.18` for 41.18 € per year on a yearly plan. At most two decimal
     * places.
     */
    amountWithoutTax: number;
    /** Currency of {@link amountWithoutTax}. */
    currency: EnyoCurrencyEnum;
}

/**
 * Lifecycle status of a subscription.
 *
 * Use `isSubscriptionActive()` or `isPlanActive()` to decide whether the
 * customer may use what the plan unlocks — it treats `trialing`, `active`,
 * `cancelled-until-period-end` and `grace` as active, so every app applies
 * the same rule.
 *
 * A `one-time` purchase is only ever `active` or `expired`: it has no trial,
 * no renewal and therefore no cancellation or grace period.
 */
export enum EnyoSubscriptionStatusEnum {
    /** In the free trial declared by the plan; nothing has been charged yet. */
    Trialing = 'trialing',
    /** Paid for the current period and renews automatically. */
    Active = 'active',
    /**
     * Cancelled by the customer, but paid until
     * {@link EnyoSubscription.currentPeriodEndIso}. It does not renew and
     * becomes `expired` when the period ends.
     */
    CancelledUntilPeriodEnd = 'cancelled-until-period-end',
    /**
     * The renewal payment failed and enyo is retrying it. The customer keeps
     * access until {@link EnyoSubscription.graceUntilIso}.
     */
    Grace = 'grace',
    /** Ended, or refunded. The customer must buy the plan again to regain access. */
    Expired = 'expired',
}

/**
 * String union of every subscription status, derived from
 * {@link EnyoSubscriptionStatusEnum} so both spellings stay interchangeable.
 */
export type EnyoSubscriptionStatus = `${EnyoSubscriptionStatusEnum}`;

/**
 * A subscription the customer bought for this energy app on this device.
 *
 * Subscriptions belong to the device the app runs on: the same plan bought on
 * another device is a separate subscription and is not visible here.
 */
export interface EnyoSubscription {
    /** Unique id of the subscription, assigned by enyo. Stable across renewals. */
    subscriptionId: string;
    /**
     * The plan this subscription is for. Matches
     * {@link EnergyAppPackageSubscriptionPlan.planKey} of the package
     * definition.
     */
    planKey: string;
    /** Current lifecycle status. */
    status: EnyoSubscriptionStatus;
    /** How often the subscription is paid for. */
    paymentInterval: EnyoSubscriptionPaymentInterval;
    /**
     * The net total the customer pays per payment interval (per month, per
     * year, or once for `one-time`). Fixed at purchase:
     * a later price change in the package definition only applies to new
     * purchases.
     */
    price: EnyoSubscriptionPrice;
    /** ISO 8601 timestamp of when the subscription was bought. */
    startedAtIso: string;
    /**
     * ISO 8601 timestamp of when the current paid period (or the trial)
     * started. For a `one-time` purchase this is the time of purchase.
     */
    currentPeriodStartIso: string;
    /**
     * ISO 8601 timestamp of when the current paid period (or the trial) ends.
     * The subscription renews at this point unless it was cancelled. Not set
     * for a `one-time` purchase, which does not end.
     */
    currentPeriodEndIso?: string;
    /** ISO 8601 timestamp of when the free trial ends. Only set when the plan has a trial. */
    trialEndIso?: string;
    /** ISO 8601 timestamp of when the customer cancelled. Only set once cancelled. */
    cancelledAtIso?: string;
    /**
     * ISO 8601 timestamp until which access is kept while a failed renewal
     * payment is retried. Only set while the status is `grace`.
     */
    graceUntilIso?: string;
}

/**
 * Passed to the listener registered with
 * {@link EnergyAppSubscriptions.listenForSubscriptionChanges} whenever a
 * subscription is created or changes.
 */
export interface EnyoSubscriptionChangeEvent {
    /** The subscription as it is now. */
    subscription: EnyoSubscription;
    /**
     * The status before this change. `undefined` when the subscription is new.
     * Equal to the current status for changes that keep the status, such as a
     * renewal of an active subscription.
     */
    previousStatus?: EnyoSubscriptionStatus;
}

/**
 * Callback invoked for every new or changed subscription.
 *
 * @param event - The changed subscription and its previous status.
 */
export type EnyoSubscriptionChangeListener = (event: EnyoSubscriptionChangeEvent) => void | Promise<void>;
