import {EnergyAppPackageLanguage} from "../energy-app-package-definition.js";

/**
 * Represents a translated value for different languages in Energy App settings.
 */
export interface EnyoPackageConfigurationTranslatedValue {
    /** Language code */
    language: EnergyAppPackageLanguage;
    /** The displayed value */
    value: string;
}

/**
 * Represents an option in a select-type setting field.
 */
export interface EnyoPackageConfigurationSettingSelectOption {
    value: string;
    /** The displayed name of the option */
    optionName: EnyoPackageConfigurationTranslatedValue[];
}

/**
 * Represents a single configuration setting for an Energy App package.
 */
export interface EnyoPackageConfigurationSetting {
    /** internal name of the setting - must be unique */
    name: string;
    /** the type of the setting */
    type: 'text' | 'select';
    /** if the setting is required */
    required: boolean;
    /** The displayed name of the field */
    fieldName: EnyoPackageConfigurationTranslatedValue[];
    /** An optional description for the user*/
    fieldDescription?: EnyoPackageConfigurationTranslatedValue[];
    /** The current value of the setting (optional) */
    currentValue?: string;
    /** Optional appliance ID. If provided, setting is for specific appliance. If omitted, setting is for the whole package */
    applianceId?: string;
    selectOptions?: EnyoPackageConfigurationSettingSelectOption[];
}

/**
 * Configuration container for Energy App package settings.
 */
export interface EnyoPackageConfiguration {
}

/**
 * Represents a change event when a setting value is modified.
 */
export interface EnyoSettingChangeEvent {
    /** The name of the setting that changed */
    settingName: string;
    /** The new value of the setting */
    newValue: string;
    /** The previous value of the setting (if any) */
    previousValue?: string;
}

/**
 * Callback function type for listening to setting changes.
 */
export type EnyoSettingsChangeListener = (event: EnyoSettingChangeEvent) => Promise<void> | void;

/**
 * Represents a configuration setting with a unique identifier.
 * Extends the base setting configuration to include an ID for tracking and management.
 */
export interface EnyoSettingConfigWithId extends EnyoPackageConfigurationSetting {
    /** Unique identifier for this setting */
    id: string;
}

/**
 * Represents a configuration setting with its current value.
 * Extends the setting configuration with ID to include the actual current value.
 */
export interface EnyoSettingConfigWithValue extends EnyoSettingConfigWithId {
    /** Current value of the setting (if set) */
    currentValue?: string;
}