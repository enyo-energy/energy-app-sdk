# enyo Energy App SDK

The official TypeScript SDK for building Energy Apps on the enyo platform. Create powerful energy management applications that integrate with inverters, batteries, charging stations, and smart home devices.

[![npm version](https://badge.fury.io/js/@enyo-energy%2Fenergy-app-sdk.svg)](https://badge.fury.io/js/@enyo-energy%2Fenergy-app-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Choosing the Right API](#choosing-the-right-api)
- [Core Concepts](#core-concepts)
  - [Energy App Lifecycle](#energy-app-lifecycle)
  - [Package Definition](#package-definition)
  - [Permissions System](#permissions-system)
- [API Reference](#api-reference)
  - [Lifecycle Management](#lifecycle-management)
  - [System APIs](#system-apis)
  - [Device Communication](#device-communication)
  - [Data Management](#data-management)
  - [Energy Resources](#energy-resources)
  - [User Features](#user-features)
  - [App Intelligence](#app-intelligence)
- [Advanced Modbus Integration](#advanced-modbus-integration)
- [Network Devices & Access Recovery](#network-devices--access-recovery)
  - [NetworkAccessGuard](#networkaccessguard)
  - [NetworkDeviceManager](#networkdevicemanager)
  - [Startup pattern](#startup-pattern)
- [Device Integrations](#device-integrations)
  - [IntegrationEnergyApp (Base Class)](#integrationenergyapp-base-class)
  - [HeatpumpIntegrationEnergyApp](#heatpumpintegrationenergyapp)
  - [WallboxIntegrationEnergyApp](#wallboxintegrationenergyapp)
  - [StorageIntegrationEnergyApp](#storageintegrationenergyapp)
  - [InverterIntegrationEnergyApp](#inverterintegrationenergyapp)
  - [AirConditioningIntegrationEnergyApp](#airconditioningintegrationenergyapp)
  - [EnergyManagerEnergyApp](#energymanagerenergyapp)
- [Forecasting](#forecasting)
  - [ForecastConfig](#forecastconfig)
  - [PvProductionForecast](#pvproductionforecast)
  - [BatteryForecast](#batteryforecast)
  - [HomeConsumptionForecast](#homeconsumptionforecast)
  - [EvChargingForecast](#evchargingforecast)
  - [HeatpumpConsumptionForecast](#heatpumpconsumptionforecast)
  - [HeatpumpDhwTemperatureForecast](#heatpumpdhwtemperatureforecast)
- [Examples](#examples)
  - [Basic Energy App](#basic-energy-app)
  - [Device Integration](#device-integration)
  - [Data Bus Messaging](#data-bus-messaging)
  - [Settings Management](#settings-management)
- [Troubleshooting](#troubleshooting)
- [External Libraries](#external-libraries)
- [CLI Tool](#cli-tool)
- [Releasing Your App](#releasing-your-app)

## Installation

Install the SDK using npm:

```bash
npm install @enyo-energy/energy-app-sdk
```

## Quick Start

Create a basic Energy App that responds to system events:

```typescript
import { EnergyApp, defineEnergyAppPackage, EnergyAppPackageCategory, EnergyAppStateEnum } from '@enyo-energy/energy-app-sdk';

// Initialize the Energy App
const energyApp = new EnergyApp();

energyApp.register((packageName: string, version: number) => {
    console.log(`Energy App ${packageName} v${version} is starting...`);
    console.log(`System is ${energyApp.isSystemOnline() ? 'online' : 'offline'}`);

    // Set app state to running
    energyApp.updateEnergyAppState(EnergyAppStateEnum.Running);

    // Your app logic starts here
    startApp();
});

async function startApp() {
    // Use SDK APIs
    const storage = energyApp.useStorage();
    const dataBus = energyApp.useDataBus();

    // Store app configuration
    await storage.save('config', { initialized: true, timestamp: Date.now() });

    // Listen for data bus messages
    dataBus.listenForMessages(['InverterValuesUpdateV1'], (message) => {
        console.log('Received inverter data:', message);
    });
}
```

## Choosing the Right API

The SDK exposes several layered building blocks. Pick the one that matches the kind of app you are building before diving into the API reference:

- **Core SDK (`EnergyApp`)** — the always-present facade for system lifecycle, storage, data bus, settings, notifications, and HTTP. Every Energy App uses it.
- **Modbus helpers (`EnergyAppModbusInverter` / `Battery` / `Meter`)** — vendor-agnostic, configuration-driven Modbus access for raw register polling.
- **Device Integrations (`*IntegrationEnergyApp`)** — *inbound* abstractions for apps that **drive a real device** (heatpump, wallbox, inverter, storage, air conditioning). They subscribe to the right data-bus commands, dispatch them to your handlers, auto-acknowledge, and expose typed `publish*` helpers for status updates.
- **Forecasting (`*Forecast`, `EnergyManagerEnergyApp`)** — *outbound* abstractions for apps that **predict** future PV production, consumption, battery state, EV charging load, heatpump load, or DHW tank temperature using historical timeseries plus live data-bus updates.

### Decision Matrix

| If you want to… | Use |
|---|---|
| React to system lifecycle, store data, send notifications | [`EnergyApp`](#api-reference) |
| Talk to a Modbus device through configuration only | [`EnergyAppModbusInverter` / `Battery` / `Meter`](#advanced-modbus-integration) |
| Build a **device integration** for a heatpump | [`HeatpumpIntegrationEnergyApp`](#heatpumpintegrationenergyapp) |
| Build a **device integration** for an EV wallbox | [`WallboxIntegrationEnergyApp`](#wallboxintegrationenergyapp) |
| Build a **device integration** for a battery / storage system | [`StorageIntegrationEnergyApp`](#storageintegrationenergyapp) |
| Build a **device integration** for a PV inverter | [`InverterIntegrationEnergyApp`](#inverterintegrationenergyapp) |
| Build a **device integration** for an air-conditioning unit | [`AirConditioningIntegrationEnergyApp`](#airconditioningintegrationenergyapp) |
| Build an **energy manager** that orchestrates many forecasters | [`EnergyManagerEnergyApp`](#energymanagerenergyapp) |
| Forecast PV production for a single inverter | [`PvProductionForecast`](#pvproductionforecast) |
| Forecast battery state-of-charge | [`BatteryForecast`](#batteryforecast) |
| Forecast total household consumption | [`HomeConsumptionForecast`](#homeconsumptionforecast) |
| Forecast EV charging demand | [`EvChargingForecast`](#evchargingforecast) |
| Forecast heatpump electrical consumption | [`HeatpumpConsumptionForecast`](#heatpumpconsumptionforecast) |
| Forecast heatpump DHW tank temperature | [`HeatpumpDhwTemperatureForecast`](#heatpumpdhwtemperatureforecast) |

> **Rule of thumb:** if your app *receives* commands and drives hardware, you want an **Integration**. If your app *produces* predictions, you want a **Forecast** (and likely an `EnergyManagerEnergyApp` to wire several together).

## Core Concepts

### Energy App Lifecycle

Energy Apps follow a specific lifecycle managed by the enyo system:

1. **Initialization**: Your app registers with the system
2. **Running**: App performs its main functionality
3. **State Management**: App reports its current state
4. **Shutdown**: Graceful cleanup when system stops

```typescript
const energyApp = new EnergyApp();

// Register startup callback
energyApp.register((packageName, version) => {
    console.log(`${packageName} v${version} started`);
    energyApp.updateEnergyAppState(EnergyAppStateEnum.Running);
});

// Register shutdown callback
energyApp.onShutdown(async () => {
    console.log('Cleaning up resources...');
    // Perform cleanup tasks
});
```

#### App States

- `launching`: Initial state when app is starting up
- `running`: App is functioning normally
- `configuration-required`: App needs user configuration
- `internet-connection-required`: App needs internet connectivity

### Package Definition

Every Energy App must be defined using `defineEnergyAppPackage()`:

```typescript
import {
    defineEnergyAppPackage,
    EnergyAppPackageCategory,
    EnergyAppPermissionTypeEnum
} from '@enyo-energy/energy-app-sdk';

const packageDef = defineEnergyAppPackage({
    version: '1',
    packageName: 'solar-optimizer',
    // Optional: Internal documentation for developers (not shown to users)
    internalDescription: 'This app optimizes solar energy production using weather forecasts and AI predictions.',
    logo: './assets/logo.png',
    categories: [
        EnergyAppPackageCategory.Inverter,
        EnergyAppPackageCategory.EnergyManagement
    ],
    storeEntry: [
        {
            language: 'en',
            title: 'Solar Optimizer',
            shortDescription: 'Optimize your solar energy production',
            description: 'Advanced solar energy optimization with AI-driven predictions and real-time adjustments.'
        },
        {
            language: 'de',
            title: 'Solar Optimierer',
            shortDescription: 'Optimieren Sie Ihre Solarenergieproduktion',
            description: 'Erweiterte Solarenergie-Optimierung mit KI-gesteuerten Vorhersagen und Echtzeitanpassungen.'
        }
    ],
    // Permissions can be objects with internal comments (recommended for documentation)
    permissions: [
        { permission: EnergyAppPermissionTypeEnum.Modbus, internalComment: 'Required to read inverter registers via Modbus TCP' },
        { permission: EnergyAppPermissionTypeEnum.SendDataBusValues, internalComment: 'Used to publish inverter power values to the data bus' },
        { permission: EnergyAppPermissionTypeEnum.SubscribeDataBus, internalComment: 'Listens for battery state updates' },
        { permission: EnergyAppPermissionTypeEnum.Storage, internalComment: 'Stores configuration and historical optimization data' }
    ],
    // Note: Simple permission types are also supported for backwards compatibility:
    // permissions: [EnergyAppPermissionTypeEnum.Modbus, EnergyAppPermissionTypeEnum.Storage]
    options: {
        restrictedInternetAccess: {
            origins: ['api.weather.com', 'solar-forecasting.com']
        },
        deviceDetection: {
            modbus: [{
                unitIds: [1],
                registerAddress: 40001,
                registerSize: 2,
                type: 'string',
                matchingValues: ['SolarMax', 'SMA']
            }]
        }
    }
});
```

#### Package Categories

- `Inverter`: Solar inverter management
- `Wallbox`: EV charging station integration
- `Meter`: Energy metering applications
- `EnergyManagement`: Overall energy optimization
- `HeatPump`: Heat pump control systems
- `BatteryStorage`: Battery management
- `ClimateControl`: HVAC and climate systems
- `ElectricityTariff`: Dynamic pricing integration

### Permissions System

Energy Apps use a granular permissions system to control access to system resources:

#### Core Permissions

- **`Storage`**: Access persistent key-value storage
- **`NetworkDeviceDiscovery`**: Discover devices on the local network
- **`NetworkDeviceSearch`**: Search for specific network devices
- **`NetworkDeviceAccess`**: Access discovered network devices
- **`Modbus`**: Communicate via Modbus protocol

#### Data Bus Permissions

- **`SendDataBusValues`**: Send sensor data and measurements
- **`SubscribeDataBus`**: Listen to data from other devices
- **`SendDataBusCommands`**: Send control commands

#### Device Permissions

- **`Appliance`**: Manage appliances created by your package
- **`AllAppliances`**: Access all appliances in the system
- **`OcppServer`**: Run OCPP server for EV charging
- **`ChargingCard`**: Manage EV charging cards
- **`Vehicle`**: Access vehicle information
- **`Charge`**: Manage charging sessions

#### Internet Access

- **`RestrictedInternetAccess`**: Access specific internet domains only

## API Reference

### Lifecycle Management

#### `register(callback: (packageName: string, version: number) => void)`

Register a callback that executes when your Energy App starts:

```typescript
energyApp.register((packageName, version) => {
    console.log(`${packageName} v${version} is now running`);
    // Initialize your app here
});
```

#### `onShutdown(callback: () => Promise<void>)`

Register cleanup logic for graceful shutdown:

```typescript
energyApp.onShutdown(async () => {
    // Close connections
    await modbusClient.disconnect();
    // Save final state
    await storage.save('lastShutdown', Date.now());
});
```

#### `updateEnergyAppState(state: EnergyAppStateEnum)`

Update your app's current state:

```typescript
import { EnergyAppStateEnum } from '@enyo-energy/energy-app-sdk';

// App needs configuration
energyApp.updateEnergyAppState(EnergyAppStateEnum.ConfigurationRequired);

// App is ready and running
energyApp.updateEnergyAppState(EnergyAppStateEnum.Running);
```

### System APIs

#### `isSystemOnline(): boolean`

Check system connectivity:

```typescript
if (energyApp.isSystemOnline()) {
    // Fetch remote data
    syncWithCloud();
} else {
    // Use cached data
    loadOfflineData();
}
```

#### `useFetch(): typeof fetch`

Get HTTP client with system configuration:

```typescript
const fetch = energyApp.useFetch();

const response = await fetch('https://api.weather.com/forecast', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer token' }
});
```

#### `getSdkVersion(): string`

Get the SDK version:

```typescript
console.log(`Using SDK version: ${energyApp.getSdkVersion()}`);
```

### Device Communication

#### `useNetworkDevices(): EnergyAppNetworkDevice`

Discover and access network devices:

```typescript
const networkDevices = energyApp.useNetworkDevices();

// Discover devices
const devices = await networkDevices.discover();

// Search for specific device types
const inverters = await networkDevices.search({
    deviceType: 'inverter',
    manufacturer: 'SMA'
});

// Get device details
const deviceInfo = await networkDevices.getDeviceInfo(device.id);
```

#### `useModbus(): EnergyAppModbus`

Access Modbus communication:

```typescript
const modbus = energyApp.useModbus();

// Connect to device
const client = await modbus.connect({
    host: '192.168.1.100',
    port: 502,
    unitId: 1
});

// Read holding registers
const registers = await client.readHoldingRegisters(1001, 10);

// Write single register
await client.writeSingleRegister(2001, 500);
```

#### `useOcpp(): EnergyAppOcpp`

Handle OCPP charging station communication:

```typescript
const ocpp = energyApp.useOcpp();

// Start OCPP server
const server = ocpp.createServer({
    port: 8080,
    onChargePointConnect: (chargePointId) => {
        console.log(`Charge point ${chargePointId} connected`);
    }
});

// Send remote commands
await server.sendRemoteStartTransaction(chargePointId, {
    connectorId: 1,
    idTag: 'user123'
});
```

### Data Management

#### `useStorage(): EnergyAppStorage`

Persistent key-value storage:

```typescript
const storage = energyApp.useStorage();

// Save configuration
await storage.save('config', {
    inverterHost: '192.168.1.100',
    pollInterval: 30000
});

// Load configuration
const config = await storage.load<ConfigType>('config');

// List all keys
const keys = await storage.listKeys();

// Remove data
await storage.remove('oldData');
```

#### `useDataBus(): EnergyAppDataBus`

Send and receive system-wide data:

```typescript
const dataBus = energyApp.useDataBus();

// Send inverter data
dataBus.sendMessage([{
    messageType: 'InverterValuesUpdateV1',
    applianceId: 'inverter-1',
    timestamp: Date.now(),
    values: {
        powerW: 3500,
        energyWh: 25000,
        voltageV: 230
    }
}]);

// Listen for battery updates
const listenerId = dataBus.listenForMessages(
    ['BatteryValuesUpdateV1'],
    (message) => {
        console.log('Battery SoC:', message.values.stateOfCharge);
    }
);

// Stop listening
dataBus.unsubscribe(listenerId);
```

#### `useInterval(): EnergyAppInterval`

Manage recurring tasks:

```typescript
const interval = energyApp.useInterval();

// Create recurring data collection
const intervalId = interval.createInterval('30s', (clockId) => {
    collectSensorData();
});

// Stop interval
interval.stopInterval(intervalId);
```

**Available intervals**: `'10s'`, `'30s'`, `'1m'`, `'5m'`, `'1hr'`

### Energy Resources

#### `useAppliances(): EnergyAppAppliance`

Manage energy appliances:

```typescript
const appliances = energyApp.useAppliances();

// Register new appliance
const applianceId = await appliances.save({
    name: [{ language: 'en', name: 'Solar Inverter' }],
    type: 'inverter',
    manufacturer: 'SMA',
    model: 'SB5000',
    networkDevice: deviceInfo
}, undefined);

// List your appliances
const myAppliances = await appliances.list();

// Get appliance details
const appliance = await appliances.getById(applianceId);

// Remove appliance
await appliances.removeById(applianceId);
```

#### `useVehicle(): EnergyAppVehicle`

Access electric vehicle information:

```typescript
const vehicles = energyApp.useVehicle();

// Get all vehicles
const vehicleList = await vehicles.getVehicles();

// Get vehicle details
const vehicle = await vehicles.getVehicleById(vehicleId);

// Update vehicle state
await vehicles.updateVehicleState(vehicleId, {
    batteryLevel: 80,
    isPluggedIn: true,
    estimatedRange: 320
});
```

#### `useCharge(): EnergyAppCharge`

Manage charging sessions:

```typescript
const charging = energyApp.useCharge();

// Start charging session
const sessionId = await charging.startCharge({
    vehicleId: 'vehicle-123',
    connectorId: 1,
    maxPowerKw: 22
});

// Get active sessions
const sessions = await charging.getActiveSessions();

// Stop charging
await charging.stopCharge(sessionId);
```

#### `useChargingCard(): EnergyAppChargingCard`

Handle charging authentication:

```typescript
const chargingCards = energyApp.useChargingCard();

// Validate charging card
const isValid = await chargingCards.validateCard('RFID-12345');

// Get card information
const cardInfo = await chargingCards.getCardInfo('RFID-12345');
```

### User Features

#### `useAuthentication(): EnergyAppAuthentication`

Handle user authentication:

```typescript
const auth = energyApp.useAuthentication();

// Get current user
const user = await auth.getCurrentUser();

// Check permissions
const hasPermission = await auth.hasPermission('admin');

// Authenticate action
const token = await auth.createAuthToken('user-action');
```

#### `useSettings(): EnergyAppSettings`

Manage app settings and configuration:

```typescript
const settings = energyApp.useSettings();

// Add setting configuration
await settings.addSettingConfig({
    name: 'pollInterval',
    displayName: [{ language: 'en', name: 'Poll Interval (seconds)' }],
    type: 'number',
    defaultValue: '30',
    validation: {
        min: 10,
        max: 300
    }
});

// Update setting value
await settings.updateSetting('pollInterval', '60');

// Listen for setting changes
settings.listenForSettingsChanges((settingName, newValue) => {
    console.log(`Setting ${settingName} changed to ${newValue}`);
});

// Get all settings
const allSettings = await settings.getSettingsConfig();
```

#### `useElectricityPrices(): EnergyAppElectricityPrices`

Access electricity pricing information:

```typescript
const prices = energyApp.useElectricityPrices();

// Get current electricity price
const currentPrice = await prices.getCurrentPrice();

// Get price forecast
const forecast = await prices.getPriceForecast({
    hoursAhead: 24
});

// Listen for price changes
prices.onPriceChange((newPrice) => {
    console.log(`New electricity price: ${newPrice.pricePerKwh} €/kWh`);
});
```

#### `useNotification(): EnergyAppNotification`

Send notifications to users:

```typescript
const notifications = energyApp.useNotification();

// Send info notification
await notifications.sendNotification({
    type: 'info',
    title: 'Energy Optimization',
    message: 'Your system is running optimally',
    timestamp: Date.now()
});

// Send warning
await notifications.sendNotification({
    type: 'warning',
    title: 'High Energy Consumption',
    message: 'Consider reducing energy usage during peak hours'
});

// Send critical alert
await notifications.sendNotification({
    type: 'error',
    title: 'System Fault',
    message: 'Inverter communication lost - please check connection'
});
```

### App Intelligence

#### `useLearningPhase(): EnergyAppLearningPhase`

Track and manage learning phases — periods where an app or a specific appliance is calibrating, gathering data, or optimizing its behavior:

```typescript
const learningPhase = energyApp.useLearningPhase();

// Register a package-wide learning phase
const phaseId = await learningPhase.registerLearningPhase({
    name: 'consumption-pattern-analysis',
    reason: [
        { language: 'en', value: 'Analyzing energy consumption patterns' },
        { language: 'de', value: 'Analyse der Energieverbrauchsmuster' }
    ],
    description: [
        { language: 'en', value: 'The system is learning your household energy consumption patterns to optimize scheduling.' },
        { language: 'de', value: 'Das System lernt Ihre Energieverbrauchsmuster, um die Planung zu optimieren.' }
    ]
});

// Register a learning phase for a specific appliance
const heatpumpPhaseId = await learningPhase.registerLearningPhase({
    name: 'heating-curve-optimization',
    applianceId: 'heatpump-001',
    reason: [
        { language: 'en', value: 'Optimizing heating curve' },
        { language: 'de', value: 'Optimierung der Heizkurve' }
    ]
});

// Check if a learning phase is still active
const isLearning = await learningPhase.isInLearningPhase(heatpumpPhaseId);
console.log(`Heatpump is ${isLearning ? 'still learning' : 'done learning'}`);

// Check if a learning phase is completed
const isDone = await learningPhase.isLearningPhaseCompleted(heatpumpPhaseId);

// Get all learning phases with their status and duration
const allPhases = await learningPhase.getLearningPhases();
for (const phase of allPhases) {
    console.log(`${phase.name}: ${phase.durationInHours}h, active: ${!phase.endDate}`);
}

// Get learning phases for a specific appliance
const heatpumpPhases = await learningPhase.getLearningPhasesByApplianceId('heatpump-001');

// Complete a learning phase
await learningPhase.completeLearningPhase(heatpumpPhaseId);

// Remove a learning phase
await learningPhase.removeLearningPhase(phaseId);
```

## Advanced Modbus Integration

The SDK includes a powerful, vendor-agnostic Modbus implementation for energy management systems. This allows you to connect to any Modbus-enabled device through configuration without code changes.

### ✨ Features

- **Vendor Agnostic** - Works with SMA, Fronius or any Modbus device via configuration
- **Type Safe** - Full TypeScript support with proper DataBus message types
- **Configurable** - Register addresses, data types, scaling all configurable
- **Fault Tolerant** - Built-in connection health monitoring and retry logic
- **Modular** - Clean separation between inverters, batteries, and meters

### 🚀 Quick Start

#### Basic Modbus Setup

```typescript
import { EnergyApp } from '@enyo-energy/energy-app-sdk';
import {
    EnergyAppModbusInverter,
    EnergyAppModbusBattery,
    EnergyAppModbusMeter
} from '@enyo-energy/energy-app-sdk';

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

## Network Devices & Access Recovery

Packages that talk to local hardware over TCP (Modbus, SunSpec, EEBUS over SHIP, REST) must deal with two failure modes the `useNetworkDevices()` API exposes only at a low level:

1. **Network-access-denied errors** — `EnyoNetworkDevice.accessStatus` is device-wide (`granted | denied | pending`). It does **not** carry per-port grants. A device can report `'granted'` while your package never received (or has since lost) access to its Modbus port, and the first symptom is the runtime error `[NET] Network access denied: Host '...:502' is not in the allowed list.` from a poll cycle.
2. **User-driven access transitions** — the user revokes or re-grants access via the UI; the SDK fires `listenForDeviceAccessChange`, and packages need to disconnect / reconnect accordingly.

The SDK ships two classes that encapsulate this lifecycle so packages don't reinvent it: a low-level **`NetworkAccessGuard`** for access-denied recovery, and a higher-level **`NetworkDeviceManager`** that wires the guard together with all the network-device listeners and the package's `ApplianceManager`.

### NetworkAccessGuard

`NetworkAccessGuard` recovers from access-denied errors raised by the SDK's network layer. Construct one per package with the ports it needs and a restored-callback that reconnects whatever client was reading from the device.

```typescript
import { NetworkAccessGuard } from '@enyo-energy/energy-app-sdk';

const accessGuard = new NetworkAccessGuard(energyApp, {
  ports: [502],
  onAccessRestored: async (networkDeviceId) => {
    await myModbusPool.reconnect(networkDeviceId);
  },
});

// Precondition before a Modbus connect:
if (!(await accessGuard.ensureAccess(networkDevice.id))) {
  console.warn(`Modbus port access not granted for ${networkDevice.hostname}`);
  return;
}

// Wrap any Modbus read so an access-denied error triggers recovery:
const registers = await accessGuard.withAccessGuard(networkDevice.id, () =>
  modbusClient.readHoldingRegisters(40000, 4),
);
```

Recovery lifecycle:

1. A read fails inside `withAccessGuard`. The guard detects the access-denied error via `NetworkAccessGuard.isAccessDeniedError(error)`, re-throws it to the caller (so the current poll cycle fails fast), and kicks off recovery in the background.
2. The guard calls `requestDeviceAccess(deviceId, ports)`. If the SDK answers `'granted'` synchronously (the port was just missing from the allow-list and no user prompt is needed), the `onAccessRestored` handler fires immediately.
3. Otherwise the device stays in a pending set and the `listenForDeviceAccessChange` registration fires the handler when the SDK reports the device flipped to `'granted'`.

Re-entrancy: repeated `recoverAccess(...)` calls for the same device while a recovery is already in flight are coalesced — the handler runs exactly once per restoration.

The guard exposes:

| Method | Purpose |
| --- | --- |
| `static isAccessDeniedError(error)` | Recognise the SDK's access-denied error string |
| `ensureAccess(deviceId)` | Idempotent port-allow-list request before a connect |
| `withAccessGuard(deviceId, action)` | Wrap any async TCP call — recovers on access-denied |
| `recoverAccess(deviceId)` | Explicit recovery trigger after catching an access-denied error |
| `onAccessRestored(handler)` / `onAccessDenied(handler)` | Register additional handlers at runtime; returns a disposer |
| `isRecovering(deviceId)` | Introspect whether a recovery is in flight |
| `dispose()` | Tear down the SDK listener |

### NetworkDeviceManager

`NetworkDeviceManager` is the recommended entry point for any package that owns appliances backed by NetworkDevices. It bundles a `NetworkAccessGuard` with the three NetworkDevice-related SDK listeners (`listenForDeviceAccessChange`, `listenForDetectedDevice`, `listenForNetworkDeviceRemoved`) and resolves every event into **per-appliance callbacks** by joining against the package's `ApplianceManager`.

```typescript
import {
  ApplianceManager,
  EnergyApp,
  NetworkDeviceManager,
} from '@enyo-energy/energy-app-sdk';

const energyApp = new EnergyApp();
const applianceManager = await ApplianceManager.initialize(energyApp);

const networkManager = await NetworkDeviceManager.initialize(
  energyApp,
  applianceManager,
  {
    ports: [502],
    autoToggleApplianceState: true,
    onApplianceAccessRestored: async ({ appliance, networkDeviceId }) => {
      // Re-establish a Modbus session and restart the polling loop for this appliance.
      await myModbusPool.reconnect(networkDeviceId);
    },
    onApplianceAccessRevoked: async ({ appliance, networkDeviceId }) => {
      // User revoked access in the UI — tear down the connection.
      await myModbusPool.disconnect(networkDeviceId);
    },
    onApplianceAccessDenied: async ({ appliance, networkDeviceId }) => {
      // An access-denied error was just observed at runtime — mark the
      // appliance offline. `autoToggleApplianceState: true` already does
      // this; the handler is here for any custom side-effects.
    },
    onApplianceNetworkDeviceRemoved: async ({ appliance, networkDeviceId }) => {
      await myModbusPool.disconnect(networkDeviceId);
    },
    onNetworkDeviceDetected: async (devices) => {
      // New device found — classify + connect.
      for (const device of devices) {
        await classifyAndConnect(device);
      }
    },
    onNetworkDeviceAccessChanged: async (deviceId, status) => {
      // Optional: raw access-status passthrough, fires even for devices
      // the package has no appliances on yet. Useful for first-time
      // onboarding where a 'granted' transition needs to drive a discovery
      // pass before any appliance exists.
    },
  },
);

// Every Modbus read inside the poll loop:
await networkManager.withAccessGuard(networkDeviceId, () =>
  modbusClient.readHoldingRegisters(40000, 4),
);
```

What the manager handles for you:

- **Access-denied recovery** — `withAccessGuard` / `ensureAccess` delegate to the bundled `NetworkAccessGuard`.
- **User-driven transitions** — on `listenForDeviceAccessChange`, the manager dispatches `onApplianceAccessRestored` on `'granted'` and `onApplianceAccessRevoked` on `'denied'` / `'pending'`, resolving each transition into the per-appliance events your reconnect/disconnect code needs.
- **Listener dedup** — the manager registers its access-change listener *before* the guard's, so a `'granted'` event during a recovery cycle dispatches only once (the manager observes `isRecovering(deviceId) === true` and skips, letting the guard's own restored callback win).
- **Device removal** — on `listenForNetworkDeviceRemoved`, the manager fires `onApplianceNetworkDeviceRemoved` per affected appliance and clears its cache.
- **Optional auto-state toggle** — with `autoToggleApplianceState: true`, the manager flips affected appliances to `EnyoApplianceStateEnum.Offline` on denial / revocation / removal, and back to `EnyoApplianceStateEnum.Connected` on restoration, via `applianceManager.updateApplianceState(...)`.

Every handler is also registerable at runtime via `manager.onApplianceAccessRestored(fn)` / `onApplianceAccessDenied(fn)` / `onApplianceAccessRevoked(fn)` / `onApplianceNetworkDeviceRemoved(fn)` / `onNetworkDeviceDetected(fn)` / `onNetworkDeviceAccessChanged(fn)`, each returning a disposer.

### Startup pattern

The SDK's `listenForDeviceAccessChange` only fires on *transitions* — devices that are already `'granted'` from a previous session won't trigger it. Recommended startup flow for a package that supports both first-onboarding and warm restarts:

```typescript
client.register(async () => {
  const applianceManager = await ApplianceManager.initialize(client);
  const networkManager = await NetworkDeviceManager.initialize(
    client,
    applianceManager,
    {
      ports: [502],
      onApplianceAccessRestored: ({ networkDeviceId }) => connectDevice(networkDeviceId),
      onApplianceAccessRevoked: ({ networkDeviceId }) => disconnectDevice(networkDeviceId),
      onNetworkDeviceDetected: async (devices) => {
        for (const device of devices) await connectDevice(device.id);
      },
    },
  );

  // Warm-restart: reconnect to devices that already have access.
  const granted = await client.useNetworkDevices().getDevices({ accessStatus: 'granted' });
  for (const device of granted) {
    await connectDevice(device.id);
  }

  client.updateEnergyAppState(EnergyAppStateEnum.Running);
});

async function connectDevice(networkDeviceId: string) {
  if (!(await networkManager.ensureAccess(networkDeviceId))) return;
  // ...classify, open modbus client, register appliances...
}
```

This pattern matches the wiring used by real Sungrow / Fronius energy-app packages: one `NetworkDeviceManager` per package, `ensureAccess` before every connect, `withAccessGuard` around every poll, and a single `getDevices({ accessStatus: 'granted' })` pass at startup to cover the warm-restart case.

## Device Integrations

Device Integrations are the high-level building blocks for apps that **drive a real device** — a heatpump, EV wallbox, PV inverter, battery storage system, or air-conditioning unit. Each integration class hides the data-bus plumbing for its appliance type so you only implement the business logic that physically controls the device.

### ✨ What the integration framework does for you

- **Subscribes** to the relevant `*CommandV1` data-bus messages for the appliance type.
- **Dispatches** each command to the async handler you register.
- **Auto-acknowledges** every command via a `CommandAcknowledgeV1` response containing your `Accepted` / `Rejected` / `NotSupported` answer.
- **Handles broadcast `GridOperatorPowerLimitationV1`** (§14a EnWG) and routes it once per managed appliance.
- **Manages lifecycle** — auto-starts on construction and auto-stops on shutdown by default.
- **Exposes typed `publish*` helpers** so your handler implementations can broadcast status updates back to the system without hand-building messages.

### 🚀 Quick Start

```typescript
import {
    HeatpumpIntegrationEnergyApp,
    EnyoSourceEnum,
    EnyoCommandAcknowledgeAnswerEnum,
    ApplianceManager,
} from '@enyo-energy/energy-app-sdk';

class MyHeatpumpApp extends HeatpumpIntegrationEnergyApp {
    constructor(applianceManager: ApplianceManager) {
        super({ source: EnyoSourceEnum.Device, applianceManager });
    }

    protected async handleHeatpumpOverheating(message) {
        await driveOverheating(message.data);
        return { answer: EnyoCommandAcknowledgeAnswerEnum.Accepted };
    }

    protected async handleHeatpumpAvailablePowerAnnouncement(message) {
        await scaleHeatpumpToEnvelope(message.data);
        return { answer: EnyoCommandAcknowledgeAnswerEnum.Accepted };
    }

    protected async handleGridOperatorPowerLimitation(message, applianceId) {
        await applyGridLimit(applianceId, message.data);
        return { applianceId, answer: EnyoCommandAcknowledgeAnswerEnum.Accepted };
    }
}
```

### IntegrationEnergyApp (Base Class)

`IntegrationEnergyApp` is the abstract base every device integration extends. It owns the data-bus subscription/acknowledgment loop and the broadcast routing so subclasses only declare *what* commands they care about and *how* to fulfil them.

**Constructor options (`IntegrationEnergyAppOptions`)**

| Field | Type | Default | Purpose |
|---|---|---|---|
| `source` | `EnyoSourceEnum` | required | Source identifier for outbound messages (typically `Device`). |
| `applianceManager` | `ApplianceManager` | optional | Lookup all appliances of the integration's `managedApplianceType`. |
| `applianceIds` | `string[]` | optional | Explicit list of appliance IDs to manage. Overrides the manager-based lookup. |
| `autoStart` | `boolean` | `true` | Subscribe to the data bus immediately after construction. |
| `autoStopOnShutdown` | `boolean` | `true` | Register an SDK shutdown hook to release listeners. |

**Lifecycle**

- `start(): void` — idempotent; registers all command handlers via the subclass's `registerHandlers()`.
- `stop(): void` — releases listeners and disposes the outbound command handler.

**For subclass authors**

- `protected abstract registerHandlers(): void` — call `registerCommandHandler(messageType, handler)` for each command you want to receive.
- `protected abstract handleGridOperatorPowerLimitation(message, applianceId)` — handle the §14a EnWG broadcast per managed appliance.
- `protected abstract get managedApplianceType(): EnyoApplianceTypeEnum` — used to resolve appliance IDs when no explicit list is given.

### HeatpumpIntegrationEnergyApp

Drives a heatpump. Manages building / DHW overheating commands and grid-power-availability announcements.

- **Subscribed commands:** `HeatpumpOverheatingV1`, `HeatpumpAvailablePowerAnnouncementV1`, `GridOperatorPowerLimitationV1` (broadcast)
- **Implement:** `handleHeatpumpOverheating`, `handleHeatpumpAvailablePowerAnnouncement`, `handleGridOperatorPowerLimitation`
- **Publish helpers:**
  - `publishHeatpumpValuesUpdate(applianceId, values)` — operation mode, electrical and thermal power, energies.
  - `publishHeatpumpTemperatures(applianceId, temperatures)` — outdoor, flow, return, DHW tanks, heating circuits, buffer tank.

### WallboxIntegrationEnergyApp

Drives an EV wallbox / charger. Has the richest command surface of all integrations.

- **Subscribed commands:** `StartChargeV1`, `StopChargeV1`, `PauseChargingV1`, `ResumeChargingV1`, `ChangeChargingPowerV1`, `SetChargingScheduleV1`, `ResetChargerV1`, `RebootChargerV1`, `RequestChargerLogsV1`, `ClearChargingProfilesV1`, `GridOperatorPowerLimitationV1` (broadcast)
- **Implement:** one `handle*` method per command listed above plus `handleGridOperatorPowerLimitation`.
- **Publish helpers:**
  - `publishChargingStarted(applianceId, data)` / `publishChargingStopped(applianceId, data)`
  - `publishChargingMeterValues(applianceId, data)` — periodic meter values during a session.
  - `publishMaxChargingPowerChanged(applianceId, maxChargingPowerKw)` — e.g. on thermal derating.
  - `publishChargerStatusChanged(applianceId, data)` — OCPP-style status changes.

```typescript
class MyWallbox extends WallboxIntegrationEnergyApp {
    constructor(applianceManager: ApplianceManager) {
        super({ source: EnyoSourceEnum.Device, applianceManager });
    }

    protected async handleStartCharge(message) {
        const txId = await this.driver.start(message.data);
        this.publishChargingStarted(message.applianceId, { transactionId: txId });
        return { answer: EnyoCommandAcknowledgeAnswerEnum.Accepted };
    }
    // ... other handlers
}
```

### StorageIntegrationEnergyApp

Drives a battery / storage system. Controls grid-charging windows and discharge limits.

- **Subscribed commands:** `StartStorageGridChargeV1`, `StopStorageGridChargeV1`, `SetStorageDischargeLimitV1`, `GridOperatorPowerLimitationV1` (broadcast)
- **Implement:** `handleStartStorageGridCharge`, `handleStopStorageGridCharge`, `handleSetStorageDischargeLimit`, `handleGridOperatorPowerLimitation`.
- **Publish helpers:**
  - `publishBatteryValuesUpdate(applianceId, data)` — state, power, SoC.
  - `publishMaxDischargePowerChanged(applianceId, maxDischargePowerKw)` — discharge-limit changes.

### InverterIntegrationEnergyApp

Drives a PV inverter. Controls grid feed-in limits and publishes electrical metrics.

- **Subscribed commands:** `SetInverterFeedInLimitV1`, `GridOperatorPowerLimitationV1` (broadcast)
- **Implement:** `handleSetInverterFeedInLimit` (`data.feedInLimitW` may be `null` to clear), `handleGridOperatorPowerLimitation`.
- **Publish helpers:**
  - `publishInverterValuesUpdate(applianceId, data)` — DC strings, AC voltages, total PV power, operating state.

### AirConditioningIntegrationEnergyApp

Drives an air-conditioning unit. Starts and stops heating or cooling modes.

- **Subscribed commands:** `StartAirConditioningV1`, `StopAirConditioningV1`, `GridOperatorPowerLimitationV1` (broadcast)
- **Implement:** `handleStartAirConditioning` (mode is `Heating` or `Cooling`), `handleStopAirConditioning`, `handleGridOperatorPowerLimitation`.
- **Publish helpers:**
  - `publishAirConditioningValues(applianceId, values)` — current operation mode and electrical consumption.
  - `publishAirConditioningTemperatures(applianceId, data)` — current and target temperatures per room.

### EnergyManagerEnergyApp

`EnergyManagerEnergyApp` is the **counterpart** to the device integrations: instead of receiving commands, it produces forecasts. It is the recommended entry point when your app needs **multiple forecasters** wired together — it lazily creates each forecaster on first request, caches it, and disposes them all on shutdown.

**Constructor**

```typescript
new EnergyManagerEnergyApp({
    source: EnyoSourceEnum.Device,
    forecastConfig?: ForecastConfig,   // applied to every forecaster unless overridden per call
    autoStopOnShutdown?: boolean,      // default true
});
```

**Lazy forecaster factories** — each returns a ready-to-use forecaster (history loaded, live listeners attached):

- `getPvProductionForecast(applianceId, config?)`
- `getBatteryForecast(applianceId, config?)`
- `getHomeConsumptionForecast(config?)` — system-wide, no appliance ID
- `getEvChargingForecast(applianceId, config?)`
- `getHeatpumpConsumptionForecast(applianceId, config?)`
- `getHeatpumpDhwTemperatureForecast(applianceId, config?)`

**Lifecycle**

- `stop(): void` — disposes every cached forecaster.

```typescript
const manager = new EnergyManagerEnergyApp({ source: EnyoSourceEnum.Device });

const pv = await manager.getPvProductionForecast('inverter-1');
const battery = await manager.getBatteryForecast('battery-1');

const pvForecast = pv.getForecast();
const batteryForecast = battery.getForecast();
```

## Forecasting

The forecasting module provides 24-hour predictions across the energy domains the SDK already understands (PV, battery, home consumption, EV charging, heatpump consumption, DHW temperature). Every forecaster follows the same lifecycle and shares the same configuration shape, so once you've used one you've used them all.

### ✨ Common pattern

1. Construct the forecaster with the SDK app, the appliance ID (where applicable), and an optional `ForecastConfig`.
2. `await initialize()` — pulls historical timeseries and subscribes to live data-bus updates.
3. Call `getForecast()` whenever you need a fresh prediction (cheap; uses in-memory state).
4. Optionally call `publishForecast()` to manually push to the data bus (or rely on auto-publish).
5. `dispose()` to release listeners on shutdown.

All forecasters compute **same-weekday recency-weighted averages** at 15-minute resolution and optionally smooth the first ~2 hours toward recent actuals. `PvProductionForecast` is the exception — sun position is weekday-independent, so it weights all days equally.

### ForecastConfig

The shared configuration applied to every forecaster.

| Field | Type | Default | Purpose |
|---|---|---|---|
| `historyDays` | `number` | `7` | Lookback window for historical timeseries. |
| `resolution` | `'1m' \| '15m'` | `'15m'` | Slot granularity for both history and forecast. |
| `horizonHours` | `number` | `24` | How far ahead to forecast. |
| `alignToRecentActuals` | `boolean` | `true` | Smoothly join the first ~2 forecast hours to recent observations. |
| `publishToBus` | `boolean` | `true` | Auto-publish to the data bus on every refresh. |

> **Per-forecaster overrides:** `PvProductionForecast` defaults to **4 days** (sun-driven, recency matters most). `BatteryForecast`, `EvChargingForecast`, and `HomeConsumptionForecast` default to **14 days** (strongly weekday-cyclic).

All forecasters return a `BaseForecast<D>`-shaped object:

```typescript
{
    generatedAtIso: string;      // ISO timestamp of computation
    data: {
        resolution: '1m' | '15m';
        entries: Array<{ startIso: string; /* per-class fields */ }>;
    };
}
```

### PvProductionForecast

Forecasts the AC power output of a single PV inverter.

```typescript
new PvProductionForecast(app, applianceId, { source: EnyoSourceEnum.Device, config? });
```

- **Output per slot:** `{ powerW: number; powerWh: number }`
- **History default:** 4 days, all-day weighting.
- **Live source:** `InverterValuesUpdateV1`.

### BatteryForecast

Forecasts state-of-charge (and derived stored energy) for a single battery.

```typescript
new BatteryForecast(app, applianceId, {
    source: EnyoSourceEnum.Device,
    config?: { ratedCapacityWh?: number, ...ForecastConfig }
});
```

- **Output per slot:** `{ socPercent: number; capacityWh: number }` (SoC clamped to `[0, 100]`).
- **History default:** 14 days.
- **Notable config:** `ratedCapacityWh` is auto-loaded from the appliance metadata if omitted.
- **Live source:** `BatteryValuesUpdateV1`.

### HomeConsumptionForecast

Forecasts total household electrical consumption — system-wide, no appliance ID.

```typescript
new HomeConsumptionForecast(app, { source: EnyoSourceEnum.Device, config? });
```

- **Output per slot:** `{ powerW: number; powerWh: number }`
- **History default:** 14 days (household routines are strongly weekday-cyclic).
- **Live source:** `AggregatedStateUpdateV1`.

### EvChargingForecast

Forecasts EV charging power for a single charger.

```typescript
new EvChargingForecast(app, applianceId, { source: EnyoSourceEnum.Device, config? });
```

- **Output per slot:** `{ powerW: number; powerWh: number }`
- **History default:** 14 days.
- **Live source:** `ChargingMeterValuesUpdateV1`.

### HeatpumpConsumptionForecast

Forecasts the electrical consumption of a heatpump (heating + cooling combined).

```typescript
new HeatpumpConsumptionForecast(app, applianceId, { source: EnyoSourceEnum.Device, config? });
```

- **Output per slot:** `{ powerW: number; powerWh: number }`
- **History default:** 7 days.
- **Live source:** `HeatpumpValuesUpdateV1`.
- **Note:** does not adjust for forecasted weather; layer COP-based correction on top if you need that.

### HeatpumpDhwTemperatureForecast

Forecasts the temperature of a heatpump's domestic-hot-water tank.

```typescript
new HeatpumpDhwTemperatureForecast(app, applianceId, {
    source: EnyoSourceEnum.Device,
    config?: { dhwTankIndex?: number, ...ForecastConfig }
});
```

- **Output per slot:** `{ temperatureC: number }` (rounded to 0.1 °C).
- **History default:** 7 days.
- **Notable config:** `dhwTankIndex` selects a specific tank (zero-based); omit to average across all tanks.
- **Live source:** heatpump temperature timeseries / live updates.

### 🚀 Common usage example

```typescript
import {
    PvProductionForecast,
    BatteryForecast,
    EnyoSourceEnum,
} from '@enyo-energy/energy-app-sdk';

const pv = new PvProductionForecast(energyApp, 'inverter-1', {
    source: EnyoSourceEnum.Device,
});
const battery = new BatteryForecast(energyApp, 'battery-1', {
    source: EnyoSourceEnum.Device,
    config: { ratedCapacityWh: 10_000 },
});

await Promise.all([pv.initialize(), battery.initialize()]);

energyApp.useInterval().createInterval('15m', () => {
    const pvNext24h = pv.getForecast();
    const batteryNext24h = battery.getForecast();
    runDispatch(pvNext24h, batteryNext24h);
});

energyApp.onShutdown(async () => {
    pv.dispose();
    battery.dispose();
});
```

> **Tip:** if your app needs more than one forecaster, prefer [`EnergyManagerEnergyApp`](#energymanagerenergyapp) — it manages construction, caching, and disposal for you.

## Examples

### Basic Energy App

A simple energy monitoring application:

```typescript
import { EnergyApp, defineEnergyAppPackage } from '@enyo-energy/energy-app-sdk';

const energyApp = new EnergyApp();

energyApp.register(async (packageName, version) => {
    console.log(`Energy Monitor ${version} starting...`);

    const storage = energyApp.useStorage();
    const dataBus = energyApp.useDataBus();
    const interval = energyApp.useInterval();

    // Load configuration
    const config = await storage.load('config') || { enabled: true };

    // Listen for energy data
    dataBus.listenForMessages(['InverterValuesUpdateV1', 'BatteryValuesUpdateV1'],
        (message) => {
            console.log(`Received ${message.messageType}:`, message.values);
            // Store or process energy data
        }
    );

    // Periodic health check
    interval.createInterval('5m', async () => {
        const isOnline = energyApp.isSystemOnline();
        await storage.save('lastHealthCheck', {
            timestamp: Date.now(),
            online: isOnline
        });
    });

    energyApp.updateEnergyAppState('running');
});
```

### Device Integration

Comprehensive device management with multiple protocols:

```typescript
import { EnergyApp } from '@enyo-energy/energy-app-sdk';

const energyApp = new EnergyApp();

energyApp.register(async (packageName, version) => {
    const networkDevices = energyApp.useNetworkDevices();
    const appliances = energyApp.useAppliances();
    const modbus = energyApp.useModbus();
    const dataBus = energyApp.useDataBus();

    try {
        // Discover network devices
        console.log('Discovering devices...');
        const devices = await networkDevices.discover();

        for (const device of devices) {
            console.log(`Found device: ${device.hostname} (${device.manufacturer})`);

            if (device.manufacturer === 'SMA' && device.protocols?.includes('modbus')) {
                // Create Modbus connection
                const client = await modbus.connect({
                    host: device.hostname,
                    port: 502,
                    unitId: 1
                });

                // Register as appliance
                const applianceId = await appliances.save({
                    name: [{ language: 'en', name: `${device.manufacturer} Inverter` }],
                    type: 'inverter',
                    manufacturer: device.manufacturer,
                    model: device.model || 'Unknown',
                    networkDevice: device
                }, undefined);

                // Start data collection
                const interval = energyApp.useInterval();
                interval.createInterval('30s', async () => {
                    try {
                        // Read power data (example registers)
                        const powerRegs = await client.readHoldingRegisters(30775, 2);
                        const power = powerRegs.getInt32BE(0);

                        // Send to data bus
                        dataBus.sendMessage([{
                            messageType: 'InverterValuesUpdateV1',
                            applianceId: applianceId,
                            timestamp: Date.now(),
                            values: {
                                powerW: power,
                                voltageV: 230, // Read from appropriate register
                                frequencyHz: 50
                            }
                        }]);

                    } catch (error) {
                        console.error('Failed to read from device:', error);
                    }
                });
            }
        }

        energyApp.updateEnergyAppState('running');

    } catch (error) {
        console.error('Device discovery failed:', error);
        energyApp.updateEnergyAppState('configuration-required');
    }
});
```

### Data Bus Messaging

Advanced data processing and message routing:

```typescript
import { EnergyApp } from '@enyo-energy/energy-app-sdk';

const energyApp = new EnergyApp();

class EnergyDataProcessor {
    private dataBus = energyApp.useDataBus();
    private storage = energyApp.useStorage();
    private lastValues = new Map();

    async initialize() {
        // Listen for various energy data types
        this.dataBus.listenForMessages([
            'InverterValuesUpdateV1',
            'BatteryValuesUpdateV1',
            'MeterValuesUpdateV1'
        ], (message) => this.processEnergyData(message));

        // Listen for commands
        this.dataBus.listenForMessages([
            'SetPowerLimitCommandV1'
        ], (message) => this.handleCommand(message));
    }

    private async processEnergyData(message: any) {
        const { messageType, applianceId, values, timestamp } = message;

        // Store latest values
        this.lastValues.set(applianceId, { messageType, values, timestamp });

        // Calculate aggregated metrics
        await this.calculateSystemMetrics();

        // Detect anomalies
        this.detectAnomalies(messageType, values);
    }

    private async calculateSystemMetrics() {
        let totalPowerW = 0;
        let totalEnergyWh = 0;
        let batterySoC = 0;

        for (const [applianceId, data] of this.lastValues) {
            if (data.messageType === 'InverterValuesUpdateV1') {
                totalPowerW += data.values.powerW || 0;
                totalEnergyWh += data.values.energyWh || 0;
            } else if (data.messageType === 'BatteryValuesUpdateV1') {
                batterySoC = data.values.stateOfCharge || 0;
            }
        }

        // Send aggregated metrics
        this.dataBus.sendMessage([{
            messageType: 'SystemMetricsUpdateV1',
            applianceId: 'system',
            timestamp: Date.now(),
            values: {
                totalPowerW,
                totalEnergyWh,
                batterySoC,
                systemEfficiency: this.calculateEfficiency()
            }
        }]);

        // Store historical data
        await this.storage.save(`metrics_${Date.now()}`, {
            totalPowerW,
            totalEnergyWh,
            batterySoC,
            timestamp: Date.now()
        });
    }

    private detectAnomalies(messageType: string, values: any) {
        // Example: Detect power spikes
        if (messageType === 'InverterValuesUpdateV1' && values.powerW > 10000) {
            const notifications = energyApp.useNotification();
            notifications.sendNotification({
                type: 'warning',
                title: 'High Power Output',
                message: `Inverter reporting ${values.powerW}W - check for issues`
            });
        }
    }

    private handleCommand(message: any) {
        console.log('Received command:', message);
        // Process control commands

        // Send acknowledgment
        this.dataBus.sendAnswer({
            originalMessageId: message.id,
            success: true,
            timestamp: Date.now()
        });
    }

    private calculateEfficiency(): number {
        // Implement efficiency calculation logic
        return 95.5;
    }
}

energyApp.register(async (packageName, version) => {
    const processor = new EnergyDataProcessor();
    await processor.initialize();

    console.log('Energy data processor ready');
    energyApp.updateEnergyAppState('running');
});
```

### Settings Management

Dynamic configuration with user interface:

```typescript
import { EnergyApp } from '@enyo-energy/energy-app-sdk';

const energyApp = new EnergyApp();

class ConfigurableEnergyApp {
    private settings = energyApp.useSettings();
    private config = {
        pollIntervalSec: 30,
        maxPowerW: 5000,
        enableNotifications: true,
        priceThreshold: 0.25
    };

    async initialize() {
        // Define app settings
        await this.setupSettings();

        // Load current settings
        await this.loadSettings();

        // Listen for setting changes
        this.settings.listenForSettingsChanges((settingName, newValue) => {
            this.handleSettingChange(settingName, newValue);
        });
    }

    private async setupSettings() {
        const settingConfigs = [
            {
                name: 'pollInterval',
                displayName: [{ language: 'en', name: 'Data Collection Interval (seconds)' }],
                description: [{ language: 'en', name: 'How often to collect data from devices' }],
                type: 'number',
                defaultValue: '30',
                validation: {
                    min: 10,
                    max: 300
                }
            },
            {
                name: 'maxPowerLimit',
                displayName: [{ language: 'en', name: 'Maximum Power Limit (W)' }],
                type: 'number',
                defaultValue: '5000',
                validation: {
                    min: 1000,
                    max: 20000
                }
            },
            {
                name: 'enableNotifications',
                displayName: [{ language: 'en', name: 'Enable Notifications' }],
                type: 'boolean',
                defaultValue: 'true'
            },
            {
                name: 'electricityPriceThreshold',
                displayName: [{ language: 'en', name: 'Price Alert Threshold (€/kWh)' }],
                type: 'number',
                defaultValue: '0.25',
                validation: {
                    min: 0.01,
                    max: 1.0,
                    step: 0.01
                }
            }
        ];

        // Add all settings
        for (const config of settingConfigs) {
            await this.settings.addSettingConfig(config);
        }
    }

    private async loadSettings() {
        const allSettings = await this.settings.getSettingsConfig();

        for (const setting of allSettings) {
            switch (setting.name) {
                case 'pollInterval':
                    this.config.pollIntervalSec = parseInt(setting.currentValue);
                    break;
                case 'maxPowerLimit':
                    this.config.maxPowerW = parseInt(setting.currentValue);
                    break;
                case 'enableNotifications':
                    this.config.enableNotifications = setting.currentValue === 'true';
                    break;
                case 'electricityPriceThreshold':
                    this.config.priceThreshold = parseFloat(setting.currentValue);
                    break;
            }
        }

        console.log('Loaded configuration:', this.config);
    }

    private async handleSettingChange(settingName: string, newValue: string) {
        console.log(`Setting ${settingName} changed to: ${newValue}`);

        switch (settingName) {
            case 'pollInterval':
                this.config.pollIntervalSec = parseInt(newValue);
                await this.restartDataCollection();
                break;
            case 'maxPowerLimit':
                this.config.maxPowerW = parseInt(newValue);
                await this.updatePowerLimits();
                break;
            case 'enableNotifications':
                this.config.enableNotifications = newValue === 'true';
                break;
            case 'electricityPriceThreshold':
                this.config.priceThreshold = parseFloat(newValue);
                await this.updatePriceAlerts();
                break;
        }
    }

    private async restartDataCollection() {
        // Restart intervals with new timing
        console.log(`Restarting data collection with ${this.config.pollIntervalSec}s interval`);
    }

    private async updatePowerLimits() {
        // Apply new power limits to devices
        console.log(`Setting maximum power limit to ${this.config.maxPowerW}W`);
    }

    private async updatePriceAlerts() {
        // Update electricity price monitoring
        const prices = energyApp.useElectricityPrices();
        prices.onPriceChange((newPrice) => {
            if (this.config.enableNotifications &&
                newPrice.pricePerKwh > this.config.priceThreshold) {

                const notifications = energyApp.useNotification();
                notifications.sendNotification({
                    type: 'info',
                    title: 'High Electricity Price',
                    message: `Current price ${newPrice.pricePerKwh}€/kWh exceeds threshold`
                });
            }
        });
    }
}

energyApp.register(async (packageName, version) => {
    const app = new ConfigurableEnergyApp();
    await app.initialize();

    energyApp.updateEnergyAppState('running');
    console.log('Configurable Energy App ready');
});
```

## Troubleshooting

### Common Issues

#### `Missing energyAppSdk instance`
This error occurs when running outside the enyo runtime environment. For development, ensure your app is properly packaged and deployed to the enyo system.

#### Permission Denied Errors
- Check your package definition includes required permissions
- Verify the permission names match exactly (case-sensitive)
- Some permissions like `AllAppliances` require special approval

#### Modbus Connection Failures
- Verify network device is reachable
- Check Modbus unit ID and register addresses
- Ensure device supports the Modbus protocol version you're using
- Use connection health monitoring to detect issues

#### Data Bus Message Not Received
- Confirm you have `SubscribeDataBus` permission
- Check message type names are exact matches
- Verify the listener is registered before messages are sent

### Best Practices

#### Error Handling
Always wrap async operations in try-catch blocks:

```typescript
try {
    await energyApp.useStorage().save('key', data);
} catch (error) {
    console.error('Storage operation failed:', error);
    // Handle gracefully
}
```

#### Resource Cleanup
Register cleanup handlers for graceful shutdown:

```typescript
energyApp.onShutdown(async () => {
    // Clean up intervals
    interval.stopInterval(intervalId);
    // Close connections
    await modbusClient.disconnect();
    // Save state
    await storage.save('lastShutdown', Date.now());
});
```

#### State Management
Always update your app state appropriately:

```typescript
// On successful initialization
energyApp.updateEnergyAppState('running');

// When configuration is needed
energyApp.updateEnergyAppState('configuration-required');

// When internet is required
energyApp.updateEnergyAppState('internet-connection-required');
```

## External Libraries

Some npm packages cannot be bundled by rsbuild due to native dependencies or dynamic require statements. Common examples include the `ws` WebSocket library. To use such libraries, configure rsbuild to copy them as external vendors:

```javascript
// rsbuild.config.js
import { defineConfig } from '@rsbuild/core';

export default defineConfig({
    output: {
        target: 'node',
        externals: {
            ws: './vendor/ws',
        },
        copy: [
            {
                from: 'node_modules/ws',
                to: 'vendor/ws',
            },
        ],
    },
});
```

This configuration:
1. Marks `ws` as an external dependency, preventing rsbuild from bundling it
2. Copies the `ws` package from `node_modules` to a `vendor/ws` directory in the output
3. Resolves imports of `ws` to the copied vendor location at runtime

You can apply this pattern to any library that cannot be bundled by adding entries to both `externals` and `copy`.

## CLI Tool

Use the enyo CLI to initialize projects and publish Energy Apps easily. The CLI provides scaffolding, testing, and deployment capabilities for rapid development.

For CLI documentation and installation instructions, visit the [enyo CLI repository](https://github.com/enyo-energy/enyo-cli).

## Releasing Your App

To release your Energy App to the enyo platform, use the official CLI tool.

### Installation

Install the enyo CLI globally:

```bash
npm install -g @enyo-energy/cli
```

### Release Command

Once your app is ready for deployment, run:

```bash
enyo release --api-key <DEVELOPER_ORG_API_KEY>
```

Replace `<DEVELOPER_ORG_API_KEY>` with your developer organization API key.

For more information about the CLI, visit [@enyo-energy/cli on npm](https://www.npmjs.com/package/@enyo-energy/cli).

---

**Package Version:** 0.0.34
**SDK Version:** Auto-injected during build
**License:** ISC
**Repository:** [github.com/enyo-energy/energy-app-sdk](https://github.com/enyo-energy/energy-app-sdk)