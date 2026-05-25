/**
 * Cross-cutting integration tests that wire together the real
 * {@link ApplianceManager}, {@link NetworkDeviceManager} and the
 * {@link NetworkAccessGuard} it embeds, against a single in-memory SDK
 * fake. The fake mimics the {@link EnergyApp} surface as closely as the
 * unit-test fakes do for each subsystem individually — the goal here is
 * to exercise the interactions *between* the three managers, including:
 *
 *  - The end-to-end appliance ↔ network-device wiring via
 *    {@link ApplianceManager.findAppliancesByNetworkDeviceId} and
 *    {@link NetworkDeviceManager.getAppliancesForDevice}.
 *  - The full access-recovery cycle: runtime denied error → guard
 *    recovers → restored handlers fire (deduped) → appliance state
 *    toggled back.
 *  - The IP-based dedup in {@link NetworkDeviceManager.handleDetected}
 *    surviving removal/re-detection and concurrent emissions.
 *  - The order-independent `restored` dispatch dedup between the
 *    manager's own SDK listener and the guard's restored callback.
 *  - The {@link NetworkDeviceManager} singleton invariant per `EnergyApp`.
 */

import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {EnergyApp} from '../../energy-app.js';
import {
    EnyoApplianceConnectionType,
    EnyoApplianceStateEnum,
    EnyoApplianceTypeEnum,
    type EnyoAppliance,
} from '../../types/enyo-appliance.js';
import {
    EnyoNetworkDeviceDetectedAtEnum,
    type EnyoNetworkDevice,
    type EnyoNetworkDeviceAccessStatus,
} from '../../types/enyo-network-device.js';
import {ApplianceManager, type ApplianceConfig} from '../appliances/appliance-manager.js';
import {
    NetworkDeviceManager,
    NetworkDeviceManagerAlreadyInitializedError,
} from '../network-devices/network-device-manager.js';

/* ------------------------------------------------------------------ */
/* Fake SDK                                                            */
/* ------------------------------------------------------------------ */

type AccessChangeListener = (deviceId: string, status: EnyoNetworkDeviceAccessStatus) => void | Promise<void>;
type DetectedListener = (devices: EnyoNetworkDevice[]) => void | Promise<void>;
type RemovedListener = (deviceId: string) => void | Promise<void>;
type ApplianceUpdatedListener = (appliance: EnyoAppliance) => void | Promise<void>;
type ApplianceRemovedListener = (applianceId: string) => void | Promise<void>;

interface FakeSdk {
    energyApp: EnergyApp;
    // Network-device side ---------------------------------------------
    networkDevices: ReturnType<typeof createNetworkDevicesFake>;
    // Appliance side ---------------------------------------------------
    appliances: ReturnType<typeof createAppliancesFake>;
}

function createNetworkDevicesFake(initial: EnyoNetworkDevice[] = []) {
    const store = new Map(initial.map(d => [d.id, structuredClone(d)]));
    const accessListeners: { id: string; fn: AccessChangeListener }[] = [];
    const detectedListeners: { id: string; fn: DetectedListener }[] = [];
    const removedListeners: { id: string; fn: RemovedListener }[] = [];
    let listenerSeq = 0;

    const requestDeviceAccess = vi.fn(
        async (deviceId: string, _ports: number[]) => {
            const d = store.get(deviceId);
            return {status: (d?.accessStatus ?? 'granted') as EnyoNetworkDeviceAccessStatus};
        },
    );

    return {
        // SDK surface ------------------------------------------------
        getDevices: vi.fn(async () => Array.from(store.values()).map(d => structuredClone(d))),
        getDevice: vi.fn(async (id: string) => {
            const d = store.get(id);
            return d ? structuredClone(d) : undefined;
        }),
        requestDeviceAccess,
        listenForDeviceAccessChange: vi.fn((fn: AccessChangeListener) => {
            const id = `nd-access-${++listenerSeq}`;
            accessListeners.push({id, fn});
            return id;
        }),
        listenForDetectedDevice: vi.fn((fn: DetectedListener) => {
            const id = `nd-detected-${++listenerSeq}`;
            detectedListeners.push({id, fn});
            return id;
        }),
        listenForNetworkDeviceRemoved: vi.fn((fn: RemovedListener) => {
            const id = `nd-removed-${++listenerSeq}`;
            removedListeners.push({id, fn});
            return id;
        }),
        removeListener: vi.fn((id: string) => {
            for (const arr of [accessListeners, detectedListeners, removedListeners]) {
                const idx = arr.findIndex(l => l.id === id);
                if (idx >= 0) arr.splice(idx, 1);
            }
        }),

        // Test-only helpers ------------------------------------------
        /** Insert/overwrite a device in the underlying store without firing listeners. */
        seed: (device: EnyoNetworkDevice) => store.set(device.id, structuredClone(device)),
        /**
         * Fire a `granted` / `denied` / `pending` transition for the given
         * device. Updates the underlying store so subsequent
         * `requestDeviceAccess` matches reality.
         */
        emitAccessChange: async (deviceId: string, status: EnyoNetworkDeviceAccessStatus) => {
            const existing = store.get(deviceId);
            if (existing) store.set(deviceId, {...existing, accessStatus: status});
            for (const {fn} of [...accessListeners]) await fn(deviceId, status);
        },
        emitDetected: async (devices: EnyoNetworkDevice[]) => {
            for (const d of devices) store.set(d.id, structuredClone(d));
            for (const {fn} of [...detectedListeners]) await fn(devices);
        },
        emitRemoved: async (deviceId: string) => {
            store.delete(deviceId);
            for (const {fn} of [...removedListeners]) await fn(deviceId);
        },
        accessListenerCount: () => accessListeners.length,
        detectedListenerCount: () => detectedListeners.length,
        removedListenerCount: () => removedListeners.length,
    };
}

function createAppliancesFake(initial: EnyoAppliance[] = []) {
    const store = new Map(initial.map(a => [a.id, structuredClone(a)]));
    const updatedListeners: { id: string; fn: ApplianceUpdatedListener }[] = [];
    const removedListeners: { id: string; fn: ApplianceRemovedListener }[] = [];
    let nextId = initial.length + 1;
    let listenerSeq = 0;

    return {
        list: vi.fn(async () => Array.from(store.values()).map(a => structuredClone(a))),
        listAll: vi.fn(async () => Array.from(store.values()).map(a => structuredClone(a))),
        save: vi.fn(async (data: Omit<EnyoAppliance, 'id'>, id?: string) => {
            const applianceId = id ?? `appl-${nextId++}`;
            store.set(applianceId, {...structuredClone(data), id: applianceId});
            return applianceId;
        }),
        getById: vi.fn(async (id: string) => {
            const v = store.get(id);
            return v ? structuredClone(v) : null;
        }),
        removeById: vi.fn(async (id: string) => {
            store.delete(id);
        }),
        listenForApplianceUpdated: vi.fn((fn: ApplianceUpdatedListener) => {
            const id = `appl-upd-${++listenerSeq}`;
            updatedListeners.push({id, fn});
            return id;
        }),
        listenForApplianceRemoved: vi.fn((fn: ApplianceRemovedListener) => {
            const id = `appl-rm-${++listenerSeq}`;
            removedListeners.push({id, fn});
            return id;
        }),
        removeListener: vi.fn((id: string) => {
            for (const arr of [updatedListeners, removedListeners]) {
                const idx = arr.findIndex(l => l.id === id);
                if (idx >= 0) arr.splice(idx, 1);
            }
        }),

        // Test-only helpers ------------------------------------------
        /**
         * Fire an `updated` event mirroring the SDK behaviour where the
         * store is in sync with the event *before* listeners run.
         */
        emitUpdated: async (appliance: EnyoAppliance) => {
            store.set(appliance.id, structuredClone(appliance));
            for (const {fn} of [...updatedListeners]) await fn(appliance);
        },
        emitRemoved: async (id: string) => {
            store.delete(id);
            for (const {fn} of [...removedListeners]) await fn(id);
        },
    };
}

function createFakeSdk(args: {
    appliances?: EnyoAppliance[];
    networkDevices?: EnyoNetworkDevice[];
} = {}): FakeSdk {
    const networkDevices = createNetworkDevicesFake(args.networkDevices ?? []);
    const appliances = createAppliancesFake(args.appliances ?? []);
    const energyApp = {
        useNetworkDevices: () => networkDevices,
        useAppliances: () => appliances,
    } as unknown as EnergyApp;
    return {energyApp, networkDevices, appliances};
}

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

function makeAppliance(
    id: string,
    networkDeviceIds: string[],
    serialNumber: string,
    overrides: Partial<EnyoAppliance> = {},
): EnyoAppliance {
    return {
        id,
        name: [{language: 'en', name: id}],
        type: EnyoApplianceTypeEnum.Inverter,
        networkDeviceIds,
        metadata: {
            connectionType: EnyoApplianceConnectionType.Connector,
            state: EnyoApplianceStateEnum.Connected,
            serialNumber,
        },
        ...overrides,
    };
}

function makeNetworkDevice(
    id: string,
    overrides: Partial<EnyoNetworkDevice> = {},
): EnyoNetworkDevice {
    return {
        id,
        hostname: `host-${id}`,
        ipAddress: `10.0.0.${id.length}`,
        isOnline: true,
        lastSeen: new Date('2026-01-01T00:00:00Z'),
        accessStatus: 'granted',
        detectedAt: [EnyoNetworkDeviceDetectedAtEnum.Mdns],
        ...overrides,
    };
}

function makeApplianceConfig(
    serialNumber: string,
    networkDevices: EnyoNetworkDevice[] = [],
): ApplianceConfig {
    return {
        name: [{language: 'en', name: serialNumber}],
        type: EnyoApplianceTypeEnum.Inverter,
        networkDevices,
        metadata: {serialNumber},
    };
}

const silent = {enableLogging: false};

/* ------------------------------------------------------------------ */
/* Test environment                                                    */
/* ------------------------------------------------------------------ */

async function buildEnvironment(args: {
    appliances?: EnyoAppliance[];
    networkDevices?: EnyoNetworkDevice[];
    networkConfig?: Partial<Parameters<typeof NetworkDeviceManager.prototype.constructor>[2]>;
}) {
    const sdk = createFakeSdk({
        appliances: args.appliances,
        networkDevices: args.networkDevices,
    });
    const applianceManager = await ApplianceManager.initialize(sdk.energyApp, silent);
    const networkDeviceManager = await NetworkDeviceManager.initialize(
        sdk.energyApp,
        applianceManager,
        {ports: [502], ...silent, ...args.networkConfig},
    );
    return {sdk, applianceManager, networkDeviceManager};
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('Manager integration: appliance ↔ network-device ↔ access-guard', () => {
    describe('end-to-end wiring', () => {
        it('createOrUpdateAppliance immediately makes the appliance discoverable via the network-device reverse index', async () => {
            const device = makeNetworkDevice('dev-1');
            const {sdk, applianceManager, networkDeviceManager} = await buildEnvironment({
                networkDevices: [device],
            });

            const applianceId = await applianceManager.createOrUpdateAppliance(
                makeApplianceConfig('SN-1', [device]),
            );

            // No emitUpdated needed — the post-save cache prime makes the
            // appliance visible to the reverse index synchronously.
            const found = networkDeviceManager.getAppliancesForDevice('dev-1');
            expect(found).toHaveLength(1);
            expect(found[0].id).toBe(applianceId);

            // A subsequent reverse-lookup hits the cache only — no SDK list call.
            sdk.appliances.list.mockClear();
            const again = networkDeviceManager.getAppliancesForDevice('dev-1');
            expect(again).toHaveLength(1);
            expect(sdk.appliances.list).not.toHaveBeenCalled();

            networkDeviceManager.dispose();
            applianceManager.dispose();
        });

        it('removing an appliance prunes both the identifier and network-device indices', async () => {
            const device = makeNetworkDevice('dev-1');
            const appliance = makeAppliance('appl-1', ['dev-1'], 'SN-1');
            const {sdk, applianceManager, networkDeviceManager} = await buildEnvironment({
                appliances: [appliance],
                networkDevices: [device],
            });

            expect(networkDeviceManager.getAppliancesForDevice('dev-1')).toHaveLength(1);
            expect(await applianceManager.findByIdentifier('SN-1')).toHaveLength(1);

            await sdk.appliances.emitRemoved('appl-1');

            expect(networkDeviceManager.getAppliancesForDevice('dev-1')).toEqual([]);
            expect(await applianceManager.findByIdentifier('SN-1')).toEqual([]);

            networkDeviceManager.dispose();
            applianceManager.dispose();
        });

        it('an appliance moved from dev-1 to dev-2 is visible only under dev-2 afterwards', async () => {
            const dev1 = makeNetworkDevice('dev-1');
            const dev2 = makeNetworkDevice('dev-2');
            const appliance = makeAppliance('appl-1', ['dev-1'], 'SN-1');
            const {sdk, applianceManager, networkDeviceManager} = await buildEnvironment({
                appliances: [appliance],
                networkDevices: [dev1, dev2],
            });

            expect(networkDeviceManager.getAppliancesForDevice('dev-1')).toHaveLength(1);
            expect(networkDeviceManager.getAppliancesForDevice('dev-2')).toEqual([]);

            // Re-emit the appliance with a different networkDeviceId — the
            // updateCache rebuild-this-id semantics should clear the stale
            // dev-1 mapping rather than appending dev-2 alongside it.
            const moved = {...appliance, networkDeviceIds: ['dev-2']};
            await sdk.appliances.emitUpdated(moved);

            expect(networkDeviceManager.getAppliancesForDevice('dev-1')).toEqual([]);
            expect(networkDeviceManager.getAppliancesForDevice('dev-2')).toHaveLength(1);

            networkDeviceManager.dispose();
            applianceManager.dispose();
        });
    });

    describe('IP-address dedup on detected events', () => {
        it('collapses duplicate IPs within a single emission to one dispatch', async () => {
            const onNetworkDeviceDetected = vi.fn();
            const {sdk, applianceManager, networkDeviceManager} = await buildEnvironment({
                networkConfig: {onNetworkDeviceDetected},
            });

            const a = makeNetworkDevice('dev-1', {ipAddress: '10.0.0.42'});
            const b = makeNetworkDevice('dev-2', {ipAddress: '10.0.0.42'}); // same IP as a
            const c = makeNetworkDevice('dev-3', {ipAddress: '10.0.0.43'});

            await sdk.networkDevices.emitDetected([a, b, c]);

            expect(onNetworkDeviceDetected).toHaveBeenCalledTimes(1);
            const [[forwarded]] = onNetworkDeviceDetected.mock.calls;
            // Only the first occurrence per IP is forwarded.
            expect(forwarded.map((d: EnyoNetworkDevice) => d.id)).toEqual(['dev-1', 'dev-3']);

            networkDeviceManager.dispose();
            applianceManager.dispose();
        });

        it('suppresses a later detection on a previously-seen IP', async () => {
            const onNetworkDeviceDetected = vi.fn();
            const {sdk, applianceManager, networkDeviceManager} = await buildEnvironment({
                networkConfig: {onNetworkDeviceDetected},
            });

            const a = makeNetworkDevice('dev-1', {ipAddress: '10.0.0.42'});
            const reborn = makeNetworkDevice('dev-1-reborn', {ipAddress: '10.0.0.42'});

            await sdk.networkDevices.emitDetected([a]);
            await sdk.networkDevices.emitDetected([reborn]);

            expect(onNetworkDeviceDetected).toHaveBeenCalledTimes(1);
            expect(onNetworkDeviceDetected.mock.calls[0][0].map((d: EnyoNetworkDevice) => d.id))
                .toEqual(['dev-1']);

            networkDeviceManager.dispose();
            applianceManager.dispose();
        });

        it('removal of the device holding the IP frees it for re-dispatch', async () => {
            const onNetworkDeviceDetected = vi.fn();
            const {sdk, applianceManager, networkDeviceManager} = await buildEnvironment({
                networkConfig: {onNetworkDeviceDetected},
            });

            const a = makeNetworkDevice('dev-1', {ipAddress: '10.0.0.42'});
            const reborn = makeNetworkDevice('dev-1-reborn', {ipAddress: '10.0.0.42'});

            await sdk.networkDevices.emitDetected([a]);
            await sdk.networkDevices.emitDetected([reborn]);   // suppressed
            await sdk.networkDevices.emitRemoved('dev-1');     // frees the IP
            await sdk.networkDevices.emitDetected([reborn]);   // fires again

            expect(onNetworkDeviceDetected).toHaveBeenCalledTimes(2);
            expect(onNetworkDeviceDetected.mock.calls[0][0].map((d: EnyoNetworkDevice) => d.id))
                .toEqual(['dev-1']);
            expect(onNetworkDeviceDetected.mock.calls[1][0].map((d: EnyoNetworkDevice) => d.id))
                .toEqual(['dev-1-reborn']);

            networkDeviceManager.dispose();
            applianceManager.dispose();
        });

        it('keeps the device cache fresh even when an emission is suppressed by dedup', async () => {
            const onNetworkDeviceDetected = vi.fn();
            const {sdk, applianceManager, networkDeviceManager} = await buildEnvironment({
                networkConfig: {onNetworkDeviceDetected},
            });

            const first = makeNetworkDevice('dev-1', {ipAddress: '10.0.0.42', hostname: 'old'});
            const update = makeNetworkDevice('dev-1', {ipAddress: '10.0.0.42', hostname: 'new'});

            await sdk.networkDevices.emitDetected([first]);
            await sdk.networkDevices.emitDetected([update]); // suppressed by IP dedup

            // The handler only saw the first emission.
            expect(onNetworkDeviceDetected).toHaveBeenCalledTimes(1);

            // But the manager's cached view reflects the latest observation,
            // so `getDevice('dev-1')` resolves from cache and returns 'new'.
            sdk.networkDevices.getDevice.mockClear();
            const cached = await networkDeviceManager.getDevice('dev-1');
            expect(cached?.hostname).toBe('new');
            expect(sdk.networkDevices.getDevice).not.toHaveBeenCalled();

            networkDeviceManager.dispose();
            applianceManager.dispose();
        });
    });

    describe('full access-recovery cycle', () => {
        it('runtime denied error triggers guard recovery, fires denied/restored exactly once each, and toggles appliance state', async () => {
            const device = makeNetworkDevice('dev-1');
            const appliance = makeAppliance('appl-1', ['dev-1'], 'SN-1');

            const onApplianceAccessDenied = vi.fn();
            const onApplianceAccessRestored = vi.fn();

            const {sdk, applianceManager, networkDeviceManager} = await buildEnvironment({
                appliances: [appliance],
                networkDevices: [device],
                networkConfig: {
                    onApplianceAccessDenied,
                    onApplianceAccessRestored,
                    autoToggleApplianceState: true,
                },
            });

            // First requestDeviceAccess attempt: pending (still waiting on user).
            // Second attempt fired from the late granted listener does NOT happen
            // — once `granted` arrives the recovery completes via the listener.
            sdk.networkDevices.requestDeviceAccess
                .mockResolvedValueOnce({status: 'pending'});

            // A live Modbus call throws the SDK's access-denied error.
            const operation = vi.fn().mockRejectedValueOnce(
                new Error('Network access denied: dev-1 port 502'),
            );

            await expect(
                networkDeviceManager.withAccessGuard('dev-1', operation),
            ).rejects.toThrow(/Network access denied/);

            // Guard recovered: denied handler fired exactly once, appliance flipped offline.
            expect(onApplianceAccessDenied).toHaveBeenCalledTimes(1);
            expect(onApplianceAccessDenied.mock.calls[0][0]).toMatchObject({
                appliance: expect.objectContaining({id: 'appl-1'}),
                networkDeviceId: 'dev-1',
            });
            expect(sdk.appliances.save).toHaveBeenCalled();
            const offlinePayload = sdk.appliances.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(offlinePayload.metadata.state).toBe(EnyoApplianceStateEnum.Offline);

            // No restored yet — the request came back 'pending'.
            expect(onApplianceAccessRestored).not.toHaveBeenCalled();

            // The SDK eventually transitions to granted (user accepted).
            // Re-add device to pending set with a hung request, then have
            // the listener observe the grant.
            sdk.networkDevices.requestDeviceAccess
                .mockImplementationOnce(() => new Promise(() => {}));
            void networkDeviceManager.getAccessGuard().recoverAccess('dev-1');
            await Promise.resolve();

            await sdk.networkDevices.emitAccessChange('dev-1', 'granted');

            // Restored fires exactly once — once via the manager listener,
            // once via the guard's restored callback, but the
            // restoredAlreadyDispatched mark collapses to one dispatch.
            expect(onApplianceAccessRestored).toHaveBeenCalledTimes(1);
            expect(onApplianceAccessRestored.mock.calls[0][0]).toMatchObject({
                appliance: expect.objectContaining({id: 'appl-1'}),
                networkDeviceId: 'dev-1',
            });

            // autoToggle flipped the appliance back to Connected.
            const onlinePayload = sdk.appliances.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(onlinePayload.metadata.state).toBe(EnyoApplianceStateEnum.Connected);

            networkDeviceManager.dispose();
            applianceManager.dispose();
        });

        it('SDK-driven access revocation fires the revoked handler (NOT denied) and toggles appliances offline', async () => {
            const device = makeNetworkDevice('dev-1');
            const appliance = makeAppliance('appl-1', ['dev-1'], 'SN-1');

            const onApplianceAccessDenied = vi.fn();
            const onApplianceAccessRevoked = vi.fn();

            const {sdk, applianceManager, networkDeviceManager} = await buildEnvironment({
                appliances: [appliance],
                networkDevices: [device],
                networkConfig: {
                    onApplianceAccessDenied,
                    onApplianceAccessRevoked,
                    autoToggleApplianceState: true,
                },
            });

            await sdk.networkDevices.emitAccessChange('dev-1', 'denied');

            // Revoked path — explicit SDK status transition.
            expect(onApplianceAccessRevoked).toHaveBeenCalledTimes(1);
            expect(onApplianceAccessRevoked.mock.calls[0][0]).toMatchObject({
                appliance: expect.objectContaining({id: 'appl-1'}),
                status: 'denied',
            });

            // Denied path is for runtime errors only — must NOT fire here.
            expect(onApplianceAccessDenied).not.toHaveBeenCalled();

            // Appliance toggled offline.
            const saved = sdk.appliances.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.metadata.state).toBe(EnyoApplianceStateEnum.Offline);

            networkDeviceManager.dispose();
            applianceManager.dispose();
        });

        it('a `granted` transition dispatches restored at most once even when both listeners observe it', async () => {
            const device = makeNetworkDevice('dev-1', {accessStatus: 'denied'});
            const appliance = makeAppliance('appl-1', ['dev-1'], 'SN-1');

            const onApplianceAccessRestored = vi.fn();
            const {sdk, applianceManager, networkDeviceManager} = await buildEnvironment({
                appliances: [appliance],
                networkDevices: [device],
                networkConfig: {onApplianceAccessRestored},
            });

            // Hang the recover request so the guard stays pending; the
            // listener will observe `granted` on both registered listeners
            // (manager's + guard's).
            sdk.networkDevices.requestDeviceAccess.mockImplementationOnce(
                () => new Promise(() => {}),
            );
            void networkDeviceManager.getAccessGuard().recoverAccess('dev-1');
            await Promise.resolve();

            await sdk.networkDevices.emitAccessChange('dev-1', 'granted');

            expect(onApplianceAccessRestored).toHaveBeenCalledTimes(1);

            networkDeviceManager.dispose();
            applianceManager.dispose();
        });

        it('a non-granted transition between grants resets the restored dedup mark', async () => {
            const device = makeNetworkDevice('dev-1');
            const appliance = makeAppliance('appl-1', ['dev-1'], 'SN-1');

            const onApplianceAccessRestored = vi.fn();
            const {sdk, applianceManager, networkDeviceManager} = await buildEnvironment({
                appliances: [appliance],
                networkDevices: [device],
                networkConfig: {onApplianceAccessRestored},
            });

            await sdk.networkDevices.emitAccessChange('dev-1', 'granted');
            await sdk.networkDevices.emitAccessChange('dev-1', 'denied');
            await sdk.networkDevices.emitAccessChange('dev-1', 'granted');

            expect(onApplianceAccessRestored).toHaveBeenCalledTimes(2);

            networkDeviceManager.dispose();
            applianceManager.dispose();
        });

        it('device removal frees the restored dedup mark so a subsequent grant fires again', async () => {
            const device = makeNetworkDevice('dev-1');
            const appliance = makeAppliance('appl-1', ['dev-1'], 'SN-1');

            const onApplianceAccessRestored = vi.fn();
            const {sdk, applianceManager, networkDeviceManager} = await buildEnvironment({
                appliances: [appliance],
                networkDevices: [device],
                networkConfig: {onApplianceAccessRestored},
            });

            await sdk.networkDevices.emitAccessChange('dev-1', 'granted');
            expect(onApplianceAccessRestored).toHaveBeenCalledTimes(1);

            await sdk.networkDevices.emitRemoved('dev-1');

            // Re-detect + grant — the dedup mark was cleared by the removed event.
            await sdk.networkDevices.emitDetected([device]);
            await sdk.networkDevices.emitAccessChange('dev-1', 'granted');

            expect(onApplianceAccessRestored).toHaveBeenCalledTimes(2);

            networkDeviceManager.dispose();
            applianceManager.dispose();
        });

        it('concurrent ensureAccess calls from many callers share one SDK round-trip', async () => {
            const device = makeNetworkDevice('dev-1');
            const {sdk, applianceManager, networkDeviceManager} = await buildEnvironment({
                networkDevices: [device],
            });

            // First (and only) call should be one shared round-trip.
            sdk.networkDevices.requestDeviceAccess.mockImplementationOnce(
                () => new Promise(resolve => setImmediate(() => resolve({status: 'granted'}))),
            );

            const results = await Promise.all([
                networkDeviceManager.ensureAccess('dev-1'),
                networkDeviceManager.ensureAccess('dev-1'),
                networkDeviceManager.ensureAccess('dev-1'),
                networkDeviceManager.ensureAccess('dev-1'),
            ]);

            expect(results).toEqual([true, true, true, true]);
            expect(sdk.networkDevices.requestDeviceAccess).toHaveBeenCalledTimes(1);

            networkDeviceManager.dispose();
            applianceManager.dispose();
        });
    });

    describe('network-device removal cascades to appliance handlers', () => {
        it('fires onApplianceNetworkDeviceRemoved once per appliance and clears appliance state when autoToggle is set', async () => {
            const device = makeNetworkDevice('dev-1');
            const a = makeAppliance('appl-1', ['dev-1'], 'SN-1');
            const b = makeAppliance('appl-2', ['dev-1'], 'SN-2');

            const onApplianceNetworkDeviceRemoved = vi.fn();
            const {sdk, applianceManager, networkDeviceManager} = await buildEnvironment({
                appliances: [a, b],
                networkDevices: [device],
                networkConfig: {
                    onApplianceNetworkDeviceRemoved,
                    autoToggleApplianceState: true,
                },
            });

            await sdk.networkDevices.emitRemoved('dev-1');

            expect(onApplianceNetworkDeviceRemoved).toHaveBeenCalledTimes(2);
            const ids = onApplianceNetworkDeviceRemoved.mock.calls
                .map(([ev]) => ev.appliance.id)
                .sort();
            expect(ids).toEqual(['appl-1', 'appl-2']);

            // Two saves — one per appliance.
            const offlineSaves = sdk.appliances.save.mock.calls.filter(
                ([data]) => (data as Omit<EnyoAppliance, 'id'>).metadata.state === EnyoApplianceStateEnum.Offline,
            );
            expect(offlineSaves).toHaveLength(2);

            networkDeviceManager.dispose();
            applianceManager.dispose();
        });

        it('is a no-op for orphan devices (no appliances bound)', async () => {
            const device = makeNetworkDevice('dev-orphan');
            const onApplianceNetworkDeviceRemoved = vi.fn();
            const {sdk, applianceManager, networkDeviceManager} = await buildEnvironment({
                networkDevices: [device],
                networkConfig: {onApplianceNetworkDeviceRemoved, autoToggleApplianceState: true},
            });

            await sdk.networkDevices.emitRemoved('dev-orphan');

            expect(onApplianceNetworkDeviceRemoved).not.toHaveBeenCalled();
            expect(sdk.appliances.save).not.toHaveBeenCalled();

            networkDeviceManager.dispose();
            applianceManager.dispose();
        });
    });

    describe('lifecycle invariants', () => {
        it('enforces one NetworkDeviceManager per EnergyApp', async () => {
            const {energyApp} = createFakeSdk();
            const applianceManager = await ApplianceManager.initialize(energyApp, silent);

            const first = await NetworkDeviceManager.initialize(energyApp, applianceManager, {
                ports: [502],
                ...silent,
            });

            expect(() =>
                new NetworkDeviceManager(energyApp, applianceManager, {ports: [502], ...silent}),
            ).toThrow(NetworkDeviceManagerAlreadyInitializedError);

            first.dispose();

            // After dispose, a fresh manager is permitted.
            const second = await NetworkDeviceManager.initialize(energyApp, applianceManager, {
                ports: [502],
                ...silent,
            });

            second.dispose();
            applianceManager.dispose();
        });

        it('disposing both managers leaves zero SDK listeners registered', async () => {
            const {sdk, applianceManager, networkDeviceManager} = await buildEnvironment({});

            // Sanity: each manager registered the expected listeners.
            expect(sdk.networkDevices.accessListenerCount()).toBe(2); // manager + guard
            expect(sdk.networkDevices.detectedListenerCount()).toBe(1);
            expect(sdk.networkDevices.removedListenerCount()).toBe(1);

            networkDeviceManager.dispose();
            applianceManager.dispose();

            expect(sdk.networkDevices.accessListenerCount()).toBe(0);
            expect(sdk.networkDevices.detectedListenerCount()).toBe(0);
            expect(sdk.networkDevices.removedListenerCount()).toBe(0);
        });

        it('listener bodies on both managers short-circuit when invoked directly after dispose', async () => {
            const device = makeNetworkDevice('dev-1');
            const appliance = makeAppliance('appl-1', ['dev-1'], 'SN-1');

            const {sdk, applianceManager, networkDeviceManager} = await buildEnvironment({
                appliances: [appliance],
                networkDevices: [device],
            });

            // Capture every listener BEFORE dispose so we can invoke them
            // directly afterwards. Going through `sdk.*.emit*` would walk the
            // fake's (now-empty) listener arrays and never reach the manager's
            // bodies — the test would prove nothing about the disposal guards.
            const applianceUpdatedListener = sdk.appliances.listenForApplianceUpdated.mock.calls[0][0] as (a: EnyoAppliance) => void | Promise<void>;
            const applianceRemovedListener = sdk.appliances.listenForApplianceRemoved.mock.calls[0][0] as (id: string) => void | Promise<void>;
            const networkAccessListener = sdk.networkDevices.listenForDeviceAccessChange.mock.calls[0][0] as (deviceId: string, status: EnyoNetworkDeviceAccessStatus) => void | Promise<void>;
            const networkDetectedListener = sdk.networkDevices.listenForDetectedDevice.mock.calls[0][0] as (devices: EnyoNetworkDevice[]) => void | Promise<void>;
            const networkRemovedListener = sdk.networkDevices.listenForNetworkDeviceRemoved.mock.calls[0][0] as (deviceId: string) => void | Promise<void>;

            networkDeviceManager.dispose();
            applianceManager.dispose();

            // Snapshot all observable SDK call counts — the listener bodies'
            // disposal guards must prevent any further interaction.
            const before = {
                save: sdk.appliances.save.mock.calls.length,
                list: sdk.appliances.list.mock.calls.length,
                applianceGetById: sdk.appliances.getById.mock.calls.length,
                getDevices: sdk.networkDevices.getDevices.mock.calls.length,
                getDevice: sdk.networkDevices.getDevice.mock.calls.length,
                requestDeviceAccess: sdk.networkDevices.requestDeviceAccess.mock.calls.length,
            };

            // Each listener should swallow the call without throwing.
            expect(() => applianceUpdatedListener(appliance)).not.toThrow();
            expect(() => applianceRemovedListener('appl-1')).not.toThrow();
            // The network listeners are async (they await dispatchAccess*) —
            // assert their promises resolve without rejection.
            await expect(Promise.resolve(networkAccessListener('dev-1', 'denied'))).resolves.not.toThrow();
            await expect(Promise.resolve(networkAccessListener('dev-1', 'granted'))).resolves.not.toThrow();
            await expect(Promise.resolve(networkDetectedListener([device]))).resolves.not.toThrow();
            await expect(Promise.resolve(networkRemovedListener('dev-1'))).resolves.not.toThrow();

            // No SDK re-entry of any kind. If a listener body's disposal
            // guard were missing, the cascaded handler (e.g. dispatchAccessRevoked
            // → setApplianceState → ApplianceManager.updateApplianceState)
            // would have fired and made SDK calls — caught here.
            expect(sdk.appliances.save.mock.calls.length).toBe(before.save);
            expect(sdk.appliances.list.mock.calls.length).toBe(before.list);
            expect(sdk.appliances.getById.mock.calls.length).toBe(before.applianceGetById);
            expect(sdk.networkDevices.getDevices.mock.calls.length).toBe(before.getDevices);
            expect(sdk.networkDevices.getDevice.mock.calls.length).toBe(before.getDevice);
            expect(sdk.networkDevices.requestDeviceAccess.mock.calls.length).toBe(before.requestDeviceAccess);
        });
    });

    describe('appliance state preservation through revoke/restore', () => {
        it('preserves each appliance\'s connectionType across an offline-then-online cycle', async () => {
            const device = makeNetworkDevice('dev-1');
            // Two appliances bound to the same device but with distinct connection types.
            const a = makeAppliance('appl-1', ['dev-1'], 'SN-1', {
                metadata: {
                    connectionType: EnyoApplianceConnectionType.Connector,
                    state: EnyoApplianceStateEnum.Connected,
                    serialNumber: 'SN-1',
                },
            });
            const b = makeAppliance('appl-2', ['dev-1'], 'SN-2', {
                metadata: {
                    connectionType: EnyoApplianceConnectionType.Cloud,
                    state: EnyoApplianceStateEnum.Connected,
                    serialNumber: 'SN-2',
                },
            });

            const {sdk, applianceManager, networkDeviceManager} = await buildEnvironment({
                appliances: [a, b],
                networkDevices: [device],
                networkConfig: {autoToggleApplianceState: true},
            });

            /**
             * Index `save` calls by (applianceId, state) → connectionType, so
             * each assertion pins the *pairing* — not just the set of values.
             * A bug that swapped connectionTypes between appliances would
             * leak through a set-based comparison but is caught here.
             */
            const connByApplianceAndState = (state: EnyoApplianceStateEnum) =>
                sdk.appliances.save.mock.calls.reduce<Map<string, EnyoApplianceConnectionType>>(
                    (acc, [data, applianceId]) => {
                        const payload = data as Omit<EnyoAppliance, 'id'>;
                        if (applianceId && payload.metadata.state === state) {
                            acc.set(applianceId as string, payload.metadata.connectionType);
                        }
                        return acc;
                    },
                    new Map(),
                );

            // Revoke → each appliance saved offline with ITS OWN connectionType.
            await sdk.networkDevices.emitAccessChange('dev-1', 'denied');

            const offlineByAppliance = connByApplianceAndState(EnyoApplianceStateEnum.Offline);
            expect(offlineByAppliance.get('appl-1')).toBe(EnyoApplianceConnectionType.Connector);
            expect(offlineByAppliance.get('appl-2')).toBe(EnyoApplianceConnectionType.Cloud);

            // Restore → each appliance flipped back online with its own connectionType preserved.
            await sdk.networkDevices.emitAccessChange('dev-1', 'granted');

            const onlineByAppliance = connByApplianceAndState(EnyoApplianceStateEnum.Connected);
            expect(onlineByAppliance.get('appl-1')).toBe(EnyoApplianceConnectionType.Connector);
            expect(onlineByAppliance.get('appl-2')).toBe(EnyoApplianceConnectionType.Cloud);

            networkDeviceManager.dispose();
            applianceManager.dispose();
        });
    });
});
