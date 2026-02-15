import {PvSystemRegistration, PvSystemInfo} from "../types/enyo-pv-system.js";

/**
 * Interface for managing PV systems.
 * Allows energy apps to register, retrieve, update, and remove PV system configurations
 * including DC string orientations, peak power, associated appliances, and feature flags.
 */
export interface EnergyAppPvSystem {
    /**
     * Registers a new PV system.
     * The PV system describes the physical installation including peak power,
     * DC string configurations with module count and orientation, optional appliances,
     * and feature flags.
     *
     * @param pvSystem - The PV system registration data
     * @returns Promise that resolves to the registered PV system info including its generated ID
     *
     * @example
     * ```typescript
     * const pvSystem = await pvSystemApi.registerPvSystem({
     *     kWp: 10.5,
     *     dcStrings: [
     *         { numberOfModules: 12, orientation: PvOrientationEnum.South, orientationSource: 'user' },
     *         { numberOfModules: 8, orientation: PvOrientationEnum.West }
     *     ],
     *     appliances: [
     *         { applianceId: 'inv-1', applianceType: EnergyAppApplianceTypeEnum.Inverter }
     *     ],
     *     features: ['only-grid-feed-in']
     * });
     * console.log(`Registered PV system: ${pvSystem.pvSystemId}`);
     * ```
     */
    registerPvSystem(pvSystem: PvSystemRegistration): Promise<PvSystemInfo>;

    /**
     * Retrieves a registered PV system by its ID.
     *
     * @param pvSystemId - The unique identifier of the PV system
     * @returns Promise that resolves to the PV system info, or null if not found
     */
    getPvSystem(pvSystemId: string): Promise<PvSystemInfo | null>;

    /**
     * Updates an existing PV system configuration.
     * Allows changing the kWp, DC string configurations, appliances, and features
     * of a registered PV system.
     *
     * @param pvSystemId - The unique identifier of the PV system to update
     * @param pvSystem - The updated PV system registration data
     * @returns Promise that resolves to the updated PV system info
     *
     * @example
     * ```typescript
     * const updated = await pvSystemApi.updatePvSystem('pv-system-001', {
     *     kWp: 12.0,
     *     dcStrings: [
     *         { numberOfModules: 14, orientation: PvOrientationEnum.South },
     *         { numberOfModules: 10, orientation: PvOrientationEnum.West }
     *     ]
     * });
     * ```
     */
    updatePvSystem(pvSystemId: string, pvSystem: PvSystemRegistration): Promise<PvSystemInfo>;

    /**
     * Removes a registered PV system by its ID.
     * If the PV system does not exist, this operation is a no-op.
     *
     * @param pvSystemId - The unique identifier of the PV system to remove
     * @returns Promise that resolves when the PV system has been removed
     */
    removePvSystem(pvSystemId: string): Promise<void>;
}
