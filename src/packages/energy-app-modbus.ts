/**
 * Configuration options for establishing a Modbus connection.
 */
export interface ModbusOptions {
    /** Hostname or IP address of the Modbus server */
    host: string;
    /** Port number for the Modbus connection (default: 502) */
    port?: number;
    /** Connection timeout in milliseconds */
    timeout?: number;
    /** Modbus unit identifier for the target device */
    unitId?: number;
}

/**
 * Interface for Modbus TCP/IP communication in HEMS one packages.
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