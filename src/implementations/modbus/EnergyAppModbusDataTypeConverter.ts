import type {IDataTypeConverter, EnergyAppModbusDataType} from './interfaces.js';

export class EnergyAppModbusDataTypeConverter implements IDataTypeConverter {
    convertFromBuffer(buffer: Buffer, dataType: EnergyAppModbusDataType, scale?: number): any {
        let value: number;

        switch (dataType) {
            case 'uint16':
                value = buffer.readUInt16BE(0);
                break;
            case 'int16':
                value = buffer.readInt16BE(0);
                break;
            case 'uint32':
                value = buffer.readUInt32BE(0);
                break;
            case 'int32':
                value = buffer.readInt32BE(0);
                break;
            case 'float32':
                value = buffer.readFloatBE(0);
                break;
            default:
                throw new Error(`Unsupported data type: ${dataType}`);
        }

        // Apply scaling if provided (FIX2 = scale 2 = divide by 100)
        if (scale !== undefined && scale > 0) {
            value = value / Math.pow(10, scale);
        }

        return value;
    }

    isValidValue(value: any, dataType: EnergyAppModbusDataType): boolean {
        if (value === null || value === undefined || isNaN(value)) {
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