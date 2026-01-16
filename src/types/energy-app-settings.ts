import {EnergyAppPackageLanguage} from "../energy-app-package-definition.js";

/**
 * Represents a translated value for different languages in Energy App settings.
 */
export interface EnergyAppPackageConfigurationTranslatedValue {
    /** Language code */
    language: EnergyAppPackageLanguage;
    /** The displayed value */
    value: string;
}

/**
 * Represents an option in a select-type setting field.
 */
export interface EnergyAppPackageConfigurationSettingSelectOption {
    value: string;
    /** The displayed name of the option */
    optionName: EnergyAppPackageConfigurationTranslatedValue[];
}

/**
 * Represents a single configuration setting for an Energy App package.
 */
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

/**
 * Configuration container for Energy App package settings.
 */
export interface EnergyAppPackageConfiguration {
}

/**
 * Represents a change event when a setting value is modified.
 */
export interface EnergyAppSettingChangeEvent {
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
export type EnergyAppSettingsChangeListener = (event: EnergyAppSettingChangeEvent) => Promise<void> | void;

/**
 * Represents a configuration setting with a unique identifier.
 * Extends the base setting configuration to include an ID for tracking and management.
 */
export interface EnergyAppSettingConfigWithId extends EnergyAppPackageConfigurationSetting {
    /** Unique identifier for this setting */
    id: string;
}

/**
 * Represents a configuration setting with its current value.
 * Extends the setting configuration with ID to include the actual current value.
 */
export interface EnergyAppSettingConfigWithValue extends EnergyAppSettingConfigWithId {
    /** Current value of the setting (if set) */
    currentValue?: string;
}