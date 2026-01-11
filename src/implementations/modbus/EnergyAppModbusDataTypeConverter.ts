import type {IDataTypeConverter, EnergyAppModbusDataType, EnergyAppModbusRegisterConfig} from './interfaces.js';

/**
 * Data Type Converter for Modbus Register Values
 *
 * @description Converts raw buffer data from Modbus registers into appropriate JavaScript types
 */
export class EnergyAppModbusDataTypeConverter implements IDataTypeConverter {
    /**
     * Converts raw buffer data from Modbus registers into appropriate JavaScript types
     *
     * @param buffer - Raw buffer data from Modbus registers
     * @param dataType - The expected data type for conversion
     * @param scale - Optional scaling factor for numeric types (divide by 10^scale)
     * @param quantity - Required for string types, specifies the string length in characters
     * @returns Converted value (number for numeric types, string for string type)
     */
    convertFromBuffer(buffer: Buffer, dataType: EnergyAppModbusDataType, scale?: number, quantity?: number): any {
        try {
            switch (dataType) {
                case 'uint16': {
                    const value = buffer.readUInt16BE(0);
                    return this.applyScale(value, scale);
                }
                case 'int16': {
                    const value = buffer.readInt16BE(0);
                    return this.applyScale(value, scale);
                }
                case 'uint32': {
                    const value = buffer.readUInt32BE(0);
                    return this.applyScale(value, scale);
                }
                case 'int32': {
                    const value = buffer.readInt32BE(0);
                    return this.applyScale(value, scale);
                }
                case 'float32': {
                    const value = buffer.readFloatBE(0);
                    return this.applyScale(value, scale);
                }
                case 'string': {
                    if (!quantity || quantity <= 0) {
                        throw new Error('String data type requires a valid quantity parameter');
                    }
                    // Convert buffer to string, handling null termination and trimming whitespace
                    return buffer.toString('ascii', 0, Math.min(buffer.length, quantity * 2))
                        .replace(/\u0000/gmi, '') // Remove null terminators
                        .trim(); // Remove leading/trailing whitespace
                }
                default:
                    throw new Error(`Unsupported data type: ${dataType}`);
            }
        } catch (error) {
            console.error(`Failed to convert Buffer (length ${buffer.length}) to ${dataType}: ${error}`, error)
            throw error
        }
    }

    /**
     * Applies scaling to numeric values
     *
     * @param value - The numeric value to scale
     * @param scale - Optional scaling factor (divide by 10^scale)
     * @returns Scaled value or original value if no scale provided
     */
    private applyScale(value: number, scale?: number): number {
        if (scale !== undefined && scale > 0) {
            return value / Math.pow(10, scale);
        }
        return value;
    }

    /**
     * Validates if a value is valid for the given data type
     *
     * @param value - The value to validate
     * @param dataType - The expected data type
     * @returns True if the value is valid, false otherwise
     */
    isValidValue(value: any, dataType: EnergyAppModbusDataType): boolean {
        if (value === null || value === undefined) {
            return false;
        }

        switch (dataType) {
            case 'string': {
                // For strings, check if it's a valid string and not empty
                return typeof value === 'string' && value.length > 0;
            }
            case 'uint16':
            case 'int16':
            case 'uint32':
            case 'int32':
            case 'float32': {
                // For numeric types, check if it's a valid number and not a common NaN value
                if (typeof value !== 'number' || isNaN(value)) {
                    return false;
                }

                // Check for common NaN values used in Modbus devices
                const nanValues = [0x8000, 0xFFFF, 0x80000000, 0xFFFFFFFF];

                // For signed values, also check negative NaN indicators
                if (dataType === 'int16' || dataType === 'int32') {
                    nanValues.push(-32768, -2147483648);
                }

                return !nanValues.includes(value);
            }
            default:
                return false;
        }
    }

    /**
     * Calculates the number of Modbus registers required for a given data type
     *
     * @param dataType - The data type to calculate register quantity for
     * @returns Number of 16-bit registers required
     */
    getRegisterQuantity(dataType: EnergyAppModbusDataType): number {
        switch (dataType) {
            case 'uint16':
            case 'int16':
                return 1;
            case 'uint32':
            case 'int32':
            case 'float32':
                return 2;
            default:
                throw new Error(`Unsupported data type: ${dataType}`);
        }
    }
}