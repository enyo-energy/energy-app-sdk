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
 * Request parameters for reading Modbus RTU registers.
 */
export interface ModbusRtuReadRegistersRequest {
    /** Slave ID of the target device on the serial bus */
    slaveId: number;
    /** Starting register address to read from */
    startRegister: number;
    /** Number of consecutive registers to read */
    count: number;
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
    /** Read register values from the connected Modbus RTU device */
    readRegisters: (request: ModbusRtuReadRegistersRequest) => Promise<ModbusRtuReadRegistersResponse>;
    /** Write register values to the connected Modbus RTU device */
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
