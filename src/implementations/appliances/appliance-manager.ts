import type {EnergyApp} from "../../index.js";
import type {EnyoNetworkDevice} from "../../types/enyo-network-device.js";
import {
    EnyoAppliance,
    EnyoApplianceConnectionType,
    EnyoApplianceMetadata,
    EnyoApplianceName,
    EnyoApplianceStateEnum,
    EnyoApplianceTopology,
    EnyoApplianceTypeEnum
} from "../../types/enyo-appliance.js";
import type {EnyoChargerApplianceMetadata} from "../../types/enyo-charger-appliance.js";
import type {EnyoHeatpumpApplianceMetadata} from "../../types/enyo-heatpump-appliance.js";
import type {EnyoBatteryApplianceMetadata} from "../../types/enyo-battery-appliance.js";
import type {EnyoInverterApplianceMetadata} from "../../types/enyo-inverter-appliance.js";
import type {EnyoMeterAppliance} from "../../types/enyo-meter-appliance.js";
import {IdentifierStrategy, NetworkDeviceIdStrategy} from "./identifier-strategies.js";

/**
 * Configuration for creating or updating an appliance.
 */
export interface ApplianceConfig {
    /** Name of the appliance in different languages */
    name: EnyoApplianceName[];
    /** Type of the appliance */
    type: EnyoApplianceTypeEnum;
    /** Network device(s) associated with the appliance */
    networkDevices?: EnyoNetworkDevice[];
    /** Appliance metadata */
    metadata?: Partial<EnyoApplianceMetadata>;
    /** Topology information */
    topology?: EnyoApplianceTopology;
    /** Type-specific metadata based on appliance type */
    typeMetadata?: {
        meter?: EnyoMeterAppliance;
        inverter?: EnyoInverterApplianceMetadata;
        charger?: EnyoChargerApplianceMetadata;
        heatpump?: EnyoHeatpumpApplianceMetadata;
        battery?: EnyoBatteryApplianceMetadata;
    };
}

/**
 * Configuration options for the ApplianceManager.
 */
export interface ApplianceManagerConfig {
    /** Strategy for identifying appliances. Defaults to NetworkDeviceIdStrategy */
    identifierStrategy?: IdentifierStrategy;
    /** Whether to auto-update appliance metadata on changes. Defaults to true */
    autoUpdateMetadata?: boolean;
    /** Whether to log operations. Defaults to true */
    enableLogging?: boolean;
    /** Default connection type for new appliances. Defaults to Connector */
    defaultConnectionType?: EnyoApplianceConnectionType;
    /** Default vendor name when not specified */
    defaultVendorName?: string;
}

/**
 * Result of a find operation.
 */
export interface FindResult {
    /** The found appliance */
    appliance: EnyoAppliance;
    /** The identifier that matched */
    identifier: string;
    /** The strategy that found the match */
    strategy: string;
}

/**
 * Manages appliances in the energy system with configurable identification strategies.
 * Provides comprehensive CRUD operations and state management for energy appliances.
 */
export class ApplianceManager {
    private applianceCache: Map<string, EnyoAppliance> = new Map();
    private identifierToApplianceId: Map<string, Set<string>> = new Map();
    private config: Required<ApplianceManagerConfig>;

    /**
     * Creates a new ApplianceManager instance.
     * @param energyApp The EnergyApp instance to use for API calls
     * @param config Configuration options for the manager
     */
    constructor(
        private energyApp: EnergyApp,
        config?: ApplianceManagerConfig
    ) {
        this.config = {
            identifierStrategy: config?.identifierStrategy ?? new NetworkDeviceIdStrategy(),
            autoUpdateMetadata: config?.autoUpdateMetadata ?? true,
            enableLogging: config?.enableLogging ?? true,
            defaultConnectionType: config?.defaultConnectionType ?? EnyoApplianceConnectionType.Connector,
            defaultVendorName: config?.defaultVendorName ?? ''
        };
    }

    /**
     * Creates or updates an appliance with the given configuration.
     * @param config The appliance configuration
     * @param existingApplianceId Optional ID of an existing appliance to update
     * @returns The ID of the created or updated appliance
     */
    async createOrUpdateAppliance(config: ApplianceConfig, existingApplianceId?: string): Promise<string> {
        // Build network device IDs list
        const networkDeviceIds = config.networkDevices?.map(d => d.id) ?? [];

        // Merge metadata with defaults
        const metadata: EnyoApplianceMetadata = {
            connectionType: this.config.defaultConnectionType,
            state: EnyoApplianceStateEnum.Connected,
            ...config.metadata
        };

        if (this.config.defaultVendorName && !metadata.vendorName) {
            metadata.vendorName = this.config.defaultVendorName;
        }

        // Build appliance data
        const applianceData: Omit<EnyoAppliance, 'id'> = {
            name: config.name,
            type: config.type,
            networkDeviceIds,
            metadata,
            ...(config.topology && {topology: config.topology})
        };

        // Add type-specific metadata
        if (config.typeMetadata) {
            Object.assign(applianceData, config.typeMetadata);
        }

        // Save appliance
        const applianceId = await this.energyApp.useAppliances().save(
            applianceData,
            existingApplianceId
        );

        // Update cache
        const savedAppliance = await this.energyApp.useAppliances().getById(applianceId);
        if (savedAppliance) {
            this.updateCache(savedAppliance, config.networkDevices?.[0]);
        }

        console.log(`${existingApplianceId ? 'Updated' : 'Created'} appliance ${applianceId} of type ${config.type}`);

        return applianceId;
    }

    /**
     * Updates the internal cache with an appliance.
     * @param appliance The appliance to cache
     * @param networkDevice Optional network device for identifier extraction
     */
    protected updateCache(appliance: EnyoAppliance, networkDevice?: EnyoNetworkDevice): void {
        this.applianceCache.set(appliance.id, appliance);

        // Extract identifier
        const identifier = this.config.identifierStrategy.extract(appliance, networkDevice);
        if (identifier) {
            if (!this.identifierToApplianceId.has(identifier)) {
                this.identifierToApplianceId.set(identifier, new Set());
            }
            this.identifierToApplianceId.get(identifier)!.add(appliance.id);
        }
    }

    /**
     * Clears the internal cache.
     */
    clearCache(): void {
        this.applianceCache.clear();
        this.identifierToApplianceId.clear();
    }

    /**
     * Refreshes the cache with all appliances from the system.
     */
    async refreshCache(): Promise<void> {
        this.clearCache();
        const appliances = await this.energyApp.useAppliances().list();

        for (const appliance of appliances) {
            // Try to get network devices if available
            const networkDevices = await this.getNetworkDevicesForAppliance(appliance);
            this.updateCache(appliance, networkDevices[0]);
        }
    }

    /**
     * Gets network devices associated with an appliance.
     * @param appliance The appliance
     * @returns Array of network devices
     */
    private async getNetworkDevicesForAppliance(appliance: EnyoAppliance): Promise<EnyoNetworkDevice[]> {
        const devices: EnyoNetworkDevice[] = [];
        const networkDevices = await this.energyApp.useNetworkDevices().getDevices();
        for (const deviceId of appliance.networkDeviceIds) {
            const device = networkDevices.find(d => d.id === deviceId);
            if (device) {
                devices.push(device);
            }
        }

        return devices;
    }

    /**
     * Finds appliances by their identifier using the configured strategy.
     * @param identifier The identifier to search for
     * @returns Array of matching appliances
     */
    async findByIdentifier(identifier: string): Promise<EnyoAppliance[]> {
        // Check cache first
        const cachedIds = this.identifierToApplianceId.get(identifier);
        if (cachedIds && cachedIds.size > 0) {
            const appliances: EnyoAppliance[] = [];
            for (const id of cachedIds) {
                const appliance = this.applianceCache.get(id);
                if (appliance) {
                    appliances.push(appliance);
                }
            }
            if (appliances.length > 0) {
                return appliances;
            }
        }

        // Search in all appliances
        const allAppliances = await this.energyApp.useAppliances().list();
        const matches: EnyoAppliance[] = [];

        for (const appliance of allAppliances) {
            const networkDevices = await this.getNetworkDevicesForAppliance(appliance);
            const extractedId = this.config.identifierStrategy.extract(
                appliance,
                networkDevices[0]
            );

            if (extractedId === identifier) {
                matches.push(appliance);
                this.updateCache(appliance, networkDevices[0]);
            }
        }

        return matches;
    }

    /**
     * Finds an appliance using multiple strategies.
     * @param searchValue The value to search for
     * @param strategies Array of strategies to try
     * @returns The first matching result or undefined
     */
    async findWithStrategies(
        searchValue: string,
        strategies: IdentifierStrategy[]
    ): Promise<FindResult | undefined> {
        const allAppliances = await this.energyApp.useAppliances().list();

        for (const strategy of strategies) {
            for (const appliance of allAppliances) {
                const networkDevices = await this.getNetworkDevicesForAppliance(appliance);
                const identifier = strategy.extract(appliance, networkDevices[0]);

                if (identifier === searchValue) {
                    return {
                        appliance,
                        identifier,
                        strategy: strategy.name
                    };
                }
            }
        }

        return undefined;
    }

    /**
     * Gets all appliances of a specific type.
     * @param type The appliance type to filter by
     * @returns Array of appliances of the specified type
     */
    async getAppliancesByType(type: EnyoApplianceTypeEnum): Promise<EnyoAppliance[]> {
        const allAppliances = await this.energyApp.useAppliances().list();
        return allAppliances.filter(a => a.type === type);
    }

    /**
     * Updates the state of an appliance.
     * @param applianceId The ID of the appliance to update
     * @param connectionType The new Connection type
     * @param state The new state
     */
    async updateApplianceState(applianceId: string, connectionType: EnyoApplianceConnectionType, state: EnyoApplianceStateEnum): Promise<void> {
        try {
            const appliance = await this.energyApp.useAppliances().getById(applianceId);
            if (appliance) {
                const updatedAppliance: Omit<EnyoAppliance, 'id'> = {
                    ...appliance,
                    metadata: {...appliance.metadata, connectionType, state}
                };

                await this.energyApp.useAppliances().save(updatedAppliance, applianceId);

                // Update cache
                appliance.metadata = {...appliance.metadata, connectionType, state};
                this.applianceCache.set(applianceId, appliance);

                console.log(`Updated appliance ${applianceId} state to ${state}`);
            }
        } catch (error) {
            console.error(`Failed to update appliance state for ${applianceId}: ${error}`);
            throw error;
        }
    }

    /**
     * Updates metadata for an appliance.
     * @param applianceId The ID of the appliance
     * @param metadata The metadata to update
     */
    async updateApplianceMetadata(
        applianceId: string,
        metadata: Partial<EnyoApplianceMetadata> & { connectionType: EnyoApplianceConnectionType }
    ): Promise<void> {
        try {
            const appliance = await this.energyApp.useAppliances().getById(applianceId);
            if (appliance) {
                const updatedAppliance: Omit<EnyoAppliance, 'id'> = {
                    ...appliance,
                    metadata: {
                        ...appliance.metadata,
                        ...metadata
                    }
                };

                await this.energyApp.useAppliances().save(updatedAppliance, applianceId);

                // Update cache
                appliance.metadata = {...appliance.metadata, ...metadata};
                this.applianceCache.set(applianceId, appliance);

                console.log(`Updated metadata for appliance ${applianceId}`);
            }
        } catch (error) {
            console.error(`Failed to update metadata for appliance ${applianceId}: ${error}`);
            throw error;
        }
    }

    /**
     * Removes an appliance by its ID.
     * @param applianceId The ID of the appliance to remove
     */
    async removeAppliance(applianceId: string): Promise<void> {
        try {
            await this.energyApp.useAppliances().removeById(applianceId);

            // Clean up cache
            const appliance = this.applianceCache.get(applianceId);
            if (appliance) {
                this.applianceCache.delete(applianceId);

                // Clean up identifier mapping
                for (const [identifier, ids] of this.identifierToApplianceId.entries()) {
                    ids.delete(applianceId);
                    if (ids.size === 0) {
                        this.identifierToApplianceId.delete(identifier);
                    }
                }
            }

            console.log(`Removed appliance ${applianceId}`);
        } catch (error) {
            console.error(`Failed to remove appliance ${applianceId}: ${error}`);
            throw error;
        }
    }

    /**
     * Removes all appliances matching an identifier.
     * @param identifier The identifier to match
     * @returns The number of appliances removed
     */
    async removeAppliancesByIdentifier(identifier: string): Promise<number> {
        const appliances = await this.findByIdentifier(identifier);
        let removedCount = 0;

        for (const appliance of appliances) {
            try {
                await this.removeAppliance(appliance.id);
                removedCount++;
            } catch (error) {
                console.error(`Failed to remove appliance ${appliance.id}: ${error}`);
            }
        }

        return removedCount;
    }

    /**
     * Sets all appliances with a given identifier to offline state.
     * @param identifier The identifier to match
     * @returns The number of appliances updated
     */
    async setAppliancesOfflineByIdentifier(identifier: string): Promise<number> {
        const appliances = await this.findByIdentifier(identifier);
        let updatedCount = 0;

        for (const appliance of appliances) {
            try {
                await this.updateApplianceState(appliance.id, appliance.metadata?.connectionType || EnyoApplianceConnectionType.Connector, EnyoApplianceStateEnum.Offline);
                updatedCount++;
            } catch (error) {
                console.error(`Failed to set appliance ${appliance.id} offline: ${error}`);
            }
        }

        return updatedCount;
    }

    /**
     * Sets all appliances with a given identifier to online (connected) state.
     * @param identifier The identifier to match
     * @returns The number of appliances updated
     */
    async setAppliancesOnlineByIdentifier(identifier: string): Promise<number> {
        const appliances = await this.findByIdentifier(identifier);
        let updatedCount = 0;

        for (const appliance of appliances) {
            try {
                await this.updateApplianceState(appliance.id, appliance.metadata?.connectionType || EnyoApplianceConnectionType.Connector, EnyoApplianceStateEnum.Connected);
                updatedCount++;
            } catch (error) {
                console.error(`Failed to set appliance ${appliance.id} online: ${error}`);
            }
        }

        return updatedCount;
    }

    /**
     * Performs a bulk update on multiple appliances.
     * @param updates Array of updates to perform
     * @returns Results of the bulk update operation
     */
    async bulkUpdate(updates: Array<{
        applianceId: string;
        data: Partial<Omit<EnyoAppliance, 'id'>>;
    }>): Promise<{ succeeded: string[]; failed: string[] }> {
        const succeeded: string[] = [];
        const failed: string[] = [];

        for (const update of updates) {
            try {
                const appliance = await this.energyApp.useAppliances().getById(update.applianceId);
                if (appliance) {
                    const updatedAppliance: Omit<EnyoAppliance, 'id'> = {
                        ...appliance,
                        ...update.data
                    };

                    await this.energyApp.useAppliances().save(updatedAppliance, update.applianceId);
                    succeeded.push(update.applianceId);

                    // Update cache
                    Object.assign(appliance, update.data);
                    this.applianceCache.set(update.applianceId, appliance);
                } else {
                    failed.push(update.applianceId);
                }
            } catch (error) {
                console.error(`Bulk update failed for ${update.applianceId}: ${error}`);
                failed.push(update.applianceId);
            }
        }

        console.log(`Bulk update completed: ${succeeded.length} succeeded, ${failed.length} failed`);
        return {succeeded, failed};
    }

    /**
     * Gets statistics about the managed appliances.
     * @returns Statistics object
     */
    async getStatistics(): Promise<{
        total: number;
        byType: Record<string, number>;
        byState: Record<string, number>;
        cached: number;
    }> {
        const appliances = await this.energyApp.useAppliances().list();
        const byType: Record<string, number> = {};
        const byState: Record<string, number> = {};

        for (const appliance of appliances) {
            // Count by type
            byType[appliance.type] = (byType[appliance.type] ?? 0) + 1;

            // Count by state
            const state = appliance.metadata?.state ?? 'unknown';
            byState[state] = (byState[state] ?? 0) + 1;
        }

        return {
            total: appliances.length,
            byType,
            byState,
            cached: this.applianceCache.size
        };
    }

    /**
     * Changes the identifier strategy at runtime.
     * @param strategy The new strategy to use
     * @param rebuildCache Whether to rebuild the cache with the new strategy
     */
    async setIdentifierStrategy(strategy: IdentifierStrategy, rebuildCache: boolean = true): Promise<void> {
        this.config.identifierStrategy = strategy;
        console.log(`Changed identifier strategy to: ${strategy.name}`);

        if (rebuildCache) {
            await this.refreshCache();
        }
    }

    /**
     * Gets the current identifier strategy.
     * @returns The current identifier strategy
     */
    getIdentifierStrategy(): IdentifierStrategy {
        return this.config.identifierStrategy;
    }
}