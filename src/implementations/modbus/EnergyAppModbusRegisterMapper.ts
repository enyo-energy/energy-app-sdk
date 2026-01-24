import {
    EnergyAppModbusReadError,
    type EnergyAppModbusRegisterConfig,
    type EnergyAppRegisterMap,
    type IDataTypeConverter,
    type IRegisterMapper,
    type IRegisterReader,
    type RegisterReadResult
} from './interfaces.js';
import {EnergyAppModbusDataTypeConverter} from './EnergyAppModbusDataTypeConverter.js';

export class EnergyAppModbusRegisterMapper implements IRegisterMapper {
    private readonly dataTypeConverter: IDataTypeConverter;

    constructor(dataTypeConverter?: IDataTypeConverter) {
        this.dataTypeConverter = dataTypeConverter || new EnergyAppModbusDataTypeConverter();
    }

    async readRegister<T, E>(reader: IRegisterReader, config: EnergyAppModbusRegisterConfig<E>): Promise<RegisterReadResult<T>> {
        try {
            // Calculate quantity if not provided
            const quantity = config.quantity || this.dataTypeConverter.getRegisterQuantity(config.dataType);

            const result = await reader.readHoldingRegisters(config.address, quantity);

            if (!result.success || !result.value) {
                return {
                    success: false,
                    error: new EnergyAppModbusReadError(
                        `Failed to read register ${config.address}: ${result.error?.message || 'Unknown error'}`,
                        config.address
                    )
                };
            }

            const convertedValue = this.dataTypeConverter.convertFromBuffer(
                result.value,
                config.dataType,
                config.scale,
                config.quantity
            );

            // Validate the converted value
            if (!this.dataTypeConverter.isValidValue(convertedValue, config.dataType)) {
                return {
                    success: false,
                    error: new EnergyAppModbusReadError(
                        `Invalid value 0x${convertedValue.toString(16)} for register ${config.address}`,
                        config.address
                    )
                };
            }

            return {
                success: true,
                value: convertedValue as T
            };
        } catch (error) {
            return {
                success: false,
                error: new EnergyAppModbusReadError(
                    `Error reading register ${config.address}: ${(error as Error).message}`,
                    config.address
                )
            };
        }
    }

    async readMultipleRegisters(reader: IRegisterReader, registerMap: EnergyAppRegisterMap): Promise<{
        [key: string]: any
    }> {
        const results: { [key: string]: any } = {};
        const failures: string[] = [];

        // Read all registers
        for (const [name, config] of Object.entries(registerMap)) {
            if (!config) {
                continue;
            }
            const result = await this.readRegister(reader, config);

            if (result.success) {
                results[name] = result.value;
            } else {
                // Check if this register was required
                if (config.required) {
                    failures.push(`${name} (${config.address})`);
                }
                console.warn(`Failed to read register ${name} (${config.address}): ${result.error?.message}`);
            }
        }

        // If any required registers failed, log warning
        if (failures.length > 0) {
            console.warn(`Failed to read required registers: ${failures.join(', ')}`);
        }

        return results;
    }

    validateRegisterMap(registerMap: EnergyAppRegisterMap): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        for (const [name, config] of Object.entries(registerMap)) {
            if (!config) {
                continue;
            }
            // Validate address
            if (!Number.isInteger(config.address) || config.address < 1) {
                errors.push(`Invalid address for register '${name}': ${config.address}`);
            }

            // Validate data type
            const validDataTypes = ['uint16', 'int16', 'uint32', 'int32', 'float32', 'string'];
            if (!validDataTypes.includes(config.dataType)) {
                errors.push(`Invalid data type for register '${name}': ${config.dataType}`);
            }

            // Validate scale
            if (config.scale !== undefined && (!Number.isInteger(config.scale) || config.scale < 0)) {
                errors.push(`Invalid scale for register '${name}': ${config.scale}`);
            }

            // Validate quantity
            if (config.quantity !== undefined && (!Number.isInteger(config.quantity) || config.quantity < 1)) {
                errors.push(`Invalid quantity for register '${name}': ${config.quantity}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}