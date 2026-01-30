import {EnyoPackageConfigurationTranslatedValue} from "./enyo-settings.js";

export type EnyoAuthenticationType = 'apiKey' | 'oauth' | 'usernamePassword';

export interface EnyoApiKeyAuthentication {
    fieldName: EnyoPackageConfigurationTranslatedValue[];
    fieldDescription?: EnyoPackageConfigurationTranslatedValue[];
    /** A link to an external resource where to find more information how to get an api key */
    externalGuideUrl?: string;
}

export interface EnyoUsernamePasswordAuthentication {
    description?: EnyoPackageConfigurationTranslatedValue[];
    usernameName: EnyoPackageConfigurationTranslatedValue[];
    passwordName: EnyoPackageConfigurationTranslatedValue[];
    /** A link to an external resource where to find more information how to get an api key */
    externalGuideUrl?: string;
}

export interface EnyoOauthAuthentication {
    description?: EnyoPackageConfigurationTranslatedValue[];
    /** If the client id and client secret need to be provided by the user*/
    clientIdName?: EnyoPackageConfigurationTranslatedValue[];
    clientSecretName?: EnyoPackageConfigurationTranslatedValue[];
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
}

export interface EnyoApiKeyAuthenticationResponse {
    apiKey: string;
}

export interface EnyoUsernamePasswordAuthenticationResponse {
    username: string;
    password: string;
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