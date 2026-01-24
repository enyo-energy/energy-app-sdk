import type {EnyoApplianceName, EnyoApplianceTopology} from "../../types/enyo-appliance.js";

/**
 * Data Types for Modbus Register Configuration
 *
 * @description Supported data types for reading Modbus registers
 * - Numeric types: uint16, int16, uint32, int32, float32
 * - String type: string (requires length property in register config)
 */
export type EnergyAppModbusDataType = 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32' | 'string';

export interface EnergyAppModbusStateValueMapping<T> {
    value: number;
    mappedState: T;
}

/**
 * Register Configuration Interface
 *
 * @description Configuration for reading a Modbus register
 */
export interface EnergyAppModbusRegisterConfig<T> {
    /** Modbus register address */
    address: number;
    /** Data type of the register value */
    dataType: EnergyAppModbusDataType;
    /** For FIX2, FIX3 scaling (divide by 10^scale) - only applies to numeric types */
    scale?: number;
    /** Number of registers to read (auto-calculated from dataType if not provided) */
    quantity?: number;
    /** Whether this register is required for device operation */
    required?: boolean;
    /** For mapping numeric values to enum states (only applies to numeric types) */
    valueMapping?: EnergyAppModbusStateValueMapping<T>[];
}

// Generic Register Map for any device type
export interface EnergyAppRegisterMap {
    [key: string]: EnergyAppModbusRegisterConfig<any> | undefined;
}

// Connection Options
export interface EnergyAppModbusConnectionOptions {
    unitId?: number;
    port?: number;
    timeout?: number;
    retryAttempts?: number;
    retryDelayMs?: number;
}

// Base Configuration for all Modbus devices
export interface EnergyAppModbusDeviceConfig {
    name: EnyoApplianceName[];
    registers: EnergyAppRegisterMap;
    options?: EnergyAppModbusConnectionOptions & {
        topology?: EnyoApplianceTopology;
    };
}

// Register Read Result
export interface RegisterReadResult<T = any> {
    success: boolean;
    value?: T;
    error?: Error;
}

// Data Reading Interface
export interface IRegisterReader {
    readHoldingRegisters(startAddress: number, quantity: number): Promise<RegisterReadResult<Buffer>>;

    readInputRegisters?(startAddress: number, quantity: number): Promise<RegisterReadResult<Buffer>>;

    isHealthy(): boolean;
}

// Register Mapper Interface
export interface IRegisterMapper {
    readRegister<T, E>(reader: IRegisterReader, config: EnergyAppModbusRegisterConfig<E>): Promise<RegisterReadResult<T>>;

    readMultipleRegisters(reader: IRegisterReader, registerMap: EnergyAppRegisterMap): Promise<{ [key: string]: any }>;

    validateRegisterMap(registerMap: EnergyAppRegisterMap): { valid: boolean; errors: string[] };
}

/**
 * Data Type Converter Interface
 *
 * @description Interface for converting raw Modbus buffer data into appropriate JavaScript types
 */
export interface IDataTypeConverter {
    /**
     * Converts raw buffer data from Modbus registers into appropriate JavaScript types
     *
     * @param buffer - Raw buffer data from Modbus registers
     * @param dataType - The expected data type for conversion
     * @param scale - Optional scaling factor for numeric types (divide by 10^scale)
     * @param quantity - Required for string types, specifies the string length in characters
     */
    convertFromBuffer(buffer: Buffer, dataType: EnergyAppModbusDataType, scale?: number, quantity?: number): any;

    /**
     * Validates if a value is valid for the given data type
     *
     * @param value - The value to validate
     * @param dataType - The expected data type
     */
    isValidValue(value: any, dataType: EnergyAppModbusDataType): boolean;

    /**
     * Calculates the number of Modbus registers required for a given data type
     *
     * @param dataType - The data type to calculate register quantity for
     */
    getRegisterQuantity(dataType: EnergyAppModbusDataType): number;
}

// Connection Health Management
export interface IConnectionHealth {
    recordSuccess(): void;

    recordFailure(error: Error): void;

    isHealthy(): boolean;

    getConsecutiveFailures(): number;

    getLastError(): Error | undefined;
}

// Error types
export class EnergyAppModbusConfigurationError extends Error {
    constructor(message: string) {
        super(`Modbus Configuration Error: ${message}`);
        this.name = 'ModbusConfigurationError';
    }
}

export class EnergyAppModbusConnectionError extends Error {
    constructor(message: string, public readonly cause?: Error) {
        super(`Modbus Connection Error: ${message}`);
        this.name = 'ModbusConnectionError';
    }
}

export class EnergyAppModbusReadError extends Error {
    constructor(message: string, public readonly register?: number) {
        super(`Modbus Read Error: ${message}`);
        this.name = 'ModbusReadError';
    }
}