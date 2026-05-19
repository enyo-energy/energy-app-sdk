import {
    EnyoNotificationCategory,
    EnyoNotificationCategoryRegistration,
    EnyoNotificationOptions,
    EnyoNotificationSendError,
    EnyoNotificationTranslation
} from "../types/enyo-notification.js";

/**
 * Interface for managing user notifications within Energy App packages.
 *
 * Notifications are grouped by {@link EnyoNotificationCategory}. Every
 * category that a package intends to use must first be registered with the
 * host via {@link registerNotificationCategory}; attempts to send a
 * notification for an unregistered category fail with a `not-registered`
 * error.
 *
 * The host may additionally enforce rate limits per category. When the limit
 * is exceeded, {@link sendNotification} fails with a `rate-limit` error and
 * the caller must back off before retrying.
 */
export interface EnergyAppNotification {
    /**
     * Registers a notification category with the host.
     *
     * Categories must be registered before any notification using that
     * category can be sent. Registration is idempotent: calling it again for
     * the same category updates the translated `name` and `description` used
     * by the host UI.
     *
     * @param registration - Category identifier together with the translated
     *   `name` (and optional `description`) shown by the host.
     *
     * @example
     * ```typescript
     * registerNotificationCategory({
     *   category: 'connection-issue',
     *   name: [
     *     { language: 'en', name: 'Connection issue' },
     *     { language: 'de', name: 'Verbindungsproblem' }
     *   ]
     * });
     * ```
     */
    registerNotificationCategory(
        registration: EnyoNotificationCategoryRegistration
    ): void;

    /**
     * Shows a notification to the user with multi-language support.
     *
     * The notification's `category` must have been registered first via
     * {@link registerNotificationCategory}. Each translation supplies both a
     * `title` (used for list rows and system banners) and a `body` (used in
     * the expanded detail view). When `options.target` is provided, the host
     * routes the user to that destination on interaction — e.g. an onboarding
     * guide for the `onboarding-required` category.
     *
     * @param type - Visual style of the notification (info, warning, error, success).
     * @param category - Lifecycle category; must be registered beforehand.
     * @param options - Display/behavior options, including optional routing target.
     * @param translations - Per-language `title`/`body` pairs.
     * @returns Unique notification ID that can be used for tracking and removal.
     * @throws {EnyoNotificationSendError} `not-registered` if the supplied
     *   category has not been registered with the host.
     * @throws {EnyoNotificationSendError} `rate-limit` if the host's
     *   notification rate limit for this category has been exceeded.
     *
     * @example
     * ```typescript
     * const notificationId = sendNotification(
     *   'onboarding-required',
     *   {
     *     target: { type: 'onboarding', onboardingName: 'wallbox-setup' }
     *   },
     *   [
     *     { language: 'en', title: 'Finish setup', body: 'Complete wallbox onboarding to start charging.' },
     *     { language: 'de', title: 'Einrichtung abschließen', body: 'Schließe das Wallbox-Onboarding ab, um zu laden.' }
     *   ]
     * );
     * ```
     */
    sendNotification(
        category: EnyoNotificationCategory,
        options: EnyoNotificationOptions,
        translations: EnyoNotificationTranslation[]
    ): string;
}
