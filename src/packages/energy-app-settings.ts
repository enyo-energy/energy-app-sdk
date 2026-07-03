import {
    EnyoPackageConfigurationSetting,
    EnyoPackageConfigurationSettingGroup,
    EnyoSettingsChangeListener,
    EnyoSettingConfigWithValue,
    EnyoSettingGroupWithValues
} from "../types/enyo-settings.js";

/**
 * Interface for managing Energy App settings configuration for appliances or the entire package.
 * Provides methods to add, remove, and modify settings, as well as listen for changes.
 * Each setting must have a unique name across the entire configuration.
 */
export interface EnergyAppSettings {
    /**
     * Adds a new setting configuration to the Energy App.
     * The setting can be configured for a specific appliance or for the entire package.
     *
     * @param config - The setting configuration to add, including optional appliance ID and current value
     * @returns Promise that resolves when the setting is successfully added
     */
    addSettingConfig(config: EnyoPackageConfigurationSetting): Promise<void>;

    /**
     * Removes a setting configuration from the Energy App.
     * This will remove the setting regardless of whether it's for an appliance or the package.
     *
     * @param settingName - The unique name of the setting to remove
     * @param applianceId - Optional appliance ID. If provided, only the setting scoped to that
     *   specific appliance is removed. If omitted, the setting is removed regardless of scope.
     * @returns Promise that resolves when the setting is successfully removed
     */
    removeSettingConfig(settingName: string, applianceId?: string): Promise<void>;

    /**
     * Updates the value of an existing setting.
     * The setting is identified by its unique name across all appliances and package settings.
     *
     * @param settingName - The unique name of the setting to update
     * @param value - The new value for the setting
     * @returns Promise that resolves when the setting value is successfully updated
     */
    updateSetting(settingName: string, value: string): Promise<void>;

    /**
     * Registers a listener that will be called when any setting value changes.
     * The listener will be notified of changes to both appliance-specific and package-wide settings.
     *
     * @param listener - The callback function to be called on setting changes
     */
    listenForSettingsChanges(listener: EnyoSettingsChangeListener): void;

    /**
     * Retrieves all currently configured settings with their unique identifiers and current values.
     * This includes settings for both specific appliances and the entire package.
     *
     * @returns Promise that resolves to an array of all settings with their IDs and current values
     */
    getSettingsConfig(): Promise<EnyoSettingConfigWithValue[]>;

    /**
     * Adds a group of related settings to the Energy App.
     * The group organizes multiple settings under a common heading with a translated caption.
     * Each group must have a unique groupName. Settings within the group follow the same rules
     * as individual settings (unique names, optional appliance scoping).
     *
     * @param group - The setting group configuration including group name, caption, and 1-n settings
     * @returns Promise that resolves when the setting group is successfully added
     */
    addSettingGroup(group: EnyoPackageConfigurationSettingGroup): Promise<void>;

    /**
     * Removes a setting group and all its contained settings from the Energy App.
     *
     * @param groupName - The unique name of the group to remove
     * @returns Promise that resolves when the group is successfully removed
     */
    removeSettingGroup(groupName: string): Promise<void>;

    /**
     * Retrieves all currently configured setting groups with their settings' unique identifiers and current values.
     *
     * @returns Promise that resolves to an array of all setting groups with their settings including IDs and current values
     */
    getSettingGroups(): Promise<EnyoSettingGroupWithValues[]>;
}