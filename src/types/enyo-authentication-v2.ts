import type {EnyoPackageConfigurationTranslatedValue} from "./enyo-settings.js";
import type {
    EnyoApiKeyAuthentication,
    EnyoApiKeyAuthenticationResponse,
    EnyoAuthenticationFailureReason,
    EnyoAuthenticationOnboardingOrder,
    EnyoAuthenticationType,
    EnyoOauthAuthentication,
    EnyoOauthAuthenticationResponse,
    EnyoOauthRedirectUrlFilter,
    EnyoUsernamePasswordAuthentication,
    EnyoUsernamePasswordAuthenticationResponse,
} from "./enyo-authentication.js";

/**
 * Fields every {@link EnyoAuthenticationV2Target} can carry, whatever its type.
 */
export interface EnyoAuthenticationV2TargetBase {
    /**
     * Optional identifiers the package keeps for this target within the
     * sign-in, e.g. the vendor's user id, account id, site id or the vendor's
     * own id of the car: `{userId: 'u-4711', vendorVehicleId: 'LRW123'}`.
     *
     * Stored by the host with the target and returned by `list()` / `get()`,
     * so a package does not need storage of its own to map an appliance or
     * vehicle to the vendor account it belongs to. Keys: 1–64 characters out of
     * `A–Z a–z 0–9 . _ -`; values: 1–256 characters; at most 20 entries.
     *
     * **Never put secrets here** (tokens, passwords, API keys): the ids are
     * shown in diagnostics and support tools. Keep secrets in the package's
     * secure storage.
     */
    externalIds?: Record<string, string>;
}

/**
 * The whole package: the sign-in is not bound to any particular appliance or
 * vehicle, e.g. one vendor cloud account the package uses for everything.
 *
 * May not be combined with other targets in the same authentication.
 */
export interface EnyoAuthenticationV2PackageTarget extends EnyoAuthenticationV2TargetBase {
    /** Discriminator identifying the whole package as the target. */
    type: 'package';
}

/**
 * One appliance the sign-in is used for.
 */
export interface EnyoAuthenticationV2ApplianceTarget extends EnyoAuthenticationV2TargetBase {
    /** Discriminator identifying an appliance as the target. */
    type: 'appliance';
    /** The appliance id as known to the host (`EnyoAppliance.id`). */
    applianceId: string;
}

/**
 * One vehicle the sign-in is used for.
 */
export interface EnyoAuthenticationV2VehicleTarget extends EnyoAuthenticationV2TargetBase {
    /** Discriminator identifying a vehicle as the target. */
    type: 'vehicle';
    /** The vehicle id as known to the host (`EnyoVehicle.id`). */
    vehicleId: string;
}

/**
 * What a sign-in is used for: the whole package, one appliance or one vehicle.
 *
 * An {@link EnyoAuthenticationV2} carries a *list* of targets, so one login can
 * cover several appliances and/or vehicles — the usual case for a vendor cloud
 * account that holds more than one car or device. Two targets are the same when
 * `type` and id match; {@link EnyoAuthenticationV2TargetBase.externalIds} do
 * not take part in that comparison. Discriminated by `type`, so
 * further kinds can be added without breaking existing consumers; treat an
 * unknown `type` as "not mine" rather than failing.
 */
export type EnyoAuthenticationV2Target =
    | EnyoAuthenticationV2PackageTarget
    | EnyoAuthenticationV2ApplianceTarget
    | EnyoAuthenticationV2VehicleTarget;

/**
 * State of one authentication (v2).
 *
 * Whether a sign-in is currently open for the user is not a state of its own;
 * it is reported separately as {@link EnyoAuthenticationV2.pendingRequestId}, so
 * an authentication can be e.g. `ReauthenticationRequired` *and* have a
 * request waiting for the user.
 *
 * More values may be added in future versions. Treat an unknown value like
 * {@link Unauthenticated}.
 */
export enum EnyoAuthenticationV2StateEnum {
    /** Nobody has signed in yet, or the user signed out. */
    Unauthenticated = 'unauthenticated',
    /** The sign-in works; the package can talk to the vendor for every target. */
    Authenticated = 'authenticated',
    /**
     * A sign-in that used to work is no longer accepted (token expired or
     * revoked, password changed elsewhere, refresh failed) and the user has to
     * sign in again. Distinct from {@link Unauthenticated} so the host can tell
     * the user *why* they are asked again instead of showing a first-time login.
     */
    ReauthenticationRequired = 'reauthentication-required',
    /**
     * The last sign-in attempt failed. Set
     * {@link EnyoAuthenticationV2.failureReason} so the user knows whether to
     * correct their input or simply retry later.
     */
    AuthenticationFailed = 'authentication-failed',
}

/**
 * Everything a package declares about one authentication (v2). Passed to
 * `useAuthenticationV2().upsert()`.
 *
 * An authentication is identified by its {@link authenticationKey}, which the
 * package chooses. Upserting the same key again replaces the definition (name,
 * targets, method, …) but keeps the state, so calling `upsert` on every start
 * is safe and is the recommended pattern.
 *
 * @example
 * ```typescript
 * await energyApp.useAuthenticationV2().upsert({
 *     authenticationKey: 'vendor-account',
 *     targets: [
 *         {type: 'vehicle', vehicleId: 'veh-1'},
 *         {type: 'vehicle', vehicleId: 'veh-2'},
 *     ],
 *     name: [
 *         {language: 'de', value: 'Hersteller-Konto'},
 *         {language: 'en', value: 'Vendor account'},
 *     ],
 *     description: [
 *         {language: 'de', value: 'Mit diesem Konto lesen wir den Ladestand deiner Fahrzeuge.'},
 *         {language: 'en', value: 'We use this account to read the state of charge of your vehicles.'},
 *     ],
 *     authenticationType: 'oauth',
 *     oauth: {},
 * });
 * ```
 */
export interface EnyoAuthenticationV2Definition {
    /**
     * Stable identifier chosen by the package, unique within the package.
     * 1–128 characters out of `A–Z a–z 0–9 . _ : -`.
     *
     * Choose something that survives restarts (e.g. `vendor-account` or
     * `account:<vendorAccountId>`) so the package never has to store a mapping
     * of its own. Keys starting with {@link ENYO_AUTHENTICATION_V2_LEGACY_KEY}
     * are used by the host for sign-ins created through the deprecated v1 API.
     */
    authenticationKey: string;
    /**
     * What this sign-in is used for. At least one target; a
     * {@link EnyoAuthenticationV2PackageTarget} may not be combined with other
     * targets. Several appliances and/or vehicles may share one sign-in.
     *
     * The list is replaced on every upsert. Use `addTargets` / `removeTargets`
     * to change it without restating the whole definition, e.g. when a car of
     * the account is paired.
     */
    targets: EnyoAuthenticationV2Target[];
    /**
     * Translated name shown to the user, e.g. "Tesla-Konto" / "Tesla account".
     * At least one entry; `de` and `en` are supported, one entry per language.
     */
    name: EnyoPackageConfigurationTranslatedValue[];
    /**
     * Optional translated explanation shown with the sign-in: what the account
     * is used for and where to find the credentials. Same language rules as
     * {@link name}.
     */
    description?: EnyoPackageConfigurationTranslatedValue[];
    /** How the user signs in. The matching configuration field below is required. */
    authenticationType: EnyoAuthenticationType;
    /** Configuration when {@link authenticationType} is `apiKey`. */
    apiKey?: EnyoApiKeyAuthentication;
    /** Configuration when {@link authenticationType} is `oauth`. */
    oauth?: EnyoOauthAuthentication;
    /** Configuration when {@link authenticationType} is `usernamePassword`. */
    usernamePassword?: EnyoUsernamePasswordAuthentication;
    /**
     * When `true`, the user cannot sign out of this authentication in the enyo
     * app. Defaults to `false`.
     */
    oneTimeAuthentication?: boolean;
    /**
     * Whether the sign-in is shown before or after the onboarding guide. When
     * omitted, the host decides.
     */
    onboardingOrder?: EnyoAuthenticationOnboardingOrder;
    /**
     * How long the host waits, in milliseconds, for the response listener to
     * answer submitted credentials. Defaults to
     * {@link ENYO_AUTHENTICATION_DEFAULT_TIMEOUT_MS}; capped at
     * {@link ENYO_AUTHENTICATION_MAX_TIMEOUT_MS}.
     */
    timeoutMs?: number;
}

/**
 * One authentication (v2) as the host knows it: the package's definition plus
 * its current state. Returned by `list()`, `get()` and passed to listeners.
 */
export interface EnyoAuthenticationV2 extends EnyoAuthenticationV2Definition {
    /** The current state. */
    state: EnyoAuthenticationV2StateEnum;
    /**
     * Optional translated explanation of the current state, shown to the user,
     * e.g. "Tesla hat die Anmeldung zurückgezogen. Bitte melde dich erneut an."
     */
    stateReason?: EnyoPackageConfigurationTranslatedValue[];
    /**
     * Machine-readable reason for {@link EnyoAuthenticationV2StateEnum.AuthenticationFailed}
     * or {@link EnyoAuthenticationV2StateEnum.ReauthenticationRequired}
     * (typically `sessionExpired`). Absent for other states.
     */
    failureReason?: EnyoAuthenticationFailureReason;
    /** Name of the signed-in account or user, e.g. an e-mail address. */
    accountName?: string;
    /** Id of the sign-in request currently waiting for the user, if any. */
    pendingRequestId?: string;
    /**
     * The targets a {@link EnyoAuthenticationV2StateEnum.ReauthenticationRequired}
     * applies to, as given in
     * {@link EnyoAuthenticationV2ReauthenticationOptions.affectedTargets}.
     * Absent when the whole sign-in is affected; cleared when the state changes.
     */
    affectedTargets?: EnyoAuthenticationV2Target[];
    /** When the state last changed, ISO 8601. */
    stateChangedAtIso: string;
}

/**
 * State change passed to `useAuthenticationV2().setState()`.
 */
export interface EnyoAuthenticationV2StateUpdate {
    /** The new state. */
    state: EnyoAuthenticationV2StateEnum;
    /**
     * Translated explanation shown to the user. Replaces the previous one;
     * omit it to clear it. `de` and `en` are supported.
     */
    stateReason?: EnyoPackageConfigurationTranslatedValue[];
    /**
     * Why the sign-in failed or has to be renewed. Only meaningful for
     * {@link EnyoAuthenticationV2StateEnum.AuthenticationFailed} and
     * {@link EnyoAuthenticationV2StateEnum.ReauthenticationRequired}; ignored for other states.
     */
    failureReason?: EnyoAuthenticationFailureReason;
    /**
     * Name of the signed-in account. When omitted the host keeps the previous
     * value, except on {@link EnyoAuthenticationV2StateEnum.Unauthenticated}, which clears it.
     */
    accountName?: string;
}

/**
 * Options for `useAuthenticationV2().requestAuthentication()`.
 */
export interface EnyoAuthenticationV2RequestOptions {
    /**
     * Show the sign-in even when the authentication is already
     * {@link EnyoAuthenticationV2StateEnum.Authenticated}, e.g. to grant
     * additional scopes or switch accounts. By default the host skips the
     * sign-in step for an authenticated authentication.
     */
    force?: boolean;
}

/**
 * Options for `useAuthenticationV2().requireReauthentication()`.
 */
export interface EnyoAuthenticationV2ReauthenticationOptions {
    /**
     * Why the user has to sign in again:
     *
     * - `sessionExpired` — the session that used to work was rejected (token
     *   expired or revoked, password changed elsewhere, refresh failed).
     * - `insufficientPermissions` — the sign-in still works, but more rights
     *   are needed, e.g. new OAuth scopes after a package update, or the user
     *   revoked access to one of the cars in the vendor portal.
     * - `accountActionRequired` — the vendor wants an action first (new terms,
     *   e-mail verification); the user signs in again afterwards.
     *
     * Stored as {@link EnyoAuthenticationV2.failureReason}.
     */
    reason: EnyoAuthenticationFailureReason;
    /**
     * Translated explanation shown with the sign-in, e.g. "Für die neue
     * Ladeplanung brauchen wir Zugriff auf den Ladestand. Bitte bestätige die
     * Berechtigung." Strongly recommended for `insufficientPermissions`, where
     * a sign-in prompt for a working account is otherwise confusing.
     */
    stateReason?: EnyoPackageConfigurationTranslatedValue[];
    /**
     * The targets the problem applies to, when it does not concern all of them
     * — e.g. the one car whose access was revoked. Must be targets of the
     * authentication. Omit when the whole sign-in is affected.
     */
    affectedTargets?: EnyoAuthenticationV2Target[];
}

/**
 * Filter for `useAuthenticationV2().list()`. All given criteria must match.
 */
export interface EnyoAuthenticationV2Filter {
    /**
     * Only authentications whose targets include this appliance. A
     * package-wide authentication does not match; filter with
     * {@link packageWide} to find it.
     */
    applianceId?: string;
    /**
     * Only authentications whose targets include this vehicle. A package-wide
     * authentication does not match; filter with {@link packageWide} to find it.
     */
    vehicleId?: string;
    /** Only package-wide authentications (`true`) or only bound ones (`false`). */
    packageWide?: boolean;
    /** Only authentications in one of these states. */
    states?: EnyoAuthenticationV2StateEnum[];
}

/**
 * Sent to the listener registered with `listenForOauthStart()` when the user
 * starts an OAuth sign-in whose definition asks for client credentials, or
 * whenever the package has to build the provider's authorize URL itself.
 */
export interface EnyoAuthenticationV2OauthStart {
    /** The sign-in request this start belongs to. */
    requestId: string;
    /** The authentication the user is signing into. */
    authenticationKey: string;
    /** The targets of that authentication at the time the request was started. */
    targets: EnyoAuthenticationV2Target[];
    /** The redirect URL the OAuth provider must send the user back to. */
    enyoRedirectUrl: string;
    /** Client id entered by the user, if the definition asked for one. */
    clientId?: string;
    /** Client secret entered by the user, if the definition asked for one. */
    clientSecret?: string;
    /**
     * The {@link EnyoOauthRedirectUrlFilter} the host applied when building
     * {@link enyoRedirectUrl}. Absent when the host chose freely.
     */
    redirectUrlFilter?: EnyoOauthRedirectUrlFilter;
}

/**
 * What the user submitted for a sign-in. Passed to the listener registered
 * with `listenForAuthenticationResponse()`.
 */
export interface EnyoAuthenticationV2Response {
    /** The sign-in request that was answered. */
    requestId: string;
    /** The authentication the user signed into. */
    authenticationKey: string;
    /** The targets of that authentication at the time the user answered. */
    targets: EnyoAuthenticationV2Target[];
    /** The method used; selects which of the fields below is set. */
    authenticationType: EnyoAuthenticationType;
    /** Submitted API key and additional fields. */
    apiKey?: EnyoApiKeyAuthenticationResponse;
    /** Submitted username, password and additional fields. */
    usernamePassword?: EnyoUsernamePasswordAuthenticationResponse;
    /** URL parameters the OAuth provider returned. */
    oauth?: EnyoOauthAuthenticationResponse;
}

/**
 * What the response listener answers after checking the submitted
 * credentials. The host applies it as the new state of the authentication.
 */
export interface EnyoAuthenticationV2Result {
    /**
     * {@link EnyoAuthenticationV2StateEnum.Authenticated} when the credentials
     * work, otherwise {@link EnyoAuthenticationV2StateEnum.AuthenticationFailed}.
     */
    state: EnyoAuthenticationV2StateEnum.Authenticated | EnyoAuthenticationV2StateEnum.AuthenticationFailed;
    /** Name of the signed-in account, e.g. the e-mail address. */
    accountName?: string;
    /** Why the sign-in failed. Set it whenever `state` is `AuthenticationFailed`. */
    failureReason?: EnyoAuthenticationFailureReason;
    /** Optional translated explanation shown to the user. */
    stateReason?: EnyoPackageConfigurationTranslatedValue[];
}

/** Listener for submitted credentials; see `listenForAuthenticationResponse()`. */
export type EnyoAuthenticationV2ResponseListener =
    (response: EnyoAuthenticationV2Response) => Promise<EnyoAuthenticationV2Result>;

/** Listener for OAuth starts; resolves with the provider's authorize URL. */
export type EnyoAuthenticationV2OauthStartListener =
    (start: EnyoAuthenticationV2OauthStart) => Promise<{ redirectUrl: string }>;

/** Listener called after the user signed out of an authentication. */
export type EnyoAuthenticationV2SignOutListener =
    (authentication: EnyoAuthenticationV2) => void | Promise<void>;

/** Listener called whenever the state of an authentication changes. */
export type EnyoAuthenticationV2StateChangeListener =
    (authentication: EnyoAuthenticationV2, previousState: EnyoAuthenticationV2StateEnum) => void | Promise<void>;

/**
 * Key (and key prefix) the host uses to expose sign-ins created through the
 * deprecated v1 API (`useAuthentication()`) in v2:
 *
 * - `legacy` — the package-wide v1 sign-in, with a single
 *   {@link EnyoAuthenticationV2PackageTarget}.
 * - `legacy:appliance:<applianceId>` — a v1 sign-in requested with an
 *   `applianceId`, with a single {@link EnyoAuthenticationV2ApplianceTarget}.
 *
 * A package migrating to v2 finds its existing sign-ins under these keys and
 * may keep using them. Build them with {@link legacyAuthenticationV2Key}.
 */
export const ENYO_AUTHENTICATION_V2_LEGACY_KEY = 'legacy';

/**
 * Builds the v2 {@link EnyoAuthenticationV2Definition.authenticationKey} under
 * which the host exposes a sign-in created through the deprecated v1 API.
 *
 * @param applianceId - The `applianceId` the v1 sign-in was requested for; omit for the package-wide one.
 * @returns `legacy` or `legacy:appliance:<applianceId>`.
 */
export function legacyAuthenticationV2Key(applianceId?: string): string {
    return applianceId ? `${ENYO_AUTHENTICATION_V2_LEGACY_KEY}:appliance:${applianceId}` : ENYO_AUTHENTICATION_V2_LEGACY_KEY;
}
