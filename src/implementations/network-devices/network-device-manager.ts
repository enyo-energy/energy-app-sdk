import type {EnergyApp} from "../../energy-app.js";
import type {EnyoNetworkDevice, EnyoNetworkDeviceAccessStatus} from "../../types/enyo-network-device.js";
import type {EnyoAppliance} from "../../types/enyo-appliance.js";
import {EnyoApplianceConnectionType, EnyoApplianceStateEnum} from "../../types/enyo-appliance.js";
import type {ApplianceManager} from "../appliances/appliance-manager.js";
import {NetworkAccessGuard} from "./network-access-guard.js";

/**
 * Context passed to per-appliance handlers fired by
 * {@link NetworkDeviceManager}. Tells the consumer exactly which
 * appliance was affected and via which underlying NetworkDevice.
 */
export interface ApplianceNetworkEvent {
    /** The appliance affected by the network-device-level event. */
    appliance: EnyoAppliance;
    /** Convenience alias for `appliance.id`. */
    applianceId: string;
    /** The NetworkDevice ID that triggered the event. */
    networkDeviceId: string;
}

/** Handler invoked once access to a NetworkDevice's required ports is granted (or re-granted). */
export type ApplianceAccessRestoredHandler = (event: ApplianceNetworkEvent) => void | Promise<void>;

/** Handler invoked the moment an access-denied error has been observed for a NetworkDevice. */
export type ApplianceAccessDeniedHandler = (event: ApplianceNetworkEvent) => void | Promise<void>;

/** Handler invoked when the SDK reports a transition to a non-granted access status. */
export type ApplianceAccessRevokedHandler = (event: ApplianceNetworkEvent & {
    /** The status the device transitioned to (typically `'denied'` or `'pending'`). */
    status: EnyoNetworkDeviceAccessStatus;
}) => void | Promise<void>;

/** Handler invoked when a NetworkDevice the package owns appliances against is removed. */
export type ApplianceNetworkDeviceRemovedHandler = (event: ApplianceNetworkEvent) => void | Promise<void>;

/** Handler invoked when the SDK detects new NetworkDevices matching the package's filter. */
export type NetworkDeviceDetectedHandler = (devices: EnyoNetworkDevice[]) => void | Promise<void>;

/** Raw handler invoked on every SDK access-status change, even for NetworkDevices the package has no appliances on. */
export type NetworkDeviceAccessChangedHandler = (
    networkDeviceId: string,
    status: EnyoNetworkDeviceAccessStatus,
) => void | Promise<void>;

/**
 * Construction options for {@link NetworkDeviceManager}.
 */
export interface NetworkDeviceManagerConfig {
    /**
     * TCP ports the package requires on every target NetworkDevice.
     * Forwarded to the underlying {@link NetworkAccessGuard}.
     */
    ports: number[];
    /**
     * Fired once access has been granted to a NetworkDevice for an
     * appliance the package owns. Use this to (re-)establish Modbus
     * connections or restart polling loops.
     */
    onApplianceAccessRestored?: ApplianceAccessRestoredHandler;
    /**
     * Fired the moment an access-denied error has been observed at
     * runtime (via {@link NetworkDeviceManager.withAccessGuard} or an
     * explicit call to the underlying guard's `recoverAccess`). This
     * is distinct from {@link onApplianceAccessRevoked} — that fires
     * when the SDK explicitly reports a status transition, while this
     * fires when an in-flight read failed with the SDK's
     * access-denied error.
     */
    onApplianceAccessDenied?: ApplianceAccessDeniedHandler;
    /**
     * Fired when the SDK transitions a NetworkDevice to a
     * non-granted access status (`'denied'` or `'pending'`),
     * typically because the user revoked access in the UI. Use this
     * to tear down connections and mark affected appliances offline.
     */
    onApplianceAccessRevoked?: ApplianceAccessRevokedHandler;
    /**
     * Fired when a NetworkDevice the package depends on has been
     * removed from the system. Use this to tear down connections and
     * mark affected appliances offline.
     */
    onApplianceNetworkDeviceRemoved?: ApplianceNetworkDeviceRemovedHandler;
    /**
     * Fired when the SDK reports newly detected NetworkDevices. The
     * SDK filters according to the package definition, so consumers
     * generally just need to react to whatever arrives.
     */
    onNetworkDeviceDetected?: NetworkDeviceDetectedHandler;
    /**
     * Raw pass-through for every SDK access-status change, regardless
     * of whether the package owns appliances on the affected device.
     * Useful for first-time onboarding flows where a 'granted'
     * transition needs to drive a discovery / connect pass before any
     * appliance exists.
     */
    onNetworkDeviceAccessChanged?: NetworkDeviceAccessChangedHandler;
    /**
     * When `true`, the manager automatically transitions affected
     * appliances to {@link EnyoApplianceStateEnum.Offline} on access
     * denial / device removal, and back to
     * {@link EnyoApplianceStateEnum.Connected} on access restoration.
     * Defaults to `false` so that consumers keep full control over
     * state transitions.
     */
    autoToggleApplianceState?: boolean;
    /** Toggle internal logging. Defaults to `true`. */
    enableLogging?: boolean;
}

/**
 * High-level orchestrator that ties together:
 * - a {@link NetworkAccessGuard} (access-denied recovery),
 * - all relevant `useNetworkDevices()` listeners (access changes,
 *   removals, detections), and
 * - an {@link ApplianceManager} so consumers can react to events at
 *   the appliance level instead of the NetworkDevice level.
 *
 * This is the recommended entry point for any package that owns
 * appliances backed by NetworkDevices (Modbus over TCP, EEBUS over
 * SHIP, etc.). Construct one per package, supply your reconnect /
 * disconnect callbacks, and wrap Modbus calls in
 * {@link withAccessGuard} — the manager handles the rest.
 *
 * Typical wiring:
 * ```ts
 * const networkManager = await NetworkDeviceManager.initialize(
 *   energyApp,
 *   applianceManager,
 *   {
 *     ports: [502],
 *     autoToggleApplianceState: true,
 *     onApplianceAccessRestored: async ({ appliance, networkDeviceId }) => {
 *       await myModbusPool.reconnect(networkDeviceId);
 *     },
 *   },
 * );
 *
 * // Inside a polling loop:
 * await networkManager.withAccessGuard(networkDeviceId, () =>
 *   modbusClient.readHoldingRegisters(...));
 * ```
 *
 * The manager is event-driven: it caches the current NetworkDevice
 * list on construction and keeps the cache in sync via the SDK's
 * detected / removed / access-change listeners.
 */
export class NetworkDeviceManager {
    private readonly guard: NetworkAccessGuard;
    private readonly listenerIds: string[] = [];
    /** Local snapshot of NetworkDevices indexed by id, refreshed on every relevant event. */
    private readonly deviceCache = new Map<string, EnyoNetworkDevice>();
    private readonly restoredHandlers = new Set<ApplianceAccessRestoredHandler>();
    private readonly deniedHandlers = new Set<ApplianceAccessDeniedHandler>();
    private readonly revokedHandlers = new Set<ApplianceAccessRevokedHandler>();
    private readonly removedHandlers = new Set<ApplianceNetworkDeviceRemovedHandler>();
    private readonly detectedHandlers = new Set<NetworkDeviceDetectedHandler>();
    private readonly accessChangedHandlers = new Set<NetworkDeviceAccessChangedHandler>();
    private readonly autoToggleApplianceState: boolean;
    private readonly enableLogging: boolean;
    private disposed = false;

    /**
     * Constructs the manager and wires up all SDK listeners. The
     * NetworkDevice cache is populated lazily — call
     * {@link initialize} if you need it primed before use.
     * @param energyApp The {@link EnergyApp} instance to read events from
     * @param applianceManager The {@link ApplianceManager} the package uses for its appliances
     * @param config Required ports plus optional handlers and behaviour flags
     */
    constructor(
        private readonly energyApp: EnergyApp,
        private readonly applianceManager: ApplianceManager,
        config: NetworkDeviceManagerConfig,
    ) {
        this.autoToggleApplianceState = config.autoToggleApplianceState ?? false;
        this.enableLogging = config.enableLogging ?? true;
        if (config.onApplianceAccessRestored) {
            this.restoredHandlers.add(config.onApplianceAccessRestored);
        }
        if (config.onApplianceAccessDenied) {
            this.deniedHandlers.add(config.onApplianceAccessDenied);
        }
        if (config.onApplianceAccessRevoked) {
            this.revokedHandlers.add(config.onApplianceAccessRevoked);
        }
        if (config.onApplianceNetworkDeviceRemoved) {
            this.removedHandlers.add(config.onApplianceNetworkDeviceRemoved);
        }
        if (config.onNetworkDeviceDetected) {
            this.detectedHandlers.add(config.onNetworkDeviceDetected);
        }
        if (config.onNetworkDeviceAccessChanged) {
            this.accessChangedHandlers.add(config.onNetworkDeviceAccessChanged);
        }

        // Register the manager's access-change listener BEFORE constructing
        // the guard, so that on a SDK 'granted' event for a device the guard
        // is currently recovering, the manager's listener observes the
        // device while it is still in the guard's `pending` set. That lets
        // it skip the per-appliance dispatch and leave it to the guard's
        // own callback — preventing a double-fire on async recovery.
        const accessListenerId = this.energyApp.useNetworkDevices().listenForDeviceAccessChange(
            (networkDeviceId, status) => this.handleAccessChange(networkDeviceId, status),
        );
        this.listenerIds.push(accessListenerId);

        this.guard = new NetworkAccessGuard(this.energyApp, {
            ports: config.ports,
            enableLogging: this.enableLogging,
            onAccessRestored: (networkDeviceId) => this.dispatchAccessRestored(networkDeviceId),
            onAccessDenied: (networkDeviceId) => this.dispatchAccessDenied(networkDeviceId),
        });

        this.subscribeToEvents();
    }

    /**
     * Convenience factory that constructs the manager and primes the
     * internal NetworkDevice cache from the SDK before returning.
     * @param energyApp The {@link EnergyApp} instance to read events from
     * @param applianceManager The {@link ApplianceManager} the package uses for its appliances
     * @param config Same options accepted by the constructor
     * @returns A manager ready to handle network-device events
     */
    static async initialize(
        energyApp: EnergyApp,
        applianceManager: ApplianceManager,
        config: NetworkDeviceManagerConfig,
    ): Promise<NetworkDeviceManager> {
        const manager = new NetworkDeviceManager(energyApp, applianceManager, config);
        await manager.refreshDevices();
        return manager;
    }

    /**
     * Returns the underlying access guard so advanced callers can
     * compose with it directly.
     */
    getAccessGuard(): NetworkAccessGuard {
        return this.guard;
    }

    /**
     * Idempotently requests access for the given NetworkDevice with
     * the configured ports.
     * @param networkDeviceId The NetworkDevice to request access on
     * @returns `true` when access is granted, `false` otherwise
     */
    async ensureAccess(networkDeviceId: string): Promise<boolean> {
        return this.guard.ensureAccess(networkDeviceId);
    }

    /**
     * Wraps an async network operation in {@link NetworkAccessGuard.withAccessGuard}.
     * Recommended call shape for every Modbus / TCP read against a
     * NetworkDevice this manager is responsible for.
     * @param networkDeviceId The NetworkDevice the action targets
     * @param action The async operation to perform
     * @returns The resolved value of `action`
     */
    async withAccessGuard<T>(networkDeviceId: string, action: () => Promise<T>): Promise<T> {
        return this.guard.withAccessGuard(networkDeviceId, action);
    }

    /**
     * Registers an additional handler for the per-appliance
     * access-restored event.
     * @param handler The handler to register
     * @returns A disposer that removes the handler again
     */
    onApplianceAccessRestored(handler: ApplianceAccessRestoredHandler): () => void {
        this.restoredHandlers.add(handler);
        return () => this.restoredHandlers.delete(handler);
    }

    /**
     * Registers an additional handler for the per-appliance
     * access-denied event.
     * @param handler The handler to register
     * @returns A disposer that removes the handler again
     */
    onApplianceAccessDenied(handler: ApplianceAccessDeniedHandler): () => void {
        this.deniedHandlers.add(handler);
        return () => this.deniedHandlers.delete(handler);
    }

    /**
     * Registers an additional handler for the per-appliance
     * access-revoked event (SDK reported a transition to a non-granted status).
     * @param handler The handler to register
     * @returns A disposer that removes the handler again
     */
    onApplianceAccessRevoked(handler: ApplianceAccessRevokedHandler): () => void {
        this.revokedHandlers.add(handler);
        return () => this.revokedHandlers.delete(handler);
    }

    /**
     * Registers an additional handler for the per-appliance
     * NetworkDevice-removed event.
     * @param handler The handler to register
     * @returns A disposer that removes the handler again
     */
    onApplianceNetworkDeviceRemoved(handler: ApplianceNetworkDeviceRemovedHandler): () => void {
        this.removedHandlers.add(handler);
        return () => this.removedHandlers.delete(handler);
    }

    /**
     * Registers an additional handler for the
     * network-device-detected event.
     * @param handler The handler to register
     * @returns A disposer that removes the handler again
     */
    onNetworkDeviceDetected(handler: NetworkDeviceDetectedHandler): () => void {
        this.detectedHandlers.add(handler);
        return () => this.detectedHandlers.delete(handler);
    }

    /**
     * Registers an additional raw access-change handler. Fires on
     * every SDK transition for any NetworkDevice, including those the
     * package has no appliances on. Useful for first-time onboarding
     * flows where a 'granted' event needs to drive a discovery pass.
     * @param handler The handler to register
     * @returns A disposer that removes the handler again
     */
    onNetworkDeviceAccessChanged(handler: NetworkDeviceAccessChangedHandler): () => void {
        this.accessChangedHandlers.add(handler);
        return () => this.accessChangedHandlers.delete(handler);
    }

    /**
     * Returns a NetworkDevice from the local cache, falling back to
     * the SDK if the cache hasn't been primed yet.
     * @param networkDeviceId The NetworkDevice ID to look up
     */
    async getDevice(networkDeviceId: string): Promise<EnyoNetworkDevice | null> {
        const cached = this.deviceCache.get(networkDeviceId);
        if (cached) return cached;
        const device = await this.energyApp.useNetworkDevices().getDevice(networkDeviceId);
        if (device) {
            this.deviceCache.set(device.id, device);
        }
        return device;
    }

    /**
     * Resolves all appliances the {@link ApplianceManager} currently
     * lists as bound to a given NetworkDevice.
     * @param networkDeviceId The NetworkDevice ID to look up
     */
    async getAppliancesForDevice(networkDeviceId: string): Promise<EnyoAppliance[]> {
        const all = await this.energyApp.useAppliances().list();
        return all.filter(a => a.networkDeviceIds.includes(networkDeviceId));
    }

    /**
     * Refreshes the local NetworkDevice cache from the SDK. The cache
     * is also kept up to date automatically via the detected /
     * removed listeners, so calling this manually is rarely needed.
     */
    async refreshDevices(): Promise<void> {
        const devices = await this.energyApp.useNetworkDevices().getDevices();
        this.deviceCache.clear();
        for (const device of devices) {
            this.deviceCache.set(device.id, device);
        }
    }

    /**
     * Tears down all listeners on the SDK and on the internal access
     * guard. After calling this the manager should no longer be used.
     */
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        const service = this.energyApp.useNetworkDevices();
        for (const id of this.listenerIds) {
            service.removeListener(id);
        }
        this.listenerIds.length = 0;
        this.guard.dispose();
        this.deviceCache.clear();
        this.restoredHandlers.clear();
        this.deniedHandlers.clear();
        this.revokedHandlers.clear();
        this.removedHandlers.clear();
        this.detectedHandlers.clear();
        this.accessChangedHandlers.clear();
        if (this.enableLogging) {
            console.log('[NetworkDeviceManager] disposed');
        }
    }

    private async handleAccessChange(
        networkDeviceId: string,
        status: EnyoNetworkDeviceAccessStatus,
    ): Promise<void> {
        // Fire the raw pass-through first so consumers see every transition
        // regardless of whether the package owns appliances for the device.
        for (const handler of this.accessChangedHandlers) {
            try {
                await handler(networkDeviceId, status);
            } catch (error) {
                if (this.enableLogging) {
                    console.warn(
                        `[NetworkDeviceManager] network-device-access-changed handler failed: ${String(error)}`,
                    );
                }
            }
        }

        if (status === 'granted') {
            // If the guard is mid-recovery, its own SDK listener will clear
            // pending and fire onAccessRestored → dispatchAccessRestored on
            // this same event. Skip here to avoid a double-fire. Manager's
            // listener is registered before the guard's, so pending is still
            // set when we run.
            if (this.guard.isRecovering(networkDeviceId)) return;
            await this.dispatchAccessRestored(networkDeviceId);
        } else {
            await this.dispatchAccessRevoked(networkDeviceId, status);
        }
    }

    private async dispatchAccessRevoked(
        networkDeviceId: string,
        status: EnyoNetworkDeviceAccessStatus,
    ): Promise<void> {
        if (this.revokedHandlers.size === 0 && !this.autoToggleApplianceState) return;
        const appliances = await this.getAppliancesForDevice(networkDeviceId);
        for (const appliance of appliances) {
            if (this.autoToggleApplianceState) {
                await this.setApplianceState(appliance, EnyoApplianceStateEnum.Offline);
            }
            for (const handler of this.revokedHandlers) {
                try {
                    await handler({
                        appliance,
                        applianceId: appliance.id,
                        networkDeviceId,
                        status,
                    });
                } catch (error) {
                    if (this.enableLogging) {
                        console.warn(
                            `[NetworkDeviceManager] access-revoked handler for appliance ${appliance.id} failed: ${String(error)}`,
                        );
                    }
                }
            }
        }
    }

    private subscribeToEvents(): void {
        const service = this.energyApp.useNetworkDevices();

        const detectedListenerId = service.listenForDetectedDevice(
            (devices) => this.handleDetected(devices),
        );
        this.listenerIds.push(detectedListenerId);

        const removedListenerId = service.listenForNetworkDeviceRemoved(
            (deviceId) => this.handleRemoved(deviceId),
        );
        this.listenerIds.push(removedListenerId);
    }

    private async handleDetected(devices: EnyoNetworkDevice[]): Promise<void> {
        for (const device of devices) {
            this.deviceCache.set(device.id, device);
        }
        for (const handler of this.detectedHandlers) {
            try {
                await handler(devices);
            } catch (error) {
                if (this.enableLogging) {
                    console.warn(
                        `[NetworkDeviceManager] network-device-detected handler failed: ${String(error)}`,
                    );
                }
            }
        }
    }

    private async handleRemoved(networkDeviceId: string): Promise<void> {
        this.deviceCache.delete(networkDeviceId);
        const appliances = await this.getAppliancesForDevice(networkDeviceId);
        if (appliances.length === 0) return;

        if (this.enableLogging) {
            console.log(
                `[NetworkDeviceManager] NetworkDevice ${networkDeviceId} removed — ${appliances.length} appliance(s) affected`,
            );
        }

        for (const appliance of appliances) {
            if (this.autoToggleApplianceState) {
                await this.setApplianceState(appliance, EnyoApplianceStateEnum.Offline);
            }
            await this.fireHandlers(this.removedHandlers, {
                appliance,
                applianceId: appliance.id,
                networkDeviceId,
            }, 'network-device-removed');
        }
    }

    private async dispatchAccessRestored(networkDeviceId: string): Promise<void> {
        if (this.restoredHandlers.size === 0 && !this.autoToggleApplianceState) return;
        const appliances = await this.getAppliancesForDevice(networkDeviceId);
        for (const appliance of appliances) {
            if (this.autoToggleApplianceState) {
                await this.setApplianceState(appliance, EnyoApplianceStateEnum.Connected);
            }
            await this.fireHandlers(this.restoredHandlers, {
                appliance,
                applianceId: appliance.id,
                networkDeviceId,
            }, 'access-restored');
        }
    }

    private async dispatchAccessDenied(networkDeviceId: string): Promise<void> {
        if (this.deniedHandlers.size === 0 && !this.autoToggleApplianceState) return;
        const appliances = await this.getAppliancesForDevice(networkDeviceId);
        for (const appliance of appliances) {
            if (this.autoToggleApplianceState) {
                await this.setApplianceState(appliance, EnyoApplianceStateEnum.Offline);
            }
            await this.fireHandlers(this.deniedHandlers, {
                appliance,
                applianceId: appliance.id,
                networkDeviceId,
            }, 'access-denied');
        }
    }

    private async fireHandlers<H extends (event: ApplianceNetworkEvent) => void | Promise<void>>(
        handlers: Set<H>,
        event: ApplianceNetworkEvent,
        label: string,
    ): Promise<void> {
        for (const handler of handlers) {
            try {
                await handler(event);
            } catch (error) {
                if (this.enableLogging) {
                    console.warn(
                        `[NetworkDeviceManager] ${label} handler for appliance ${event.applianceId} failed: ${String(error)}`,
                    );
                }
            }
        }
    }

    private async setApplianceState(appliance: EnyoAppliance, state: EnyoApplianceStateEnum): Promise<void> {
        try {
            const connectionType = appliance.metadata?.connectionType ?? EnyoApplianceConnectionType.Connector;
            await this.applianceManager.updateApplianceState(appliance.id, connectionType, state);
        } catch (error) {
            if (this.enableLogging) {
                console.warn(
                    `[NetworkDeviceManager] failed to set appliance ${appliance.id} to ${state}: ${String(error)}`,
                );
            }
        }
    }
}
