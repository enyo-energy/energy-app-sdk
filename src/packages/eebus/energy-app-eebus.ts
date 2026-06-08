import {EebusDeviceManagement} from './eebus-device-management.js';
import {EebusFeatureCatalog} from './eebus-feature-catalog.js';
import {EebusIdentityService} from './eebus-identity-service.js';
import {EebusSpineLowLevel} from './eebus-spine-low-level.js';
import {EebusUseCaseRegistry} from './eebus-use-case-registry.js';

export {EebusDeviceManagement} from './eebus-device-management.js';
export {
    EebusFeatureCatalog,
    EebusFeatureAddressMatch,
    EebusFindFeatureForClientOptions,
} from './eebus-feature-catalog.js';
export {EebusIdentityService} from './eebus-identity-service.js';
export {EebusSpineLowLevel} from './eebus-spine-low-level.js';
export {EebusUseCaseClient, EebusUseCaseReadiness} from './eebus-use-case-client.js';
export {EebusUseCaseRegistry} from './eebus-use-case-registry.js';
export {EebusHvacClient, HvacClientOptions} from './eebus-hvac-client.js';
export {
    EebusLpcClient,
    LpcClientOptions,
    FindLpcLimitOptions,
    FindPerPhaseLimitIdsOptions,
    SetConsumptionLimitOptions,
} from './eebus-lpc-client.js';
export {EebusLppClient} from './eebus-lpp-client.js';
export {EebusMgcpClient} from './eebus-mgcp-client.js';
export {EebusMpcClient, MpcClientOptions, FindMpcMeasurementOptions} from './eebus-mpc-client.js';
export {EebusOhpcfClient, OhpcfClientOptions} from './eebus-ohpcf-client.js';
export {EebusSetpointClient, SetpointClientOptions} from './eebus-setpoint-client.js';
export {EebusCevcClient, CevcClientOptions} from './eebus-cevc-client.js';
export {EebusEvccClient, EvccClientOptions} from './eebus-evcc-client.js';
export {EebusEvcemClient, EvcemClientOptions} from './eebus-evcem-client.js';
export {EebusEvseccClient, EvseccClientOptions} from './eebus-evsecc-client.js';
export {EebusEvsocClient, EvsocClientOptions} from './eebus-evsoc-client.js';
export {EebusOpevClient, OpevClientOptions} from './eebus-opev-client.js';
export {EebusOscevClient, OscevClientOptions} from './eebus-oscev-client.js';
export {EebusVabdClient, VabdClientOptions} from './eebus-vabd-client.js';
export {EebusVapdClient, VapdClientOptions} from './eebus-vapd-client.js';

/**
 * Interface for EEbus (SHIP/SPINE) device communication in enyo packages.
 *
 * The API is split into five orthogonal concerns, each its own sub-interface:
 *
 * - {@link devices} — SHIP-level device lifecycle: discovery, pairing, connection
 * - {@link identity} — NID: observable per-node identity, diagnosis state, use-case discovery
 * - {@link features} — observable per-peer SPINE entity/feature catalog
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
 * // 3. Feature catalog — gate behaviour on what the peer actually advertises
 * const catalog = await eebus.features.get(device.ski);
 * const hasLpcServer = catalog.entities
 *   .flatMap(e => e.features)
 *   .some(f => f.type === 'LoadControl' && f.role === 'server');
 *
 * // 4. Use cases — typed, role-aware
 * if (hasLpcServer) {
 *   await eebus.useCases.lpc(device.ski).setConsumptionLimit({
 *     value: 11000,
 *     isActive: true,
 *   });
 * }
 *
 * // 5. Escape hatch — raw SPINE for unmodelled features
 * const dp = await eebus.spine.readData(device.ski, 'DeviceConfiguration', 'keyValueListData');
 * ```
 */
export interface EnergyAppEebus {
    /** SHIP-level device lifecycle management */
    devices: EebusDeviceManagement;
    /** EEBUS Node Identification (NID) — observable identity + use-case discovery */
    identity: EebusIdentityService;
    /**
     * Observable per-peer SPINE entity/feature catalog. Prefer feature-level
     * gates from this catalog over use-case gates from {@link identity} when
     * the peer is known to under-populate `NodeManagement.UseCaseData`.
     */
    features: EebusFeatureCatalog;
    /** Typed use-case clients for the implemented EEBUS use cases */
    useCases: EebusUseCaseRegistry;
    /** Low-level SPINE escape hatch for features not yet wrapped by a typed client */
    spine: EebusSpineLowLevel;
}
