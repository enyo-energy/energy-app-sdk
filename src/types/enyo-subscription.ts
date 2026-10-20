import {EnyoCurrencyEnum} from "./enyo-currency.js";
import type {EnergyAppPackageLanguage} from "../energy-app-package-definition.js";

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
 * For a `per-unit` plan the amount is the total per unit: 3 units of a
 * yearly plan for 10 € are charged 30 € per year.
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
 * What a plan's price is charged for.
 */
export enum EnyoSubscriptionPricingModelEnum {
    /**
     * One price for the package on this device, however many appliances,
     * vehicles or other units the app manages.
     */
    PerPackage = 'per-package',
    /**
     * The price is charged once per unit the app reports with
     * {@link EnergyAppSubscriptions.setUnits} — for example per wallbox or per
     * vehicle. The quantity comes from the energy app, not from the customer.
     */
    PerUnit = 'per-unit',
}

/**
 * String union of every pricing model, derived from
 * {@link EnyoSubscriptionPricingModelEnum} so both spellings stay
 * interchangeable.
 */
export type EnyoSubscriptionPricingModel = `${EnyoSubscriptionPricingModelEnum}`;

/**
 * What kind of thing a unit of a `per-unit` plan is.
 */
export enum EnyoSubscriptionUnitTypeEnum {
    /** An appliance; the reference is its appliance id. */
    Appliance = 'appliance',
    /** A vehicle; the reference is its vehicle id. */
    Vehicle = 'vehicle',
    /** Anything else; the reference is chosen by the app and the unit carries a translated name. */
    Custom = 'custom',
}

/**
 * String union of every unit type, derived from
 * {@link EnyoSubscriptionUnitTypeEnum} so both spellings stay interchangeable.
 */
export type EnyoSubscriptionUnitType = `${EnyoSubscriptionUnitTypeEnum}`;

/**
 * A translated name of a custom unit, shown on the offer screen, the invoice
 * and the customer's subscription overview.
 *
 * Mirrors the translation shape used elsewhere in the SDK (see
 * {@link EnyoPackageConfigurationTranslatedValue}).
 */
export interface EnyoSubscriptionUnitTranslation {
    /** Language code this translation applies to. */
    language: EnergyAppPackageLanguage;
    /** The displayed name in the given language. */
    value: string;
}

/**
 * Fields every subscription unit has.
 */
interface EnyoSubscriptionUnitBase {
    /**
     * The id this unit is paid under. Together with `type` it identifies the
     * unit, so it must stay the same for as long as the unit exists — a new
     * reference reads as a new unit that has not been paid for.
     */
    referenceId: string;
}

/**
 * An appliance billed as one unit. Its name is taken from the appliance.
 */
export interface EnyoSubscriptionApplianceUnit extends EnyoSubscriptionUnitBase {
    /** Discriminator identifying this as an appliance unit. */
    type: 'appliance';
}

/**
 * A vehicle billed as one unit. Its name is taken from the vehicle.
 */
export interface EnyoSubscriptionVehicleUnit extends EnyoSubscriptionUnitBase {
    /** Discriminator identifying this as a vehicle unit. */
    type: 'vehicle';
}

/**
 * Any other thing billed as one unit, for example a room or a charging card.
 */
export interface EnyoSubscriptionCustomUnit extends EnyoSubscriptionUnitBase {
    /** Discriminator identifying this as a custom unit. */
    type: 'custom';
    /** Translated name of the unit. Entries for `de` and `en` are required. */
    name: EnyoSubscriptionUnitTranslation[];
}

/**
 * One unit of a `per-unit` plan: an appliance, a vehicle, or a custom unit
 * with a translated name. Identified by `type` plus `referenceId`.
 */
export type EnyoSubscriptionUnit =
    | EnyoSubscriptionApplianceUnit
    | EnyoSubscriptionVehicleUnit
    | EnyoSubscriptionCustomUnit;

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
    /** Whether the price is charged for the package or per unit. */
    pricingModel: EnyoSubscriptionPricingModel;
    /**
     * The net total the customer pays per payment interval (per month, per
     * year, or once for `one-time`) — for a `per-unit` subscription, per unit.
     * Fixed at purchase: a later price change in the package definition only
     * applies to new purchases.
     */
    price: EnyoSubscriptionPrice;
    /**
     * The units this subscription is paid for. Only set for `per-unit`
     * subscriptions. A unit the app reported but that is missing here has not
     * been paid for yet; use `isUnitActive()` to check a single unit.
     */
    units?: EnyoSubscriptionUnit[];
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
     * renewal of an active subscription or units added to it.
     */
    previousStatus?: EnyoSubscriptionStatus;
}

/**
 * Callback invoked for every new or changed subscription.
 *
 * @param event - The changed subscription and its previous status.
 */
export type EnyoSubscriptionChangeListener = (event: EnyoSubscriptionChangeEvent) => void | Promise<void>;
