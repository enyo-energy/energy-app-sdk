/**
 * Configuration options for establishing a Modbus RTU serial connection.
 */
export interface ModbusRtuOptions {
    /** Baud rate for serial communication (default: 9600) */
    baudRate?: number;
    /** Number of data bits per character (default: 8) */
    dataBits?: number;
    /** Number of stop bits (default: 1) */
    stopBits?: number;
    /** Parity mode for error detection (default: 'none') */
    parity?: 'none' | 'even' | 'odd';
    /** Connection timeout in milliseconds */
    timeout?: number;
    /**
     * When `true`, requests are not run in parallel on this connection: consecutive requests
     * ({@link EnergyAppModbusRtuInstance.readRegisters} / {@link EnergyAppModbusRtuInstance.writeRegisters})
     * are serialized through an internal operation chain and run sequentially in call order, so a
     * chain of messages cannot be interleaved with requests from concurrent callers. This is
     * especially relevant on RTU, where the serial line is half-duplex and shared across every
     * slave ID on the bus. Defaults to `false` (requests may execute concurrently).
     */
    noParallelRequests?: boolean;
    /**
     * Optional delay, in milliseconds, to wait between two consecutive requests. Only applies when
     * {@link noParallelRequests} is `true`; ignored otherwise. A short inter-message gap is often
     * required by slower RTU slaves to avoid dropped frames. Defaults to `0` (no delay).
     */
    waitBetweenMessagesMs?: number;
}

/**
 * Which register bank an RTU read addresses, and therefore which Modbus
 * function code goes on the wire.
 *
 * Holding and input registers are two separate address spaces: a device may
 * answer register 30001 as an input register and hold something entirely
 * different — or nothing at all — at the same address in the holding bank.
 * Reading the wrong bank yields an illegal-data-address exception, not a
 * timeout, so this is a correctness knob rather than a recovery one.
 */
export type ModbusRtuRegisterType =
    /** Holding registers, read with function code 3 (`mbpoll -t 4`). */
    | 'holding'
    /** Input registers, read with function code 4 (`mbpoll -t 3`). */
    | 'input';

/**
 * Request parameters for reading Modbus RTU registers.
 */
export interface ModbusRtuReadRegistersRequest {
    /** Slave ID of the target device on the serial bus */
    slaveId: number;
    /** Starting register address to read from */
    startRegister: number;
    /** Number of consecutive registers to read */
    count: number;
    /**
     * Which register bank to read from.
     *
     * `'holding'` issues function code 3 and `'input'` issues function code 4.
     * Defaults to `'holding'` when omitted, which is what every existing caller
     * gets today.
     */
    registerType?: ModbusRtuRegisterType;
}

/**
 * Response containing register values read from a Modbus RTU device.
 * Values are returned as a map of register address to value.
 */
export interface ModbusRtuReadRegistersResponse {
    /** Map of register address to its numeric value */
    values: Record<number, number>;
}

/**
 * Request parameters for writing values to Modbus RTU registers.
 */
export interface ModbusRtuWriteRegistersRequest {
    /** Slave ID of the target device on the serial bus */
    slaveId: number;
    /** Starting register address to write to */
    startRegister: number;
    /** Array of values to write to consecutive registers */
    values: number[];
}

/**
 * Interface representing an active Modbus RTU connection instance.
 * Provides methods for reading and writing registers over a serial connection.
 */
export interface EnergyAppModbusRtuInstance {
    /**
     * Read register values from the connected Modbus RTU device.
     *
     * Reads holding registers (function code 3) unless the request sets
     * {@link ModbusRtuReadRegistersRequest.registerType} to `'input'`, which
     * reads input registers with function code 4 instead.
     */
    readRegisters: (request: ModbusRtuReadRegistersRequest) => Promise<ModbusRtuReadRegistersResponse>;
    /** Write register values to the connected Modbus RTU device (holding registers only) */
    writeRegisters: (request: ModbusRtuWriteRegistersRequest) => Promise<void>;
}

/**
 * Interface for Modbus RTU serial communication in enyo packages.
 * Provides serial-based Modbus communication using slave IDs and register addressing.
 */
export interface EnergyAppModbusRtu {
    /** Establish a Modbus RTU connection over a serial port */
    connect: (options: ModbusRtuOptions) => Promise<EnergyAppModbusRtuInstance>;
}
