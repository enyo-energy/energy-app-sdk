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
}