import {EnergyManagerInfo} from "../types/enyo-energy-manager.js";

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
}
