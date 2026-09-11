import {EnyoPackageConfigurationTranslatedValue} from "./enyo-settings.js";

export type EnyoAuthenticationType = 'apiKey' | 'oauth' | 'usernamePassword';

/**
 * Indicates whether the authentication request should be presented to the user
 * before or after the onboarding guide. When omitted, the host decides the default ordering.
 */
export type EnyoAuthenticationOnboardingOrder = 'before-onboarding' | 'after-onboarding';

/**
 * Represents an additional custom field for authentication forms.
 * Allows developers to add extra input fields beyond the standard username/password or API key.
 */
export interface EnyoAuthenticationAdditionalField {
    /** Internal field name used as the key when returning field values */
    fieldName: string;
    /** Translated title/label displayed to the user */
    title: EnyoPackageConfigurationTranslatedValue[];
    /** Optional translated description/help text for the field */
    fieldDescription?: EnyoPackageConfigurationTranslatedValue[];
}

export interface EnyoApiKeyAuthentication {
    fieldName: EnyoPackageConfigurationTranslatedValue[];
    fieldDescription?: EnyoPackageConfigurationTranslatedValue[];
    /** A link to an external resource where to find more information how to get an api key */
    externalGuideUrl?: string;
    /** Optional additional fields to display in the authentication form */
    additionalFields?: EnyoAuthenticationAdditionalField[];
}

export interface EnyoUsernamePasswordAuthentication {
    description?: EnyoPackageConfigurationTranslatedValue[];
    usernameName: EnyoPackageConfigurationTranslatedValue[];
    passwordName: EnyoPackageConfigurationTranslatedValue[];
    /** A link to an external resource where to find more information how to get an api key */
    externalGuideUrl?: string;
    /** Optional additional fields to display in the authentication form */
    additionalFields?: EnyoAuthenticationAdditionalField[];
}

/**
 * How the host encodes the pending request into the enyo callback URL it hands
 * out as {@link EnyoOauthAuthenticationStart.enyoRedirectUrl}.
 *
 * OAuth providers differ in what they accept as a registered `redirect_uri`:
 * some match the URL exactly and reject anything carrying a query string,
 * others match only the path prefix. Declaring the shape the provider's OAuth
 * app was registered with avoids a generic "invalid redirect_uri" that only
 * surfaces after the user has already typed a password.
 */
export enum EnyoOauthRedirectUrlPatternEnum {
    /**
     * The request id is carried as a query parameter, e.g.
     * `https://api.enyo-energy.de/oauth-callback?from=<requestId>`. The host's
     * default.
     */
    QueryParam = 'query-param',
    /**
     * The request id is carried as a trailing path segment, e.g.
     * `https://api.enyo-energy.de/oauth-callback/<requestId>`. Use this for
     * providers that reject a registered `redirect_uri` containing a query
     * string.
     */
    PathSegment = 'path-segment',
}

/**
 * Constraints a package puts on the enyo callback URL the host generates for an
 * OAuth flow. Every field is optional — an omitted field leaves the choice to
 * the host.
 *
 * These are properties of the *provider*, not preferences: set them because the
 * vendor's OAuth app rejects the alternative, not because one shape looks
 * tidier. The filter the host applied travels back with the request as
 * {@link EnyoOauthAuthenticationStart.redirectUrlFilter}, so an app can confirm
 * what it got instead of parsing the URL.
 */
export interface EnyoOauthRedirectUrlFilter {
    /**
     * Require an `https` callback URL rather than a custom app scheme such as
     * `enyoapp://`, which forces the login to run in a web browser instead of an
     * in-app / native flow.
     *
     * Set it when the provider will not accept a custom-scheme redirect. Many
     * OAuth providers reject anything that is not `https`, so a redirect of
     * `enyoapp://…` fails at the authorization server before the installer has
     * typed a password, with nothing on screen that points at the cause. The
     * native flow is the better experience where it works — it keeps the
     * installer inside the app — so only turn this on when the provider forces
     * it.
     */
    webOnly?: boolean;
    /**
     * Which {@link EnyoOauthRedirectUrlPatternEnum} the callback URL must
     * follow. Omit to let the host choose (today: `QueryParam`).
     */
    pattern?: EnyoOauthRedirectUrlPatternEnum;
}

export interface EnyoOauthAuthentication {
    description?: EnyoPackageConfigurationTranslatedValue[];
    /** If the client id and client secret need to be provided by the user*/
    clientIdName?: EnyoPackageConfigurationTranslatedValue[];
    clientSecretName?: EnyoPackageConfigurationTranslatedValue[];
    /**
     * Constraints on the enyo callback URL the host generates for this flow —
     * `https`-only and/or a specific URL pattern. The host applies them when
     * building {@link EnyoOauthAuthenticationStart.enyoRedirectUrl}, before the
     * request ever reaches the package's `listenForOauthStart` listener.
     *
     * Omit it to let the host pick, which is right unless the provider's OAuth
     * app was registered with a redirect URI the default does not match.
     */
    redirectUrlFilter?: EnyoOauthRedirectUrlFilter;
}

/**
 * OAuth authentication start configuration
 * Contains the required redirect URL and optional client credentials
 */
export interface EnyoOauthAuthenticationStart {
    requestId: string;
    /** The redirect URL where the OAuth provider should send the user after authentication */
    enyoRedirectUrl: string;
    /** Optional client ID if the user needs to provide their own OAuth app credentials */
    clientId?: string;
    /** Optional client secret if the user needs to provide their own OAuth app credentials */
    clientSecret?: string;
    /** Optional appliance id if the request was created for a specific appliance */
    applianceId?: string;
    /**
     * Whether this request was started in web-only mode, meaning
     * {@link enyoRedirectUrl} is an `https` URL rather than a custom app scheme
     * such as `enyoapp://`.
     *
     * Set by the host when the flow that started the login declared the
     * constraint. It is reported here so a package building the provider's
     * authorize URL can act on it explicitly: pick the matching registered
     * OAuth client, or fail fast with a clear message instead of letting the
     * authorization server answer "invalid redirect_uri" after the user has
     * already typed a password.
     *
     * Absent or `false` means the host chose the redirect itself and it may
     * carry a custom scheme. Prefer reading this flag over sniffing
     * {@link enyoRedirectUrl}'s scheme.
     *
     * @deprecated Read {@link redirectUrlFilter}`.webOnly` instead, which
     * carries the same information alongside the URL-pattern constraint. The
     * host keeps both in sync: whenever this flag is `true`,
     * `redirectUrlFilter.webOnly` is `true` as well.
     */
    requiresWebAuthentication?: boolean;
    /**
     * The {@link EnyoOauthRedirectUrlFilter} the host applied when building
     * {@link enyoRedirectUrl} — the resolved constraints, not the requested
     * ones, so a package can confirm which callback shape it got rather than
     * parsing the URL.
     *
     * Absent when the flow declared no constraints and the host chose freely.
     */
    redirectUrlFilter?: EnyoOauthRedirectUrlFilter;
}

export interface EnyoOauthAuthenticationRedirectUrlResponse {
    redirectUrl: string;
}

export interface EnyoAuthentication {
    /** The authentication mode */
    authenticationType: EnyoAuthenticationType;
    /** the api key configuration */
    apiKey?: EnyoApiKeyAuthentication;
    /** the oauth configuration */
    oauth?: EnyoOauthAuthentication;
    /** the username password configuration */
    usernamePassword?: EnyoUsernamePasswordAuthentication;
    /** If the authentication is one time or not. If not a one time authentication, the user can sign out*/
    oneTimeAuthentication: boolean;
    /** Optional appliance ID. If provided, authentication is for specific appliance. If omitted, authentication is for the whole package */
    applianceId?: string;
    /**
     * Optional ordering hint indicating whether this authentication request should be
     * presented before or after the onboarding guide. When omitted, the host decides the default.
     */
    onboardingOrder?: EnyoAuthenticationOnboardingOrder;
}

export interface EnyoApiKeyAuthenticationResponse {
    apiKey: string;
    /** Values submitted for additional fields, keyed by fieldName */
    additionalFields?: Record<string, string>;
}

export interface EnyoUsernamePasswordAuthenticationResponse {
    username: string;
    password: string;
    /** Values submitted for additional fields, keyed by fieldName */
    additionalFields?: Record<string, string>;
}

/**
 * OAuth authentication response containing authorization code and/or additional parameters
 * The code is optional to support different OAuth flows and providers
 */
export interface EnyoOauthAuthenticationResponse {
    /** URL parameters that may be returned by the OAuth provider */
    urlParams: Record<string, string>;
}

export interface EnyoAuthenticationResponse {
    requestId: string;
    /** Optional appliance ID. If provided, authentication is for specific appliance. If omitted, authentication is for the whole package */
    applianceId?: string;
    authenticationType: EnyoAuthenticationType;
    apiKey?: EnyoApiKeyAuthenticationResponse;
    usernamePassword?: EnyoUsernamePasswordAuthenticationResponse;
    oauth?: EnyoOauthAuthenticationResponse;
}

export enum EnyoAuthenticationStateEnum {
    Authenticated = 'Authenticated',
    AuthenticationFailed = 'AuthenticationFailed',
    Unauthenticated = 'Unauthenticated'
}

export interface EnyoAuthenticateState {
    state: EnyoAuthenticationStateEnum;
    authenticatedByRequestId?: string;
    /** The name of the account or user */
    name?: string;
}