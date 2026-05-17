import {EebusDeviceManagement} from './eebus-device-management.js';
import {EebusIdentityService} from './eebus-identity-service.js';
import {EebusSpineLowLevel} from './eebus-spine-low-level.js';
import {EebusUseCaseRegistry} from './eebus-use-case-registry.js';

export {EebusDeviceManagement} from './eebus-device-management.js';
export {EebusIdentityService} from './eebus-identity-service.js';
export {EebusSpineLowLevel} from './eebus-spine-low-level.js';
export {EebusUseCaseRegistry} from './eebus-use-case-registry.js';
export {EebusHvacClient} from './eebus-hvac-client.js';
export {EebusLpcClient} from './eebus-lpc-client.js';
export {EebusLppClient} from './eebus-lpp-client.js';
export {EebusMgcpClient} from './eebus-mgcp-client.js';
export {EebusMpcClient} from './eebus-mpc-client.js';
export {EebusOhpcfClient} from './eebus-ohpcf-client.js';
export {EebusSetpointClient} from './eebus-setpoint-client.js';

/**
 * Interface for EEbus (SHIP/SPINE) device communication in enyo packages.
 *
 * The API is split into four orthogonal concerns, each its own sub-interface:
 *
 * - {@link devices} — SHIP-level device lifecycle: discovery, pairing, connection
 * - {@link identity} — NID: observable per-node identity, diagnosis state, use-case discovery
 * - {@link useCases} — typed use-case clients: LPC, LPP, MGCP, MPC, OHPCF, Setpoint, Hvac
 * - {@link spine} — low-level SPINE escape hatch for features not yet wrapped
 *
 * Dual roles (Energy Management System vs Controllable System) are modelled at
 * the *method* level inside each use-case client, not by splitting the surface
 * — consumers that act in only one role simply never call the other half.
 *
 * @example
 * ```typescript
 * const eebus = energyApp.useEebus();
 *
 * // 1. SHIP — pair and connect
 * const [discovered] = await eebus.devices.getDiscoveredDevices();
 * const device = await eebus.devices.pairDevice(discovered.ski);
 * await eebus.devices.connect(device.ski);
 *
 * // 2. NID — read identity and watch for changes
 * const identity = await eebus.identity.get(device.ski);
 * console.log(`${identity.brandName} ${identity.deviceName} v${identity.softwareRevision}`);
 * eebus.identity.onIdentityChanged(device.ski, next => updateStatusBadge(next));
 *
 * // 3. Use cases — typed, role-aware
 * const supported = await eebus.identity.getSupportedUseCases(device.ski);
 * if (supported.some(u => u.name === 'limitationOfPowerConsumption')) {
 *   await eebus.useCases.lpc(device.ski).setConsumptionLimit({
 *     value: 11000,
 *     isActive: true,
 *   });
 * }
 *
 * // 4. Escape hatch — raw SPINE for unmodelled features
 * const dp = await eebus.spine.readData(device.ski, 'DeviceConfiguration', 'keyValueListData');
 * ```
 */
export interface EnergyAppEebus {
    /** SHIP-level device lifecycle management */
    devices: EebusDeviceManagement;
    /** EEBUS Node Identification (NID) — observable identity + use-case discovery */
    identity: EebusIdentityService;
    /** Typed use-case clients for the implemented EEBUS use cases */
    useCases: EebusUseCaseRegistry;
    /** Low-level SPINE escape hatch for features not yet wrapped by a typed client */
    spine: EebusSpineLowLevel;
}
