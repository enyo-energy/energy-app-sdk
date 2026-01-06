import type {EnergyAppModbusInstance} from "../../packages/energy-app-modbus.js";
import type {IRegisterReader, IConnectionHealth, RegisterReadResult} from './interfaces.js';

export class EnergyAppModbusFaultTolerantReader implements IRegisterReader {
    private readonly _modbusInstance: EnergyAppModbusInstance;
    private readonly _connectionHealth: IConnectionHealth;

    constructor(modbusInstance: EnergyAppModbusInstance, connectionHealth: IConnectionHealth) {
        this._modbusInstance = modbusInstance;
        this._connectionHealth = connectionHealth;
    }

    async readHoldingRegisters(startAddress: number, quantity: number): Promise<RegisterReadResult<Buffer>> {
        try {
            const result = await this._modbusInstance.readHoldingRegisters(startAddress, quantity);
            this._connectionHealth.recordSuccess();

            return {
                success: true,
                value: result
            };
        } catch (error) {
            const err = error as Error;
            this._connectionHealth.recordFailure(err);

            console.warn(
                `Failed to read registers ${startAddress}-${startAddress + quantity - 1}: ${err.message} ` +
                `(consecutive failures: ${this._connectionHealth.getConsecutiveFailures()})`
            );

            return {
                success: false,
                error: err
            };
        }
    }

    async readInputRegisters(startAddress: number, quantity: number): Promise<RegisterReadResult<Buffer>> {
        try {
            // Note: This would need to be implemented in the SDK if input registers are needed
            throw new Error('Input registers not supported by current SDK');
        } catch (error) {
            const err = error as Error;
            this._connectionHealth.recordFailure(err);

            return {
                success: false,
                error: err
            };
        }
    }

    isHealthy(): boolean {
        return this._connectionHealth.isHealthy();
    }
}