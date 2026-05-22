import {
    EnyoConfiguration,
    EnyoConfigurationChangeListener
} from "../types/enyo-configuration-manager.js";

/**
 * Internal configuration manager for an Energy App package.
 *
 * Unlike {@link import('./energy-app-settings.js').EnergyAppSettings}, configurations
 * registered here are NOT user-facing and are not rendered in the Energy App UI.
 * They are intended for values that the package itself reads and writes at runtime
 * (e.g. internal feature toggles, tuning parameters, calibration values) and need
 * to be persisted across restarts.
 *
 * Each configuration is identified by a unique `key` within the package and is
 * either a numeric value (`number`) or a value picked from a fixed list (`select`).
 * Consumers can react to value changes by registering a change listener.
 */
export interface EnergyAppConfigurationManager {
    /**
     * Registers the full set of internal configurations for the package in a
     * single call. This method is intended to be called once per package start
     * with every configuration the package needs.
     *
     * Each configuration must have a unique `key` within the supplied array.
     * Re-registering an existing key is treated as an update of that
     * configuration's definition; the currently stored value is preserved if
     * it still satisfies the new constraints.
     *
     * @param configurations - The complete list of configuration definitions to register
     * @returns Promise that resolves once all configurations are registered
     */
    registerConfigurations(configurations: EnyoConfiguration[]): Promise<void>;

    /**
     * Removes the configurations identified by the given keys along with any
     * values stored for them. Unknown keys are ignored.
     *
     * @param keys - The unique keys of the configurations to remove
     * @returns Promise that resolves once all configurations are removed
     */
    unregisterConfigurations(keys: string[]): Promise<void>;

    /**
     * Retrieves the current value for a registered configuration.
     *
     * Returns the persisted value if one has been set, otherwise the
     * configuration's `defaultValue` if defined, otherwise `undefined`.
     *
     * @param key - The unique key of the configuration
     * @returns Promise resolving to the current value, or `undefined` if no
     *          value and no default has been defined
     */
    getConfiguration(key: string): Promise<string | number | undefined>;

    /**
     * Registers a listener that is invoked whenever the value of any
     * configuration managed by this package changes.
     *
     * @param listener - Callback invoked with the change event
     */
    onConfigurationChanged(listener: EnyoConfigurationChangeListener): void;
}
