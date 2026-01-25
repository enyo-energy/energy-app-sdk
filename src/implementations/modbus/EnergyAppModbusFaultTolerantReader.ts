import type {EnergyAppModbusInstance} from "../../packages/energy-app-modbus.js";
import type {IRegisterReader, IConnectionHealth, RegisterReadResult, EnergyAppModbusDataType} from './interfaces.js';
import {EnergyAppModbusDataTypeConverter} from './EnergyAppModbusDataTypeConverter.js';

export class EnergyAppModbusFaultTolerantReader implements IRegisterReader {
    private readonly _modbusInstance: EnergyAppModbusInstance;
    private readonly _connectionHealth: IConnectionHealth;
    private readonly _converter: EnergyAppModbusDataTypeConverter;

    constructor(modbusInstance: EnergyAppModbusInstance, connectionHealth: IConnectionHealth) {
        this._modbusInstance = modbusInstance;
        this._connectionHealth = connectionHealth;
        this._converter = new EnergyAppModbusDataTypeConverter();
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

    /**
     * Reads holding registers with automatic type conversion
     *
     * @param address - Starting register address
     * @param dataType - The data type to convert to
     * @param options - Optional parameters for scaling and string length
     * @returns Register value converted to the specified type, or error
     */
    async readHoldingRegisterWithType<T = any>(
        address: number,
        dataType: EnergyAppModbusDataType,
        options?: {
            scale?: number;
            quantity?: number; // For strings: number of characters
        }
    ): Promise<RegisterReadResult<T>> {
        try {
            // Calculate register quantity based on data type
            let registerQuantity: number;

            if (dataType === 'string') {
                // For strings, quantity represents character count
                // Each register holds 2 ASCII characters
                if (!options?.quantity || options.quantity <= 0) {
                    throw new Error('String data type requires a valid quantity parameter (character count)');
                }
                registerQuantity = Math.ceil(options.quantity / 2);
            } else {
                // For numeric types, get register count from converter
                registerQuantity = this._converter.getRegisterQuantity(dataType);
            }

            // Read registers with fault tolerance
            const result = await this.readHoldingRegisters(address, registerQuantity);

            if (!result.success || !result.value) {
                return {
                    success: false,
                    error: result.error || new Error('Failed to read registers')
                };
            }

            // Convert buffer to appropriate type
            const convertedValue = this._converter.convertFromBuffer(
                result.value,
                dataType,
                options?.scale,
                options?.quantity
            );

            // Validate the converted value
            if (!this._converter.isValidValue(convertedValue, dataType)) {
                console.warn(
                    `Invalid value for ${dataType} at register ${address}: ${convertedValue}`
                );
            }

            return {
                success: true,
                value: convertedValue as T
            };
        } catch (error) {
            const err = error as Error;
            console.error(
                `Failed to read ${dataType} from register ${address}: ${err.message}`
            );

            return {
                success: false,
                error: err
            };
        }
    }

    /**
     * Convenience method for reading string values from holding registers
     *
     * @param address - Starting register address
     * @param length - String length in characters
     * @returns String value or error
     */
    async readString(
        address: number,
        length: number
    ): Promise<RegisterReadResult<string>> {
        return this.readHoldingRegisterWithType<string>(
            address,
            'string',
            { quantity: length }
        );
    }

    /**
     * Convenience method for reading numeric values from holding registers
     *
     * @param address - Starting register address
     * @param dataType - Numeric data type (uint16, int16, uint32, int32, float32)
     * @param scale - Optional scaling factor (divide by 10^scale)
     * @returns Numeric value or error
     */
    async readNumeric(
        address: number,
        dataType: Exclude<EnergyAppModbusDataType, 'string'>,
        scale?: number
    ): Promise<RegisterReadResult<number>> {
        return this.readHoldingRegisterWithType<number>(
            address,
            dataType,
            { scale }
        );
    }
}