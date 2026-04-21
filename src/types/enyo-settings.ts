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
 * Display option for select-type settings.
 * - `dropdown`: renders as a dropdown/select element
 * - `radioButtons`: renders as radio button group
 */
export type EnyoSelectDisplayOption = 'dropdown' | 'radioButtons';

/**
 * Display option for float-type settings.
 * - `stepper`: renders as a stepper control with +/- buttons
 */
export type EnyoFloatDisplayOption = 'stepper';

/**
 * Configuration options for float-type settings.
 */
export interface EnyoPackageConfigurationSettingFloatOptions {
    maxValue?: number;
    minValue?: number;
    step?: number;
    /** Optional display option for the float input. Use 'stepper' to render a +/- button control. */
    displayOption?: EnyoFloatDisplayOption;
    /** Optional unit suffix displayed next to the value (e.g., "ct/kWh") */
    suffix?: string;
}

/**
 * Configuration options for integer-type settings.
 */
export interface EnyoPackageConfigurationSettingIntegerOptions {
    maxValue?: number;
    minValue?: number;
    /** Optional unit suffix displayed next to the value (e.g., "ct/kWh") */
    suffix?: string;
}

export interface EnyoPackageConfigurationSettingTextOptions {
    maxLength?: number;
}

/**
 * Represents a single configuration setting for an Energy App package.
 */
export interface EnyoPackageConfigurationSetting {
    /** internal name of the setting - must be unique */
    name: string;
    /** the type of the setting */
    type: 'text' | 'select' | 'float' | 'integer' | 'checkbox';
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
    /** Optional display option for select-type settings. Defaults to 'dropdown' if not specified. */
    selectDisplayOption?: EnyoSelectDisplayOption;
    floatOptions?: EnyoPackageConfigurationSettingFloatOptions;
    integerOptions?: EnyoPackageConfigurationSettingIntegerOptions;
    textOptions?: EnyoPackageConfigurationSettingTextOptions;
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

/**
 * Represents a group of related settings with a name and translated caption.
 * Groups allow organizing multiple settings under a common heading in the UI.
 */
export interface EnyoPackageConfigurationSettingGroup {
    /** Internal name of the group - must be unique */
    groupName: string;
    /** Translated caption displayed as the group heading */
    caption: EnyoPackageConfigurationTranslatedValue[];
    /** The settings belonging to this group (1 or more) */
    settings: EnyoPackageConfigurationSetting[];
}

/**
 * Represents a setting group with resolved setting values.
 * Used when retrieving groups including their current persisted values and IDs.
 */
export interface EnyoSettingGroupWithValues {
    /** Internal name of the group */
    groupName: string;
    /** Translated caption displayed as the group heading */
    caption: EnyoPackageConfigurationTranslatedValue[];
    /** The settings belonging to this group, including IDs and current values */
    settings: EnyoSettingConfigWithValue[];
}