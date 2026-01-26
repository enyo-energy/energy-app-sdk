import type {EnergyApp} from "../../index.js";
import type {EnyoNetworkDevice} from "../../types/enyo-network-device.js";
import {
    EnyoAppliance,
    EnyoApplianceConnectionType,
    EnyoApplianceMetadata,
    EnyoApplianceStateEnum,
    EnyoApplianceTypeEnum
} from "../../types/enyo-appliance.js";
import {ApplianceConfig, ApplianceManager, ApplianceManagerConfig, FindResult} from "./appliance-manager.js";
import {IdentifierStrategy} from "./identifier-strategies.js";
import {randomUUID} from "node:crypto";

/**
 * Demo implementation of ApplianceManager that stores all data in memory.
 * This class provides the same interface as ApplianceManager but doesn't
 * use energyApp.useAppliances() for persistence.
 */
export class InMemoryApplianceManager extends ApplianceManager {
    private memoryStore: Map<string, EnyoAppliance> = new Map();
    private nextId: number = 1;
    private networkDevicesStore: Map<string, EnyoNetworkDevice[]> = new Map();

    /**
     * Creates a new DemoApplianceManager instance.
     * @param energyApp The EnergyApp instance (not used for persistence in demo)
     * @param config Configuration options for the manager
     */
    constructor(energyApp: EnergyApp, config?: ApplianceManagerConfig) {
        super(energyApp, config);
    }

    /**
     * Creates or updates an appliance in memory.
     * @param appliance The appliance configuration
     * @returns The ID of the created or updated appliance
     */
    async createOrUpdateAppliance(appliance: ApplianceConfig): Promise<string> {
        // Build network device IDs list
        const networkDeviceIds = appliance.networkDevices?.map(d => d.id) ?? [];

        // Try to find existing appliance using identifier strategy
        let existingAppliance: EnyoAppliance | undefined;

        const identifier = this.config.identifierStrategy.extract(
            appliance,
        );

        if (identifier) {
            const existing = await this.findByIdentifier(identifier);
            if (existing.length > 0) {
                existingAppliance = existing[0];
                if (this.config.enableLogging) {
                    console.log(`Found existing appliance with ID ${existingAppliance.id} for identifier ${identifier}`);
                }
            }
        }

        // Merge metadata with defaults and existing values
        const metadata: EnyoApplianceMetadata = {
            connectionType: appliance.metadata?.connectionType ||
                existingAppliance?.metadata?.connectionType ||
                EnyoApplianceConnectionType.Connector,
            state: appliance.metadata?.state ||
                existingAppliance?.metadata?.state ||
                EnyoApplianceStateEnum.Connected,
            ...appliance.metadata
        };

        // Build appliance data
        const applianceId = existingAppliance?.id || randomUUID();
        const applianceData: EnyoAppliance = {
            id: applianceId,
            name: appliance.name,
            type: appliance.type,
            networkDeviceIds,
            metadata,
            ...(appliance.topology && {topology: appliance.topology}),
            meter: appliance.meter,
            heatpump: appliance.heatpump,
            battery: appliance.battery,
            charger: appliance.charger,
            inverter: appliance.inverter,
        };

        // Save to memory store
        this.memoryStore.set(applianceId, applianceData);

        // Store network devices if provided
        if (appliance.networkDevices) {
            this.networkDevicesStore.set(applianceId, appliance.networkDevices);
        }

        // Update cache
        this.updateCache(applianceData);

        console.log(`[DEMO] ${existingAppliance ? 'Updated' : 'Created'} appliance ${applianceId} of type ${appliance.type}`);

        return applianceId;
    }

    /**
     * Gets an appliance by ID from memory.
     * @param applianceId The ID of the appliance
     * @returns The appliance or null if not found
     */
    async getApplianceById(applianceId: string): Promise<EnyoAppliance | null> {
        return this.memoryStore.get(applianceId) || null;
    }

    /**
     * Gets all appliances from memory.
     * @returns Array of all appliances
     */
    async getAllAppliances(): Promise<EnyoAppliance[]> {
        return Array.from(this.memoryStore.values());
    }

    /**
     * Gets network devices associated with an appliance.
     * @param appliance The appliance
     * @returns Array of network devices
     */
    protected async getNetworkDevicesForApplianceDemo(appliance: EnyoAppliance): Promise<EnyoNetworkDevice[]> {
        return this.networkDevicesStore.get(appliance.id) || [];
    }

    /**
     * Finds appliances by their identifier using the configured strategy.
     * @param identifier The identifier to search for
     * @returns Array of matching appliances
     */
    async findByIdentifier(identifier: string): Promise<EnyoAppliance[]> {
        const matches: EnyoAppliance[] = [];
        const strategy = this.getIdentifierStrategy();

        for (const appliance of this.memoryStore.values()) {
            const networkDevices = await this.getNetworkDevicesForApplianceDemo(appliance);
            const extractedId = strategy.extract(appliance);

            if (extractedId === identifier) {
                matches.push(appliance);
                this.updateCache(appliance);
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
        for (const strategy of strategies) {
            for (const appliance of this.memoryStore.values()) {
                const networkDevices = await this.getNetworkDevicesForApplianceDemo(appliance);
                const identifier = strategy.extract(appliance);

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
        return Array.from(this.memoryStore.values()).filter(a => a.type === type);
    }

    /**
     * Updates the state of an appliance in memory.
     * @param applianceId The ID of the appliance to update
     * @param connectionType The new connection type
     * @param state The new state
     */
    async updateApplianceState(
        applianceId: string,
        connectionType: EnyoApplianceConnectionType,
        state: EnyoApplianceStateEnum
    ): Promise<void> {
        const appliance = this.memoryStore.get(applianceId);
        if (appliance) {
            appliance.metadata = {
                ...appliance.metadata,
                connectionType,
                state
            };
            this.memoryStore.set(applianceId, appliance);
            this.updateCache(appliance);
            console.log(`[DEMO] Updated appliance ${applianceId} state to ${state}`);
        } else {
            throw new Error(`Appliance ${applianceId} not found`);
        }
    }

    /**
     * Updates metadata for an appliance in memory.
     * @param applianceId The ID of the appliance
     * @param metadata The metadata to update
     */
    async updateApplianceMetadata(
        applianceId: string,
        metadata: Partial<EnyoApplianceMetadata> & { connectionType: EnyoApplianceConnectionType }
    ): Promise<void> {
        const appliance = this.memoryStore.get(applianceId);
        if (appliance) {
            appliance.metadata = {
                ...appliance.metadata,
                ...metadata
            };
            this.memoryStore.set(applianceId, appliance);
            this.updateCache(appliance);
            console.log(`[DEMO] Updated metadata for appliance ${applianceId}`);
        } else {
            throw new Error(`Appliance ${applianceId} not found`);
        }
    }

    /**
     * Removes an appliance from memory.
     * @param applianceId The ID of the appliance to remove
     */
    async removeAppliance(applianceId: string): Promise<void> {
        if (this.memoryStore.has(applianceId)) {
            this.memoryStore.delete(applianceId);
            this.networkDevicesStore.delete(applianceId);

            // Clean up cache (from parent class)
            this.clearCache();

            console.log(`[DEMO] Removed appliance ${applianceId}`);
        } else {
            throw new Error(`Appliance ${applianceId} not found`);
        }
    }

    /**
     * Performs a bulk update on multiple appliances in memory.
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
                const appliance = this.memoryStore.get(update.applianceId);
                if (appliance) {
                    const updatedAppliance: EnyoAppliance = {
                        ...appliance,
                        ...update.data,
                        id: appliance.id // Ensure ID is preserved
                    };

                    this.memoryStore.set(update.applianceId, updatedAppliance);
                    this.updateCache(updatedAppliance);
                    succeeded.push(update.applianceId);
                } else {
                    failed.push(update.applianceId);
                }
            } catch (error) {
                console.error(`[DEMO] Bulk update failed for ${update.applianceId}: ${error}`);
                failed.push(update.applianceId);
            }
        }

        console.log(`[DEMO] Bulk update completed: ${succeeded.length} succeeded, ${failed.length} failed`);
        return {succeeded, failed};
    }

    /**
     * Gets statistics about the managed appliances in memory.
     * @returns Statistics object
     */
    async getStatistics(): Promise<{
        total: number;
        byType: Record<string, number>;
        byState: Record<string, number>;
        cached: number;
    }> {
        const appliances = Array.from(this.memoryStore.values());
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
            cached: this.memoryStore.size
        };
    }

    /**
     * Refreshes the cache with all appliances from memory.
     */
    async refreshCache(): Promise<void> {
        this.clearCache();
        for (const appliance of this.memoryStore.values()) {
            const networkDevices = await this.getNetworkDevicesForApplianceDemo(appliance);
            this.updateCache(appliance);
        }
    }

    /**
     * Clears all data from memory (for testing purposes).
     */
    clearAllData(): void {
        this.memoryStore.clear();
        this.networkDevicesStore.clear();
        this.clearCache();
        this.nextId = 1;
        console.log('[DEMO] All data cleared from memory');
    }

    /**
     * Gets the current size of the memory store.
     * @returns The number of appliances in memory
     */
    getMemoryStoreSize(): number {
        return this.memoryStore.size;
    }
}