import {EnergyAppPackageConfigurationTranslatedValue} from "../energy-app-package-configuration.js";

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
    sessionId: string;
    authenticationType: HemsOneAuthenticationType;
    apiKey?: HemsOneApiKeyAuthenticationResponse;
    usernamePassword?: HemsOneUsernamePasswordAuthenticationResponse;
    oauth?: HemsOneOauthAuthenticationResponse;
}

export enum HemsOneAuthenticationStateEnum {
    Success = 'Success',
    Failed = 'Failed'
}

export interface HemsOneAuthenticateState {
    state: HemsOneAuthenticationStateEnum;
}