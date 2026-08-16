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
  - [Networking & Protocols](#networking--protocols)
  - [Location & Site](#location--site)
  - [Energy Domain APIs](#energy-domain-apis)
  - [Operational Utilities](#operational-utilities)
- [Advanced Modbus Integration](#advanced-modbus-integration)
- [Appliance Management](#appliance-management)
- [Network Devices & Access Recovery](#network-devices--access-recovery)
  - [NetworkAccessGuard](#networkaccessguard)
  - [NetworkDeviceManager](#networkdevicemanager)
  - [Startup pattern](#startup-pattern)
- [Firmware Update Registry](#firmware-update-registry)
  - [Declaring firmware](#declaring-firmware)
  - [Firmware modes](#firmware-modes)
  - [Resolving the next version](#resolving-the-next-version)
  - [Downloading a file](#downloading-a-file)
  - [Validating the graph](#validating-the-graph)
- [Retry Framework](#retry-framework)
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
  - [AirConditioningConsumptionForecast](#airconditioningconsumptionforecast)
  - [AirConditioningRoomTemperatureForecast](#airconditioningroomtemperatureforecast)
- [Appliance Energy-Manager Forecast](#appliance-energy-manager-forecast)
  - [`useApplianceEnergyManagerForecast()`](#useapplianceenergymanagerforecast-energyappapplianceenergymanagerforecast)
  - [ChargerForecast](#chargerforecast)
  - [BatteryCommandForecast](#batterycommandforecast)
  - [HeatpumpForecast](#heatpumpforecast)
  - [Validators](#validators)
- [Automations](#automations)
  - [The model](#-the-model)
  - [Guide: Energy Manager apps](#-guide-energy-manager-apps)
  - [Guide: regular energy apps (smart plugs like Shelly)](#-guide-regular-energy-apps-smart-plugs-like-shelly)
  - [End-to-end: pool pump on solar](#-end-to-end-pool-pump-on-solar)
  - [Mandatory vs Flexible (current limitation)](#-mandatory-vs-flexible-current-limitation)
  - [Permissions](#-permissions)
  - [Validators](#-validators)
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
| Forecast air conditioning electrical consumption | [`AirConditioningConsumptionForecast`](#airconditioningconsumptionforecast) |
| Forecast air conditioning room temperature | [`AirConditioningRoomTemperatureForecast`](#airconditioningroomtemperatureforecast) |
| Announce a charger / battery / heatpump command plan you **intend to apply** | [`useApplianceEnergyManagerForecast()`](#useapplianceenergymanagerforecast-energyappapplianceenergymanagerforecast) |
| Talk to an EEBUS / SHIP / SPINE device | [`useEebus()`](#useeebus-energyappeebus) |
| Speak MQTT (SDK broker or external) | [`useMqtt()`](#usemqtt-energyappmqtt) |
| Scan or talk to Bluetooth LE peripherals | [`useBluetooth()`](#usebluetooth-energyappbluetooth) |
| Send/receive UDP datagrams | [`useUdp()`](#useudp-energyappudp) |
| Read serial Modbus RTU | [`useModbusRtu()`](#usemodbusrtu-energyappmodbusrtu) |
| List known WiFi SSIDs in range | [`useWifi()`](#usewifi-energyappwifi) |
| Query historical timeseries (PV, battery, meter, …) | [`useTimeseries()`](#usetimeseries-energyapptimeseries) |
| Read site location (zip or coordinates) | [`useLocation()`](#uselocation-energyapplocation) |
| Read grid connection point (fuse, phases, max power) | [`useGridConnectionPoint()`](#usegridconnectionpoint-energyappgridconnectionpoint) |
| Retrieve secrets from the developer org secret store | [`useSecretManager()`](#usesecretmanager-energyappsecretmanager) |
| Submit energy-manager diagnostics | [`useDiagnostics()`](#usediagnostics-energyappdiagnostics) |
| Register a weather / PV / dynamic-price forecast provider | [`useWeatherForecasting()`](#useweatherforecasting-energyappweatherforecasting) / [`usePvForecasting()`](#usepvforecasting-energyapppvforecasting) / [`useDynamicPriceForecast()`](#usedynamicpriceforecast-energyappdynamicpriceforecast) |
| Read EPEX SPOT wholesale prices (incl. negative-price windows) | [`useEpexSpotPrices()`](#useepexspotprices-energyappepexspotprice) |
| Manage electricity tariffs (default tariff, price per kWh) | [`useElectricityTariff()`](#useelectricitytariff-energyappelectricitytariff) |
| Register a PV system (kWp, DC strings, orientation) | [`usePvSystem()`](#usepvsystem-energyapppvsystem) |
| Discover capabilities of the active energy manager | [`useEnergyManager()`](#useenergymanager-energyappenergymanager) |
| Drive a multi-step onboarding flow | [`useOnboarding()`](#useonboarding-energyapponboarding) |
| Allocate process-local sequential IDs | [`useSequenceGenerator()`](#usesequencegenerator-energyappsequencegenerator) |
| Manage retries with circuit-breaker semantics | [`RetryManager`](#retry-framework) |
| Keep an `applianceId` cache in sync with the SDK | [`ApplianceManager`](#appliance-management) |

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
            }],
            mdns: [{
                // The Envoy advertises under a vendor-specific service type; without
                // `serviceType` the host never browses it and this rule can't fire.
                serviceType: '_enphase-envoy._tcp.local',
                key: 'serialnum',
                operation: 'startsWith',
                matchingValues: ['1224']
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
- `AirConditioning`: Air-conditioning units
- `BatteryStorage`: Battery management
- `ClimateControl`: HVAC and climate systems
- `DynamicElectricityTariff`: Dynamic / spot-price tariff providers
- `StaticElectricityTariff`: Fixed-price tariff providers
- `TemperatureSensor`: Standalone temperature sensors
- `SmartPlug`: Smart-plug appliances
- `Other`: Anything not covered above

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

#### Command Permissions

- **`InverterControlCommands`**: Send inverter control commands (e.g. feed-in limit)
- **`BatteryControlCommands`**: Send battery / storage control commands
- **`ChargerControlCommands`**: Send wallbox / charger control commands

#### Networking & Protocol Permissions

- **`ModbusRtu`**: Communicate over Modbus RTU (serial)
- **`EebusDeviceManagement`**: Pair / discover / connect EEBUS devices
- **`EebusDataAccess`**: Read EEBUS use-case data
- **`EebusControl`**: Send EEBUS control commands (write features)
- **`Mqtt`**: Connect to the internal SDK MQTT broker or external brokers
- **`Bluetooth`**: Scan and talk to BLE peripherals
- **`Wifi`**: List known WiFi SSIDs
- **`Udp`**: Bind UDP sockets and exchange datagrams
- **`ChildProcess`**: Spawn child processes from the runtime

#### Data & Domain Permissions

- **`Timeseries`**: Query historical timeseries data
- **`EnergyPrices`**: Read current and forecast electricity prices
- **`ElectricityTariff`**: Manage electricity tariffs
- **`EnergyManager`**: Run as the active energy manager
- **`EnergyManagerInfo`**: Read information about the active energy manager
- **`WeatherForecastRegister`** / **`WeatherForecastUse`**: Publish / consume weather forecasts
- **`PvForecastRegister`** / **`PvForecastUse`**: Publish / consume PV forecasts
- **`DynamicPriceForecastRegister`** / **`DynamicPriceForecastUse`**: Publish / consume dynamic-price forecasts
- **`PvSystemRegister`** / **`PvSystemUse`**: Register / read PV system configuration
- **`Savings`**: Publish and read back day-scoped savings reports
- **`EpexSpotPrices`**: Read EPEX SPOT day-ahead wholesale market prices

#### Site & Identity Permissions

- **`LocationZipCode`**: Read the site's zip-code-level location
- **`LocationCoordinates`**: Read the site's full coordinates
- **`SecretManager`**: Read developer-org secrets

#### Internet Access

- **`RestrictedInternetAccess`**: Access specific internet domains only

## API Reference

### Lifecycle Management

#### `register(callback: (packageName: string, version: number, channel: EnyoPackageChannel, deviceId: string) => void | Promise<void>)`

Register a callback that executes when your Energy App starts. The callback receives the package name, version, release channel (`stable` / `beta` / …), and the device ID the package is running on. It may be `async`.

```typescript
energyApp.register(async (packageName, version, channel, deviceId) => {
    console.log(`${packageName} v${version} on ${channel} (device ${deviceId}) is now running`);
    // Initialize your app here
});
```

#### `onNetworkStatusChanged(listener: (online: boolean) => void | Promise<void>): string`

Subscribe to system-online transitions. Returns a listener ID. Pairs well with [`isSystemOnline()`](#issystemonline-boolean) for first-state, then deltas:

```typescript
const listenerId = energyApp.onNetworkStatusChanged((online) => {
    console.log(online ? 'System back online' : 'System went offline');
});
```

#### `onShutdown(callback: () => void | Promise<void>)`

Register cleanup logic for graceful shutdown. The callback may be sync or async; it runs on Node `beforeExit` **and** `exit`.

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

#### `useDeviceTest(): EnergyAppDeviceTest`

Answer the host's "is this device yours, and did it yield appliances?" question.

Every other device API points outward — you scan, or you get notified, and you decide what to do next. This one is inverted: the host has detected a device it cannot identify on its own and calls **into** your app. Register one handler; it is used by the onboarding v2 `device-test` action, by background auto-detection, and by user-triggered re-tests (see `request.origin`).

```typescript
await energyApp.useDeviceTest().registerDeviceTestHandler(async (request) => {
    const devices: EnyoDeviceTestDeviceResult[] = [];
    const appliances: EnyoDeviceTestApplianceResult[] = [];

    for (const device of request.devices) {
        const identity = await readVendorRegisters(device);       // your protocol
        if (!identity) {
            devices.push({networkDeviceId: device.id, outcome: EnyoDeviceTestOutcomeEnum.NotSupported});
            continue;
        }

        const existing = await findApplianceForSerial(identity.serialNumber);
        const applianceId = await energyApp.useAppliances().save(buildAppliance(device, identity), existing?.id);

        appliances.push({
            applianceId,
            applianceType: EnyoApplianceTypeEnum.Inverter,
            disposition: existing
                ? EnyoDeviceTestApplianceDispositionEnum.Updated
                : EnyoDeviceTestApplianceDispositionEnum.Created,
            networkDeviceId: device.id
        });
        devices.push({
            networkDeviceId: device.id,
            outcome: existing
                ? EnyoDeviceTestOutcomeEnum.AppliancesAlreadyExisted
                : EnyoDeviceTestOutcomeEnum.AppliancesCreated,
            vendor: identity.vendor,
            model: identity.model,
            serialNumber: identity.serialNumber
        });
    }

    return {
        requestId: request.requestId,
        outcome: aggregateDeviceTestOutcome(devices),
        devices,
        appliances
    };
});
```

Rules worth respecting:

- **The host owns the clock.** `request.timeoutMs` is your budget; the host stops waiting when it expires and treats the run as `failed`. Your handler is *not* told, so bound socket timeouts and retries to fit and never leave connections open past the point where an answer could matter.
- **One handler per package.** Registering again replaces the previous one. Register during startup — a request arriving before registration is answered `failed`, which in a guided run means the installer sees the failure branch.
- **Answer for every device.** A twelve-device scan needs twelve verdicts; "three are mine, one needs a password, eight are the neighbour's printer" is the normal case.
- **`created` vs `already-existed` are different answers.** Both are successes, but the guide branches differently — one is "set up", the other "already set up".
- **Derive the aggregate with `aggregateDeviceTestOutcome()`.** Success dominates a sibling device's failure, and actionable outcomes outrank unactionable ones; hand-rolling that precedence is where the bugs are.
- **No permission is needed to register**, but the work inside needs `NetworkDeviceAccess` to reach a device and `Appliance` to create one. Without them, answer `access-not-granted` rather than throwing.

Validate a result during development with `validateDeviceTestResult(result, request)` — it catches contradictions like `appliances-created` with no created appliance, which would otherwise route an installer to a success screen for appliances that do not exist.

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

**Available intervals**: `'1s'`, `'5s'`, `'10s'`, `'30s'`, `'1m'`, `'5m'`, `'1hr'` (defined by the `IntervalDuration` type — any other string is rejected).

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

React to charging sessions as they happen:

```typescript
const charge = energyApp.useCharge();

const startedId = charge.listenForChargeStarted((session) => {
    console.log(`charging started on ${session.applianceId}`);
});

const updatedId = charge.listenForChargeUpdated((session) => {
    const latest = session.meterValues?.at(-1);
    console.log(`now at ${latest?.valueWh} Wh`);
});

const stoppedId = charge.listenForChargeStopped((session) => {
    if (session.status === EnyoChargeStatus.Completed) {
        console.log(`delivered ${session.totalEnergyKwh} kWh`);
    }
});

// later
charge.removeListener(startedId);
```

The three events are disjoint: `listenForChargeUpdated` fires only for changes to a
*running* session (meter values, charge mode, smart-charging schedule, additional
transaction IDs), never for the start or the end, so a handler never sees the same
event twice. Check `session.status` in the stopped listener — `Completed` and
`Failed` both end a charge. Meter updates can arrive every few seconds, so keep
the update callback cheap.

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

#### `useConfigurationManager(): EnergyAppConfigurationManager`

Register **internal**, non user-facing configurations for your package and react to value changes. Unlike `useSettings()`, configurations registered here are NOT rendered in the Energy App UI — they are intended for values the package itself reads and writes at runtime (e.g. internal feature toggles, tuning parameters, calibration values) and need to be persisted across restarts.

Each configuration is addressed by a unique `key` and is either of type `number` (with optional `minValue` / `maxValue` / `step` constraints) or `select` (with a fixed list of allowed `selectOptions`).

```typescript
const configManager = energyApp.useConfigurationManager();

// Register the full set of internal configurations in a single call
await configManager.registerConfigurations([
    {
        key: 'pollIntervalMs',
        type: 'number',
        defaultValue: 5000,
        numberOptions: { minValue: 1000, maxValue: 60000, step: 1000 }
    },
    {
        key: 'logLevel',
        type: 'select',
        defaultValue: 'info',
        selectOptions: [
            { value: 'debug' },
            { value: 'info' },
            { value: 'warn' },
            { value: 'error' }
        ]
    }
]);

// Read the current (or default) value for a configuration
const pollInterval = await configManager.getConfiguration('pollIntervalMs');

// React to value changes
configManager.onConfigurationChanged(event => {
    console.log(
        `Configuration ${event.key} changed from ${event.previousValue} to ${event.newValue}`
    );
});

// Remove configurations (e.g. on cleanup or after a migration)
await configManager.unregisterConfigurations(['logLevel']);
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

### Networking & Protocols

#### `useEebus(): EnergyAppEebus`

Talk to EEBUS / SHIP / SPINE devices. The returned facade exposes four sub-interfaces:

- `devices` — SHIP-level lifecycle: discovery, pairing, connection.
- `identity` — Node Identification (NID), observable identity, supported use-case discovery.
- `useCases` — typed use-case clients (LPC, LPP, MGCP, MPC, OHPCF).
- `spine` — low-level SPINE escape hatch for features not yet wrapped.

```typescript
const eebus = energyApp.useEebus();

const discovered = await eebus.devices.getDiscoveredDevices();
const device = await eebus.devices.pairDevice(discovered[0].ski);

const identity = await eebus.identity.get(device.ski);
const useCases = await eebus.identity.getSupportedUseCases(device.ski);
```

Requires the `EebusDeviceManagement` permission for the calls above. `EebusDataAccess` / `EebusControl` gate reads and writes on use-case features.

#### `useMqtt(): EnergyAppMqtt`

Connect to the internal SDK MQTT broker or an external broker, publish, subscribe, and observe connection status.

```typescript
const mqtt = energyApp.useMqtt();
const client = await mqtt.connectToSdkBroker();

await client.subscribe('sensors/+/temperature');
client.onTopic('sensors/+/temperature', (payload) => {
    console.log('Sensor reading:', payload.toString());
});

await client.publish('control/pump', 'on', /* qos */ 1, /* retain */ false);
```

For external brokers use `connectToExternalBroker(brokerUrl, options)`. Requires the `Mqtt` permission.

#### `useBluetooth(): EnergyAppBluetooth`

Scan for BLE peripherals and perform GATT read / write / notify against them.

```typescript
const ble = energyApp.useBluetooth();

const devices = await ble.scan({ durationMs: 5000 });

await ble.withDevice(devices[0].address, async (session) => {
    const value = await session.read('1800', '2a00');
    await session.write('180a', '2a29', new TextEncoder().encode('hi'));
});
```

Notifications can be consumed three ways from the session: `notifications(svc, ch).onValue(cb)` (push), `.next(timeoutMs)` (pull-once), or `.values()` (async iterator). Requires the `Bluetooth` permission.

#### `useUdp(): EnergyAppUdp`

Bind UDP sockets and exchange datagrams. Lazily instantiates a single server instance and reuses it on subsequent calls; the permission gate runs on every accessor call so revocations surface consistently.

```typescript
const udp = energyApp.useUdp();
const socket = await udp.bind(5000);

socket.onMessage((data, rinfo) => {
    console.log(`Received ${data.length}B from ${rinfo.address}:${rinfo.port}`);
});

await socket.send(new TextEncoder().encode('hello'), 5001, '192.168.1.50');
```

Throws `EnergyAppPermissionNotGrantedError` if the `Udp` permission isn't granted.

#### `useModbusRtu(): EnergyAppModbusRtu`

Modbus RTU over serial. Open a port with baud rate / parity / data bits / stop bits, then read/write registers by slave ID.

```typescript
const rtu = energyApp.useModbusRtu();
const client = await rtu.connect('/dev/ttyUSB0', { baudRate: 9600, parity: 'none' });

const registers = await client.readRegisters(/* slaveId */ 1, /* startReg */ 0, /* count */ 10);
await client.writeRegisters(1, 100, [42, 43]);
```

Requires the `ModbusRtu` permission.

#### `useWifi(): EnergyAppWifi`

List the SSIDs the device is configured to join that are currently in range.

```typescript
const wifi = energyApp.useWifi();
const ssids = await wifi.getKnownSsids();
for (const { ssid } of ssids) console.log(ssid);
```

Requires the `Wifi` permission.

### Location & Site

#### `useLocation(): EnergyAppLocation`

Two-tier location API. Zip-code resolution and full coordinates are gated by separate permissions so apps can opt into the minimum precision they need.

```typescript
const location = energyApp.useLocation();

const zip = await location.getZipCodeLocation();          // requires LocationZipCode
const full = await location.getLocation();                 // requires LocationCoordinates
if (full) console.log(`lat=${full.latitude} lon=${full.longitude}`);
```

#### `useGridConnectionPoint(): EnergyAppGridConnectionPoint`

Read the site's grid connection details — main fuse rating, number of phases, and the maximum allowed grid power. Use this to size dispatch envelopes and avoid violating the contractual cap.

```typescript
const gcp = energyApp.useGridConnectionPoint();
const point = await gcp.getGridConnectionPoint();
if (point) {
    console.log(`Fuse ${point.fuseAmpere}A across ${point.numberOfPhases} phases`);
}
```

### Energy Domain APIs

#### `useEnergyManager(): EnergyAppEnergyManager`

Read information about the currently active energy manager (vendor, version, supported features). Useful for apps that want to behave differently depending on which manager owns dispatch.

```typescript
const em = energyApp.useEnergyManager();
const info = await em.getEnergyManagerInfo();
if (info) console.log(`Active manager: ${info.name} v${info.version}`);
```

Requires the `EnergyManagerInfo` permission.

#### `useElectricityTariff(): EnergyAppElectricityTariff`

Register, retrieve, and manage electricity tariffs. One tariff can be marked as the system default.

```typescript
const tariffs = energyApp.useElectricityTariff();

await tariffs.registerTariff({ id: 't1', name: 'Spot 2026', pricePerKwh: 0.21 });
await tariffs.makeDefaultTariff('t1');

const defaultTariff = await tariffs.getDefaultTariff();
const all = await tariffs.getAllTariffs();
```

Requires the `ElectricityTariff` permission.

#### `useWeatherForecasting(): EnergyAppWeatherForecasting`

Register a weather-forecast provider (e.g. wraps an external API) and / or consume forecasts by zip code or coordinates.

```typescript
const weather = energyApp.useWeatherForecasting();

await weather.registerForecast({ forecastId: 'wx-prod', name: 'OpenWeather' });
const byZip = await weather.getWeatherForecastByZipCode('wx-prod');
const byCoords = await weather.getWeatherForecastByCoordinates('wx-prod', 48.13, 11.57);
```

Publishers need `WeatherForecastRegister`; consumers need `WeatherForecastUse`.

#### `usePvForecasting(): EnergyAppPvForecasting`

Same shape as weather forecasting, but for PV production.

```typescript
const pvForecast = energyApp.usePvForecasting();
await pvForecast.registerForecast({ forecastId: 'pv-prod', name: 'Solargis' });
const forecast = await pvForecast.getPvForecast('pv-prod');
```

Publishers need `PvForecastRegister`; consumers need `PvForecastUse`.

#### `useDynamicPriceForecast(): EnergyAppDynamicPriceForecast`

Publish and consume forward-looking electricity-price forecasts (e.g. day-ahead spot). The data is forecast only — never settled prices.

```typescript
const dpf = energyApp.useDynamicPriceForecast();

await dpf.registerForecast({ forecastId: 'epex-da', name: 'EPEX Day-Ahead', vendor: 'EPEX' });
await dpf.publishForecast('epex-da', {
    currency: 'EUR',
    resolution: '1h',
    entries: [{ timestampIso: '2026-05-23T10:00:00Z', consumptionPricePerKwh: 0.21 }]
});

const latest = await dpf.getLatestForecast();
dpf.onForecastPublished((forecast) => console.log('new forecast', forecast.forecastId));
```

Publishers need `DynamicPriceForecastRegister`; consumers need `DynamicPriceForecastUse`.

#### `useEpexSpotPrices(): EnergyAppEpexSpotPrice`

Read the EPEX SPOT day-ahead wholesale prices the host caches for this device, so an energy manager can decide when to charge, when to run a flexible load, and when to stop exporting PV.

These are **raw market prices** — no grid fees, levies, taxes or supplier margin — and they go **negative** when supply outruns demand. For what the customer is billed use [`useElectricityPrices()`](#useelectricityprices-energyappenergyprices); for forecasts published by other apps use [`useDynamicPriceForecast()`](#usedynamicpriceforecast-energyappdynamicpriceforecast).

```typescript
const epex = energyApp.useEpexSpotPrices();

const now = await epex.getCurrentSpotPrice();
if (now && now.pricePerKwh < 0) {
    // feeding in costs money right now
}

const tomorrow = await epex.getSpotPrices({
    fromIso: '2026-08-13T00:00:00Z',
    untilIso: '2026-08-14T00:00:00Z'
});

// Pre-grouped runs of sub-zero periods — the shape curtailment logic wants.
const windows = await epex.getNegativePriceWindows();

// Tomorrow's auction clears around 14:00 CET; re-plan when it lands.
epex.onSpotPricesUpdated(prices => scheduler.replan(prices.entries));
```

Notes worth respecting:

- **Read `resolution`, don't assume it.** EPEX SPOT day-ahead moved to 15-minute periods in 2025, but older data is still hourly.
- **The series may be shorter than you asked for.** Before the day-ahead auction clears (14:00 CET/CEST), only today exists — check the last entry's `endTimestampIso`.
- **`retrievedAtIso` tells you how stale the cache is** after the device has been offline.
- Prices come both as `pricePerMwh` (the exchange's own unit) and `pricePerKwh` (the SDK's convention).
- Inverter appliances carry a `blockFeedInOnNegativePrices` flag in their metadata (`EnyoInverterApplianceMetadata`). It is configuration, not state: whoever controls the inverter is responsible for curtailing export to 0 W while the price is negative and lifting the curtailment afterwards.

Requires the `EpexSpotPrices` permission.

#### `usePvSystem(): EnergyAppPvSystem`

Register a PV system's structural configuration (kWp, DC string orientations, associated appliances) so other apps can reason about expected production.

```typescript
const pv = energyApp.usePvSystem();
await pv.registerPvSystem({
    id: 'pv-1',
    kWp: 9.6,
    dcStrings: [
        { azimuth: 180, tilt: 30 },
        { azimuth: 90, tilt: 30 }
    ]
});
const systems = await pv.getPvSystems();
```

Publishers need `PvSystemRegister`; consumers need `PvSystemUse`.

#### `useTimeseries(): EnergyAppTimeseries`

Query historical 15-minute aggregated data across the energy domain (PV production, battery SoC / power, meter values, grid power, home consumption, heatpump electrical / thermal, air-conditioning, temperature sensors). Some endpoints also support 1-minute resolution.

```typescript
const ts = energyApp.useTimeseries();
const last24h = await ts.query({
    dataType: 'pvProduction',
    resolution: '15m',
    startTime: Date.now() - 24 * 60 * 60 * 1000,
    endTime: Date.now()
});
```

Requires the `Timeseries` permission.

#### `useDiagnostics(): EnergyAppDiagnostics`

Energy-manager packages can submit their current state, forecast, and control plan to internal diagnostics for offline analysis. Fire-and-forget.

```typescript
const diag = energyApp.useDiagnostics();
diag.energyManagerDiagnostics(
    { batterySoc: 47, gridPowerW: 1200 },
    { pvNext24h: [...] },
    { actions: [{ applianceId: 'battery-1', mode: 'charge', powerW: 3000 }] }
);
```

#### `useSavings(): EnergyAppSavings`

Publish what the energy management saved the customer on a finished day, and read back which days were already reported.

The app settles a day by replaying its **measured** environment through a simulation of the same house running **uncontrolled**, and pricing both worlds against the tariff that actually applied. Publishing is an upsert keyed by `dayIso` + `method`, so a day may be recomputed after a backfill or a bugfix. The platform stores days and owns every aggregation above them (month, year, lifetime) — and excludes `Low` confidence days from those rollups.

```typescript
const savings = energyApp.useSavings();

// On boot: which days still need settling?
const { missingDayIsos } = await savings.getDailySavings({
    startDayIso: '2026-07-01',
    endDayIso: '2026-07-31'
});

for (const dayIso of missingDayIsos) {
    await savings.publishDailySavings({
        schemaVersion: 1,
        dayIso,
        timeZone: 'Europe/Berlin',
        dayStartUtcMs: startOfLocalDayUtcMs(dayIso),
        dayEndUtcMs: endOfLocalDayUtcMs(dayIso),   // 23 or 25 h on DST days
        method: EnyoSavingsMethodEnum.Settled,
        computedAtIso: new Date().toISOString(),
        calculatorVersion: '3.2.0',
        confidence: EnyoSavingsConfidenceEnum.High,
        confidenceIssues: [],
        costs: {
            currency: EnyoCurrencyEnum.EUR,
            optimizedCost: 1.42,
            baselineCost: 3.07,
            savings: 1.65,
            savingsFromSelfConsumption: 1.12,
            savingsFromArbitrage: 0.53
        },
        energy: { /* both worlds, Wh */ },
        metrics: { /* both worlds */ },
        attribution: [
            { applianceType: EnergyAppApplianceTypeEnum.Charger, savings: 0.91, shiftedEnergyWh: 12400 }
        ],
        coverage: [
            { series: 'pv', source: EnyoSavingsDataSourceEnum.Measured, expectedBuckets: 96, presentBuckets: 96 }
        ],
        assumptions: [
            { key: 'battery.dischargeEfficiency', value: 0.95 }
        ]
    });
}
```

Notes worth respecting when producing a report:

- **Publish both worlds, never only the delta.** A lone savings number is unauditable and cannot be re-aggregated.
- **Assumptions travel with the report.** The counterfactual rests on guesses; without them, changing a default silently rewrites history.
- **`dayIso` is a local calendar date.** The IANA zone and the exact UTC bounds go alongside — anything assuming 96 buckets is wrong twice a year.
- **Per-slot detail (`slots`) is opt-in.** Settlement is stateless, so the app can regenerate it on demand; only publish it for days under investigation.
- **Units follow the platform:** energy in Wh, power in W, prices per kWh, currency as `EnyoCurrencyEnum`.

Requires the `Savings` permission.

### Operational Utilities

#### `useOnboarding(): EnergyAppOnboarding`

Drive a multi-step onboarding guide — start / advance / back / skip / cancel, persist responses, and observe step transitions.

```typescript
const guide = energyApp.useOnboarding();

await guide.startGuide('pv-setup', EnyoOnboardingGuideCategory.PvSystem);
const step = await guide.nextStep('pv-setup');
await guide.respondToStep('pv-setup', { answer: 'yes' });

const listenerId = guide.onStepListener('pv-setup', (event) => {
    console.log('step changed:', event.stepId);
});
```

#### `useSecretManager(): EnergyAppSecretManager`

Encrypted retrieval / storage of developer-org secrets (API keys, vendor tokens, OAuth client secrets). Strongly typed accessors keep the call site safe.

```typescript
const secrets = energyApp.useSecretManager();

await secrets.saveSecret('weather-api', { token: 'xyz' });
const cred = await secrets.getSecret<{ token: string }>('weather-api');

const names = await secrets.listAvailableSecrets();
await secrets.removeSecret('weather-api');
```

Requires the `SecretManager` permission.

#### `useSequenceGenerator(): EnergyAppSequenceGenerator`

Process-local monotonic counter, keyed by an arbitrary name. Use it for stable request / message IDs without coordinating across instances.

```typescript
const seq = energyApp.useSequenceGenerator();
const reqId = await seq.next('mqtt-publish');   // 1, 2, 3, …
const txId = await seq.next('ocpp-tx');         // independent counter
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

## Appliance Management

`ApplianceManager` is the recommended way to keep the SDK's appliance list and your in-process state in sync. It wraps `useAppliances()` with caching, identifier-based lookup strategies, bulk operations, and helpers that the device-integrations and `NetworkDeviceManager` consume internally.

```typescript
import { ApplianceManager } from '@enyo-energy/energy-app-sdk';

const applianceManager = await ApplianceManager.initialize(energyApp, {
    // Optional config: identifier strategy, cache options, etc.
});

// Create or update by identifier (idempotent — uses the configured strategy).
const applianceId = await applianceManager.createOrUpdateAppliance({
    identifier: 'sn-1234567890',
    name: [{ language: 'en', name: 'Inverter A' }],
    type: EnyoApplianceTypeEnum.Inverter,
    /* ... */
});

// Lookups
const inverters = await applianceManager.getAppliancesByType(EnyoApplianceTypeEnum.Inverter);
const byId = await applianceManager.findApplianceById(applianceId);
const matches = await applianceManager.findByIdentifier('sn-1234567890');

// State transitions
await applianceManager.updateApplianceState(
    applianceId,
    EnyoApplianceConnectionType.Modbus,
    EnyoApplianceStateEnum.Connected
);
```

**Key methods**

| Method | Purpose |
|---|---|
| `static initialize(app, config?)` | Build a manager, prime the cache, install SDK listeners. |
| `createOrUpdateAppliance(config)` | Upsert by the configured `IdentifierStrategy`. Returns the appliance ID. Throws `MissingIdentifierError` if the strategy returns no identifier, or `DuplicateIdentifierError` if the identifier maps to more than one appliance. |
| `updateAppliance(id, patch)` | Patch an existing appliance. |
| `removeAppliance(id)` / `removeAppliancesByIdentifier(id)` | Delete one / many. |
| `findApplianceById(id)` | SDK lookup by appliance ID. Returns `null` on not-found; **propagates** SDK errors. |
| `findByIdentifier(extractedId)` | Cache-first lookup keyed by the configured identifier strategy. Falls through to one SDK list call on cache miss. |
| `findFirstByStrategies(value, strategies)` | Probes each strategy in order against the SDK list; returns the first match plus which strategy hit. |
| `findAppliancesByNetworkDeviceId(deviceId)` | Synchronous, cache-backed reverse lookup from a NetworkDevice to its appliances. |
| `getAppliancesByType(type)` / `getAllAppliancesByType(type)` | Filtered listing (own / all). |
| `updateApplianceState(id, connection, state)` | State transitions (`Connected` / `Offline` / `Error` / …). |
| `setAppliancesStateByIdentifier(id, state)` | Bulk state transition for every appliance sharing an identifier; preserves each appliance's existing `connectionType`. |
| `bulkUpdate(updates)` | Atomic batch of state changes. |
| `setIdentifierStrategy(strategy, rebuildCache)` / `getIdentifierStrategy()` | Swap the identifier-resolution strategy at runtime. `rebuildCache` is required: pass `false` to keep the cached appliances and just recompute the in-memory identifier index against the new strategy, or `true` to force a full refresh from the SDK. |
| `refreshCache()` / `clearCache()` | Manual cache control. |
| `dispose()` | Release SDK listeners. |

Identifier strategies are exported from the package — typical choices match on serial number, hostname, or a composite of `manufacturer + model + sn`.

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
- **Listener dedup** — both the manager's SDK access-change listener and the guard's own restored callback feed into the same internal `dispatchAccessRestored`. The manager records which devices have already been dispatched for the current `'granted'` transition and short-circuits a second dispatch, so the dedup is order-independent and does not rely on SDK listener FIFO semantics. The mark is cleared on the next non-granted transition or device removal.
- **AccessDenied vs AccessRevoked** — both signal "the package can no longer read this device", but the source differs. `onApplianceAccessDenied` fires when `withAccessGuard` catches a runtime read error (the SDK's "Network access denied" message). `onApplianceAccessRevoked` fires when the SDK explicitly reports a status transition to `'denied'` or `'pending'` (typically a user-driven UI action). Wire both if you want a single "lost access" signal — they will not double-fire for one underlying event.
- **One manager per `EnergyApp`** — `NetworkDeviceManager.initialize` enforces a single active manager per `EnergyApp` instance. Calling it a second time without first calling `dispose()` throws `NetworkDeviceManagerAlreadyInitializedError`. After disposal a fresh manager can be created.
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

## Firmware Update Registry

Ship firmware images with your package and hand them to devices at runtime. You declare the files by local path in the package definition, the enyo CLI uploads them during `enyo release`, and the app reaches them through `energyApp.useFirmwareRegistry()`. The release tarball never carries the bytes.

Requires the `FirmwareRegistry` permission.

**Firmware versions are opaque strings.** A version is whatever the vendor calls it — `2.4.1`, `2024-11-rc3`, `A7F2` — and is never parsed, ordered, or compared beyond exact equality. Nothing can be derived from the string itself, so the update order is declared rather than computed. `firmwareMode` picks which form that takes.

### Firmware modes

| `firmwareMode` | Order comes from | Use when |
|---|---|---|
| `'latest'` *(default)* | **Declaration order** — the last entry declared for the device's model is always the one offered | Devices accept any image directly |
| `'dependent'` | The explicit **`installForFirmwareVersion`** edges on each entry | Devices must be stepped through intermediate versions |

### Declaring firmware

`firmwareMode: 'latest'` — a plain list, last one wins:

```typescript
import { defineEnergyAppPackage, defineFirmwareFile, EnergyAppPackageFirmwareModeEnum, EnergyAppPermissionTypeEnum } from '@enyo-energy/energy-app-sdk';

export default defineEnergyAppPackage({
    version: '1',
    packageName: 'acme-wallbox',
    // ...
    permissions: [EnergyAppPermissionTypeEnum.FirmwareRegistry],
    firmwareMode: EnergyAppPackageFirmwareModeEnum.Latest,
    firmware: [
        defineFirmwareFile({
            fileId: 'ac22-2024-11',
            path: './firmware/ac22-2024-11.bin',
            firmwareVersion: '2024-11-rc3',
            modelNames: ['AC-22-Pro']
        }),
        defineFirmwareFile({
            fileId: 'ac22-current',
            path: './firmware/ac22-current.bin',
            firmwareVersion: 'A7F2',
            modelNames: ['AC-22-Pro']
        })
        // ↑ last declared for AC-22-Pro — every AC-22-Pro is offered this one
    ]
});
```

`firmwareMode: 'dependent'` — each entry declares the versions it installs *for*:

```typescript
firmwareMode: EnergyAppPackageFirmwareModeEnum.Dependent,
firmware: [
    defineFirmwareFile({
        fileId: 'ac22-baseline',
        path: './firmware/ac22-2024-11-rc3.bin',
        firmwareVersion: '2024-11-rc3',
        modelNames: ['AC-22-Pro'],
        // offered to devices whose reported version matches no declared entry
        fallbackForUnknownVersion: true
    }),
    defineFirmwareFile({
        fileId: 'ac22-hotfix-a',
        path: './firmware/ac22-hotfix-a.bin',
        firmwareVersion: 'A7F2',
        installForFirmwareVersion: ['2024-11-rc3'],
        modelNames: ['AC-22-Pro']
    }),
    defineFirmwareFile({
        fileId: 'ac22-stable',
        path: './firmware/ac22-stable.bin',
        firmwareVersion: '1.0',
        // collapses two old versions into one image
        installForFirmwareVersion: ['A7F2', 'legacy-b'],
        modelNames: ['AC-22-Pro'],
        releaseNotes: [
            { language: 'en', value: 'Fixes phase rotation detection.' },
            { language: 'de', value: 'Behebt die Erkennung der Phasenlage.' }
        ]
    })
]
```

`installForFirmwareVersion` is the whole graph. Three entries each naming their predecessor form a chain; two entries naming the same predecessor for *different* models form a branch; one entry naming several predecessors merges old versions into a single image. Omitting it makes an entry a root that is never offered as an update to a known version. Under `'latest'` the field is ignored (and the validator warns if you set it).

`modelNames` scopes resolution in both modes — an entry without it applies to every model the package supports.

### Resolving the next version

```typescript
const registry = energyApp.useFirmwareRegistry();

const next = await registry.getNextFirmware(device.reportedVersion, { modelName: 'AC-22-Pro' });
if (!next) {
    // Already up to date — the normal outcome, not an error.
    return;
}
console.log(`Update available: ${next.firmwareVersion} (${next.sizeBytes} bytes)`);
```

Under `'dependent'`, `getNextFirmware()` returns **one hop**, not the destination. After the device installs the image and reports its new version, call again to continue the chain — each step is verified on the device before the next is offered. When you need the whole chain up front:

```typescript
const path = await registry.getFirmwareUpdatePath(device.reportedVersion, { modelName: 'AC-22-Pro' });
const totalMb = path.reduce((sum, file) => sum + file.sizeBytes, 0) / 1_000_000;
console.log(`${path.length} updates pending, ${totalMb.toFixed(1)} MB total`);
```

Under `'latest'` there is no chain to walk: `getNextFirmware()` hands back the last declared entry for the model until the device runs it, and `getFirmwareUpdatePath()` never returns more than one entry.

### Downloading a file

Firmware images are large, so the bytes never cross the app/host boundary. Request a signed, time-limited URL instead — one that many wallboxes and inverters can fetch themselves:

```typescript
const download = await registry.requestDownloadUrl(next.fileId, { ttlSeconds: 900 });

// Either hand the URL to the device...
await device.installFirmwareFromUrl(download.url, download.sha256);

// ...or stream it into the app.
const response = await fetch(download.url);
```

Two rules:

- **Request the URL at the moment of use.** It expires at `download.expiresAt` (epoch ms) and the storage backend then rejects it. Never cache or persist it.
- **Always verify `sha256`** against the downloaded bytes before flashing.

### Validating the graph

An ambiguous or cyclic `'dependent'` graph has no correct resolution at runtime, so validate before releasing:

```typescript
import { validateFirmwareRegistry, assertValidFirmwareRegistry } from '@enyo-energy/energy-app-sdk';

const result = validateFirmwareRegistry(packageDefinition);
if (!result.ok) console.error(result.errors);
console.warn(result.warnings);

assertValidFirmwareRegistry(packageDefinition); // or throw on the first failure
```

Blocking errors in both modes: duplicate `fileId`s, two entries installing the same version for overlapping models, and declaring firmware without the `FirmwareRegistry` permission. Under `'dependent'` additionally: two entries installing for the same current version on overlapping models, cycles, an entry listing its own version in `installForFirmwareVersion`, and multiple fallbacks per model.

Warnings: under `'latest'`, entries that declare `installForFirmwareVersion` or `fallbackForUnknownVersion` — both are ignored there, so declaring them usually means `'dependent'` was intended. Under `'dependent'`: a source version matching no declared entry — which is exactly how you attach a chain to firmware that shipped before this registry existed — and entries that are neither reachable nor a fallback. In both modes: models or vendors missing from `compatibility`.

For local unit tests, `resolveNextFirmware()` and `resolveFirmwareUpdatePath()` run the same resolution the host performs, against a plain array of entries:

```typescript
resolveNextFirmware(definition.firmware ?? [], currentVersion, {
    modelName: 'AC-22-Pro',
    firmwareMode: definition.firmwareMode
});
```

## Retry Framework

`RetryManager` centralises retry / backoff / circuit-breaker logic so polling loops don't have to reinvent it. Register one entry per logical operation, give it a `RetryPolicy`, and run attempts through `execute(id, fn)` — the manager handles attempt counting, exponential backoff, transition into `Open` after repeated failures, and recovery on the next success.

```typescript
import { RetryManager, exponentialBackoff } from '@enyo-energy/energy-app-sdk';

const retries = new RetryManager();

retries.register('modbus-inverter-1', {
    backoff: exponentialBackoff({ initialMs: 1_000, maxMs: 60_000, factor: 2 }),
    maxAttempts: Infinity,           // keep retrying forever
    openAfterConsecutiveFailures: 5, // trip the breaker after 5 fails
});

const value = await retries.execute('modbus-inverter-1', () =>
    modbusClient.readHoldingRegisters(40000, 4)
);

// React to circuit-breaker transitions (Idle → Retrying → Open → Closed).
const unsubscribe = retries.onStateChange((snapshot) => {
    console.log(`[${snapshot.id}] ${snapshot.state} (attempt ${snapshot.attempts})`);
});

retries.statuses();         // current snapshots of every registered op
retries.reset('modbus-inverter-1');
retries.unregister('modbus-inverter-1');
```

Backoff helpers (`exponentialBackoff`, `fixedBackoff`, `linearBackoff` — see `src/implementations/retry/backoff.ts`) and the dedicated error types (`RetryAbortedError`, `RetryOpenError`) live alongside the manager so you can distinguish "we gave up" from "the caller cancelled".

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
- `getAirConditioningConsumptionForecast(applianceId, config?)`
- `getAirConditioningRoomTemperatureForecast(applianceId, config?)`

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

The forecasting module provides 24-hour predictions across the energy domains the SDK already understands (PV, battery, home consumption, EV charging, heatpump consumption, DHW temperature, air conditioning consumption, air conditioning room temperature). Every forecaster follows the same lifecycle and shares the same configuration shape, so once you've used one you've used them all.

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

### AirConditioningConsumptionForecast

Forecasts the electrical consumption of an air conditioning appliance (cooling + heating combined).

```typescript
new AirConditioningConsumptionForecast(app, applianceId, { source: EnyoSourceEnum.Device, config? });
```

- **Output per slot:** `{ powerW: number; powerWh: number }`
- **History default:** 14 days — AC load is weather-driven and bursty, so a wider window than the heatpump's 7 days gives a more stable per-slot profile.
- **Live source:** `AirConditioningValuesUpdateV1`.
- **Note:** `powerW` is optional on that message; updates without a power reading are ignored rather than counted as `0 W`, so an appliance that only reports its operation mode does not drag the forecast towards zero.
- **Note:** like the heatpump forecaster, it does not adjust for forecasted weather; layer a correction on top if you need that.

### AirConditioningRoomTemperatureForecast

Forecasts the room temperature served by an air conditioning appliance — the input you need to plan pre-cooling on forecasted PV surplus.

```typescript
new AirConditioningRoomTemperatureForecast(app, applianceId, {
    source: EnyoSourceEnum.Device,
    config?: { roomIndex?: number, ...ForecastConfig }
});
```

- **Output per slot:** `{ temperatureC: number }` (rounded to 0.1 °C).
- **History default:** 7 days.
- **Notable config:** `roomIndex` selects a specific room (zero-based); omit to average across all rooms. When set, it is echoed back on the published message's `data.roomIndex`.
- **Live source:** `AirConditioningTemperaturesUpdateV1`.

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

energyApp.useInterval().createInterval('5m', () => {
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

## Appliance Energy-Manager Forecast

The [Forecasting](#forecasting) module above predicts what an appliance will **do** based on history. The Appliance Energy-Manager Forecast package goes the other way: it lets an energy-manager app declare what it **intends to command** each appliance to do over the upcoming horizon, plus the temperature trajectories its commands are expected to produce. Three appliance families are supported today — chargers, batteries, and heatpumps — and the heatpump payload can carry any combination of DHW boost, room pre-heating, buffer-tank boost, and a relative power-announcement schedule in one call.

How the runtime fans these forecasts out to subscribers (data bus, RPC, …) is an internal implementation detail of the SDK runtime — apps just call `publish*` and the SDK takes care of the rest.

**Required permission:** `EnergyManager`.

### `useApplianceEnergyManagerForecast(): EnergyAppApplianceEnergyManagerForecast`

```typescript
const forecasts = energyApp.useApplianceEnergyManagerForecast();
```

| Method | Purpose |
|---|---|
| `publishChargerForecast(applianceId, forecast: ChargerForecast)` | Publish the planned phase / power schedule for a charger. |
| `publishBatteryForecast(applianceId, forecast: BatteryCommandForecast)` | Publish the planned charge / discharge / auto cadence for a battery. |
| `publishHeatpumpForecast(applianceId, forecast: HeatpumpForecast)` | Publish any combination of DHW boost / room pre-heating / buffer-tank boost / power-announcement schedule for a heatpump. |

Every call validates the payload first and rejects with `ApplianceCommandForecastValidationError` if any invariant is broken — `publish*` never goes through the runtime with malformed data.

Every forecast also accepts shared optional metadata via [`ApplianceForecastMetadata`](#validators):

- `generatedAtIso?: string` — ISO 8601 generation timestamp. Stamped by the runtime when omitted.
- `reason?: string` — free-form note (e.g. `"follow PV peak"`, `"§14a DR event"`).
- `estimatedSavings?: ApplianceForecastEstimatedSavings` — see below.

```typescript
interface ApplianceForecastEstimatedSavings {
    costSavings: number;            // positive = savings, negative = extra cost (in `currency`)
    currency: string;               // ISO 4217 code
    co2SavingsGrams?: number;
    selfConsumptionGainWh?: number;
    note?: string;                  // e.g. "vs. flat-tariff baseline"
}
```

### ChargerForecast

Relative phase / power schedule that mirrors an OCPP TxProfile but adds explicit `numberOfPhases` (1 / 2 / 3).

```typescript
import { ChargerForecast } from '@enyo-energy/energy-app-sdk';

const forecast: ChargerForecast = {
    relativeSchedule: [
        // Right now: 11 kW across three phases
        { seconds: 0,    powerW: 11_000, numberOfPhases: 3 },
        // In 30 minutes: derate to 3.7 kW on one phase
        { seconds: 1800, powerW:  3_700, numberOfPhases: 1 },
        // In one hour: pause
        { seconds: 3600, powerW:  0                       },
    ],
    estimatedSavings: { costSavings: 0.42, currency: 'EUR', co2SavingsGrams: 120 },
    reason: 'follow PV peak',
};

await forecasts.publishChargerForecast('charger-1', forecast);
```

Per-entry invariants:

- `seconds`: finite, non-negative; first entry `= 0`; subsequent entries strictly increasing.
- `powerW`: finite, non-negative (`0` means "pause").
- `numberOfPhases`: optional; if set, must be `1`, `2`, or `3`.

### BatteryCommandForecast

Relative `{seconds, mode, powerW}` schedule where `mode` is one of `'charge'`, `'discharge'`, or `'auto'`. `auto` returns control to the appliance and must always carry `powerW = 0`.

The type is named `BatteryCommandForecast` to make the distinction with the existing [`BatteryForecast`](#batteryforecast) class (which forecasts state-of-charge from history) explicit.

```typescript
import {
    BatteryCommandForecast,
    BatteryCommandForecastModeEnum,
} from '@enyo-energy/energy-app-sdk';

const forecast: BatteryCommandForecast = {
    relativeSchedule: [
        { seconds: 0,    mode: BatteryCommandForecastModeEnum.Charge,    powerW: 3000 },
        { seconds: 1800, mode: BatteryCommandForecastModeEnum.Discharge, powerW: 2500 },
        { seconds: 3600, mode: BatteryCommandForecastModeEnum.Auto,      powerW: 0    },
    ],
    estimatedSavings: { costSavings: 0.18, currency: 'EUR' },
};

await forecasts.publishBatteryForecast('battery-1', forecast);
```

Per-entry invariants:

- `seconds`: finite, non-negative; first entry `= 0`; subsequent entries strictly increasing.
- `mode`: one of `charge` / `discharge` / `auto`.
- `powerW`: finite, non-negative. **MUST be `0` when `mode === 'auto'`.**

### HeatpumpForecast

The heatpump payload can carry any combination of the four supported command families in one call — at least one must be present and non-empty. Each command family also accepts its own forecasted temperature trajectory so subscribers can reason about the plan and its expected outcome together.

```typescript
import { HeatpumpForecast } from '@enyo-energy/energy-app-sdk';

const forecast: HeatpumpForecast = {
    // ----- DHW boost -----
    dhwBoosts: [
        { startIso: '2026-06-10T13:00:00.000Z', endIso: '2026-06-10T15:00:00.000Z', targetTemperatureC: 60 },
    ],
    dhwTemperatureForecast: [
        { timestampIso: '2026-06-10T12:00:00.000Z', temperatureC: 48 },
        { timestampIso: '2026-06-10T13:00:00.000Z', temperatureC: 52 },
        { timestampIso: '2026-06-10T15:00:00.000Z', temperatureC: 60 },
    ],

    // ----- Room pre-heating (per heating circuit) -----
    roomPreHeatings: [
        { startIso: '2026-06-10T05:00:00.000Z', endIso: '2026-06-10T07:00:00.000Z', targetTemperatureC: 22, circuitIndex: 0 },
    ],
    roomTemperatureForecast: [
        { timestampIso: '2026-06-10T05:00:00.000Z', temperatureC: 19 },
        { timestampIso: '2026-06-10T07:00:00.000Z', temperatureC: 22 },
    ],

    // ----- Buffer-tank boost -----
    bufferTankBoosts: [
        { startIso: '2026-06-10T13:00:00.000Z', endIso: '2026-06-10T14:00:00.000Z', targetTemperatureC: 55 },
    ],
    bufferTankTemperatureForecast: [
        { timestampIso: '2026-06-10T13:00:00.000Z', temperatureC: 45 },
        { timestampIso: '2026-06-10T14:00:00.000Z', temperatureC: 55 },
    ],

    // ----- Power-announcement schedule (relative) -----
    powerAnnouncementSchedule: [
        { seconds: 0,    powerW: 1500 },
        { seconds: 1800, powerW: 3000 },
        { seconds: 3600, powerW: 0    },
    ],

    estimatedSavings: { costSavings: 1.05, currency: 'EUR', co2SavingsGrams: 320 },
    reason: 'soak PV during 13–15h window',
};

await forecasts.publishHeatpumpForecast('heatpump-1', forecast);
```

Per-family invariants:

- **`dhwBoosts` / `bufferTankBoosts`** — each window must satisfy `startIso < endIso`, sorted ascending and non-overlapping, `targetTemperatureC ∈ [0, 100]`.
- **`roomPreHeatings`** — same shape as the boost windows but `targetTemperatureC ∈ [0, 40]`. Non-overlap is enforced **per `circuitIndex`** so different heating circuits can pre-heat in parallel.
- **`powerAnnouncementSchedule`** — relative schedule (seconds-since-effective), first entry at `seconds = 0`, strictly increasing thereafter; per-entry `powerW` finite and non-negative.
- **Temperature trajectories** — strictly increasing `timestampIso`; `temperatureC ∈ [−50, 150]`.

### Validators

The validators that `publish*` runs internally are exported as standalone pure functions so apps can validate forecasts while building them — for instance, to surface user-facing errors in a planning UI before holding the forecast in state.

```typescript
import {
    validateChargerForecast,
    validateBatteryCommandForecast,
    validateHeatpumpForecast,
    ApplianceCommandForecastValidationError,
} from '@enyo-energy/energy-app-sdk';

try {
    validateHeatpumpForecast(forecast);
} catch (error) {
    if (error instanceof ApplianceCommandForecastValidationError) {
        // surface error.message — it names the offending field / index
    }
}
```

Granular helpers are exported alongside the top-level validators: `validateChargerSchedule`, `validateBatterySchedule`, `validateDhwBoostWindows`, `validateRoomPreHeatingWindows`, `validateBufferTankBoostWindows`, `validatePowerAnnouncementSchedule`, `validateTemperatureForecast`.

## Automations

Automations let the end-user wire up simple **"when a trigger is active, do one or more actions"** rules — for example *"when PV surplus is above 2000 W, switch my pool pump for at least 10 minutes."* They are composed by the user in the platform UI from building blocks that energy apps contribute:

- An **Energy Manager app** *registers the trigger types* it can evaluate and publishes the live trigger state (and, optionally, a forecast).
- A **regular energy app** (e.g. a Shelly smart-plug integration) *declares which of its appliances can be an action target* and *executes the switching* when the trigger fires.
- The **user** creates the concrete automation in the app; energy apps only **read and observe** automations through the SDK — there is no `create()` on the SDK (authoring lives in the platform).

Access the API via `useAutomations()`:

```typescript
const automations = sdk.useAutomations();
```

### 🧩 The model

An `EnyoAutomation` is `{ id, name, enabled, trigger, actions[] }`. The pieces:

| Concept | Type | Values / fields |
| --- | --- | --- |
| **Trigger** | `EnyoAutomationTriggerTypeEnum` | `PvSurplusThreshold` → `{ thresholdW }` (activate above, deactivate below) |
| **Action — smart plug** | `EnyoAutomationActionTypeEnum.SmartPlugSwitch` | `{ applianceId, minDurationMinutes }` — `minDurationMinutes` is `5…360` in steps of `5` |
| **Action — MQTT** | `EnyoAutomationActionTypeEnum.Mqtt` | `{ topic, payloadTemplate, updateChargingPvSurplus, publishOptions? }` |
| **Scheduling** | `EnyoAutomationSchedulingModeEnum` | `Mandatory` (run exactly while active) or `Flexible` (Energy Manager may choose whether/when within the active window) |
| **Target kind** | `EnyoAutomationTargetKindEnum` | `Load` (consumes power — counts in the energy balance) or `Signal` (control signal only) |

The **MQTT** `payloadTemplate` is JSON that may embed the placeholders in `EnyoAutomationMqttPlaceholderEnum` — `{{state}}` (`on`/`off`), `{{surplusW}}`, `{{timestampIso}}`, `{{automationId}}` — which the platform substitutes before publishing.

Two things travel over the **data bus** vs. the **API**:

- **Trigger state** is the data-bus message `AutomationTriggerV1` (`EnyoDataBusAutomationTriggerV1`): `{ automationId, data: { active, trigger } }`, where `trigger` is the per-type `EnyoAutomationTriggerData` (for PV surplus: `{ triggerType, surplusW, thresholdW }`).
- The **forecast** is a method — `publishAutomationForecast()` — not a data-bus message.

### ⚡ Guide: Energy Manager apps

Requires the **`EnergyManager`** permission (to register triggers / publish forecasts) and **`SendDataBusValues`** (to emit the trigger message).

**1. Register the trigger type once, at startup.** Registration is by enum value only — all user-facing wording is handled by the UI.

```typescript
import {EnergyApp, EnyoAutomationTriggerTypeEnum} from '@enyo-energy/energy-app-sdk';

const sdk = new EnergyApp();
const automations = sdk.useAutomations();

sdk.register(async () => {
    await automations.registerTrigger(EnyoAutomationTriggerTypeEnum.PvSurplusThreshold);
});
```

**2. Evaluate the condition and publish trigger state.** Watch the aggregated PV surplus and, for every automation that uses your trigger, publish an `AutomationTriggerV1` message whenever it crosses the user-configured `thresholdW`.

Message-type identifiers are the `EnyoDataBusMessageEnum` values passed as strings, the same convention used everywhere else in the data-bus API.

```typescript
import {EnyoAutomationTriggerTypeEnum} from '@enyo-energy/energy-app-sdk';

const dataBus = sdk.useDataBus();

dataBus.listenForMessages(['AggregatedStateUpdateV1'], (message: any) => {
    // gridFeedInW is the surplus fed to the grid (or derive from -gridPowerW when negative)
    const surplusW = message.data?.gridFeedInW ?? 0;

    for (const automation of currentAutomations) {
        if (automation.trigger.type !== EnyoAutomationTriggerTypeEnum.PvSurplusThreshold) continue;
        const thresholdW = automation.trigger.thresholdW;
        const active = surplusW > thresholdW;

        dataBus.sendMessage([{
            type: 'message',
            message: 'AutomationTriggerV1',
            automationId: automation.id,
            data: {
                active,
                trigger: {
                    triggerType: EnyoAutomationTriggerTypeEnum.PvSurplusThreshold,
                    surplusW,
                    thresholdW,
                },
            },
        }]);
    }
});
```

> Debounce/hysteresis (e.g. only emit on a real transition, add a deactivate margin) is the Energy Manager's responsibility — send a message when the `active` state actually changes, not on every tick.

**3. (Optional) Publish a forecast.** Combine your PV-surplus forecast with each automation's threshold to predict the windows where the trigger will be active, so the system can plan ahead. The forecast marks occupied windows only (no watts).

```typescript
await automations.publishAutomationForecast({
    automationId: 'pool-pump',
    resolution: '15m',
    entries: [
        { timestampIso: '2026-07-04T10:00:00.000Z', active: true, mandatory: false, hasLoad: true },
        { timestampIso: '2026-07-04T10:15:00.000Z', active: true, mandatory: false, hasLoad: true },
        { timestampIso: '2026-07-04T10:30:00.000Z', active: false },
    ],
});
```

### 🔌 Guide: regular energy apps (smart plugs like Shelly)

Requires the **`Automation`** permission (to read/observe automations) plus whatever your device needs to switch (e.g. network device access, Modbus, or `RestrictedInternetAccess` for a Shelly HTTP call).

**1. Advertise which appliances can be an action target.** When you register (or update) an appliance, set `supportedAutomationActions`. The automation UI then offers this appliance only for the action types it lists. A three-channel Shelly registers three `SmartPlug` appliances, one per channel.

```typescript
import {EnyoApplianceTypeEnum, EnyoAutomationActionTypeEnum} from '@enyo-energy/energy-app-sdk';

await sdk.useAppliances().save(
    {
        name: [{language: 'en', name: 'Pool pump'}],
        type: EnyoApplianceTypeEnum.SmartPlug,
        networkDeviceIds: [shellyDeviceId],
        supportedAutomationActions: [EnyoAutomationActionTypeEnum.SmartPlugSwitch],
    },
    'shelly-pool-ch0',
);
```

**2. Learn which automations target your appliances.** Fetch on startup and keep in sync with the listeners. Each listener returns an id you can pass to `removeListener()`.

```typescript
const automations = sdk.useAutomations();

let mine = (await automations.list()).filter(hasSmartPlugActionForMyAppliances);

automations.listenForAutomationCreated((a) => { /* add if it targets my appliance */ });
automations.listenForAutomationUpdated((a) => { /* replace */ });
automations.listenForAutomationRemoved((automationId) => { /* drop + switch off */ });
```

**3. Switch on the trigger message.** Subscribe to `AutomationTriggerV1`, resolve the automation's `SmartPlugSwitch` action to one of your appliances, and drive the relay. Honor `minDurationMinutes` locally (keep it on for at least that long after switching on).

```typescript
import {EnyoAutomationActionTypeEnum} from '@enyo-energy/energy-app-sdk';

sdk.useDataBus().listenForMessages(['AutomationTriggerV1'], async (message: any) => {
    const {automationId, data} = message; // data: { active, trigger }
    const automation = mine.find((a) => a.id === automationId);
    if (!automation) return;

    for (const action of automation.actions) {
        if (action.type !== EnyoAutomationActionTypeEnum.SmartPlugSwitch) continue;
        if (data.active) {
            await switchOn(action.applianceId);
            scheduleMinRuntimeGuard(action.applianceId, action.minDurationMinutes);
        } else if (minRuntimeElapsed(action.applianceId)) {
            await switchOff(action.applianceId);
        }
    }
});
```

### 🅿️ End-to-end: pool pump on solar

The user's automation object (authored in the app) for *"when PV surplus > 2000 W, run the pool pump for at least 10 minutes, Energy Manager may choose the timing":*

```typescript
const automation = {
    id: 'pool-pump',
    name: 'Pool pump on solar',
    enabled: true,
    trigger: {type: EnyoAutomationTriggerTypeEnum.PvSurplusThreshold, thresholdW: 2000},
    actions: [{
        id: 'switch-pump',
        type: EnyoAutomationActionTypeEnum.SmartPlugSwitch,
        applianceId: 'shelly-pool-ch0',
        minDurationMinutes: 10,
        schedulingMode: EnyoAutomationSchedulingModeEnum.Flexible,
        targetKind: EnyoAutomationTargetKindEnum.Load,
    }],
};
```

The **Energy Manager** publishes `AutomationTriggerV1` as the surplus crosses 2000 W; the **Shelly app** receives it and switches `shelly-pool-ch0`, keeping it on for ≥ 10 minutes.

### ⏳ Mandatory vs Flexible (current limitation)

- **`Mandatory`** works fully today: the device app reacts directly to the `AutomationTriggerV1` `active` flag (on when `true`, off when `false` once the minimum runtime has elapsed).
- **`Flexible`** lets the Energy Manager decide *whether and when* to actually run the action inside the active window. That decision does **not yet** have a dedicated Energy-Manager→device dispatch message — `AutomationTriggerV1` only reports that the *condition* holds. Until a dispatch message (planned: `AutomationActionCommandV1`, carrying `automationId`, `actionId`, `command`, and a run duration) is added, a device app treats `Flexible` like `Mandatory` and self-enforces `minDurationMinutes`.

### 🔐 Permissions

| Capability | Permission |
| --- | --- |
| `list` / `getById` / `listenFor*` automations | `Automation` |
| `registerTrigger` / `deregisterTrigger` / `publishAutomationForecast` | `EnergyManager` |
| Emit the `AutomationTriggerV1` data-bus message | `SendDataBusValues` |

### ✅ Validators

`validateAutomation`, `validateAutomationTriggerData`, and `validateAutomationForecast` are exported as pure functions (throwing `AutomationValidationError`, whose message names the offending field) so you can validate before persisting or publishing.

```typescript
import {validateAutomation, AutomationValidationError} from '@enyo-energy/energy-app-sdk';

try {
    validateAutomation(automation, knownSmartPlugApplianceIds);
} catch (error) {
    if (error instanceof AutomationValidationError) {
        // surface error.message
    }
}
```

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

**Package Version:** see `package.json` (`version` field) — currently `0.0.134`
**SDK Version:** Auto-injected during build
**License:** ISC
**Repository:** [github.com/enyo-energy/energy-app-sdk](https://github.com/enyo-energy/energy-app-sdk)