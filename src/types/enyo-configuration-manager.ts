/**
 * Discriminator for the type of an internal configuration.
 * - `number`: a numeric value with optional min/max/step constraints
 * - `select`: a string value picked from a fixed list of allowed options
 */
export type EnyoConfigurationType = 'number' | 'select';

/**
 * Defines an allowed option for a select-type configuration.
 */
export interface EnyoConfigurationSelectOption {
    /** The underlying value stored for this option. Must be unique within the configuration. */
    value: string;
}

/**
 * Constraints for a number-type configuration.
 * All bounds are inclusive when provided.
 */
export interface EnyoConfigurationNumberOptions {
    /** Optional inclusive minimum value */
    minValue?: number;
    /** Optional inclusive maximum value */
    maxValue?: number;
    /** Optional step increment between valid values */
    step?: number;
}

/**
 * Base properties shared by every configuration registration.
 */
interface EnyoConfigurationBase {
    /**
     * Unique key identifying this configuration within the package.
     * The same key is used for retrieval, change notifications, and removal.
     */
    key: string;
    /**
     * Optional default value applied when the configuration has not been
     * set yet. For `select` configurations this must match one of the
     * defined option values. For `number` configurations this must satisfy
     * the configured min/max/step constraints.
     */
    defaultValue?: string | number;
}

/**
 * Registration payload for a number-type internal configuration.
 */
export interface EnyoNumberConfiguration extends EnyoConfigurationBase {
    type: 'number';
    /** Optional numeric constraints */
    numberOptions?: EnyoConfigurationNumberOptions;
    /** Default value must be a number when provided */
    defaultValue?: number;
}

/**
 * Registration payload for a select-type internal configuration.
 */
export interface EnyoSelectConfiguration extends EnyoConfigurationBase {
    type: 'select';
    /** The list of allowed options - must contain at least one entry */
    selectOptions: EnyoConfigurationSelectOption[];
    /** Default value must match one of the {@link selectOptions} values when provided */
    defaultValue?: string;
}

/**
 * Discriminated union of all configuration registration payloads.
 * Use the `type` field to narrow to the concrete configuration shape.
 */
export type EnyoConfiguration = EnyoNumberConfiguration | EnyoSelectConfiguration;

/**
 * Event emitted when the value of a registered configuration changes.
 * `previousValue` is omitted when the configuration is being set for the first time.
 */
export interface EnyoConfigurationChangeEvent {
    /** The key of the configuration that changed */
    key: string;
    /** The new value of the configuration */
    newValue: string | number;
    /** The previous value of the configuration, if one existed */
    previousValue?: string | number;
}

/**
 * Callback signature for listeners notified on configuration value changes.
 */
export type EnyoConfigurationChangeListener = (event: EnyoConfigurationChangeEvent) => Promise<void> | void;
