/**
 * The **Modbus server** package: serve your app's data to Modbus clients on the
 * hub's own listener.
 *
 * This is the inverse of {@link EnergyAppModbus}. There, the app is a client
 * polling somebody else's device. Here, the hub *is* the device: a third-party
 * energy manager, a building-automation controller or an installer's diagnostic
 * tool connects to the hub, and the values it reads come from handlers this app
 * registers.
 *
 * Requires the `ModbusServer` permission.
 */

import type {EnergyAppModbusDataType} from '../implementations/modbus/interfaces.js';
import type {
    EnyoModbusServerConfig,
    EnyoModbusServerRegistration,
    EnyoModbusServerRegistrationHandle,
    EnyoModbusServerRegistrationOf,
} from '../types/enyo-modbus-server.js';

/**
 * Interface for serving Modbus registers from an enyo package.
 *
 * **The server is shared.** One host-owned TCP listener, one unit id, and every
 * installed app carving up the same address space. Two consequences an app
 * author has to design around:
 *
 * 1. Address ranges are first-come, first-served across *all* apps, so
 *    registration can fail with
 *    {@link EnyoModbusServerRegistrationConflictError} through no fault of your
 *    own. Handle it at runtime; do not assume startup registration succeeds.
 * 2. The unit id from {@link getModbusServerConfig} does not identify your app.
 *    A client addressing it reaches the whole hub, not your package.
 *
 * Register metadata (translated name, description, unit) never travels over
 * Modbus — the protocol carries bare words. It exists so the host can show the
 * hub's register map and generate installer documentation.
 *
 * @example
 * ```typescript
 * const server = energyApp.useModbusServer();
 * const {addresses, port, unitId} = await server.getModbusServerConfig();
 * console.log(`Reachable at ${addresses.join(', ')}:${port}, unit ${unitId}`);
 *
 * const handle = await server.registerRegister(modbusServerRegister.holding({
 *     address: 40071,
 *     key: 'active-power-w',
 *     name: [
 *         {language: 'de', value: 'Momentanleistung'},
 *         {language: 'en', value: 'Active power'},
 *     ],
 *     description: [
 *         {language: 'de', value: 'Aktuelle Wirkleistung der Anlage.'},
 *         {language: 'en', value: 'Current active power of the plant.'},
 *     ],
 *     unit: 'W',
 *     dataType: 'float32',            // claims 40071..40072
 *     onRead: async () => currentPowerW,
 *     onWrite: async (value) => applyPowerLimit(value),
 * }));
 *
 * // later, on shutdown
 * await handle.unregister();
 * ```
 */
export interface EnergyAppModbusServer {
    /**
     * Returns where the hub's Modbus server can be reached — addresses, port and
     * the shared unit id.
     *
     * Everything returned is host-owned and read-only. Use it to tell an
     * installer where to point their client; prefer showing
     * {@link EnyoModbusServerConfig.addresses} in full over guessing which
     * interface they are on.
     *
     * @returns The current server configuration.
     */
    getModbusServerConfig(): Promise<EnyoModbusServerConfig>;

    /**
     * Claims one address range and serves it from the supplied handlers.
     *
     * The range claimed runs from `address` for as many words as the
     * registration's `dataType` implies (1 for `uint16`, 2 for `float32`,
     * `quantity` for `string`, 1 bit for a coil or discrete input). Any overlap
     * with an existing registration — yours or another app's — fails the whole
     * call; nothing partial is claimed.
     *
     * @param registration - The register to serve, with its metadata and handlers.
     * @returns A handle for releasing the range again.
     * @throws {EnyoModbusServerRegistrationConflictError} If any word of the
     *   range is already registered. Check `heldByCaller` to tell your own
     *   double-registration from another app holding the address.
     */
    registerRegister<D extends EnergyAppModbusDataType>(
        registration: EnyoModbusServerRegistrationOf<D>,
    ): Promise<EnyoModbusServerRegistrationHandle>;

    /**
     * Claims several address ranges at once, atomically.
     *
     * Either every registration succeeds or none does — a conflict partway
     * through the list leaves no ranges claimed. Prefer this over a loop of
     * {@link registerRegister} when registering a device's whole register map,
     * so a mid-list conflict cannot strand you with half a map published.
     *
     * @param registrations - The registers to serve.
     * @returns One handle per registration, in the order supplied.
     * @throws {EnyoModbusServerRegistrationConflictError} If any range in the
     *   list conflicts, with the details of the first conflict found. Overlaps
     *   *within* the supplied list are reported the same way, with
     *   `heldByCaller` true.
     */
    registerRegisters(
        registrations: EnyoModbusServerRegistration[],
    ): Promise<EnyoModbusServerRegistrationHandle[]>;

    /**
     * Lists the registrations this app currently holds.
     *
     * Scoped to the calling app — registrations belonging to other apps are
     * never visible, even though they share the address space.
     *
     * @returns The live handles, in no guaranteed order.
     */
    getRegisteredRegisters(): Promise<EnyoModbusServerRegistrationHandle[]>;

    /**
     * Releases every range this app holds.
     *
     * Idempotent, and safe to call when nothing is registered. Worth calling on
     * shutdown: ranges stay claimed while the app is installed, so a stale
     * registration blocks a later re-registration of the same address.
     */
    unregisterAll(): Promise<void>;
}
