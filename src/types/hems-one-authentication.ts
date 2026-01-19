import {EnergyAppPackageConfigurationTranslatedValue} from "./energy-app-settings.js";

export type HemsOneAuthenticationType = 'apiKey' | 'oauth' | 'usernamePassword';

export interface HemsOneApiKeyAuthentication {
    fieldName: EnergyAppPackageConfigurationTranslatedValue[];
    fieldDescription?: EnergyAppPackageConfigurationTranslatedValue[];
    /** A link to an external resource where to find more information how to get an api key */
    externalGuideUrl?: string;
}

export interface HemsOneUsernamePasswordAuthentication {
    description?: EnergyAppPackageConfigurationTranslatedValue[];
    usernameName: EnergyAppPackageConfigurationTranslatedValue[];
    passwordName: EnergyAppPackageConfigurationTranslatedValue[];
    /** A link to an external resource where to find more information how to get an api key */
    externalGuideUrl?: string;
}

export interface HemsOneOauthAuthentication {
    description?: EnergyAppPackageConfigurationTranslatedValue[];
    /** details to request the redirect url. Hems one will set the forward url after a successful login */
    authorizeUrl: string;
    clientId: string;
    scope: string;
}

export interface HemsOneAuthentication {
    /** The authentication mode */
    authenticationType: HemsOneAuthenticationType;
    /** the api key configuration */
    apiKey?: HemsOneApiKeyAuthentication;
    /** the oauth configuration */
    oauth?: HemsOneOauthAuthentication;
    /** the username password configuration */
    usernamePassword?: HemsOneUsernamePasswordAuthentication;
    /** If the authentication is one time or not. If not a one time authentication, the user can sign out*/
    oneTimeAuthentication: boolean;
    /** Optional appliance ID. If provided, authentication is for specific appliance. If omitted, authentication is for the whole package */
    applianceId?: string;
}

export interface HemsOneApiKeyAuthenticationResponse {
    apiKey: string;
}

export interface HemsOneUsernamePasswordAuthenticationResponse {
    username: string;
    password: string;
}

export interface HemsOneOauthAuthenticationResponse {
    code: string;
    challenge: string;
}

export interface HemsOneAuthenticationResponse {
    requestId: string;
    authenticationType: HemsOneAuthenticationType;
    apiKey?: HemsOneApiKeyAuthenticationResponse;
    usernamePassword?: HemsOneUsernamePasswordAuthenticationResponse;
    oauth?: HemsOneOauthAuthenticationResponse;
}

export enum HemsOneAuthenticationStateEnum {
    Authenticated = 'Authenticated',
    AuthenticationFailed = 'AuthenticationFailed',
    Unauthenticated = 'Unauthenticated'
}

export interface HemsOneAuthenticateState {
    state: HemsOneAuthenticationStateEnum;
}