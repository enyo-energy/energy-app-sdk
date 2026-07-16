import {EnyoAppliance, EnyoApplianceTypeEnum} from "../types/enyo-appliance.js";

/**
 * Ownership scope for an appliance-created subscription.
 * - `'own'`: appliances created by your own package.
 * - `'all'`: every appliance created system-wide.
 * - `'external'`: only appliances created by *other* packages (all minus own).
 */
export type EnyoApplianceCreatedScope = 'own' | 'all' | 'external';

/**
 * Optional filter controlling which appliance-created events a listener receives.
 * When omitted, defaults to `scope: 'own'` and no category restriction.
 */
export interface EnyoApplianceCreatedFilter {
    /**
     * Ownership scope of the subscription:
     * - `'own'` (default): appliances created by your own package.
     * - `'all'`: every appliance created system-wide. Requires the `AllAppliances` permission.
     * - `'external'`: only appliances created by *other* packages (all minus own). Requires the `AllAppliances` permission.
     */
    scope?: EnyoApplianceCreatedScope;
    /**
     * When set, the listener only fires for appliances whose
     * {@link EnyoApplianceTypeEnum category} is included in this list. When
     * omitted, appliances of every category are delivered.
     */
    types?: EnyoApplianceTypeEnum[];
}

/**
 * Interface for managing appliances in enyo packages.
 * Provides CRUD operations for appliance registration and management.
 */
export interface EnergyAppAppliance {
    /** Save or update an appliance in the system */
    save: (appliance: Omit<EnyoAppliance, 'id'>, applianceId: string | undefined) => Promise<string>;
    /** Get a list of all registered appliances of your package */
    list: () => Promise<EnyoAppliance[]>;
    /** Get a list of all appliances. Needs a specific permission */
    listAll: () => Promise<EnyoAppliance[]>;
    /** Get a specific appliance by its ID */
    getById: (id: string) => Promise<EnyoAppliance | null>;
    /** Remove an appliance by its ID */
    removeById: (id: string) => Promise<void>;
    /**
     * Listen for appliance updates (when an appliance is saved or modified).
     * @param listener - Callback invoked with the updated appliance
     * @returns A unique listener ID that can be used to remove the listener
     */
    listenForApplianceUpdated: (listener: (appliance: EnyoAppliance) => void | Promise<void>) => string;
    /**
     * Listen for appliance removals.
     * @param listener - Callback invoked with the ID of the removed appliance
     * @returns A unique listener ID that can be used to remove the listener
     */
    listenForApplianceRemoved: (listener: (applianceId: string) => void | Promise<void>) => string;
    /**
     * Listen for newly-created appliances. Fires only when an appliance is
     * first created — not on subsequent updates (use
     * {@link listenForApplianceUpdated} for those).
     *
     * The optional {@link EnyoApplianceCreatedFilter filter} controls scope and
     * category: by default only your own package's creations are delivered;
     * `scope: 'all'` and `scope: 'external'` observe appliances created by other
     * packages and require the `AllAppliances` permission.
     *
     * @param listener - Callback invoked with each newly-created appliance
     * @param filter - Optional scope/category filter; defaults to `{ scope: 'own' }`
     * @returns A unique listener ID that can be used to remove the listener
     */
    listenForApplianceCreated: (
        listener: (appliance: EnyoAppliance) => void | Promise<void>,
        filter?: EnyoApplianceCreatedFilter,
    ) => string;
    /**
     * Removes a previously registered listener.
     * @param listenerId - The ID returned by listenForApplianceUpdated, listenForApplianceRemoved, or listenForApplianceCreated
     */
    removeListener: (listenerId: string) => void;
}