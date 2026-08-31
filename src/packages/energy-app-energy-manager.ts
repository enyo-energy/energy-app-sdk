import {EnergyManagerFeatureEnum, EnergyManagerInfo} from "../types/enyo-energy-manager.js";
import {EnyoDiagnosticsControlPlan} from "../types/enyo-diagnostics.js";
import type {
    EnergyManagerSettingEnum,
    EnergyManagerSettingValues,
    EnergyManagerSettingsChangeListener,
    EnergyManagerSettingsState,
} from "../types/enyo-energy-manager-settings.js";

/**
 * Interface for retrieving energy manager information and capabilities.
 * The energy manager is responsible for optimizing energy usage across appliances.
 */
export interface EnergyAppEnergyManager {
    /**
     * Gets information about the currently active energy manager.
     * Returns null if no energy manager is configured.
     *
     * @returns Promise resolving to energy manager info or null if no energy manager is configured
     *
     * @example
     * ```typescript
     * const energyManager = energyApp.useEnergyManager();
     * const info = await energyManager.getEnergyManagerInfo();
     * if (info) {
     *     console.log(`Energy Manager: ${info.name}`);
     *     console.log(`Features: ${info.features.join(', ')}`);
     * }
     * ```
     */
    getEnergyManagerInfo(): Promise<EnergyManagerInfo | null>;

    /** Only for Energy Manager Energy Apps: Register the features which are provided*/
    registerFeatures(features: EnergyManagerFeatureEnum[]): void;

    /**
     * Only for Energy Manager Energy Apps: Publishes the energy manager's control plan forecast.
     * The control plan contains time-slotted actions for each appliance along with
     * estimated costs and grid power values.
     *
     * @param controlPlan - The time-slotted control plan with actions for each appliance
     *   and estimated costs
     *
     * @example
     * ```typescript
     * const energyManager = energyApp.useEnergyManager();
     * energyManager.publishForecast({
     *     actions: [
     *         {
     *             action: EnyoDiagnosticsControlActionEnum.BatteryChargeFromGrid,
     *             type: EnyoApplianceTypeEnum.Storage,
     *             applianceId: 'battery-1',
     *             timestampIso: new Date().toISOString(),
     *             isCommand: true,
     *             powerW: 3000,
     *             durationInMinutes: 60,
     *             reason: {
     *                 type: EnyoDiagnosticsActionReasonTypeEnum.ElectricityPriceBelowThreshold,
     *                 electricityPricePerKwh: 0.15,
     *             }
     *         }
     *     ],
     *     generatedAtIso: new Date().toISOString(),
     *     totalEstimatedCostEur: 3.50,
     *     totalGridImportKwh: 12.5,
     *     totalGridExportKwh: 4.2
     * });
     * ```
     */
    publishForecast(controlPlan: EnyoDiagnosticsControlPlan): void;

    /**
     * Only for Energy Manager Energy Apps: declares which general settings this
     * energy manager honours.
     *
     * The counterpart of {@link registerFeatures} for the user-facing controls:
     * the enyo cockpit renders exactly the settings named here, and an app reads
     * {@link EnergyManagerSettingsState.supported} before acting on any value.
     * A setting left out is one this energy manager does not implement — the
     * user is never offered a switch that does nothing.
     *
     * Calling again replaces the previous declaration. Declare during startup,
     * before the cockpit asks.
     *
     * Declare the gates and their dependants together: `ChargerControl` without
     * `DefaultChargeMode` is a half-built control surface, and
     * `validateEnergyManagerSettingsState()` warns about it. See
     * {@link ENERGY_MANAGER_SETTING_DEPENDENCIES} for which settings gate which.
     *
     * @param settings - The general settings this energy manager honours.
     *
     * @example
     * ```typescript
     * const em = energyApp.useEnergyManager();
     * em.registerSupportedSettings([
     *     EnergyManagerSettingEnum.BatteryControl,
     *     EnergyManagerSettingEnum.BatteryChargingMode,
     *     EnergyManagerSettingEnum.BatteryChargeFromGrid,
     *     EnergyManagerSettingEnum.ChargerControl,
     *     EnergyManagerSettingEnum.DefaultChargeMode,
     *     EnergyManagerSettingEnum.PriceLimitCtPerKwh,
     *     // no heat pump / heating rod: this energy manager does not steer them
     * ]);
     * ```
     */
    registerSupportedSettings(settings: EnergyManagerSettingEnum[]): void;

    /**
     * Gets the general settings of the currently active energy manager.
     *
     * Returns `null` when no energy manager is configured — the same contract as
     * {@link getEnergyManagerInfo}, and not an error: a hub without an energy
     * manager is a valid state, and an app should carry on unsteered rather than
     * fail.
     *
     * Check {@link EnergyManagerSettingsState.supported} before reading a value,
     * and remember that an absent boolean is **not** `false`: it means
     * unsupported or never chosen, while `false` is the user deliberately
     * switching something off.
     *
     * @returns Promise resolving to the current settings, or `null` when no
     *   energy manager is configured.
     *
     * @example
     * ```typescript
     * const em = energyApp.useEnergyManager();
     * const state = await em.getEnergyManagerSettings();
     *
     * if (state?.supported.includes(EnergyManagerSettingEnum.ChargerControl)
     *     && state.values.chargerControl === false) {
     *     skipChargerOptimization();
     * }
     * ```
     */
    getEnergyManagerSettings(): Promise<EnergyManagerSettingsState | null>;

    /**
     * Only for Energy Manager Energy Apps: writes general settings.
     *
     * Intended for seeding sensible defaults on first run, so the user meets a
     * configured system rather than an empty screen. Only settings this energy
     * manager declared through {@link registerSupportedSettings} can be written;
     * the rest are rejected by the host.
     *
     * **Pass `onlyIfUnset: true` when seeding defaults.** A plain write is
     * last-write-wins, so an energy manager that seeds its defaults on every
     * startup will overwrite the user's choice on every restart — a bug that
     * looks like "the app keeps forgetting my settings" and is nearly impossible
     * to attribute from the outside.
     *
     * @param values - The settings to write. Fields left out are untouched.
     * @param options - `onlyIfUnset` writes each value only where none is stored
     *   yet, leaving anything the user has already chosen alone. Defaults to
     *   `false`.
     * @returns Promise that resolves once the values have been persisted.
     *
     * @example
     * ```typescript
     * // Seed defaults without ever overriding the user.
     * await energyApp.useEnergyManager().setEnergyManagerSettings(
     *     {
     *         batteryControl: true,
     *         batteryChargingMode: EnergyManagerBatteryChargingModeEnum.Paced,
     *         defaultChargeMode: EnyoChargeModeEnum.CostOptimized,
     *     },
     *     {onlyIfUnset: true},
     * );
     * ```
     */
    setEnergyManagerSettings(
        values: Partial<EnergyManagerSettingValues>,
        options?: { onlyIfUnset?: boolean }
    ): Promise<void>;

    /**
     * Registers a listener called whenever the general settings change.
     *
     * The event carries the **complete** new state, so a listener never has to
     * re-read it and never races a concurrent update. Use `event.changed` to act
     * only on what actually moved.
     *
     * Several listeners may be registered; each call returns its own
     * subscription id for {@link unsubscribeEnergyManagerSettings}.
     *
     * @param listener - Callback invoked on every settings change.
     * @returns The subscription id.
     *
     * @example
     * ```typescript
     * const em = energyApp.useEnergyManager();
     * const id = em.listenForEnergyManagerSettingsChange(async ({changed, state}) => {
     *     if (changed.includes(EnergyManagerSettingEnum.DefaultChargeMode)) {
     *         await applyChargeMode(state.values.defaultChargeMode);
     *     }
     * });
     *
     * // later
     * em.unsubscribeEnergyManagerSettings(id);
     * ```
     */
    listenForEnergyManagerSettingsChange(
        listener: EnergyManagerSettingsChangeListener
    ): string;

    /**
     * Cancels a subscription created with
     * {@link listenForEnergyManagerSettingsChange}.
     *
     * Unknown ids are ignored, so teardown is safe to call unconditionally.
     *
     * @param subscriptionId - The id returned when the listener was registered.
     */
    unsubscribeEnergyManagerSettings(subscriptionId: string): void;
}
