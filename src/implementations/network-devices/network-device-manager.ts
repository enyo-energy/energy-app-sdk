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

/**
 * Handler invoked the moment an access-denied **error** has been observed at
 * runtime — i.e. a Modbus / TCP read inside {@link NetworkDeviceManager.withAccessGuard}
 * threw the SDK's access-denied error despite the device reporting `'granted'`.
 *
 * Contrast with {@link ApplianceAccessRevokedHandler}: this fires on
 * **runtime errors**, while revocation fires on **SDK status transitions**
 * (typically user-driven via the UI).
 */
export type ApplianceAccessDeniedHandler = (event: ApplianceNetworkEvent) => void | Promise<void>;

/**
 * Handler invoked when the SDK reports a NetworkDevice transition to a
 * non-granted access status (`'denied'` or `'pending'`), e.g. the user
 * revoked access from the UI.
 *
 * Contrast with {@link ApplianceAccessDeniedHandler}: this fires when the
 * SDK explicitly signals a status change, while access-denied fires when
 * an in-flight read **fails** with the SDK's access-denied error.
 */
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
 *
 * **AccessDenied vs AccessRevoked**: both represent "the package can no longer
 * read this device", but their source differs:
 *
 * | Event | Source | When it fires |
 * |---|---|---|
 * | `onApplianceAccessDenied` | Runtime read error caught by {@link NetworkDeviceManager.withAccessGuard} | A live Modbus / TCP call returned the SDK's "Network access denied" error |
 * | `onApplianceAccessRevoked` | SDK access-status listener | The SDK reported a transition to `'denied'` or `'pending'` — usually a user-driven UI action |
 *
 * If you want a single "lost access" signal, wire both handlers to the same
 * downstream — they will not double-fire for a single underlying event.
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
    /** See {@link ApplianceAccessDeniedHandler}. */
    onApplianceAccessDenied?: ApplianceAccessDeniedHandler;
    /** See {@link ApplianceAccessRevokedHandler}. */
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
     *
     * The manager dedupes the list by `ipAddress` before invoking the
     * handler. Each IP fires the handler at most once until the SDK
     * reports the corresponding device removed — at which point the
     * IP becomes eligible to fire again. This collapses mDNS /
     * discovery bursts (which re-emit the same physical host, sometimes
     * under a fresh `EnyoNetworkDevice.id` per scan) into a single
     * dispatch so handlers do not need to maintain their own
     * "already-connected" set. Devices without an `ipAddress` are
     * always forwarded.
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
 * Thrown when {@link NetworkDeviceManager.initialize} is called more than
 * once for the same `EnergyApp` without disposing the previous instance
 * first. Constructing two managers per package leaks SDK listeners and
 * causes every event to fire twice.
 */
export class NetworkDeviceManagerAlreadyInitializedError extends Error {
    constructor() {
        super(
            'NetworkDeviceManager is already initialized for this EnergyApp. ' +
            'Call dispose() on the existing instance before creating a new one, ' +
            'or reuse the existing manager.',
        );
        this.name = 'NetworkDeviceManagerAlreadyInitializedError';
    }
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
 * Only one manager may be active per `EnergyApp`: calling
 * {@link initialize} a second time without first disposing the previous
 * instance throws {@link NetworkDeviceManagerAlreadyInitializedError}.
 */
export class NetworkDeviceManager {
    /** Per-EnergyApp registry used to enforce the single-instance invariant. */
    private static readonly active = new WeakMap<EnergyApp, NetworkDeviceManager>();

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
    /** IPs already dispatched to detected-handlers; cleared per-IP on the SDK's removal event. */
    private readonly dispatchedIps = new Set<string>();
    /**
     * Devices whose `restored` dispatch has already fired for the current
     * `granted` transition. Holds entries until the next non-granted transition
     * or removal so that an out-of-order second `granted` listener fire
     * (manager-listener and guard-callback both feed into
     * {@link dispatchAccessRestored}) cannot produce a duplicate per-appliance
     * dispatch. Order-independent — does not rely on SDK listener FIFO semantics.
     */
    private readonly restoredAlreadyDispatched = new Set<string>();
    private disposed = false;

    /**
     * Constructs the manager and wires up all SDK listeners. The
     * NetworkDevice cache is populated lazily — call
     * {@link initialize} if you need it primed before use.
     *
     * Prefer {@link initialize} over direct construction so the
     * single-instance invariant is enforced.
     *
     * @param energyApp The {@link EnergyApp} instance to read events from
     * @param applianceManager The {@link ApplianceManager} the package uses for its appliances
     * @param config Required ports plus optional handlers and behaviour flags
     * @throws {NetworkDeviceManagerAlreadyInitializedError} if another manager for the same `EnergyApp` is still active
     */
    constructor(
        private readonly energyApp: EnergyApp,
        private readonly applianceManager: ApplianceManager,
        config: NetworkDeviceManagerConfig,
    ) {
        const existing = NetworkDeviceManager.active.get(energyApp);
        if (existing && !existing.disposed) {
            throw new NetworkDeviceManagerAlreadyInitializedError();
        }

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

        // Wire up SDK listeners + the access guard under try/catch — if any
        // step throws partway through, unwind the partial state so we don't
        // leak orphan listeners that fire into a dead manager.
        try {
            // Register the manager's access-change listener BEFORE constructing
            // the guard so the manager observes 'granted' transitions while the
            // device is still in the guard's pending set (used by handleAccessChange
            // as a hint to short-circuit). Note: the dedup that actually prevents
            // double-fires is restoredAlreadyDispatched — it does NOT depend on
            // listener ordering.
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
        } catch (error) {
            this.cleanupPartialInit();
            throw error;
        }
        NetworkDeviceManager.active.set(energyApp, this);
    }

    /**
     * Reverses any side effects performed during a partially-failed
     * construction: removes whatever SDK listeners we managed to register and
     * disposes the guard if it was constructed. Idempotent and exception-safe.
     */
    private cleanupPartialInit(): void {
        const service = this.energyApp.useNetworkDevices();
        for (const listenerId of this.listenerIds) {
            try {
                service.removeListener(listenerId);
            } catch {
                // best-effort — we're already unwinding a construction failure
            }
        }
        this.listenerIds.length = 0;
        if (this.guard) {
            try {
                this.guard.dispose();
            } catch {
                // best-effort
            }
        }
    }

    /**
     * Convenience factory that constructs the manager and primes the
     * internal NetworkDevice cache from the SDK before returning.
     *
     * @param energyApp The {@link EnergyApp} instance to read events from
     * @param applianceManager The {@link ApplianceManager} the package uses for its appliances
     * @param config Same options accepted by the constructor
     * @returns A manager ready to handle network-device events
     * @throws {NetworkDeviceManagerAlreadyInitializedError} if another manager for the same `EnergyApp` is still active
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
     * Resolves all appliances currently bound to a given NetworkDevice.
     * Reads from the {@link ApplianceManager}'s in-memory index — never
     * hits the SDK — so this is safe to call inside hot event handlers.
     *
     * @param networkDeviceId The NetworkDevice ID to look up
     */
    getAppliancesForDevice(networkDeviceId: string): EnyoAppliance[] {
        return this.applianceManager.findAppliancesByNetworkDeviceId(networkDeviceId);
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
     * A new manager can be created for the same `EnergyApp` after disposal.
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
        this.dispatchedIps.clear();
        this.restoredAlreadyDispatched.clear();
        this.restoredHandlers.clear();
        this.deniedHandlers.clear();
        this.revokedHandlers.clear();
        this.removedHandlers.clear();
        this.detectedHandlers.clear();
        this.accessChangedHandlers.clear();
        if (NetworkDeviceManager.active.get(this.energyApp) === this) {
            NetworkDeviceManager.active.delete(this.energyApp);
        }
        if (this.enableLogging) {
            console.log('[NetworkDeviceManager] disposed');
        }
    }

    /**
     * Reacts to the SDK's access-status change events. Fires the raw
     * pass-through handler for every transition, then dispatches the
     * per-appliance event matching the new status.
     *
     * For a `granted` transition the dispatch is deduplicated against
     * {@link restoredAlreadyDispatched} so that — regardless of which
     * listener (this one or the guard's restored callback) runs first
     * — each `granted` transition fires `dispatchAccessRestored` at
     * most once.
     */
    private async handleAccessChange(
        networkDeviceId: string,
        status: EnyoNetworkDeviceAccessStatus,
    ): Promise<void> {
        // Short-circuit if dispose has run mid-flight — the cascaded
        // dispatch would otherwise call into a disposed ApplianceManager
        // and throw ApplianceManagerDisposedError up the SDK's listener stack.
        if (this.disposed) return;
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
            await this.dispatchAccessRestored(networkDeviceId);
        } else {
            // A transition away from 'granted' frees the device's restored
            // dedup mark so the next 'granted' can fire again.
            this.restoredAlreadyDispatched.delete(networkDeviceId);
            await this.dispatchAccessRevoked(networkDeviceId, status);
        }
    }

    /**
     * Dispatches the per-appliance `access-revoked` event for every
     * appliance bound to the device. Optionally flips affected
     * appliances to {@link EnyoApplianceStateEnum.Offline} first when
     * `autoToggleApplianceState` is set.
     */
    private async dispatchAccessRevoked(
        networkDeviceId: string,
        status: EnyoNetworkDeviceAccessStatus,
    ): Promise<void> {
        if (this.revokedHandlers.size === 0 && !this.autoToggleApplianceState) return;
        const appliances = this.getAppliancesForDevice(networkDeviceId);
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

    /**
     * Subscribes the manager to the SDK's detected and removed listeners.
     * The access-change listener is set up in the constructor — see the
     * comment there for the ordering rationale.
     */
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

    /**
     * Refreshes the device cache for every observation, then forwards a
     * deduped device list to the registered `detected` handlers. Dedup
     * is keyed by `ipAddress` and persists until the SDK reports the
     * corresponding device removed — collapsing mDNS / discovery bursts
     * into a single dispatch per physical host.
     */
    private async handleDetected(devices: EnyoNetworkDevice[]): Promise<void> {
        if (this.disposed) return;
        // Cache writes are keyed by canonical device id, so they are idempotent
        // and keep hostname / accessStatus / lastSeen current irrespective of
        // whether the device passes the IP-based dedup below.
        for (const device of devices) {
            this.deviceCache.set(device.id, device);
        }

        const toDispatch: EnyoNetworkDevice[] = [];
        for (const device of devices) {
            const ip = device.ipAddress;
            if (!ip) {
                // No IP to key on — forward without recording.
                toDispatch.push(device);
                continue;
            }
            if (this.dispatchedIps.has(ip)) continue;
            this.dispatchedIps.add(ip);
            toDispatch.push(device);
        }

        if (toDispatch.length === 0) return;

        for (const handler of this.detectedHandlers) {
            try {
                await handler(toDispatch);
            } catch (error) {
                if (this.enableLogging) {
                    console.warn(
                        `[NetworkDeviceManager] network-device-detected handler failed: ${String(error)}`,
                    );
                }
            }
        }
    }

    /**
     * Reacts to the SDK's NetworkDevice-removed event. Frees the device's
     * IP for re-dispatch, evicts the local cache entry, clears the
     * `restored` dedup mark, and dispatches per-appliance removed handlers.
     */
    private async handleRemoved(networkDeviceId: string): Promise<void> {
        if (this.disposed) return;
        // Free the IP for re-dispatch BEFORE evicting the cached device — the
        // cache is the only place we can recover the device's IP at this point.
        const cached = this.deviceCache.get(networkDeviceId);
        if (cached?.ipAddress) {
            this.dispatchedIps.delete(cached.ipAddress);
        }
        this.deviceCache.delete(networkDeviceId);
        this.restoredAlreadyDispatched.delete(networkDeviceId);
        const appliances = this.getAppliancesForDevice(networkDeviceId);
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

    /**
     * Dispatches the per-appliance `access-restored` event for every
     * appliance bound to the device. Marks the device as already
     * dispatched so the manager's SDK listener and the guard's restored
     * callback cannot produce two dispatches for the same transition —
     * order-independently. Optionally flips affected appliances to
     * {@link EnyoApplianceStateEnum.Connected} first when
     * `autoToggleApplianceState` is set.
     */
    private async dispatchAccessRestored(networkDeviceId: string): Promise<void> {
        if (this.restoredAlreadyDispatched.has(networkDeviceId)) return;
        this.restoredAlreadyDispatched.add(networkDeviceId);
        if (this.restoredHandlers.size === 0 && !this.autoToggleApplianceState) return;
        const appliances = this.getAppliancesForDevice(networkDeviceId);
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

    /**
     * Dispatches the per-appliance `access-denied` event for every
     * appliance bound to the device. Distinct from `revoked` — see the
     * comment on {@link NetworkDeviceManagerConfig} for the difference.
     */
    private async dispatchAccessDenied(networkDeviceId: string): Promise<void> {
        if (this.deniedHandlers.size === 0 && !this.autoToggleApplianceState) return;
        const appliances = this.getAppliancesForDevice(networkDeviceId);
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

    /**
     * Awaits every registered handler in `handlers` with the supplied
     * `event`, catching and logging individual handler failures so one
     * misbehaving consumer cannot prevent the rest from running.
     */
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

    /**
     * Delegates an appliance state change to the {@link ApplianceManager},
     * preserving the existing `connectionType` from the appliance's
     * metadata. Failures are logged but do not propagate.
     */
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
