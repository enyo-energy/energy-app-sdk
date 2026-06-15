import {EnyoBatteryState} from "../types/enyo-battery-state.js";

/**
 * Interface for retrieving the current runtime state of battery storages
 * managed by the enyo system. Read-only snapshots keyed by appliance ID.
 *
 * Static battery configuration (capacity, mode, features, …) remains on
 * `EnyoBatteryApplianceMetadata` via the Appliance API; this package is
 * intentionally limited to volatile runtime values (SoC, stored kWh,
 * price per kWh, optional solar share).
 *
 * Requires the `BatteryStorageState` permission.
 */
export interface EnergyAppBattery {
    /**
     * Returns the current state for every known battery storage.
     * Batteries without a reported state are omitted from the result.
     *
     * @returns Promise resolving to the list of current battery states
     */
    list: () => Promise<EnyoBatteryState[]>;

    /**
     * Returns the current state of a single battery storage by its
     * appliance ID, or `null` if no state is known for that ID (e.g.
     * the appliance is not a battery, is unknown, or has not yet
     * reported a value).
     *
     * @param applianceId - The ID of the battery appliance (`EnyoAppliance.id`)
     * @returns Promise resolving to the current battery state, or `null` if unknown
     */
    getByApplianceId: (applianceId: string) => Promise<EnyoBatteryState | null>;
}
