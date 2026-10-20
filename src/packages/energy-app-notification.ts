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
 *
 * ## Sending a `charging-issue`
 *
 * The host relies on these rules and does not re-check them, so every app
 * must send a `charging-issue` under the same conditions.
 *
 * Send it only when **all** of the following hold:
 * - The app itself asked the charger to charge: it sent a start or resume,
 *   or it is giving the charger more than 0 W of available power.
 * - The charger has stayed non-charging for at least 5 minutes after that
 *   request. Non-charging means its status is not
 *   {@link EnyoChargerApplianceStatusEnum.Charging}, or it is `Charging` but
 *   draws (almost) no power.
 * - The car is not the one holding the charge: do **not** send while the
 *   charger reports {@link EnyoChargerApplianceStatusEnum.Suspended} with
 *   reason {@link EnyoChargerApplianceSuspendedReasonEnum.Ev}. That means the
 *   car's battery is full or the car paused charging itself, which is not a
 *   fault.
 * - No grid-operator limit (§14a /
 *   {@link EnyoDataBusMessageEnum.GridOperatorPowerLimitationV1}) is
 *   currently pushing the charger to 0.
 *
 * Send it **at most once per plug-in**: after sending, wait until the car is
 * unplugged ({@link EnyoChargerApplianceStatusEnum.Available}) before sending
 * again for that appliance.
 *
 * Always pass `options.applianceId` and
 * `options.target = { type: 'appliance', applianceId }`.
 *
 * The host enforces a rate limit of one `charging-issue` per appliance per
 * 30 minutes. A notification sent within that window is dropped and the call
 * fails with a `rate-limit` error.
 *
 * @example
 * ```typescript
 * const notification = sdk.useNotification();
 *
 * notification.registerNotificationCategory({
 *     category: 'charging-issue',
 *     name: [
 *         {language: 'de', name: 'Ladeprobleme'},
 *         {language: 'en', name: 'Charging issues'},
 *     ],
 *     description: [
 *         {language: 'de', name: 'Ladeprobleme', description: 'Wenn dein Auto nicht lädt, obwohl es laden sollte.'},
 *         {language: 'en', name: 'Charging issues', description: 'When your car is not charging although it should.'},
 *     ],
 * });
 *
 * notification.sendNotification(
 *     'charging-issue',
 *     {applianceId, target: {type: 'appliance', applianceId}},
 *     [
 *         {language: 'de', title: 'Dein Auto lädt nicht', body: 'Die Wallbox sollte gerade laden, tut es aber nicht. Prüfe bitte Auto und Ladekabel.'},
 *         {language: 'en', title: 'Your car is not charging', body: 'The wallbox should be charging right now but isn\'t. Please check the car and the charging cable.'},
 *     ],
 * );
 * ```
 *
 * ## Sending a `battery-issue`
 *
 * Send it only when **all** of the following hold:
 * - The app itself commanded the battery: it sent a
 *   {@link EnyoDataBusMessageEnum.SetStorageControlV2} with mode `Controlled`
 *   (or one of the `Start…`/`SetStorage…` storage commands) that is still in
 *   effect. Never send while the battery runs on its own logic (`Auto`).
 * - For at least 5 minutes after that command, the battery has not followed
 *   it, judged by `batteryPowerW` in
 *   {@link EnyoDataBusMessageEnum.BatteryValuesUpdateV1}:
 *   - `Charge`: the battery is not charging, or charges at (almost) 0 W.
 *   - `Discharge`: the battery is not discharging, or discharges at
 *     (almost) 0 W.
 *   - `Hold`: the battery charges or discharges noticeably.
 * - The battery is not simply at its limit: do **not** send for a charge
 *   command while the state of charge is at or above
 *   {@link EnyoBatteryApplianceMetadata.maxSoC} (or 100 %), or for a
 *   discharge command while it is at or below
 *   {@link EnyoBatteryApplianceMetadata.minSoC}.
 * - A discharge to the house is not capped by low household consumption.
 *   Without grid discharging, the battery can only deliver what the house
 *   draws, which is not a fault.
 * - No grid-operator limit (§14a / `gridOperatorLimit` in
 *   `BatteryValuesUpdateV1`, or
 *   {@link EnyoDataBusMessageEnum.GridOperatorPowerLimitationV1}) is
 *   currently pushing the battery's power to 0.
 * - Control is allowed: {@link EnyoBatteryApplianceMetadata.controlAllowed}
 *   is not `false`. (The app must not command such a battery at all.)
 *
 * Send it **at most once per issue**: after sending, wait until the battery
 * follows a command again, or the app releases it back to `Auto`, before
 * sending again for that appliance.
 *
 * Always pass `options.applianceId` and
 * `options.target = { type: 'appliance', applianceId }`.
 *
 * The host enforces a rate limit of one `battery-issue` per appliance per
 * 30 minutes. A notification sent within that window is dropped and the call
 * fails with a `rate-limit` error.
 *
 * ## Sending an `authentication-required`
 *
 * {@link EnergyAppAuthentication.requestAuthentication} already prompts the
 * user, including for the first sign-in during onboarding. This category is
 * only for a sign-in that **used to work** and was lost.
 *
 * Send it only when **all** of the following hold:
 * - The package was authenticated before
 *   ({@link EnyoAuthenticationStateEnum.Authenticated}) and the session is now
 *   unusable: the vendor rejects the credentials or token, and a refresh (if
 *   the vendor supports one) failed.
 * - The failure is not transient. Timeouts, 5xx responses or the vendor cloud
 *   being down are a `connection-issue`, not an `authentication-required`.
 * - The user did not sign out themselves: do **not** send after
 *   {@link EnergyAppAuthentication.signOut} or a sign-out reported through
 *   {@link EnergyAppAuthentication.listenForSignOut}.
 *
 * Before sending, set the state via
 * {@link EnergyAppAuthentication.setAuthenticationState} (to
 * `AuthenticationFailed` or `Unauthenticated`) and create a new request via
 * {@link EnergyAppAuthentication.requestAuthentication}, so the target has a
 * sign-in to open.
 *
 * Send it **at most once per lost session**: after sending, wait until the
 * package is `Authenticated` again before sending another one.
 *
 * Pass `options.target = { type: 'authentication' }`. For an appliance
 * sign-in, also pass `options.applianceId` and set the target's
 * `applianceId`.
 *
 * The host enforces a rate limit of one `authentication-required` per
 * package (or per appliance, for an appliance sign-in) per 24 hours.
 *
 * @example
 * ```typescript
 * const notification = sdk.useNotification();
 * const auth = sdk.useAuthentication();
 *
 * notification.registerNotificationCategory({
 *     category: 'authentication-required',
 *     name: [
 *         {language: 'de', name: 'Anmeldung erforderlich'},
 *         {language: 'en', name: 'Sign-in required'},
 *     ],
 * });
 *
 * // The vendor rejected the refresh token: the session is gone for good.
 * await auth.setAuthenticationState({state: EnyoAuthenticationStateEnum.AuthenticationFailed});
 * await auth.requestAuthentication({authenticationType: 'oauth', oauth: {}, oneTimeAuthentication: false});
 *
 * notification.sendNotification(
 *     'authentication-required',
 *     {target: {type: 'authentication'}},
 *     [
 *         {language: 'de', title: 'Bitte erneut anmelden', body: 'Deine Anmeldung ist abgelaufen. Melde dich erneut an, damit wir deine Geräte weiter steuern können.'},
 *         {language: 'en', title: 'Please sign in again', body: 'Your sign-in has expired. Sign in again so we can keep controlling your devices.'},
 *     ],
 * );
 * ```
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
     * guide for the `onboarding-required` category, or the appliance's live
     * view (`{ type: 'appliance', applianceId }`) for `charging-issue` and
     * `battery-issue`, or the pending sign-in (`{ type: 'authentication' }`)
     * for `authentication-required`. The "Sending a …" sections on
     * {@link EnergyAppNotification} describe when those categories may be
     * sent.
     *
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
