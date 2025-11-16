import {EnergyAppPackageLanguage} from "./energy-app-package-definition.js";

export interface EnergyAppPackageConfigurationTranslatedValue {
    /** Language code */
    language: EnergyAppPackageLanguage;
    /** The displayed value */
    value: string;
}

export interface EnergyAppPackageConfigurationApiKeyAuthentication {
    fieldName: EnergyAppPackageConfigurationTranslatedValue[];
    fieldDescription?: EnergyAppPackageConfigurationTranslatedValue[];
    /** A link to an external resource where to find more information how to get an api key */
    externalGuideUrl?: string;
}

export interface EnergyAppPackageConfigurationOauthAuthentication {
    description?: EnergyAppPackageConfigurationTranslatedValue[];
    /** details to request the redirect url. Hems one will set the forward url after a successful login */
    authorizeUrl: string;
    clientId: string;
    scope: string;
}

export interface EnergyAppPackageConfigurationAuthentication {
    /** if an authentication is required */
    required: boolean;
    /** The authentication mode */
    authenticationType: 'apiKey' | 'oauth';
    /** the api key configuration */
    apiKey?: EnergyAppPackageConfigurationApiKeyAuthentication;
    /** the oauth configuration */
    oauth?: EnergyAppPackageConfigurationOauthAuthentication;
}

export interface EnergyAppPackageConfigurationSettingSelectOption {
    value: string;
    /** The displayed name of the option */
    optionName: EnergyAppPackageConfigurationTranslatedValue[];
}

export interface EnergyAppPackageConfigurationSetting {
    /** internal name of the setting */
    name: string;
    /** the type of the setting */
    type: 'text' | 'select';
    /** if the setting is required */
    required: boolean;
    /** The displayed name of the field */
    fieldName: EnergyAppPackageConfigurationTranslatedValue[];
    /** An optional description for the user*/
    fieldDescription?: EnergyAppPackageConfigurationTranslatedValue[];
    /** The optional default value or default selection value*/
    defaultValue?: string;
    selectOptions?: EnergyAppPackageConfigurationSettingSelectOption[];
}

export interface EnergyAppPackageConfiguration {
    authentication?: EnergyAppPackageConfigurationAuthentication;
    settings?: EnergyAppPackageConfigurationSetting[];
}
