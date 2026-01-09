import type {EnergyApp} from "../../index.js";
import type {HemsOneNetworkDevice} from "../../types/hems-one-network-device.js";
import type {HemsOneAppliance, HemsOneApplianceName, HemsOneApplianceTopology} from "../../types/hems-one-appliance.js";
import {HemsOneBatteryStateEnum, HemsOneDataBusMessage, HemsOneInverterStateEnum} from "../../types/hems-one-data-bus-value.js";

// Data Types for Modbus Register Configuration
export type EnergyAppModbusDataType = 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32';

// Value mapping for battery state registers
export interface EnergyAppBatteryStateValueMapping {
    value: number;
    mappedState: HemsOneBatteryStateEnum;
}

// Value mapping for inverter state registers
export interface EnergyAppInverterStateValueMapping {
    value: number;
    mappedState: HemsOneInverterStateEnum;
}

// Register Configuration Interface
export interface EnergyAppModbusRegisterConfig {
    address: number;
    dataType: EnergyAppModbusDataType;
    scale?: number; // For FIX2, FIX3 scaling (divide by 10^scale)
    quantity?: number; // Number of registers to read (auto-calculated from dataType if not provided)
    required?: boolean; // Whether this register is required for device operation
    valueMapping?: EnergyAppBatteryStateValueMapping[] | EnergyAppInverterStateValueMapping[]; // For mapping numeric values to enum states
}

// Generic Register Map for any device type
export interface EnergyAppRegisterMap {
    [key: string]: EnergyAppModbusRegisterConfig | undefined;
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
    name: HemsOneApplianceName[];
    registers: EnergyAppRegisterMap;
    options?: EnergyAppModbusConnectionOptions & {
        topology?: HemsOneApplianceTopology;
    };
}

// Specific Configurations for each device type
export interface EnergyAppModbusInverterConfig extends EnergyAppModbusDeviceConfig {
    registers: {
        serialNumber?: EnergyAppModbusRegisterConfig;
        power?: EnergyAppModbusRegisterConfig;
        voltageL1?: EnergyAppModbusRegisterConfig;
        voltageL2?: EnergyAppModbusRegisterConfig;
        voltageL3?: EnergyAppModbusRegisterConfig;
        current?: EnergyAppModbusRegisterConfig;
        frequency?: EnergyAppModbusRegisterConfig;
        totalEnergy?: EnergyAppModbusRegisterConfig;
        dailyEnergy?: EnergyAppModbusRegisterConfig;
        maxPvProductionW?: EnergyAppModbusRegisterConfig; // Maximum PV production in W
        state?: EnergyAppModbusRegisterConfig; // Inverter state (off, sleeping, mppt, etc.)
        activePowerLimitationW?: EnergyAppModbusRegisterConfig; // Active power limitation in W
        [key: string]: EnergyAppModbusRegisterConfig | undefined;
    };
}

export interface EnergyAppModbusBatteryConfig extends EnergyAppModbusDeviceConfig {
    inverter?: IEnergyAppModbusInverter; // Reference to parent inverter
    registers: {
        current?: EnergyAppModbusRegisterConfig;
        voltage?: EnergyAppModbusRegisterConfig;
        soc?: EnergyAppModbusRegisterConfig; // State of Charge
        power?: EnergyAppModbusRegisterConfig;
        temperature?: EnergyAppModbusRegisterConfig;
        state?: EnergyAppModbusRegisterConfig; // Battery state (charging, discharging, etc.)
        maxCapacityWh?: EnergyAppModbusRegisterConfig; // Maximum battery capacity in Wh
        maxDischargePowerW?: EnergyAppModbusRegisterConfig; // Maximum discharge power in W
        maxChargingPowerW?: EnergyAppModbusRegisterConfig; // Maximum charging power in W
        [key: string]: EnergyAppModbusRegisterConfig | undefined;
    };
}

export interface EnergyAppModbusMeterConfig extends EnergyAppModbusDeviceConfig {
    registers: {
        gridPower?: EnergyAppModbusRegisterConfig;
        gridFeedInPower?: EnergyAppModbusRegisterConfig;
        gridConsumptionPower?: EnergyAppModbusRegisterConfig;
        gridFeedInEnergy?: EnergyAppModbusRegisterConfig;
        gridConsumptionEnergy?: EnergyAppModbusRegisterConfig;
        [key: string]: EnergyAppModbusRegisterConfig | undefined;
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
    readRegister<T>(reader: IRegisterReader, config: EnergyAppModbusRegisterConfig): Promise<RegisterReadResult<T>>;

    readMultipleRegisters(reader: IRegisterReader, registerMap: EnergyAppRegisterMap): Promise<{ [key: string]: any }>;

    validateRegisterMap(registerMap: EnergyAppRegisterMap): { valid: boolean; errors: string[] };
}

// Data Type Converter Interface
export interface IDataTypeConverter {
    convertFromBuffer(buffer: Buffer, dataType: EnergyAppModbusDataType, scale?: number): any;

    isValidValue(value: any, dataType: EnergyAppModbusDataType): boolean;

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

// Main Modbus Device Interfaces
export interface EnergyAppModbusDevice {
    readonly client: EnergyApp;
    readonly config: EnergyAppModbusDeviceConfig;
    readonly appliance: HemsOneAppliance;
    readonly networkDevice: HemsOneNetworkDevice;

    connect(): Promise<void>;

    disconnect(): Promise<void>;

    isConnected(): boolean;

    updateData(): Promise<HemsOneDataBusMessage[]>;
}

// Forward declarations for device classes
export interface IEnergyAppModbusInverter extends EnergyAppModbusDevice {
    readonly config: EnergyAppModbusInverterConfig;

    getSerialNumber(): Promise<string | null>;

    getCurrentPower(): Promise<number | null>;

    getTotalEnergy(): Promise<number | null>;
}

export interface IEnergyAppModbusBattery extends EnergyAppModbusDevice {
    readonly config: EnergyAppModbusBatteryConfig;
    readonly inverter?: IEnergyAppModbusInverter;

    getSoc(): Promise<number | null>;

    getCurrent(): Promise<number | null>;

    getPower(): Promise<number | null>;
}

export interface IEnergyAppModbusMeter extends EnergyAppModbusDevice {
    readonly config: EnergyAppModbusMeterConfig;

    getGridPower(): Promise<number | null>;

    getGridFeedInEnergy(): Promise<number | null>;

    getGridConsumptionEnergy(): Promise<number | null>;
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