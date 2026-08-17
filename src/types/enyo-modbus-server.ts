/**
 * Types for the **Modbus server** package ({@link EnergyAppModbusServer}).
 *
 * Where {@link EnergyAppModbus} is a *client* — the app reaches out to somebody
 * else's device — this model is the inverse: the hub itself answers Modbus
 * requests, and an energy app supplies the data behind individual registers by
 * registering them with read/write handlers.
 *
 * The server is **host-owned and shared**: one TCP listener, one unit id, and
 * every installed app carving up the same address space. That single fact drives
 * most of the design here — see
 * {@link EnyoModbusServerRegistrationConflictError}.
 *
 * Pure type declarations (no runtime logic). Use
 * `validateModbusServerRegistrations()`
 * (`../implementations/modbus/modbus-server-validators.ts`) to catch overlaps
 * and missing metadata locally before registering.
 */

import type {EnergyAppModbusDataType} from '../implementations/modbus/interfaces.js';
import type {EnyoPackageConfigurationTranslatedValue} from './enyo-settings.js';

// ---------------------------------------------------------------------------
// Address spaces
// ---------------------------------------------------------------------------

/**
 * The four Modbus address spaces a register can live in.
 *
 * Read/write access is fixed by the protocol, not by configuration: coils and
 * holding registers are writable, discrete inputs and input registers are not.
 * The registration types encode this — an `onWrite` handler does not exist on a
 * read-only space.
 */
export enum EnyoModbusServerRegisterSpace {
    /** Read/write single bit (function 1 / 5 / 15). */
    Coil = 'coil',
    /** Read-only single bit (function 2). */
    DiscreteInput = 'discrete-input',
    /** Read/write 16-bit word (function 3 / 6 / 16). */
    Holding = 'holding',
    /** Read-only 16-bit word (function 4). */
    Input = 'input',
}

// ---------------------------------------------------------------------------
// Handler context & signatures
// ---------------------------------------------------------------------------

/**
 * What the host knows about the request that triggered a handler.
 *
 * Handlers are called per registered register, so `space`/`address` identify the
 * register rather than the raw request: a client reading a 10-word block that
 * spans three registered registers produces three handler calls, and the host
 * assembles the response.
 */
export interface EnyoModbusServerRequestContext {
    /** The address space the register lives in. */
    space: EnyoModbusServerRegisterSpace;
    /** The register's start address. */
    address: number;
    /** How many words (or bits) this register occupies. */
    quantity: number;
    /** The unit id the request was addressed to. Shared across apps. */
    unitId: number;
    /** Remote client address, when the transport exposes it. */
    remoteAddress?: string;
    /** When the host received the request. */
    requestedAt: Date;
}

/**
 * Produces the current value of a register.
 *
 * Must resolve within the registration's `timeoutMs`; an overrunning handler is
 * abandoned and the client receives
 * {@link EnyoModbusServerExceptionCode.ServerDeviceBusy}. Throw
 * {@link EnyoModbusServerException} to answer with a specific exception code;
 * any other throw becomes
 * {@link EnyoModbusServerExceptionCode.ServerDeviceFailure}.
 *
 * @param context - What the host knows about the triggering request.
 * @returns The register's value, in the shape implied by its `dataType`.
 */
export type EnyoModbusServerReadHandler<T> = (
    context: EnyoModbusServerRequestContext,
) => Promise<T> | T;

/**
 * Applies a value written by a Modbus client.
 *
 * Reject an unacceptable value by throwing
 * {@link EnyoModbusServerException} with
 * {@link EnyoModbusServerExceptionCode.IllegalDataValue} — resolving normally
 * tells the client the write succeeded. Timeout and error mapping otherwise
 * match {@link EnyoModbusServerReadHandler}.
 *
 * @param value - The decoded, de-scaled value the client wrote.
 * @param context - What the host knows about the triggering request.
 */
export type EnyoModbusServerWriteHandler<T> = (
    value: T,
    context: EnyoModbusServerRequestContext,
) => Promise<void> | void;

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Descriptive metadata shared by every registration.
 *
 * **None of this travels over Modbus.** The protocol carries bare words — no
 * names, no units, no types. This metadata exists so the host can render the
 * hub's register map in the UI and generate installer-facing documentation; a
 * Modbus client will never read it.
 */
export interface EnyoModbusServerRegisterBase {
    /** The address space this register lives in. */
    space: EnyoModbusServerRegisterSpace;
    /** The register's start address. */
    address: number;
    /**
     * Stable machine key, unique within your app. Appears in logs, diagnostics
     * and {@link EnyoModbusServerRegistrationConflictError}, so it must not
     * carry user-facing prose — unlike {@link name}, it should never change once
     * shipped.
     */
    key: string;
    /** Translated display name (de/en), e.g. „Momentanleistung" / "Active power". */
    name: EnyoPackageConfigurationTranslatedValue[];
    /** Optional translated description — what the value means and when it updates. */
    description?: EnyoPackageConfigurationTranslatedValue[];
    /** Optional unit symbol. Not translated: `'W'`, `'kWh'`, `'°C'`, `'A'`. */
    unit?: string;
    /**
     * Response deadline for this register's handlers, in milliseconds. When
     * omitted the host default applies. A handler that overruns it is abandoned
     * and never told; the client receives
     * {@link EnyoModbusServerExceptionCode.ServerDeviceBusy}.
     */
    timeoutMs?: number;
}

/** A read/write single-bit coil. */
export interface EnyoModbusServerCoilRegistration extends EnyoModbusServerRegisterBase {
    space: EnyoModbusServerRegisterSpace.Coil;
    /** Produces the coil's current state. */
    onRead: EnyoModbusServerReadHandler<boolean>;
    /**
     * Applies a client write. Optional: omit it to expose the coil as
     * read-only, in which case writes answer
     * {@link EnyoModbusServerExceptionCode.IllegalDataAddress}.
     */
    onWrite?: EnyoModbusServerWriteHandler<boolean>;
}

/** A read-only single-bit discrete input. */
export interface EnyoModbusServerDiscreteInputRegistration extends EnyoModbusServerRegisterBase {
    space: EnyoModbusServerRegisterSpace.DiscreteInput;
    /** Produces the input's current state. */
    onRead: EnyoModbusServerReadHandler<boolean>;
}

/**
 * The value a word register's handlers deal in, derived from its `dataType`.
 * Every numeric type decodes to a `number`; `'string'` decodes to a `string`.
 */
export type EnyoModbusServerWordValue<D extends EnergyAppModbusDataType> = D extends 'string'
    ? string
    : number;

/**
 * Fields shared by the two word spaces (holding and input).
 *
 * The host owns word packing, endianness and scaling: handlers deal in decoded
 * values, never in raw registers. How many words the register occupies follows
 * from {@link dataType} — 1 for `uint16`/`int16`/`acc16`, 2 for
 * `uint32`/`int32`/`float32`/`acc32`, and {@link quantity} for `string`.
 */
export interface EnyoModbusServerWordRegisterBase<D extends EnergyAppModbusDataType>
    extends EnyoModbusServerRegisterBase {
    /** How the value is encoded on the wire. */
    dataType: D;
    /**
     * Decimal scaling: the wire value is `value * 10^scale`. Applied by the host
     * in both directions, so handlers always see the real-world value. Numeric
     * types only.
     */
    scale?: number;
    /**
     * Number of 16-bit words the register occupies. **Required** for
     * `dataType: 'string'`, where it cannot be derived; ignored otherwise.
     */
    quantity?: number;
}

/** A read/write 16-bit holding register. */
export interface EnyoModbusServerHoldingRegistration<
    D extends EnergyAppModbusDataType = EnergyAppModbusDataType,
> extends EnyoModbusServerWordRegisterBase<D> {
    space: EnyoModbusServerRegisterSpace.Holding;
    /** Produces the register's current value. */
    onRead: EnyoModbusServerReadHandler<EnyoModbusServerWordValue<D>>;
    /**
     * Applies a client write. Optional: a read-only holding register is common
     * in real devices, and omitting this makes writes answer
     * {@link EnyoModbusServerExceptionCode.IllegalDataAddress}.
     */
    onWrite?: EnyoModbusServerWriteHandler<EnyoModbusServerWordValue<D>>;
}

/** A read-only 16-bit input register. */
export interface EnyoModbusServerInputRegistration<
    D extends EnergyAppModbusDataType = EnergyAppModbusDataType,
> extends EnyoModbusServerWordRegisterBase<D> {
    space: EnyoModbusServerRegisterSpace.Input;
    /** Produces the register's current value. */
    onRead: EnyoModbusServerReadHandler<EnyoModbusServerWordValue<D>>;
}

/**
 * Any register an app can offer through the Modbus server, with its word type
 * pinned to `D`.
 *
 * A discriminated union on `space`, so the protocol's access rules are enforced
 * by the compiler: a discrete-input or input registration has no `onWrite` field
 * to set.
 *
 * Prefer the {@link modbusServerRegister} factories over writing this out: they
 * infer `D` from the literal `dataType`, which is what makes a handler's value
 * type exact. Annotating a literal as the un-parameterised
 * {@link EnyoModbusServerRegistration} instead leaves `D` at its default — the
 * whole data-type union — so handler values widen to `string | number` and a
 * `float32` register would accept a `string`.
 */
export type EnyoModbusServerRegistrationOf<D extends EnergyAppModbusDataType> =
    | EnyoModbusServerCoilRegistration
    | EnyoModbusServerDiscreteInputRegistration
    | EnyoModbusServerHoldingRegistration<D>
    | EnyoModbusServerInputRegistration<D>;

/**
 * Any register an app can offer, over any data type.
 *
 * This is the storage/transport form — what a list of registrations is typed as.
 * For *authoring* a register use {@link modbusServerRegister}, so the data type
 * is inferred and the handler signatures come out exact.
 */
export type EnyoModbusServerRegistration = EnyoModbusServerRegistrationOf<EnergyAppModbusDataType>;

/**
 * A live registration, returned by
 * {@link EnergyAppModbusServer.registerRegister}.
 *
 * Hold on to it: {@link unregister} is the only way to release the address
 * range, and an app that never releases keeps the range claimed for as long as
 * it stays installed.
 */
export interface EnyoModbusServerRegistrationHandle {
    /** Host-assigned id for this registration. */
    id: string;
    /** The space the register was claimed in. */
    space: EnyoModbusServerRegisterSpace;
    /** The claimed start address. */
    address: number;
    /** How many words (or bits) were claimed, starting at {@link address}. */
    quantity: number;
    /** The {@link EnyoModbusServerRegisterBase.key} it was registered under. */
    key: string;
    /**
     * Releases the address range. Idempotent — unregistering twice is not an
     * error. After this resolves the range is free for any app to claim.
     */
    unregister(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Server configuration
// ---------------------------------------------------------------------------

/**
 * Where the hub's Modbus server can be reached.
 *
 * Everything here is host-owned: an app reads this to tell an installer where to
 * point their client, and cannot change any of it.
 */
export interface EnyoModbusServerConfig {
    /** The primary address to advertise. */
    host: string;
    /**
     * Every local address the server answers on. The hub is typically
     * multi-homed (LAN, WLAN, and possibly a service interface), so prefer
     * showing an installer this whole list over guessing from {@link host}.
     */
    addresses: string[];
    /** The TCP port the server listens on. Conventionally 502. */
    port: number;
    /**
     * The unit id clients must address. **Shared across every installed app** —
     * it does not identify your app, and you do not own it.
     */
    unitId: number;
    /** Whether the server is currently accepting connections. */
    listening: boolean;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Modbus exception codes a handler can answer with.
 *
 * These are the wire-level codes from the Modbus application protocol
 * specification; the numeric values are fixed by the spec, not by us.
 */
export enum EnyoModbusServerExceptionCode {
    /** The function code is not supported for this address. */
    IllegalFunction = 1,
    /** The address is not registered, or not writable. */
    IllegalDataAddress = 2,
    /** The address is fine but the value is not acceptable. */
    IllegalDataValue = 3,
    /** The handler failed unrecoverably. The default for an unexpected throw. */
    ServerDeviceFailure = 4,
    /** The handler did not answer in time; the client should retry. */
    ServerDeviceBusy = 6,
}

/**
 * Throw this from a read or write handler to answer the client with a specific
 * {@link EnyoModbusServerExceptionCode}.
 *
 * Any other error thrown from a handler is reported as
 * {@link EnyoModbusServerExceptionCode.ServerDeviceFailure}, which is correct
 * but tells the client nothing. Prefer throwing this with
 * {@link EnyoModbusServerExceptionCode.IllegalDataValue} when rejecting a write,
 * so the client can distinguish "bad value" from "device broken".
 *
 * @example
 * ```typescript
 * onWrite: async (value) => {
 *     if (value < 0 || value > 10_000) {
 *         throw new EnyoModbusServerException(
 *             EnyoModbusServerExceptionCode.IllegalDataValue,
 *             `power limit ${value} W out of range`,
 *         );
 *     }
 *     await applyPowerLimit(value);
 * }
 * ```
 */
export class EnyoModbusServerException extends Error {
    /** The Modbus exception code sent to the client. */
    public readonly code: EnyoModbusServerExceptionCode;

    /**
     * @param code - The Modbus exception code to answer with.
     * @param message - Human-readable cause, for logs. Never sent to the client —
     *   Modbus exception responses carry a code and nothing else.
     */
    constructor(code: EnyoModbusServerExceptionCode, message?: string) {
        super(message ?? `Modbus exception ${code}`);
        this.name = 'EnyoModbusServerException';
        this.code = code;
    }
}

/**
 * Thrown by {@link EnergyAppModbusServer.registerRegister} and
 * {@link EnergyAppModbusServer.registerRegisters} when the requested address
 * range is already claimed.
 *
 * The server is shared and so is its unit id, which means **a conflict is not
 * necessarily your bug**: another installed app may hold the address. Check
 * {@link heldByCaller} before blaming your own register map. It follows that
 * registration can start failing across an update — an app installed after
 * yours can claim a range you have not taken yet — so handle this at runtime
 * rather than assuming a successful registration at startup.
 *
 * The error deliberately does not name the app holding the range: that would
 * expose which apps are installed on the hub across app boundaries.
 */
export class EnyoModbusServerRegistrationConflictError extends Error {
    /** The space of the attempted registration. */
    public readonly space: EnyoModbusServerRegisterSpace;
    /** The start address of the attempted registration. */
    public readonly address: number;
    /** How many words (or bits) the attempted registration wanted. */
    public readonly quantity: number;
    /**
     * True when the caller itself already holds part of the range — that case is
     * your own bug. False when another app holds it, which is not.
     */
    public readonly heldByCaller: boolean;

    /**
     * @param space - The space of the attempted registration.
     * @param address - The start address of the attempted registration.
     * @param quantity - How many words (or bits) it wanted.
     * @param heldByCaller - Whether the caller already holds part of the range.
     * @param message - Optional override for the generated message.
     */
    constructor(
        space: EnyoModbusServerRegisterSpace,
        address: number,
        quantity: number,
        heldByCaller: boolean,
        message?: string,
    ) {
        super(
            message ??
                `Modbus ${space} range ${address}..${address + quantity - 1} is already registered ` +
                    `by ${heldByCaller ? 'this app' : 'another app'}.`,
        );
        this.name = 'EnyoModbusServerRegistrationConflictError';
        this.space = space;
        this.address = address;
        this.quantity = quantity;
        this.heldByCaller = heldByCaller;
    }
}
