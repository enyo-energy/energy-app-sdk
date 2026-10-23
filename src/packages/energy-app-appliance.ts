import {EnyoAppliance, EnyoApplianceGroup, EnyoApplianceTypeEnum} from "../types/enyo-appliance.js";

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
    /**
     * Get a list of all registered appliances of your package, including the
     * ones marked {@link EnyoAppliance.hidden}.
     */
    list: () => Promise<EnyoAppliance[]>;
    /**
     * Get a list of all appliances. Needs a specific permission. Appliances of
     * other packages marked {@link EnyoAppliance.hidden} are left out; your own
     * package's hidden appliances are included.
     */
    listAll: () => Promise<EnyoAppliance[]>;
    /** Get a specific appliance by its ID */
    getById: (id: string) => Promise<EnyoAppliance | null>;
    /** Remove an appliance by its ID */
    removeById: (id: string) => Promise<void>;
    /**
     * Save or update a group of your package's appliances, shown in the UI as
     * one collapsible entry — see {@link EnyoApplianceGroup}.
     *
     * Rejected when a member is not an appliance of your package or already
     * belongs to another group; move it by first saving that other group
     * without it.
     * @param group - The group to save
     * @param groupId - ID of the group to update, or `undefined` to create one
     * @returns The ID of the saved group
     */
    saveGroup: (group: Omit<EnyoApplianceGroup, 'id'>, groupId: string | undefined) => Promise<string>;
    /** Get all appliance groups of your package */
    listGroups: () => Promise<EnyoApplianceGroup[]>;
    /**
     * Remove an appliance group. Only the group goes away — its members stay
     * and are shown individually again.
     * @param groupId - ID of the group to remove
     */
    removeGroup: (groupId: string) => Promise<void>;
    /**
     * Listen for appliance updates (when an appliance is saved or modified).
     * @param listener - Callback invoked with the updated appliance
     * @returns A unique listener ID that can be used to remove the listener
     */
    listenForApplianceUpdated: (listener: (appliance: EnyoAppliance) => void | Promise<void>) => string;
    /**
     * Listen for appliance removals.
     *
     * When the appliance was marked as billed ({@link EnyoAppliance.billing}),
     * the host has already removed it from the plan's units — only stop
     * serving it.
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
     * packages and require the `AllAppliances` permission. Appliances of other
     * packages marked {@link EnyoAppliance.hidden} are never delivered.
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