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
    /** Optional description providing additional context for this option */
    optionDescription?: EnyoPackageConfigurationTranslatedValue[];
}

/**
 * Represents an option in a priority-type setting field.
 * Priority options are similar to select options but include an order index
 * to define the relative priority of each option.
 */
export interface EnyoPackageConfigurationSettingPriorityOption {
    /** The underlying value of this priority option */
    value: string;
    /** Translated caption displayed for this option */
    caption: EnyoPackageConfigurationTranslatedValue[];
    /** Optional translated description providing additional context for this option */
    description?: EnyoPackageConfigurationTranslatedValue[];
    /** The order/priority index of this option */
    orderIndex: number;
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
 * Step option for time-type settings, defining the interval between selectable time values.
 * - `'15min'`: 15-minute intervals (e.g., 00:00, 00:15, 00:30, ...)
 * - `'30min'`: 30-minute intervals (e.g., 00:00, 00:30, 01:00, ...)
 * - `'1hour'`: 1-hour intervals (e.g., 00:00, 01:00, 02:00, ...)
 */
export type EnyoTimeStepOption = '15min' | '30min' | '1hour';

/**
 * Configuration options for time-type settings.
 * Time values are represented in "HH:mm" format (e.g., "08:00", "14:30").
 */
export interface EnyoPackageConfigurationSettingTimeOptions {
    /** The step interval between selectable time values */
    stepOption: EnyoTimeStepOption;
}

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
    type: 'text' | 'select' | 'float' | 'integer' | 'checkbox' | 'time' | 'priority';
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
    /** Optional configuration for time-type settings. Values are in "HH:mm" format. */
    timeOptions?: EnyoPackageConfigurationSettingTimeOptions;
    /** Optional configuration for priority-type settings, defining the available priority options with order indices */
    priorityOptions?: EnyoPackageConfigurationSettingPriorityOption[];
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
    /** Optional translated caption displayed as the group heading */
    caption?: EnyoPackageConfigurationTranslatedValue[];
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
    /** Optional translated caption displayed as the group heading */
    caption?: EnyoPackageConfigurationTranslatedValue[];
    /** The settings belonging to this group, including IDs and current values */
    settings: EnyoSettingConfigWithValue[];
}