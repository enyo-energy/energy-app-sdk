import {EnyoGridConnectionPoint} from "../types/enyo-grid-connection-point.js";

/**
 * Interface for retrieving information about the site's grid connection point.
 *
 * The grid connection point describes the physical interface between the
 * local electrical installation and the public grid, including the main
 * fuse rating, the number of phases, and the maximum allowed grid power.
 * Energy apps consume this information to size grid-import/export budgets,
 * enforce per-phase current limits, and respect contractual or regulatory
 * power caps.
 */
export interface EnergyAppGridConnectionPoint {
    /**
     * Retrieves the configured grid connection point details.
     *
     * Returns `null` when no grid connection point has been configured for
     * the site yet (e.g. during initial onboarding).
     *
     * @returns Promise resolving to the grid connection point details, or
     *   `null` if none is configured.
     *
     * @example
     * ```typescript
     * const gridConnectionPoint = energyApp.useGridConnectionPoint();
     * const details = await gridConnectionPoint.getGridConnectionPoint();
     * if (details) {
     *     console.log(`Fuse: ${details.fuseAmpere} A`);
     *     console.log(`Phases: ${details.numberOfPhases}`);
     *     console.log(`Power limit: ${details.powerLimitW} W`);
     * }
     * ```
     */
    getGridConnectionPoint(): Promise<EnyoGridConnectionPoint | null>;
}
