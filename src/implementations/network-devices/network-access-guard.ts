import type {EnergyApp} from "../../energy-app.js";
import type {EnyoNetworkDeviceAccessStatus} from "../../types/enyo-network-device.js";

/**
 * Callback fired when access to a NetworkDevice's required ports
 * becomes granted — either synchronously in response to a re-request
 * or asynchronously via the SDK's `listenForDeviceAccessChange`
 * listener.
 */
export type AccessRestoredHandler = (networkDeviceId: string) => void | Promise<void>;

/**
 * Callback fired when {@link NetworkAccessGuard.recoverAccess} is
 * invoked because the caller has just observed an access-denied
 * error. The handler runs at most once per recovery cycle, before
 * the guard re-requests access.
 */
export type AccessDeniedHandler = (networkDeviceId: string) => void | Promise<void>;

/**
 * Construction options for {@link NetworkAccessGuard}.
 */
export interface NetworkAccessGuardConfig {
    /**
     * TCP ports the package requires on every target NetworkDevice.
     * Forwarded to `requestDeviceAccess(deviceId, ports)` whenever the
     * guard needs to (re-)negotiate access.
     */
    ports: number[];
    /**
     * Optional handler invoked when access is restored. Multiple
     * handlers can be registered after construction via
     * {@link NetworkAccessGuard.onAccessRestored}.
     */
    onAccessRestored?: AccessRestoredHandler;
    /**
     * Optional handler invoked the moment {@link NetworkAccessGuard.recoverAccess}
     * is triggered — i.e. when a caller has just observed an
     * access-denied error. Lets consumers mark dependent appliances
     * offline before recovery completes.
     */
    onAccessDenied?: AccessDeniedHandler;
    /** Toggle internal logging. Defaults to `true`. */
    enableLogging?: boolean;
}

/**
 * Substring patterns the SDK currently uses in its network-access-denied
 * error messages. Kept in one place so the test suite can pin them; if
 * the SDK rephrases the message, only this constant and its tests need to
 * change. There is no typed SDK error class to instanceof-check against
 * today, so we have to substring-match.
 */
const ACCESS_DENIED_PATTERNS: readonly RegExp[] = [
    /Network access denied/i,
    /not in the allowed list/i,
];

/**
 * Recovers from "Network access denied" failures raised by the SDK's
 * network layer when a Modbus (or other TCP) call hits a host whose
 * port is not in the package's allowed list.
 *
 * Why this exists: `EnyoNetworkDevice.accessStatus` is device-wide
 * (`granted | denied | pending`) — it does NOT carry per-port grants.
 * A device can report `'granted'` while our package never received
 * (or has since lost) access to its Modbus port, and the first
 * symptom is a runtime `[NET] Network access denied: Host '...:502'
 * is not in the allowed list. Allowed origins: [], Allowed network
 * devices: []` error from a poll cycle. The guard provides one place
 * to detect that error, re-request access, and dispatch a reconnect
 * once access returns.
 *
 * Typical wiring:
 * 1. Construct one guard per package with the ports it needs.
 * 2. On every Modbus call site, either:
 *    - wrap the call in {@link withAccessGuard}, which recovers in
 *      the background on access-denied errors and re-throws, or
 *    - catch the error, check {@link isAccessDeniedError}, and call
 *      {@link recoverAccess} explicitly.
 * 3. Register an `onAccessRestored` handler (via the config or
 *    {@link onAccessRestored}) that performs the reconnect.
 *
 * Re-entrancy: repeated {@link recoverAccess} calls for the same
 * device while a recovery is already in flight are coalesced — the
 * restored handlers run exactly once per restoration.
 *
 * Precondition use: {@link ensureAccess} exposes the same idempotent
 * `requestDeviceAccess` call so callers can use a single API for both
 * "before a connect, make sure we have access" and "we just lost
 * access, recover it". Concurrent {@link ensureAccess} calls for the
 * same device share a single SDK round-trip.
 */
export class NetworkAccessGuard {
    /** Devices we've re-requested access for and are awaiting a 'granted' signal on. */
    private readonly pending = new Set<string>();
    /** In-flight `ensureAccess` promises keyed by device id so concurrent callers share one SDK round-trip. */
    private readonly ensureInFlight = new Map<string, Promise<boolean>>();
    /** Listener IDs registered against the network-devices service. */
    private readonly listenerIds: string[] = [];
    private readonly restoredHandlers = new Set<AccessRestoredHandler>();
    private readonly deniedHandlers = new Set<AccessDeniedHandler>();
    private readonly ports: number[];
    private readonly enableLogging: boolean;
    private disposed = false;

    /**
     * Recognise the SDK's network-access-denied error so callers don't
     * have to re-implement the substring check. Matches both variants
     * observed in production logs.
     *
     * Note: this is a substring match against the error message because
     * the SDK does not expose a typed error class. {@link ACCESS_DENIED_PATTERNS}
     * is the single source of truth; if the SDK rephrases the message,
     * update that constant and the corresponding pinning tests.
     *
     * @param error The error to inspect (any value is accepted)
     * @returns `true` if the error message looks like an access-denied error
     */
    static isAccessDeniedError(error: unknown): boolean {
        const message = error instanceof Error ? error.message : String(error);
        return ACCESS_DENIED_PATTERNS.some(p => p.test(message));
    }

    /**
     * Constructs a guard and immediately subscribes to the SDK's
     * device-access-change events.
     * @param energyApp The {@link EnergyApp} instance used to call the network-devices API
     * @param config Required ports plus optional initial handlers and logging flag
     */
    constructor(
        private readonly energyApp: EnergyApp,
        config: NetworkAccessGuardConfig,
    ) {
        this.ports = config.ports;
        this.enableLogging = config.enableLogging ?? true;
        if (config.onAccessRestored) {
            this.restoredHandlers.add(config.onAccessRestored);
        }
        if (config.onAccessDenied) {
            this.deniedHandlers.add(config.onAccessDenied);
        }

        const listenerId = this.energyApp.useNetworkDevices().listenForDeviceAccessChange(
            (deviceId, status) => this.handleAccessChange(deviceId, status),
        );
        this.listenerIds.push(listenerId);
    }

    /**
     * Registers an additional handler to be invoked whenever access
     * is restored for any NetworkDevice the guard is recovering.
     * @param handler The handler to register
     * @returns A disposer that removes the handler again
     */
    onAccessRestored(handler: AccessRestoredHandler): () => void {
        this.restoredHandlers.add(handler);
        return () => this.restoredHandlers.delete(handler);
    }

    /**
     * Registers an additional handler to be invoked whenever a
     * recovery cycle starts (i.e. an access-denied error was just
     * observed). Useful for marking dependent appliances offline.
     * @param handler The handler to register
     * @returns A disposer that removes the handler again
     */
    onAccessDenied(handler: AccessDeniedHandler): () => void {
        this.deniedHandlers.add(handler);
        return () => this.deniedHandlers.delete(handler);
    }

    /**
     * Idempotently request access to the configured ports for the
     * given NetworkDevice. Safe to call as a precondition before any
     * Modbus operation.
     *
     * Concurrent calls for the same device share a single underlying
     * `requestDeviceAccess` SDK call — the SDK is hit exactly once per
     * in-flight request, regardless of how many callers `await` on it.
     *
     * @param networkDeviceId The NetworkDevice to request access on
     * @returns `true` when the SDK reports access is granted, `false` otherwise
     */
    async ensureAccess(networkDeviceId: string): Promise<boolean> {
        const inFlight = this.ensureInFlight.get(networkDeviceId);
        if (inFlight) return inFlight;

        const promise = this.requestAccess(networkDeviceId)
            .finally(() => this.ensureInFlight.delete(networkDeviceId));
        this.ensureInFlight.set(networkDeviceId, promise);
        return promise;
    }

    private async requestAccess(networkDeviceId: string): Promise<boolean> {
        try {
            const result = await this.energyApp
                .useNetworkDevices()
                .requestDeviceAccess(networkDeviceId, this.ports);
            return result.status === 'granted';
        } catch (error) {
            this.log('warn', `requestDeviceAccess for ${networkDeviceId} failed: ${String(error)}`);
            return false;
        }
    }

    /**
     * Wraps an async action so that an access-denied error
     * automatically triggers a background recovery. The original
     * error is re-thrown so the caller can fail-fast on the failed
     * read; the next read after access is restored will succeed.
     *
     * Use this on Modbus call sites for the simplest integration:
     * ```ts
     * await guard.withAccessGuard(networkDeviceId, () =>
     *   modbusClient.readHoldingRegisters(...));
     * ```
     * @param networkDeviceId The NetworkDevice the action targets
     * @param action The async operation to perform
     * @returns The resolved value of `action`
     */
    async withAccessGuard<T>(networkDeviceId: string, action: () => Promise<T>): Promise<T> {
        try {
            return await action();
        } catch (error) {
            if (NetworkAccessGuard.isAccessDeniedError(error)) {
                void this.recoverAccess(networkDeviceId);
            }
            throw error;
        }
    }

    /**
     * Drive recovery from an access-denied error: notify denied
     * handlers, re-request access, and fire the restored handlers
     * once access is granted. The restored handlers run at most once
     * per recovery, regardless of whether the grant is observed
     * synchronously (from the request response) or asynchronously
     * (from the access-change listener).
     *
     * If the SDK responds with anything other than `'granted'`, the
     * device is removed from the pending set so the next access-denied
     * error from the same device can drive a fresh recovery attempt
     * (instead of getting silently coalesced forever).
     *
     * @param networkDeviceId The NetworkDevice whose access needs to be recovered
     */
    async recoverAccess(networkDeviceId: string): Promise<void> {
        if (this.disposed) return;
        if (this.pending.has(networkDeviceId)) {
            this.log('debug', `recovery already in flight for ${networkDeviceId}`);
            return;
        }
        this.pending.add(networkDeviceId);
        this.log('log', `re-requesting access for ${networkDeviceId} after access-denied`);

        await this.fireHandlers(this.deniedHandlers, networkDeviceId, 'access-denied');

        const granted = await this.ensureAccess(networkDeviceId);
        if (!granted) {
            // Clear pending so a subsequent access-denied error can drive
            // a fresh recovery cycle. The SDK won't necessarily emit a
            // later `'granted'` event (e.g. on a permanent `denied`
            // response, transient SDK error, or user dismissal), so
            // leaving the device pending would orphan it.
            this.pending.delete(networkDeviceId);
            return;
        }
        // Synchronous grant — the listener won't observe a transition,
        // so fire the handlers ourselves and clear the pending mark.
        this.pending.delete(networkDeviceId);
        await this.fireHandlers(this.restoredHandlers, networkDeviceId, 'access-restored');
    }

    /**
     * Returns `true` if a recovery cycle is currently in flight for
     * the given NetworkDevice. Intended for tests, introspection, and
     * the dedup logic inside {@link NetworkDeviceManager} — do NOT
     * poll this in a busy loop to wait for recovery completion; await
     * the restored handler instead.
     */
    isRecovering(networkDeviceId: string): boolean {
        return this.pending.has(networkDeviceId);
    }

    /**
     * Tears down the SDK listener and clears all handlers. After
     * calling this the guard should no longer be used. In-flight
     * recoveries are not cancelled, but `recoverAccess` is a no-op
     * after dispose so no new recoveries will start.
     */
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        const service = this.energyApp.useNetworkDevices();
        for (const id of this.listenerIds) {
            service.removeListener(id);
        }
        this.listenerIds.length = 0;
        this.restoredHandlers.clear();
        this.deniedHandlers.clear();
        this.pending.clear();
        this.ensureInFlight.clear();
    }

    private async handleAccessChange(
        networkDeviceId: string,
        status: EnyoNetworkDeviceAccessStatus,
    ): Promise<void> {
        if (status !== 'granted') return;
        if (!this.pending.has(networkDeviceId)) return;
        this.pending.delete(networkDeviceId);
        await this.fireHandlers(this.restoredHandlers, networkDeviceId, 'access-restored');
    }

    private async fireHandlers<H extends (deviceId: string) => void | Promise<void>>(
        handlers: Iterable<H>,
        networkDeviceId: string,
        label: 'access-restored' | 'access-denied',
    ): Promise<void> {
        for (const handler of handlers) {
            try {
                await handler(networkDeviceId);
            } catch (error) {
                this.log('warn', `${label} handler for ${networkDeviceId} failed: ${String(error)}`);
            }
        }
    }

    private log(level: 'log' | 'debug' | 'warn', message: string): void {
        if (!this.enableLogging) return;
        console[level](`[NetworkAccessGuard] ${message}`);
    }
}
