# Advanced Modbus - Vendor-Agnostic Modbus Integration

A configurable, vendor-agnostic Modbus library for energy management systems. Supports any Modbus device through configuration without code changes.

## ✨ Features

- **Vendor Agnostic** - Works with SMA, Fronius, Huawei, or any Modbus device via configuration
- **Type Safe** - Full TypeScript support with proper DataBus message types
- **Configurable** - Register addresses, data types, scaling all configurable
- **Fault Tolerant** - Built-in connection health monitoring and retry logic
- **Modular** - Clean separation between inverters, batteries, and meters
- **Easy to Use** - Simple constructor-based configuration

## 🚀 Quick Start

### Basic Usage (as requested by user)

```typescript
import { ModbusInverter, ModbusBattery } from './advanced-modbus';

// Create configurable inverter
const modbusInverter = new ModbusInverter(client, {
    name: [{ language: 'en', name: 'XYZ Vendor Inverter' }],
    registers: {
        serialNumber: {
            address: 400001,
            dataType: 'uint16'
        },
        power: {
            address: 400010,
            dataType: 'int32',
            required: true
        },
        voltage: {
            address: 400020,
            dataType: 'uint32',
            scale: 2
        }
    },
    options: {
        topology: {},
        unitId: 1,
        timeout: 5000
    }
});

// Create battery with inverter dependency
const modbusBattery = new ModbusBattery(client, {
    inverter: modbusInverter,
    name: [{ language: 'en', name: 'XYZ Vendor Battery' }],
    registers: {
        soc: {
            address: 400001,
            dataType: 'uint16',
            required: true
        },
        current: {
            address: 400005,
            dataType: 'int16',
            scale: 1
        }
    },
    options: {}
});

// Connect and start data collection
await modbusInverter.connect();
await modbusBattery.connect();

// Fetch data (returns proper DataBus messages)
const inverterData = await modbusInverter.updateData();
const batteryData = await modbusBattery.updateData();
```

### SMA Configuration (Built-in)

```typescript
import { createSMAInverterConfig, createSMABatteryConfig } from './configs/SMAConfigurations';

const smaInverter = new ModbusInverter(
    dependencies,
    createSMAInverterConfig('SMA Sunny Tripower'),
    networkDevice
);

const smaBattery = new ModbusBattery(
    dependencies,
    createSMABatteryConfig('SMA Battery', smaInverter)
);
```

## 📊 Supported Data Types

- `uint16` - 16-bit unsigned integer (1 register)
- `int16` - 16-bit signed integer (1 register)
- `uint32` - 32-bit unsigned integer (2 registers)
- `int32` - 32-bit signed integer (2 registers)
- `float32` - 32-bit float (2 registers)

## ⚙️ Register Configuration

```typescript
interface RegisterConfig {
    address: number;                    // Modbus register address
    dataType: ModbusDataType;          // Data type
    scale?: number;                    // Scaling factor (FIX2 = scale 2)
    quantity?: number;                 // Number of registers (auto-calculated)
    required?: boolean;                // Whether register is required
}
```

## 🔄 DataBus Integration

Uses proper typed DataBus messages:
- `HemsOneDataBusInverterValuesV1` - Inverter data
- `HemsOneDataBusBatteryValuesUpdateV1` - Battery data
- `HemsOneDataBusMeterValuesUpdateV1` - Meter data

All messages include `timestampIso` and proper message types for seamless integration.

## 🏭 Vendor Examples

### Fronius
```typescript
const forniusConfig: ModbusInverterConfig = {
    name: [{ language: 'en', name: 'Fronius Inverter' }],
    registers: {
        power: { address: 40083, dataType: 'float32', required: true },
        voltage: { address: 40085, dataType: 'float32' }
    },
    options: { unitId: 1 }
};
```

### Huawei
```typescript
const huaweiConfig: ModbusInverterConfig = {
    name: [{ language: 'en', name: 'Huawei Inverter' }],
    registers: {
        power: { address: 32080, dataType: 'int32', scale: 3, required: true },
        voltage: { address: 32069, dataType: 'uint16', scale: 1 }
    },
    options: { unitId: 1 }
};
```

## 🛠️ Error Handling

- **ModbusConfigurationError** - Invalid configuration
- **ModbusConnectionError** - Connection failures
- **ModbusReadError** - Register read failures

All errors include context and can be handled gracefully.

## 🏗️ Architecture

- **interfaces.ts** - All types and interfaces in single file
- **ModbusInverter** - Configurable inverter implementation
- **ModbusBattery** - Battery with inverter dependency
- **ModbusMeter** - Standalone meter implementation
- **RegisterMapper** - Configuration-driven register access
- **DataTypeConverter** - Vendor-agnostic data handling
- **configs/** - Pre-built vendor configurations