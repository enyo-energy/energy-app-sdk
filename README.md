# HEMS one Energy App SDK

This is the official TypeScript Energy App SDK for HEMS one. If you want to build your own Energy App to publish it on the HEMS one Hub, this is the package you need!

## Installation

You can install the package using npm:
```bash
npm install @hems-one/energy-app-sdk
```

Take a look on our CLI to init a project and publish a new Energy App easily.

## Usage

Here's a basic example of how to use the client:

```typescript
import { EnergyApp } from '@hems-one/energy-app-sdk';

const energyAppInstance = new EnergyApp();

energyAppInstance.register((packageName: string, version: number) => {
    console.log(`network state is ${client.isOnline() ? 'online' : 'offline'}. Package ${packageName} version ${version} is registered.`);
    // This starts you Energy App, do all the things in here!

});
```