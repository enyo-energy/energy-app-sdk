# enyo Energy App SDK

This is the official TypeScript Energy App SDK for enyo. If you want to build your own Energy App to publish it on the enyo Hub, this is the package you need!

## Installation

You can install the package using npm:
```bash
npm install @enyo/energy-app-sdk
```

Take a look on our CLI to init a project and publish a new Energy App easily.

## Usage

Here's a basic example of how to use the client:

```typescript
import { EnergyApp } from '@enyo/energy-app-sdk';

const energyAppInstance = new EnergyApp();

energyAppInstance.register((packageName: string, version: number) => {
    console.log(`network state is ${client.isOnline() ? 'online' : 'offline'}. Package ${packageName} version ${version} is registered.`);
    // This starts you Energy App, do all the things in here!

});
```

## Advanced Modbus Integration

The SDK includes a powerful, vendor-agnostic Modbus implementation for energy management systems. This allows you to connect to any Modbus-enabled device through configuration without code changes.

### ✨ Features

- **Vendor Agnostic** - Works with SMA, Fronius, Huawei, or any Modbus device via configuration
- **Type Safe** - Full TypeScript support with proper DataBus message types
- **Configurable** - Register addresses, data types, scaling all configurable
- **Fault Tolerant** - Built-in connection health monitoring and retry logic
- **Modular** - Clean separation between inverters, batteries, and meters

### 🚀 Quick Start

#### Basic Modbus Setup

```typescript
import { EnergyApp } from '@enyo/energy-app-sdk';
import {
    EnergyAppModbusInverter,
    EnergyAppModbusBattery,
    EnergyAppModbusMeter
} from '@enyo/energy-app-sdk';

const energyApp = new EnergyApp();
const dependencies = { client: energyApp, randomUUID: () => crypto.randomUUID() };

// Network device configuration
const networkDevice = {
    id: 'device-1',
    hostname: '192.168.1.100',
    // ... other network device properties
};

// Create configurable inverter
const modbusInverter = new EnergyAppModbusInverter(dependencies, {
    name: [{ language: 'en', name: 'Solar Inverter' }],
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
        voltageL1: {
            address: 400020,
            dataType: 'uint32',
            scale: 2
        },
        totalEnergy: {
            address: 400030,
            dataType: 'uint32'
        }
    },
    options: {
        unitId: 1,
        timeout: 5000
    }
}, networkDevice);

// Create battery with inverter dependency
const modbusBattery = new EnergyAppModbusBattery(dependencies, {
    inverter: modbusInverter,
    name: [{ language: 'en', name: 'Battery Storage' }],
    registers: {
        soc: {
            address: 500001,
            dataType: 'uint16',
            required: true
        },
        current: {
            address: 500005,
            dataType: 'int16',
            scale: 1
        },
        voltage: {
            address: 500010,
            dataType: 'uint16',
            scale: 1
        }
    },
    options: {}
});

// Create standalone meter
const modbusMeter = new EnergyAppModbusMeter(dependencies, {
    name: [{ language: 'en', name: 'Grid Meter' }],
    registers: {
        gridPower: {
            address: 600001,
            dataType: 'int32',
            required: true
        },
        gridFeedInEnergy: {
            address: 600010,
            dataType: 'uint32'
        },
        gridConsumptionEnergy: {
            address: 600020,
            dataType: 'uint32'
        }
    },
    options: {
        unitId: 2
    }
}, networkDevice);

// Connect and start data collection
await modbusInverter.connect();
await modbusBattery.connect();
await modbusMeter.connect();

// Fetch data (returns proper DataBus messages)
const inverterData = await modbusInverter.updateData();
const batteryData = await modbusBattery.updateData();
const meterData = await modbusMeter.updateData();
```

### 📊 Supported Data Types

- `uint16` - 16-bit unsigned integer (1 register)
- `int16` - 16-bit signed integer (1 register)
- `uint32` - 32-bit unsigned integer (2 registers)
- `int32` - 32-bit signed integer (2 registers)
- `float32` - 32-bit float (2 registers)

### ⚙️ Register Configuration

```typescript
interface EnergyAppModbusRegisterConfig {
    address: number;                    // Modbus register address
    dataType: EnergyAppModbusDataType;  // Data type
    scale?: number;                     // Scaling factor (FIX2 = scale 2)
    quantity?: number;                  // Number of registers (auto-calculated)
    required?: boolean;                 // Whether register is required
}
```

### 🔄 DataBus Integration

The Modbus implementation seamlessly integrates with the enyo DataBus using typed messages:

- `EnyoDataBusInverterValuesV1` - Inverter data messages
- `EnyoDataBusBatteryValuesUpdateV1` - Battery data messages
- `EnyoDataBusMeterValuesUpdateV1` - Meter data messages

All messages include proper timestamps and message types for seamless integration with the enyo platform.

### 🛠️ Error Handling

The implementation provides comprehensive error handling with specific error types:

- **EnergyAppModbusConfigurationError** - Invalid configuration parameters
- **EnergyAppModbusConnectionError** - Connection and communication failures
- **EnergyAppModbusReadError** - Register read failures with context

```typescript
try {
    await modbusInverter.connect();
    const data = await modbusInverter.updateData();
} catch (error) {
    if (error instanceof EnergyAppModbusConnectionError) {
        console.error('Connection failed:', error.message);
        // Handle connection issues
    } else if (error instanceof EnergyAppModbusConfigurationError) {
        console.error('Configuration error:', error.message);
        // Fix configuration issues
    }
}
```

### 🏗️ Architecture

The Modbus implementation follows a clean, modular architecture:

- **EnergyAppModbusInverter** - Configurable inverter implementation
- **EnergyAppModbusBattery** - Battery with inverter dependency support
- **EnergyAppModbusMeter** - Standalone meter implementation
- **EnergyAppModbusRegisterMapper** - Configuration-driven register access
- **EnergyAppModbusDataTypeConverter** - Vendor-agnostic data handling
- **EnergyAppModbusFaultTolerantReader** - Fault-tolerant communication layer
- **EnergyAppModbusConnectionHealth** - Connection health monitoring

This modular design ensures maintainability, testability, and extensibility for future enhancements.