import {
    EnergyAppPackageConfigurationSetting,
    EnergyAppSettingsChangeListener,
    EnergyAppSettingConfigWithValue
} from "../types/energy-app-settings.js";

/**
 * Interface for managing Energy App settings configuration.
 * Provides methods to add, remove, and modify settings, as well as listen for changes.
 */
export interface EnergyAppSettings {
    /**
     * Adds a new setting configuration to the Energy App.
     * @param config The setting configuration to add
     * @returns Promise that resolves when the setting is successfully added
     */
    addSettingConfig(config: EnergyAppPackageConfigurationSetting): Promise<void>;

    /**
     * Removes a setting configuration from the Energy App.
     * @param settingName The name of the setting to remove
     * @returns Promise that resolves when the setting is successfully removed
     */
    removeSettingConfig(settingName: string): Promise<void>;

    /**
     * Changes the value of an existing setting.
     * @param settingName The name of the setting to change
     * @param value The new value for the setting
     * @returns Promise that resolves when the setting value is successfully changed
     */
    changeSettingsValue(settingName: string, value: string): Promise<void>;

    /**
     * Registers a listener that will be called when any setting value changes.
     * @param listener The callback function to be called on setting changes
     */
    listenForSettingsChanges(listener: EnergyAppSettingsChangeListener): void;

    /**
     * Retrieves all currently configured settings with their unique identifiers and current values.
     * @returns Promise that resolves to an array of all settings with their IDs and current values
     */
    getSettingsConfig(): Promise<EnergyAppSettingConfigWithValue[]>;
}