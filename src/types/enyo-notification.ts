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
 */
export type EnyoNotificationCategory = 'connection-issue' | 'onboarding-required';

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
    | EnyoNotificationApplianceSettingsTarget;

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
