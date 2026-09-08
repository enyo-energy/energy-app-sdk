/**
 * Configuration options for establishing a Modbus connection.
 */
export interface ModbusOptions {
    /** Hostname or IP address of the Modbus server. If set as an array, we use the other hosts as fallbacks */
    host: string | string[];
    /** Port number for the Modbus connection (default: 502) */
    port?: number;
    /** Connection timeout in milliseconds */
    timeout?: number;
    /** Modbus unit identifier for the target device */
    unitId?: number;
    /** Whether to use TLS/SSL for the Modbus connection. Defaults to false (plain Modbus TCP). Set to true to enable Modbus Security (TLS, typically port 802). */
    useTls?: boolean;
    /**
     * PEM-encoded client certificate (or Buffer) presented for mutual-TLS Modbus Security
     * connections. Only used when {@link useTls} is true.
     */
    cert?: string | Buffer;
    /**
     * PEM-encoded private key (or Buffer) matching {@link cert} for mutual-TLS connections.
     * Only used when {@link useTls} is true.
     */
    key?: string | Buffer;
    /**
     * Trusted CA certificate(s) — a PEM string/Buffer, or an array of them — used to verify the
     * server's certificate. Only used when {@link useTls} is true.
     */
    ca?: string | Buffer | Array<string | Buffer>;
    /**
     * Whether to reject a TLS connection whose server certificate cannot be verified against
     * {@link ca}. When omitted, the transport's default verification behaviour is used. Only
     * used when {@link useTls} is true.
     */
    rejectUnauthorized?: boolean;
    /**
     * When `true`, requests are not run in parallel on this connection: consecutive Modbus
     * requests (reads and writes) are serialized through an internal operation chain and run
     * sequentially in call order, so a chain of messages cannot be interleaved with requests from
     * concurrent callers. Use this when a sequence of register operations must be applied
     * atomically relative to each other. Defaults to `false` (requests may execute concurrently).
     */
    noParallelRequests?: boolean;
    /**
     * Optional delay, in milliseconds, to wait between two consecutive requests. Only applies when
     * {@link noParallelRequests} is `true`; ignored otherwise. Useful for devices that need a short
     * recovery gap between messages. Defaults to `0` (no delay).
     */
    waitBetweenMessagesMs?: number;
    /** Per-operation (read/write) deadline in ms before the socket is recycled. Default 5000. */
    readTimeoutMs?: number;
    /** Recycle a socket that looks open but had no successful op within this window. Default 30000; 0 disables. */
    staleSocketMs?: number;
    /** TCP keepalive idle interval in ms on the live socket, so a dead peer surfaces fast. Default 10000; 0 disables. */
    keepAliveMs?: number;
    /**
     * When `true`, the connection is taken from a shared pool of sockets keyed by the target
     * device (host, port, unit id and transport settings) instead of opening a socket that belongs
     * exclusively to this caller. Pooling lets several parts of an app — or several `connect()`
     * calls for the same device — reuse one TCP connection, which matters for devices that accept
     * only a small number of simultaneous Modbus clients. A pooled instance's `disconnect()`
     * releases the connection back to the pool rather than necessarily closing the socket, and the
     * socket stays open while other users still hold it.
     *
     * Defaults to `true` (a dedicated connection per `connect()` call).
     */
    pooledConnection?: boolean;
}

/**
 * Interface for Modbus TCP/IP communication in enyo packages.
 * Provides comprehensive Modbus client functionality for reading and writing
 * coils, discrete inputs, holding registers, and input registers.
 */
export interface EnergyAppModbus {
    /** Establish connection to a Modbus server */
    connect: (options: ModbusOptions) => Promise<EnergyAppModbusInstance>;
}

export interface EnergyAppModbusInstance {
    /** Close the Modbus connection */
    disconnect: () => Promise<void>;
    /** Check if currently connected to a Modbus server */
    isConnected: () => boolean;

    /** Read coil values from the specified address range */
    readCoils: (address: number, quantity: number) => Promise<boolean[]>;
    /** Read discrete input values from the specified address range */
    readDiscreteInputs: (address: number, quantity: number) => Promise<boolean[]>;
    /** Read holding register values from the specified address range */
    readHoldingRegisters: (address: number, quantity: number) => Promise<Buffer>;
    /** Read input register values from the specified address range */
    readInputRegisters: (address: number, quantity: number) => Promise<Buffer>;

    /** Write a single coil value to the specified address */
    writeSingleCoil: (address: number, value: boolean) => Promise<void>;
    /** Write a single register value to the specified address */
    writeSingleRegister: (address: number, value: number) => Promise<void>;
    /** Write multiple coil values starting from the specified address */
    writeMultipleCoils: (address: number, values: boolean[]) => Promise<void>;
    /** Write multiple register values starting from the specified address */
    writeMultipleRegisters: (address: number, values: number[]) => Promise<void>;
    /** Read holding register string value */
    readRegisterStringValue: (address: number, quantity: number) => Promise<string>;

    /**
     * Sends one Modbus PDU verbatim on this connection and returns the raw response.
     *
     * This is the escape hatch for vendor function codes — the sub-commands a manufacturer
     * reserves for itself outside the eight standard codes, such as the installer login a
     * Huawei SUN2000 requires before it accepts a single control write. The transport owns
     * framing (MBAP header, transaction id, unit id) exactly as it does for every other
     * request; `payload` is put on the wire untouched and the response bytes come back
     * untouched.
     *
     * The call is queued on the same per-connection chain as the standard reads and writes,
     * so it honours {@link ModbusOptions.noParallelRequests} and
     * {@link ModbusOptions.waitBetweenMessagesMs} and can never be interleaved with a block
     * read that is already in flight.
     *
     * A device that answers with an exception resolves rather than rejects: the exception
     * code is data (see {@link ModbusRawPduResponse.exceptionCode}), because for a
     * permission probe "not allowed" is the expected answer and has to be distinguishable
     * from a timeout or a dropped socket. Only transport failures reject.
     *
     * Request payloads are never logged — a vendor handshake typically carries a credential
     * digest. Only the function code and the payload length appear in the logs.
     *
     * @param functionCode Modbus function code, 1…127. The exception space (`>= 0x80`) and
     *                     `0` are rejected; the eight standard codes are allowed but the
     *                     dedicated methods above are the better way to reach them.
     * @param payload      PDU bytes after the function code. At most
     *                     {@link MODBUS_MAX_PDU_PAYLOAD_BYTES} bytes, so the frame stays
     *                     within the 253-byte Modbus PDU limit. May be empty.
     * @param options      Optional per-call overrides.
     * @throws Error if the parameters are out of range, if the connection is gone, or if the
     *         device does not answer within the deadline.
     */
    sendRawPdu: (
        functionCode: number,
        payload: Buffer,
        options?: ModbusRawPduOptions,
    ) => Promise<ModbusRawPduResponse>;

    /**
     * Registers a listener that fires whenever the underlying socket for this unit has been
     * replaced — a reconnect after a dropped link, a recycled half-open socket, or a stale
     * socket torn down by the transport.
     *
     * This matters for anything the device tracks per connection rather than per device.
     * A vendor login, for instance, grants permission to the *socket* that authenticated:
     * once that socket is gone the permission is gone with it, silently — the next write
     * simply comes back with an exception. The listener is the point at which an app can
     * re-authenticate before the next command instead of after a failed one.
     *
     * The listener fires once per socket replacement, after the old socket is gone and
     * before the next operation is served. It is not called for the initial connect.
     * Listeners must not throw; a throwing listener is logged and ignored.
     *
     * @param listener Called with no arguments once per socket replacement.
     * @returns A function that removes the listener. Every listener is dropped automatically
     *          on {@link EnergyAppModbusInstance.disconnect}.
     */
    onReconnect: (listener: () => void) => () => void;

    /**
     * Monotonic counter of how many sockets this unit has been bound to, starting at `1` for
     * the first live socket.
     *
     * The pull-based counterpart to {@link EnergyAppModbusInstance.onReconnect}: read it
     * before and after an operation to tell whether connection-scoped state (a vendor login,
     * a session token) survived, without having to keep a listener alive. A value that
     * changed means the socket was replaced and anything scoped to it is void.
     *
     * Returns `0` while the instance has never had a live socket.
     */
    connectionGeneration: () => number;
}

/**
 * Per-call options for {@link EnergyAppModbusInstance.sendRawPdu}.
 */
export interface ModbusRawPduOptions {
    /**
     * Deadline for this single request in milliseconds. Defaults to the connection's
     * {@link ModbusOptions.readTimeoutMs}. As with every other operation, exceeding it is
     * treated as a dead link and recycles the socket.
     */
    timeoutMs?: number;
}

/**
 * The raw answer to a {@link EnergyAppModbusInstance.sendRawPdu} call.
 *
 * Both a normal response and a device-level exception arrive here; only transport failures
 * are thrown. Check {@link ModbusRawPduResponse.exceptionCode} first — it is `undefined`
 * exactly when the device accepted the request.
 */
export interface ModbusRawPduResponse {
    /**
     * The function code the device echoed. On an exception this is the requested code with
     * the high bit set (`functionCode | 0x80`), which is what the device actually put on the
     * wire.
     */
    functionCode: number;
    /**
     * The response bytes that followed the function code, with vendor framing intact.
     * Empty on an exception — the exception code is reported separately rather than left in
     * the payload.
     */
    payload: Buffer;
    /**
     * The device's exception code when it rejected the request, otherwise `undefined`.
     *
     * Standard Modbus defines `0x01`…`0x0B`, but vendors add their own — Huawei answers
     * `0x80` for "permission authentication failure or permission expiration" — so this is
     * the raw byte, passed through without validation against the standard set.
     */
    exceptionCode?: number;
}

/**
 * The largest payload {@link EnergyAppModbusInstance.sendRawPdu} accepts, in bytes.
 *
 * A Modbus PDU is capped at 253 bytes; one of those is the function code, leaving 252 for
 * the payload.
 */
export const MODBUS_MAX_PDU_PAYLOAD_BYTES = 252;

/**
 * Thrown when a Modbus device answered a request with an exception response — the device is
 * reachable and the frame was well-formed, it simply refused the operation.
 *
 * This is deliberately distinct from a transport failure. An app probing whether it is
 * allowed to write (write a register back its own value and see what happens) needs
 * "refused with code 0x80" to be reliably distinguishable from "timed out" or "socket
 * dropped", and a generic `Error` with the code buried in its message string is not a
 * contract anything can be built on.
 *
 * The socket is left intact when this is thrown: an exception response is a protocol answer,
 * not a broken link.
 *
 * Note that {@link EnergyAppModbusInstance.sendRawPdu} does *not* throw this — a raw PDU
 * reports its exception as data on {@link ModbusRawPduResponse.exceptionCode}, because there
 * the exception is frequently the expected outcome rather than a failure.
 *
 * @example
 * ```ts
 * try {
 *     await instance.writeSingleRegister(43006, currentValue);
 *     // The write landed — this connection may write.
 * } catch (error) {
 *     if (error instanceof ModbusExceptionError && error.exceptionCode === 0x80) {
 *         // Refused for lack of permission — a login is required.
 *     }
 *     throw error;
 * }
 * ```
 */
export class ModbusExceptionError extends Error {
    /**
     * @param exceptionCode The raw exception code the device answered with. Standard codes
     *                      are `0x01`…`0x0B`; vendor-specific codes are passed through
     *                      unvalidated.
     * @param functionCode  The function code of the request that was refused (the request's
     *                      own code, without the exception high bit).
     * @param message       Human-readable description, including the operation that failed.
     * @param address       The register or coil address involved, when the operation had
     *                      one.
     */
    constructor(
        public readonly exceptionCode: number,
        public readonly functionCode: number,
        message: string,
        public readonly address?: number,
    ) {
        super(message);
        this.name = 'ModbusExceptionError';
        // Restores the prototype chain so `instanceof` holds when this package is consumed
        // from code compiled down to ES5.
        Object.setPrototypeOf(this, ModbusExceptionError.prototype);
    }
}