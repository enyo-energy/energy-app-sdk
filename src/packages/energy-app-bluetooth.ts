import {
    EnergyAppBluetoothConnectOptions,
    EnergyAppBluetoothDevice,
    EnergyAppBluetoothScanOptions,
} from "../types/enyo-bluetooth.js";

/**
 * Three consumption styles for the same notify channel — pick whichever fits
 * the protocol you are implementing.
 *
 * - `onValue` is push-based and ideal for fire-and-forget event handling.
 * - `next` is pull-based and convenient for request/response style protocols.
 * - `values` exposes the same stream as an async iterator usable in
 *   `for await` loops; the iterator ends automatically when the underlying
 *   session disconnects.
 *
 * The three styles share the same underlying subscription, so calling
 * {@link stop} cancels the notification subscription regardless of which
 * style was used to consume values.
 */
export interface EnergyAppBluetoothNotifications {
    /**
     * Push-style consumption: the listener is invoked for every notification.
     *
     * @param listener - Callback invoked with each notification payload.
     * @returns Promise resolving to an unsubscribe function. Calling it stops
     *          delivering notifications to this listener but does not
     *          terminate the underlying subscription — use {@link stop} for
     *          that.
     */
    onValue(listener: (value: Uint8Array) => void): Promise<() => Promise<void>>;

    /**
     * Pull-style consumption: resolves with the next single notification.
     *
     * @param timeoutMs - Optional timeout. When provided and no notification
     *                    arrives in time, the promise rejects with an
     *                    `EnergyAppBluetoothError` of code `timeout`.
     * @returns Promise resolving with the next received notification payload.
     */
    next(timeoutMs?: number): Promise<Uint8Array>;

    /**
     * Stream-style consumption usable with `for await` loops.
     * The iterator ends automatically when the session disconnects.
     */
    values(): AsyncIterableIterator<Uint8Array>;

    /**
     * Stop notifications regardless of consumption style.
     * Subsequent calls to {@link next} will reject and {@link values} will
     * complete. Idempotent.
     */
    stop(): Promise<void>;
}

/**
 * One open connection to a Bluetooth peripheral.
 *
 * All GATT operations are scoped to this object — there is no need to repeat
 * the device address on every call. A session must NOT be reused after
 * {@link disconnect} has been awaited or after the callback passed to
 * {@link EnergyAppBluetooth.withDevice} has returned.
 */
export interface EnergyAppBluetoothSession {
    /** MAC address of the peripheral this session is connected to. */
    readonly address: string;

    /**
     * `true` until the connection is closed, either locally via
     * {@link disconnect} or because the peripheral disconnected.
     */
    readonly connected: boolean;

    /**
     * Read the current value of a GATT characteristic.
     *
     * @param serviceUuid - UUID of the GATT service that owns the characteristic.
     * @param charUuid - UUID of the characteristic to read.
     * @returns Promise resolving with the raw characteristic bytes.
     */
    read(serviceUuid: string, charUuid: string): Promise<Uint8Array>;

    /**
     * Write a value to a GATT characteristic. Defaults to write-with-response.
     *
     * @param serviceUuid - UUID of the GATT service that owns the characteristic.
     * @param charUuid - UUID of the characteristic to write.
     * @param value - Bytes to write.
     * @param options - Pass `withoutResponse: true` to use write-without-response.
     */
    write(
        serviceUuid: string,
        charUuid: string,
        value: Uint8Array,
        options?: { withoutResponse?: boolean },
    ): Promise<void>;

    /**
     * Subscribe to notifications/indications on a characteristic.
     * The returned object exposes three interchangeable consumption styles
     * — see {@link EnergyAppBluetoothNotifications}.
     *
     * @param serviceUuid - UUID of the GATT service that owns the characteristic.
     * @param charUuid - UUID of the characteristic to subscribe to.
     */
    notifications(serviceUuid: string, charUuid: string): EnergyAppBluetoothNotifications;

    /**
     * Close the connection. Idempotent — calling it more than once is safe
     * and resolves immediately on subsequent calls.
     */
    disconnect(): Promise<void>;
}

/**
 * Bluetooth Low Energy API for enyo packages.
 *
 * Provides device discovery (scan) and GATT connection management. All
 * operations require the package to declare the `Bluetooth` permission.
 *
 * @example
 * ```ts
 * const bluetooth = energyApp.useBluetooth();
 *
 * // Discover nearby Shelly devices
 * const devices = await bluetooth.scan({
 *     durationMs: 5000,
 *     filter: { manufacturerIds: [0x0BA9] },
 * });
 *
 * // Talk to one of them, with guaranteed cleanup
 * await bluetooth.withDevice(devices[0].address, async (session) => {
 *     const value = await session.read('1800', '2a00');
 *     console.log(new TextDecoder().decode(value));
 * });
 * ```
 */
export interface EnergyAppBluetooth {
    /**
     * Run a discovery on the device's HCI controller.
     *
     * @param options - Optional filter and duration. Without options the host
     *                  uses default duration and returns every advertisement.
     * @returns Promise resolving with the discovered devices.
     */
    scan(options?: EnergyAppBluetoothScanOptions): Promise<EnergyAppBluetoothDevice[]>;

    /**
     * Open a connection to a peripheral.
     *
     * The caller is responsible for invoking {@link EnergyAppBluetoothSession.disconnect}.
     * Prefer {@link withDevice} for typical use cases — it guarantees cleanup
     * even when the callback throws.
     *
     * @param address - MAC address as returned by {@link scan}.
     * @param options - Optional connection timeout configuration.
     * @returns Promise resolving with an active {@link EnergyAppBluetoothSession}.
     */
    connect(
        address: string,
        options?: EnergyAppBluetoothConnectOptions,
    ): Promise<EnergyAppBluetoothSession>;

    /**
     * Force-bond (SMP pairing) with a peripheral. Only required for devices that
     * refuse GATT operations until bonded. Most BLE accessories do not need this.
     */
    pair(address: string, options?: EnergyAppBluetoothConnectOptions): Promise<void>;

    /**
     * Convenience scope: connects to the peripheral, runs `fn`, and always
     * disconnects (even if `fn` throws). Strongly preferred over manual
     * connect/disconnect because it eliminates the risk of leaking sessions
     * when error paths short-circuit cleanup.
     *
     * @param address - MAC address as returned by {@link scan}.
     * @param fn - Callback invoked with the live session. Its return value is
     *             forwarded as the result of `withDevice`.
     * @param options - Optional connection timeout configuration.
     * @returns Promise resolving with the value returned by `fn`.
     */
    withDevice<T>(
        address: string,
        fn: (session: EnergyAppBluetoothSession) => Promise<T>,
        options?: EnergyAppBluetoothConnectOptions,
    ): Promise<T>;
}
