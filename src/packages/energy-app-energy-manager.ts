import {EnergyManagerFeatureEnum, EnergyManagerInfo} from "../types/enyo-energy-manager.js";
import {EnyoDiagnosticsControlPlan} from "../types/enyo-diagnostics.js";

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
}
