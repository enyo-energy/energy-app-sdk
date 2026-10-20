import {EnergyAppPackageLanguage} from "../energy-app-package-definition.js";

/**
 * Lifecycle category of a notification.
 *
 * Categories must be registered with the host (via
 * {@link EnergyAppNotification.registerNotificationCategory}) before any
 * notification using that category can be sent. This allows the host to
 * pre-allocate UI surfaces (badges, sections, inbox tabs) and to enforce
 * per-category rate limits.
 *
 * - `connection-issue`: The package has detected a connectivity problem with
 *   an appliance, gateway, or upstream service that requires user attention.
 * - `onboarding-required`: The package needs the user to complete (or revisit)
 *   an onboarding flow before it can continue operating normally.
 * - `charging-issue`: The app expected an appliance to charge — it sent a
 *   start or resume, gave the charger power, or scheduled a charge — but the
 *   appliance is not charging. See "Sending a `charging-issue`" on
 *   {@link EnergyAppNotification} for when to send it.
 * - `battery-issue`: The app commanded a battery to charge, discharge or hold,
 *   but the battery is not following the command. See "Sending a
 *   `battery-issue`" on {@link EnergyAppNotification} for when to send it.
 * - `authentication-required`: A sign-in that used to work was lost (expired
 *   or revoked) and the user has to sign in again before the package can
 *   continue. See "Sending an `authentication-required`" on
 *   {@link EnergyAppNotification} for when to send it.
 */
export type EnyoNotificationCategory =
    | 'connection-issue'
    | 'onboarding-required'
    | 'charging-issue'
    | 'battery-issue'
    | 'authentication-required';

/**
 * Registration payload describing a notification category to the host.
 *
 * The host uses the translated `name` and optional `description` to render
 * the category in user-facing surfaces (settings screens, inbox filters,
 * etc.) without the package needing to ship per-host UI strings.
 */
export interface EnyoNotificationCategoryRegistration {
    /** Category identifier this registration applies to. */
    category: EnyoNotificationCategory;
    /** Translated, human-readable name of the category. */
    name: EnyoNotificationCategoryTranslation[];
    /** Optional translated description shown alongside the category name. */
    description?: EnyoNotificationCategoryTranslation[];
}

/**
 * Translated label for a notification category, used during registration.
 */
export interface EnyoNotificationCategoryTranslation {
    /** Language code for this translation. */
    language: EnergyAppPackageLanguage;
    /** Display name of the category in the given language. */
    name: string;
    /** Optional description of the category in the given language. */
    description?: string;
}

/**
 * Target object describing an in-app destination the user is routed to when
 * they interact with a notification. Discriminated by the `type` field so
 * additional target kinds can be added without breaking existing consumers.
 */
export type EnyoNotificationTarget =
    | EnyoNotificationOnboardingTarget
    | EnyoNotificationEnergyAppSettingsTarget
    | EnyoNotificationApplianceSettingsTarget
    | EnyoNotificationSubscriptionOfferTarget
    | EnyoNotificationApplianceTarget
    | EnyoNotificationAuthenticationTarget;

/**
 * Target that opens an onboarding guide previously registered with the host.
 *
 * Use this for notifications whose category is `onboarding-required` (or any
 * other case where the resolution is "walk the user through onboarding").
 */
export interface EnyoNotificationOnboardingTarget {
    /** Discriminator identifying this as an onboarding target. */
    type: 'onboarding';
    /**
     * Name of the onboarding guide to open. Must match the `guideName` of a
     * guide previously registered via the onboarding package.
     */
    onboardingName: string;
}

/**
 * Target that opens the settings screen for the energy app package itself
 * (package-wide settings registered via the settings package, not scoped to
 * a specific appliance).
 */
export interface EnyoNotificationEnergyAppSettingsTarget {
    /** Discriminator identifying this as an energy app settings target. */
    type: 'energy-app-settings';
}

/**
 * Target that opens the settings screen for a specific appliance managed by
 * the energy app package.
 *
 * To show the appliance's live state instead (e.g. for a `charging-issue`),
 * use {@link EnyoNotificationApplianceTarget}.
 */
export interface EnyoNotificationApplianceSettingsTarget {
    /** Discriminator identifying this as an appliance settings target. */
    type: 'appliance-settings';
    /**
     * Identifier of the appliance whose settings should be opened. Must match
     * an appliance id known to the host.
     */
    applianceId: string;
}

/**
 * Target that opens the live view of a specific appliance (its current
 * state, power and session), as opposed to its settings screen.
 *
 * This is the target to use for `charging-issue` and `battery-issue`
 * notifications.
 */
export interface EnyoNotificationApplianceTarget {
    /** Discriminator identifying this as an appliance target. */
    type: 'appliance';
    /**
     * Identifier of the appliance to open. Must match an appliance id known
     * to the host.
     */
    applianceId: string;
}

/**
 * Target that opens the package's pending sign-in, i.e. the authentication
 * request previously created via
 * {@link EnergyAppAuthentication.requestAuthentication}.
 *
 * This is the target to use for `authentication-required` notifications.
 * Create the authentication request before sending the notification, so that
 * there is a sign-in for the host to open.
 */
export interface EnyoNotificationAuthenticationTarget {
    /** Discriminator identifying this as an authentication target. */
    type: 'authentication';
    /**
     * Identifier of the appliance the sign-in belongs to. Set it when the
     * authentication request was created for a specific appliance
     * ({@link EnyoAuthentication.applianceId}); omit it for a package-wide
     * sign-in.
     */
    applianceId?: string;
}

/**
 * Target that opens enyo's offer screen for one of the package's
 * subscription plans, from where the user can buy it.
 *
 * The app never learns whether the user bought the plan from this
 * notification; a purchase arrives like any other through
 * {@link EnergyAppSubscriptions.listenForSubscriptionChanges}.
 */
export interface EnyoNotificationSubscriptionOfferTarget {
    /** Discriminator identifying this as a subscription offer target. */
    type: 'subscription-offer';
    /**
     * Key of the plan to offer. Must match a
     * {@link EnergyAppPackageSubscriptionPlan.planKey} declared in the package
     * definition.
     */
    planKey: string;
}

/**
 * Configuration options for notification display and behavior.
 */
export interface EnyoNotificationOptions {
    /** Optional appliance ID if notification is specific to an appliance. */
    applianceId?: string;
    /**
     * Optional in-app destination the user is routed to when they interact
     * with the notification.
     */
    target?: EnyoNotificationTarget;
}

/**
 * Translated notification content for multi-language support.
 *
 * Each translation provides both a short `title` (shown in lists, headers
 * and system notifications) and a longer `body` (shown in the expanded
 * detail view).
 */
export interface EnyoNotificationTranslation {
    /** Language code for this translation. */
    language: EnergyAppPackageLanguage;
    /** Short headline shown in notification lists and system banners. */
    title: string;
    /** Longer message body shown when the notification is expanded. */
    body: string;
}

/**
 * Error reasons returned by {@link EnergyAppNotification.sendNotification}
 * when a notification cannot be delivered.
 *
 * - `not-registered`: The supplied category has not been registered with the
 *   host via {@link EnergyAppNotification.registerNotificationCategory}.
 * - `rate-limit`: The package has exceeded the host's notification rate
 *   limit for the supplied category and must back off before retrying.
 *   For `charging-issue` and `battery-issue` the limit is one notification
 *   per appliance per 30 minutes; for `authentication-required` it is one
 *   per package (or per appliance, for an appliance sign-in) per 24 hours.
 */
export type EnyoNotificationSendErrorType = 'not-registered' | 'rate-limit';

/**
 * Error thrown or returned by {@link EnergyAppNotification.sendNotification}
 * when a notification cannot be delivered.
 */
export interface EnyoNotificationSendError {
    /** Machine-readable error reason. */
    type: EnyoNotificationSendErrorType;
    /** Optional human-readable detail describing the error. */
    message?: string;
}

/**
 * Complete notification object containing all notification data.
 */
export interface EnyoNotification {
    /** Category of the notification; must be registered before sending. */
    category: EnyoNotificationCategory;
    /** Configuration options for display and behavior. */
    options: EnyoNotificationOptions;
    /** Array of translated notification messages for different languages. */
    translations: EnyoNotificationTranslation[];
}
