export interface ModbusOptions {
    host: string;
    port?: number;
    timeout?: number;
    unitId?: number;
}

export interface ModbusRegisterData {
    address: number;
    value: number | number[];
}

export interface ModbusCoilData {
    address: number;
    value: boolean | boolean[];
}

export interface ConnectModbus {
    connect: (options: ModbusOptions) => Promise<void>;
    disconnect: () => Promise<void>;
    isConnected: () => boolean;

    // Read operations
    readCoils: (address: number, quantity: number) => Promise<boolean[]>;
    readDiscreteInputs: (address: number, quantity: number) => Promise<boolean[]>;
    readHoldingRegisters: (address: number, quantity: number) => Promise<number[]>;
    readInputRegisters: (address: number, quantity: number) => Promise<number[]>;

    // Write operations
    writeSingleCoil: (address: number, value: boolean) => Promise<void>;
    writeSingleRegister: (address: number, value: number) => Promise<void>;
    writeMultipleCoils: (address: number, values: boolean[]) => Promise<void>;
    writeMultipleRegisters: (address: number, values: number[]) => Promise<void>;
}