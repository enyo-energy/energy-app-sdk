import {EnergyApp, SerialNumberStrategy} from "../../index.js";
import type {EnyoNetworkDevice} from "../../types/enyo-network-device.js";
import {
    EnyoAppliance, EnyoApplianceAvailableFeaturesEnum,
    EnyoApplianceConnectionType,
    EnyoApplianceMetadata,
    EnyoApplianceName,
    EnyoApplianceStateEnum,
    EnyoApplianceTopology,
    EnyoApplianceTypeEnum
} from "../../types/enyo-appliance.js";
import type {EnyoApplianceCreatedFilter} from "../../packages/energy-app-appliance.js";
import type {EnyoChargerApplianceMetadata} from "../../types/enyo-charger-appliance.js";
import type {EnyoHeatpumpApplianceMetadata} from "../../types/enyo-heatpump-appliance.js";
import type {EnyoBatteryApplianceMetadata} from "../../types/enyo-battery-appliance.js";
import type {EnyoInverterApplianceMetadata} from "../../types/enyo-inverter-appliance.js";
import type {EnyoMeterAppliance} from "../../types/enyo-meter-appliance.js";
import type {EnyoTemperatureSensorApplianceMetadata} from "../../types/enyo-temperature-sensor-appliance.js";
import type {EnyoAirConditioningApplianceMetadata} from "../../types/enyo-air-conditioning-appliance.js";
import type {EnyoHeatingRodApplianceMetadata} from "../../types/enyo-heating-rod-appliance.js";
import {IdentifierStrategy} from "./identifier-strategies.js";

/**
 * Thrown when {@link ApplianceManager.createOrUpdateAppliance} is called with
 * an input that the configured {@link IdentifierStrategy} cannot extract an
 * identifier from. Without an identifier the manager cannot tell "this is the
 * same appliance" from "this is a new appliance", and silently creating a
 * duplicate would be worse than failing loudly here.
 */
export class MissingIdentifierError extends Error {
    constructor(strategyName: string) {
        super(
            `ApplianceManager: configured identifier strategy "${strategyName}" returned undefined ` +
            `for the supplied appliance — cannot decide create-vs-update. Provide a value the ` +
            `strategy can extract (e.g. metadata.serialNumber for SerialNumberStrategy), or ` +
            `swap to a different strategy via setIdentifierStrategy().`,
        );
        this.name = 'MissingIdentifierError';
    }
}

/**
 * Thrown when {@link ApplianceManager.createOrUpdateAppliance} discovers more
 * than one existing appliance matching the extracted identifier. This indicates
 * either a corrupted dataset or an identifier strategy too loose to be unique;
 * the manager refuses to guess which one to update and surfaces it to the caller.
 */
export class DuplicateIdentifierError extends Error {
    readonly applianceIds: readonly string[];

    constructor(identifier: string, applianceIds: readonly string[]) {
        super(
            `ApplianceManager: identifier "${identifier}" maps to ${applianceIds.length} appliances ` +
            `(${applianceIds.join(', ')}) — refusing to update a single match arbitrarily. ` +
            `Resolve the duplicates (removeAppliance) or use a more specific identifier strategy.`,
        );
        this.name = 'DuplicateIdentifierError';
        this.applianceIds = applianceIds;
    }
}

/**
 * Thrown when any operation is attempted on a manager that has been
 * {@link ApplianceManager.dispose}d. Catching this turns post-dispose
 * usage into a loud failure rather than a silent no-op against an empty cache.
 */
export class ApplianceManagerDisposedError extends Error {
    constructor() {
        super('ApplianceManager has been disposed and can no longer be used.');
        this.name = 'ApplianceManagerDisposedError';
    }
}

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
    meter?: EnyoMeterAppliance;
    inverter?: EnyoInverterApplianceMetadata;
    charger?: EnyoChargerApplianceMetadata;
    heatpump?: EnyoHeatpumpApplianceMetadata;
    battery?: EnyoBatteryApplianceMetadata;
    temperatureSensor?: EnyoTemperatureSensorApplianceMetadata;
    airConditioning?: EnyoAirConditioningApplianceMetadata;
    heatingRod?: EnyoHeatingRodApplianceMetadata;
    availableFeatures?: EnyoApplianceAvailableFeaturesEnum[];
    /**
     * Optional identifier of the cloud-deployed energy app package that manages
     * this appliance. Forwarded to {@link EnyoAppliance.cloudPackageId} when the
     * appliance is created or updated.
     */
    cloudPackageId?: string;
}

/**
 * Configuration options for the ApplianceManager.
 */
export interface ApplianceManagerConfig {
    /** Strategy for identifying appliances. Defaults to {@link SerialNumberStrategy}. */
    identifierStrategy?: IdentifierStrategy;
    /** Whether to auto-update appliance metadata on changes. Defaults to true. */
    autoUpdateMetadata?: boolean;
    /** Whether to log operations. Defaults to true. */
    enableLogging?: boolean;
    /** Default connection type for new appliances. Defaults to `Connector`. */
    defaultConnectionType?: EnyoApplianceConnectionType;
    /** Default vendor name when not specified. */
    defaultVendorName?: string;
}

/**
 * Result of {@link ApplianceManager.findFirstByStrategies}.
 */
export interface FindResult {
    /** The found appliance. */
    appliance: EnyoAppliance;
    /** The identifier that matched. */
    identifier: string;
    /** The {@link IdentifierStrategy.name} that produced the match. */
    strategy: string;
}

/** Sub-objects on EnyoAppliance that {@link ApplianceManager} shallow-merges during updates. */
const MERGEABLE_METADATA_KEYS = [
    'metadata',
    'inverter',
    'charger',
    'battery',
    'heatpump',
    'meter',
    'temperatureSensor',
    'airConditioning',
    'heatingRod',
] as const;

/**
 * Manages appliances in the energy system with configurable identification strategies.
 * Provides comprehensive CRUD operations and state management for energy appliances.
 *
 * Lifecycle: prefer {@link ApplianceManager.initialize} over direct construction —
 * the static factory primes the cache from the SDK and subscribes to appliance
 * update / removal events so the cache stays in sync without manual refreshes.
 * Always call {@link dispose} on shutdown to release the listeners.
 */
export class ApplianceManager {
    private applianceCache: Map<string, EnyoAppliance> = new Map();
    /** identifier (from current strategy) → set of applianceIds whose extracted identifier matches. */
    private identifierToApplianceId: Map<string, Set<string>> = new Map();
    /** networkDeviceId → set of applianceIds bound to that network device. */
    private networkDeviceToApplianceIds: Map<string, Set<string>> = new Map();
    private listenerIds: string[] = [];
    private disposed = false;
    protected config: Required<ApplianceManagerConfig>;

    /**
     * Performs a shallow merge of `update` onto `existing` with one wrinkle: every
     * key in {@link MERGEABLE_METADATA_KEYS} is itself shallow-merged so callers
     * can patch a single nested field without clearing the rest.
     *
     * Example:
     * ```ts
     * existing = { metadata: { connectionType: 'connector', vendorName: 'X' } }
     * update   = { metadata: { state: 'offline' } }
     * result   = { metadata: { connectionType: 'connector', vendorName: 'X', state: 'offline' } }
     * ```
     * Without the per-key merge, the result would be `{ metadata: { state: 'offline' } }`
     * — losing `connectionType` and `vendorName`.
     *
     * Note: the merge is one level deep. Nested objects inside a metadata sub-object
     * are replaced, not merged.
     *
     * Update contract: an omitted optional field leaves the stored value unchanged.
     * For the {@link MERGEABLE_METADATA_KEYS} this is enforced by the per-key merge
     * below; for the other optional top-level fields (`availableFeatures`,
     * `cloudPackageId`) the caller-facing {@link createOrUpdateAppliance} drops the
     * key when the value is `undefined` so this spread cannot overwrite it. To clear
     * or replace such a field, pass an explicit value (e.g. an empty array `[]`).
     *
     * @param existing The existing appliance data
     * @param update The partial update data to merge
     * @returns The merged appliance data (without `id`)
     */
    protected mergeApplianceData(
        existing: EnyoAppliance,
        update: Partial<Omit<PartialEnyoAppliance, 'id'>>,
    ): Omit<EnyoAppliance, 'id'> {
        const merged: Record<string, unknown> = {...existing, ...update};
        for (const key of MERGEABLE_METADATA_KEYS) {
            const u = update[key];
            const e = existing[key];
            merged[key] = u ? {...e, ...u} : e;
        }
        return merged as Omit<EnyoAppliance, 'id'>;
    }

    /**
     * Creates a new ApplianceManager instance.
     *
     * Prefer {@link initialize} unless you need control over when the cache
     * is primed or when event subscriptions begin.
     *
     * @param energyApp The {@link EnergyApp} instance to use for API calls
     * @param config Configuration options for the manager
     */
    constructor(
        private energyApp: EnergyApp,
        config?: ApplianceManagerConfig,
    ) {
        this.config = {
            identifierStrategy: config?.identifierStrategy ?? new SerialNumberStrategy(),
            autoUpdateMetadata: config?.autoUpdateMetadata ?? true,
            enableLogging: config?.enableLogging ?? true,
            defaultConnectionType: config?.defaultConnectionType ?? EnyoApplianceConnectionType.Connector,
            defaultVendorName: config?.defaultVendorName ?? '',
        };
    }

    /**
     * Creates a fully-wired ApplianceManager: primes the cache from the SDK
     * and subscribes to appliance update / removal events so the cache stays
     * in sync over the lifetime of the package.
     *
     * @param energyApp The {@link EnergyApp} instance to use for API calls
     * @param config Configuration options for the manager
     * @returns Promise that resolves to an initialized ApplianceManager instance
     */
    static async initialize(
        energyApp: EnergyApp,
        config?: ApplianceManagerConfig,
    ): Promise<ApplianceManager> {
        const manager = new ApplianceManager(energyApp, config);
        await manager.refreshCache();
        manager.subscribeToEvents();
        return manager;
    }

    /**
     * Creates a new appliance, or updates an existing one if the configured
     * {@link IdentifierStrategy} resolves to an appliance already known to the
     * SDK.
     *
     * Decision logic:
     * 1. Extract an identifier from the input via the configured strategy.
     *    Throws {@link MissingIdentifierError} if the strategy returns
     *    `undefined` — silent fall-through would create a phantom duplicate.
     * 2. Look up existing appliances with that identifier from the in-memory
     *    cache (which the manager keeps in sync via SDK listeners). If exactly
     *    one matches, update it; if zero, create a new one; if more than one,
     *    throw {@link DuplicateIdentifierError} so the caller can resolve the
     *    ambiguity instead of guessing.
     *
     * @param appliance The appliance configuration
     * @returns The ID of the created or updated appliance
     * @throws {MissingIdentifierError} when the strategy returns no identifier
     * @throws {DuplicateIdentifierError} when more than one existing appliance matches
     * @throws {ApplianceManagerDisposedError} when called after {@link dispose}
     */
    async createOrUpdateAppliance(appliance: ApplianceConfig): Promise<string> {
        this.throwIfDisposed();

        const identifier = this.config.identifierStrategy.extract(appliance);
        if (!identifier) {
            throw new MissingIdentifierError(this.config.identifierStrategy.name);
        }

        const existing = await this.findByIdentifier(identifier);
        if (existing.length > 1) {
            throw new DuplicateIdentifierError(identifier, existing.map(a => a.id));
        }
        const existingApplianceId = existing[0]?.id;
        if (existingApplianceId && this.config.enableLogging) {
            console.debug(`Found existing appliance with ID ${existingApplianceId} for identifier ${identifier}`);
        }

        const networkDeviceIds = appliance.networkDevices?.map(d => d.id) ?? [];

        const metadata: EnyoApplianceMetadata = {
            connectionType: this.config.defaultConnectionType,
            state: EnyoApplianceStateEnum.Connected,
            ...appliance.metadata,
        };
        if (this.config.defaultVendorName && !metadata.vendorName) {
            metadata.vendorName = this.config.defaultVendorName;
        }

        const newApplianceData: Omit<EnyoAppliance, 'id'> = {
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
            temperatureSensor: appliance.temperatureSensor,
            airConditioning: appliance.airConditioning,
            heatingRod: appliance.heatingRod,
            // Conditionally spread the two optional top-level fields that are NOT
            // covered by MERGEABLE_METADATA_KEYS. If they were always materialized
            // as explicit keys, an omitted (undefined) value would clobber the
            // stored value during mergeApplianceData's `{...existing, ...update}`
            // spread on an update. `!== undefined` keeps an explicit `[]` (clear)
            // while dropping omitted fields so the existing value is preserved.
            ...(appliance.cloudPackageId !== undefined && {cloudPackageId: appliance.cloudPackageId}),
            ...(appliance.availableFeatures !== undefined && {availableFeatures: appliance.availableFeatures}),
        };

        let applianceData = newApplianceData;
        if (existingApplianceId) {
            const existingAppliance = await this.energyApp.useAppliances().getById(existingApplianceId);
            if (existingAppliance) {
                applianceData = this.mergeApplianceData(existingAppliance, newApplianceData);
            }
        }

        const applianceId = await this.energyApp.useAppliances().save(
            applianceData,
            existingApplianceId,
        );

        // Prime the cache synchronously from the SDK so a subsequent read
        // returns the new appliance without racing the appliance-updated
        // listener (which may fire on a later microtask).
        await this.primeCacheFromSdk(applianceId);

        return applianceId;
    }

    /**
     * Updates the internal cache with an appliance, rebuilding the
     * identifier-index and network-device-index entries for that appliance.
     *
     * @param appliance The appliance to cache
     */
    protected updateCache(appliance: EnyoAppliance): void {
        if (this.disposed) return;
        // Rebuild index entries for this id rather than appending — a single
        // appliance can change its identifier or networkDeviceIds across updates,
        // and stale entries would silently widen lookups.
        this.removeFromCache(appliance.id);
        this.applianceCache.set(appliance.id, appliance);

        const identifier = this.config.identifierStrategy.extract(appliance);
        if (identifier) {
            this.addToIndex(this.identifierToApplianceId, identifier, appliance.id);
        }
        for (const networkDeviceId of appliance.networkDeviceIds ?? []) {
            this.addToIndex(this.networkDeviceToApplianceIds, networkDeviceId, appliance.id);
        }
    }

    private addToIndex(index: Map<string, Set<string>>, key: string, applianceId: string): void {
        let ids = index.get(key);
        if (!ids) {
            ids = new Set();
            index.set(key, ids);
        }
        ids.add(applianceId);
    }

    /**
     * Removes an appliance from the internal cache by its ID, and prunes the
     * identifier-index and network-device-index of any entries pointing at it.
     */
    private removeFromCache(applianceId: string): void {
        const appliance = this.applianceCache.get(applianceId);
        if (!appliance) return;
        this.applianceCache.delete(applianceId);
        this.pruneFromIndex(this.identifierToApplianceId, applianceId);
        this.pruneFromIndex(this.networkDeviceToApplianceIds, applianceId);
    }

    private pruneFromIndex(index: Map<string, Set<string>>, applianceId: string): void {
        for (const [key, ids] of index.entries()) {
            if (!ids.delete(applianceId)) continue;
            if (ids.size === 0) index.delete(key);
        }
    }

    /**
     * Subscribes to appliance update and removal events to keep the cache in sync.
     */
    private subscribeToEvents(): void {
        const applianceService = this.energyApp.useAppliances();

        const updatedListenerId = applianceService.listenForApplianceUpdated(
            (appliance: EnyoAppliance) => {
                if (this.disposed) return;
                if (this.config.enableLogging) {
                    console.debug(`Appliance updated event for ${appliance.id}`);
                }
                this.updateCache(appliance);
            },
        );
        this.listenerIds.push(updatedListenerId);

        const removedListenerId = applianceService.listenForApplianceRemoved(
            (applianceId: string) => {
                if (this.disposed) return;
                if (this.config.enableLogging) {
                    console.debug(`Appliance removed event for ${applianceId}`);
                }
                this.removeFromCache(applianceId);
            },
        );
        this.listenerIds.push(removedListenerId);
    }

    /**
     * Subscribes to newly-created appliances. Fires only when an appliance is
     * first created, not on subsequent updates. The optional
     * {@link EnyoApplianceCreatedFilter filter} controls scope (own package,
     * all appliances, or only externally-created) and category — `scope: 'all'`
     * and `scope: 'external'` require the `AllAppliances` permission.
     *
     * @param listener - Invoked with each newly-created appliance
     * @param filter - Optional scope/category filter; defaults to `{ scope: 'own' }`
     * @returns An unsubscribe function. Any still-active subscription is also
     *          cleaned up automatically on {@link dispose}.
     * @throws {ApplianceManagerDisposedError} when called after {@link dispose}
     */
    onApplianceCreated(
        listener: (appliance: EnyoAppliance) => void | Promise<void>,
        filter?: EnyoApplianceCreatedFilter,
    ): () => void {
        this.throwIfDisposed();
        const applianceService = this.energyApp.useAppliances();
        const listenerId = applianceService.listenForApplianceCreated(
            (appliance: EnyoAppliance) => {
                if (this.disposed) return;
                return listener(appliance);
            },
            filter,
        );
        this.listenerIds.push(listenerId);
        return () => {
            applianceService.removeListener(listenerId);
            this.listenerIds = this.listenerIds.filter(id => id !== listenerId);
        };
    }

    /**
     * Clears the internal cache without touching the SDK.
     */
    clearCache(): void {
        this.applianceCache.clear();
        this.identifierToApplianceId.clear();
        this.networkDeviceToApplianceIds.clear();
    }

    /**
     * Refreshes the cache with all appliances from the SDK. Rarely needed in
     * practice — the manager subscribes to update / removal events on
     * {@link initialize}, so the cache stays in sync automatically. Call this
     * explicitly only after a known cache-divergence event.
     *
     * @throws {ApplianceManagerDisposedError} when called after {@link dispose}
     */
    async refreshCache(): Promise<void> {
        this.throwIfDisposed();
        const appliances = await this.energyApp.useAppliances().list();
        this.clearCache();
        for (const appliance of appliances) {
            this.updateCache(appliance);
        }
    }

    /**
     * Finds appliances by their identifier using the configured strategy. Cache-first:
     * if the manager has an indexed mapping for the identifier, the matching
     * cached appliances are returned without an SDK call. Otherwise the SDK is
     * queried once and any matches are folded into the cache.
     *
     * @param identifier The identifier to search for
     * @returns Array of matching appliances (empty if none match)
     * @throws {ApplianceManagerDisposedError} when called after {@link dispose}
     */
    async findByIdentifier(identifier: string): Promise<EnyoAppliance[]> {
        this.throwIfDisposed();
        const cachedIds = this.identifierToApplianceId.get(identifier);
        if (cachedIds && cachedIds.size > 0) {
            const appliances: EnyoAppliance[] = [];
            for (const id of cachedIds) {
                const appliance = this.applianceCache.get(id);
                if (appliance) appliances.push(appliance);
            }
            if (appliances.length > 0) return appliances;
        }

        // Cache miss — pay one SDK list call and fold matches in.
        const allAppliances = await this.energyApp.useAppliances().list();
        const matches: EnyoAppliance[] = [];
        for (const appliance of allAppliances) {
            const extractedId = this.config.identifierStrategy.extract(appliance);
            if (extractedId === identifier) {
                matches.push(appliance);
                this.updateCache(appliance);
            }
        }
        return matches;
    }

    /**
     * Gets an appliance by its SDK ID. SDK errors (network failure, permission
     * denied, etc.) are propagated to the caller; a genuine "not found"
     * response from the SDK returns `null`. Callers that care about the
     * distinction (e.g. retry logic) can `try`/`catch` on the rejection.
     *
     * @param applianceId The ID of the appliance to retrieve
     * @returns The appliance if it exists, `null` if the SDK reports no such appliance
     * @throws {ApplianceManagerDisposedError} when called after {@link dispose}
     * @throws Any error raised by the underlying SDK call
     */
    async findApplianceById(applianceId: string): Promise<EnyoAppliance | null> {
        this.throwIfDisposed();
        const appliance = await this.energyApp.useAppliances().getById(applianceId);
        if (appliance) {
            this.updateCache(appliance);
        }
        return appliance;
    }

    /**
     * Finds the first appliance matching `searchValue` under any of the given
     * strategies, in order. Unlike {@link findByIdentifier} this method does
     * NOT use the manager's identifier index — it always queries the SDK once
     * and walks the result with each provided strategy. Use this when probing
     * by identifiers that are not the configured `identifierStrategy`.
     *
     * @param searchValue The value to match
     * @param strategies Strategies to try in order; the first match wins
     * @returns The first match plus which strategy found it, or `undefined`
     * @throws {ApplianceManagerDisposedError} when called after {@link dispose}
     */
    async findFirstByStrategies(
        searchValue: string,
        strategies: IdentifierStrategy[],
    ): Promise<FindResult | undefined> {
        this.throwIfDisposed();
        const allAppliances = await this.energyApp.useAppliances().list();
        for (const strategy of strategies) {
            for (const appliance of allAppliances) {
                const identifier = strategy.extract(appliance);
                if (identifier === searchValue) {
                    return {appliance, identifier, strategy: strategy.name};
                }
            }
        }
        return undefined;
    }

    /**
     * Returns appliances bound to a given NetworkDevice. Reads from the
     * cached index and never hits the SDK, so this is safe to call inside
     * hot loops (e.g. on every access-status change).
     *
     * @param networkDeviceId The NetworkDevice ID to look up
     * @returns Array of cached appliances bound to that NetworkDevice
     * @throws {ApplianceManagerDisposedError} when called after {@link dispose}
     */
    findAppliancesByNetworkDeviceId(networkDeviceId: string): EnyoAppliance[] {
        this.throwIfDisposed();
        const ids = this.networkDeviceToApplianceIds.get(networkDeviceId);
        if (!ids || ids.size === 0) return [];
        const result: EnyoAppliance[] = [];
        for (const id of ids) {
            const appliance = this.applianceCache.get(id);
            if (appliance) result.push(appliance);
        }
        return result;
    }

    /**
     * Returns appliances of a given type owned by the calling package
     * (i.e. those returned by `useAppliances().list()`).
     *
     * @param type The appliance type to filter by
     * @returns Array of matching appliances
     * @throws {ApplianceManagerDisposedError} when called after {@link dispose}
     */
    async getAppliancesByType(type: EnyoApplianceTypeEnum): Promise<EnyoAppliance[]> {
        this.throwIfDisposed();
        const all = await this.energyApp.useAppliances().list();
        return all.filter(a => a.type === type);
    }

    /**
     * Returns appliances of a given type from the system-wide list
     * (i.e. those returned by `useAppliances().listAll()`), which requires
     * the `AllAppliances` permission. Use this only when your package needs
     * visibility into appliances it does not own.
     *
     * @param type The appliance type to filter by
     * @returns Array of matching appliances visible to the package
     * @throws {ApplianceManagerDisposedError} when called after {@link dispose}
     */
    async getAllAppliancesByType(type: EnyoApplianceTypeEnum): Promise<EnyoAppliance[]> {
        this.throwIfDisposed();
        const all = await this.energyApp.useAppliances().listAll();
        return all.filter(a => a.type === type);
    }

    /**
     * Updates the connection type and state of an appliance. The cache is
     * primed synchronously from the post-save SDK response so a subsequent
     * read (`findAppliancesByNetworkDeviceId`, `findByIdentifier`, etc.)
     * returns the new state without waiting for the SDK's update listener.
     *
     * @param applianceId The ID of the appliance to update
     * @param connectionType The new connection type
     * @param state The new state
     * @throws {ApplianceManagerDisposedError} when called after {@link dispose}
     */
    async updateApplianceState(
        applianceId: string,
        connectionType: EnyoApplianceConnectionType,
        state: EnyoApplianceStateEnum,
    ): Promise<void> {
        this.throwIfDisposed();
        const appliance = await this.energyApp.useAppliances().getById(applianceId);
        if (!appliance) return;
        const updated: Omit<EnyoAppliance, 'id'> = {
            ...appliance,
            metadata: {...appliance.metadata, connectionType, state},
        };
        await this.energyApp.useAppliances().save(updated, applianceId);
        await this.primeCacheFromSdk(applianceId);
    }

    /**
     * Patches an appliance with the provided attributes via {@link mergeApplianceData}.
     * The cache is primed synchronously from the post-save SDK response so a
     * subsequent read returns the patched state without waiting for the SDK's
     * update listener.
     *
     * @param applianceId The ID of the appliance to patch
     * @param attributes The attributes to merge onto the existing record
     * @throws {ApplianceManagerDisposedError} when called after {@link dispose}
     */
    async updateAppliance(
        applianceId: string,
        attributes: Partial<PartialEnyoAppliance>,
    ): Promise<void> {
        this.throwIfDisposed();
        const appliance = await this.energyApp.useAppliances().getById(applianceId);
        if (!appliance) return;
        const updated = this.mergeApplianceData(appliance, attributes);
        await this.energyApp.useAppliances().save(updated, applianceId);
        await this.primeCacheFromSdk(applianceId);
    }

    /**
     * Refetches an appliance from the SDK and reflects the result in the
     * cache. Used by mutating methods to keep cache reads consistent with
     * what the SDK has just persisted, without relying on the (eventual)
     * appliance-updated listener.
     */
    private async primeCacheFromSdk(applianceId: string): Promise<void> {
        const saved = await this.energyApp.useAppliances().getById(applianceId);
        if (saved) {
            this.updateCache(saved);
        }
    }

    /**
     * Removes an appliance by its ID. The cache is updated by the SDK's
     * appliance-removed listener.
     *
     * @param applianceId The ID of the appliance to remove
     * @throws {ApplianceManagerDisposedError} when called after {@link dispose}
     */
    async removeAppliance(applianceId: string): Promise<void> {
        this.throwIfDisposed();
        await this.energyApp.useAppliances().removeById(applianceId);
    }

    /**
     * Removes every appliance matching the given identifier. Per-appliance
     * failures are logged but do not abort the bulk operation.
     *
     * @param identifier The identifier to match
     * @returns The number of appliances successfully removed
     * @throws {ApplianceManagerDisposedError} when called after {@link dispose}
     */
    async removeAppliancesByIdentifier(identifier: string): Promise<number> {
        this.throwIfDisposed();
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
     * Sets all appliances matching the given identifier to the given state,
     * preserving each appliance's existing `connectionType`. Per-appliance
     * failures are logged but do not abort the bulk operation.
     *
     * @param identifier The identifier to match
     * @param state The new state to apply
     * @returns The number of appliances successfully updated
     * @throws {ApplianceManagerDisposedError} when called after {@link dispose}
     */
    async setAppliancesStateByIdentifier(
        identifier: string,
        state: EnyoApplianceStateEnum,
    ): Promise<number> {
        this.throwIfDisposed();
        const appliances = await this.findByIdentifier(identifier);
        let updatedCount = 0;
        for (const appliance of appliances) {
            try {
                const connectionType = appliance.metadata?.connectionType ?? this.config.defaultConnectionType;
                await this.updateApplianceState(appliance.id, connectionType, state);
                updatedCount++;
            } catch (error) {
                console.error(`Failed to set appliance ${appliance.id} to ${state}: ${error}`);
            }
        }
        return updatedCount;
    }

    /**
     * Performs a bulk update on multiple appliances. Each item is merged onto
     * its target via {@link mergeApplianceData}. Failures are recorded per
     * `applianceId` and returned to the caller.
     *
     * @param updates Array of appliance IDs and patches to apply
     * @returns The set of IDs that succeeded and the set that failed
     * @throws {ApplianceManagerDisposedError} when called after {@link dispose}
     */
    async bulkUpdate(updates: Array<{
        applianceId: string;
        data: Partial<Omit<EnyoAppliance, 'id'>>;
    }>): Promise<{ succeeded: string[]; failed: string[] }> {
        this.throwIfDisposed();
        const succeeded: string[] = [];
        const failed: string[] = [];

        for (const update of updates) {
            try {
                const appliance = await this.energyApp.useAppliances().getById(update.applianceId);
                if (!appliance) {
                    failed.push(update.applianceId);
                    continue;
                }
                const updatedAppliance = this.mergeApplianceData(appliance, update.data);
                await this.energyApp.useAppliances().save(updatedAppliance, update.applianceId);
                await this.primeCacheFromSdk(update.applianceId);
                succeeded.push(update.applianceId);
            } catch (error) {
                console.error(`Bulk update failed for ${update.applianceId}: ${error}`);
                failed.push(update.applianceId);
            }
        }

        return {succeeded, failed};
    }

    /**
     * Swaps the configured {@link IdentifierStrategy}.
     *
     * `rebuildCache` is **required** so callers explicitly choose how the
     * cache should be reconciled — silently picking a default once caused
     * stale-cache regressions (see commit history). Pass:
     *  - `false` to keep the existing cached appliances and only recompute
     *    the in-memory identifier index against the new strategy. Fast and
     *    correct as long as no SDK updates have been missed.
     *  - `true` to re-run {@link refreshCache} against the SDK before
     *    returning. Use after a known cache-divergence event or when an
     *    immediate, source-of-truth view is required.
     *
     * @param strategy The new strategy to use
     * @param rebuildCache Whether to rebuild the cache from the SDK
     * @throws {ApplianceManagerDisposedError} when called after {@link dispose}
     */
    async setIdentifierStrategy(
        strategy: IdentifierStrategy,
        rebuildCache: boolean,
    ): Promise<void> {
        this.throwIfDisposed();
        this.config.identifierStrategy = strategy;
        if (rebuildCache) {
            await this.refreshCache();
            return;
        }
        // Re-build only the identifier index in place — the appliance cache itself
        // is still valid, only the per-strategy mappings need to be recomputed.
        this.identifierToApplianceId.clear();
        for (const appliance of this.applianceCache.values()) {
            const identifier = strategy.extract(appliance);
            if (identifier) {
                this.addToIndex(this.identifierToApplianceId, identifier, appliance.id);
            }
        }
    }

    /**
     * Gets the current identifier strategy.
     */
    getIdentifierStrategy(): IdentifierStrategy {
        return this.config.identifierStrategy;
    }

    /**
     * Disposes the manager: releases SDK listeners and clears the cache. All
     * subsequent public method calls throw {@link ApplianceManagerDisposedError}.
     * Calling `dispose` more than once is a no-op.
     */
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;

        const applianceService = this.energyApp.useAppliances();
        for (const listenerId of this.listenerIds) {
            applianceService.removeListener(listenerId);
        }
        this.listenerIds = [];
        this.clearCache();

    }

    /**
     * Throws {@link ApplianceManagerDisposedError} if {@link dispose} has been
     * called. Public methods on this class call it as their first action so
     * post-dispose usage fails loudly instead of silently reading an empty cache.
     * `protected` so subclasses (e.g. {@link InMemoryApplianceManager}) that
     * override public methods can preserve the same contract.
     */
    protected throwIfDisposed(): void {
        if (this.disposed) {
            throw new ApplianceManagerDisposedError();
        }
    }
}

export interface PartialEnyoAppliance {
    /** Unique identifier for the appliance */
    id: string;
    /** Name of the appliance in different supported languages */
    name: EnyoApplianceName[];
    /** Type/category of the appliance */
    type: EnyoApplianceTypeEnum;
    /** network device IDs associated with the appliance */
    networkDeviceIds: string[];
    /** Optional Metadata of the Appliance */
    metadata?: Partial<EnyoApplianceMetadata>;
    /** Topology Information of the appliance */
    topology?: EnyoApplianceTopology;
    /** Optional Metadata of the Appliance if of type Meter */
    meter?: Partial<EnyoMeterAppliance>;
    /** Optional Metadata of the Appliance if of type Inverter */
    inverter?: Partial<EnyoInverterApplianceMetadata>;
    /** Optional Metadata of the Appliance if of type Charger */
    charger?: Partial<EnyoChargerApplianceMetadata>;
    /** Optional Metadata of the Appliance if of type Heatpump */
    heatpump?: Partial<EnyoHeatpumpApplianceMetadata>;
    /** Optional Metadata of the Appliance if of type Battery */
    battery?: Partial<EnyoBatteryApplianceMetadata>;
    /** Optional Metadata of the Appliance if of type TemperatureSensor */
    temperatureSensor?: Partial<EnyoTemperatureSensorApplianceMetadata>;
    /** Optional Metadata of the Appliance if of type AirConditioning */
    airConditioning?: Partial<EnyoAirConditioningApplianceMetadata>;
    /** Optional Metadata of the Appliance if of type HeatingRod */
    heatingRod?: Partial<EnyoHeatingRodApplianceMetadata>;
    /** Optional custom name for the appliance, defined by the user */
    customName?: string;
    /**
     * Optional identifier of the cloud-deployed energy app package that manages
     * this appliance. Mirrors {@link EnyoAppliance.cloudPackageId}.
     */
    cloudPackageId?: string;
}
