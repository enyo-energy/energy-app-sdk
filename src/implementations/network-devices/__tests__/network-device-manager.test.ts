import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {EnergyApp} from '../../../energy-app.js';
import type {EnyoNetworkDevice, EnyoNetworkDeviceAccessStatus} from '../../../types/enyo-network-device.js';
import {
    EnyoApplianceConnectionType,
    EnyoApplianceStateEnum,
    EnyoApplianceTypeEnum,
    type EnyoAppliance,
} from '../../../types/enyo-appliance.js';
import type {ApplianceManager} from '../../appliances/appliance-manager.js';
import {NetworkDeviceManager, NetworkDeviceManagerAlreadyInitializedError} from '../network-device-manager.js';

type AccessChangeListener = (deviceId: string, status: EnyoNetworkDeviceAccessStatus) => void | Promise<void>;
type DetectedListener = (devices: EnyoNetworkDevice[]) => void | Promise<void>;
type RemovedListener = (deviceId: string) => void | Promise<void>;

interface NetworkDevicesFake {
    getDevices: ReturnType<typeof vi.fn>;
    getDevice: ReturnType<typeof vi.fn>;
    requestDeviceAccess: ReturnType<typeof vi.fn>;
    listenForDeviceAccessChange: ReturnType<typeof vi.fn>;
    listenForDetectedDevice: ReturnType<typeof vi.fn>;
    listenForNetworkDeviceRemoved: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    /** Lists every listener in the order it was registered. */
    accessChangeListenerOrder: AccessChangeListener[];
    emitAccessChange: (deviceId: string, status: EnyoNetworkDeviceAccessStatus) => Promise<void>;
    /** Replays each access-change listener in reverse registration order — used to assert dedup is order-independent. */
    emitAccessChangeReverse: (deviceId: string, status: EnyoNetworkDeviceAccessStatus) => Promise<void>;
    emitDetected: (devices: EnyoNetworkDevice[]) => Promise<void>;
    emitRemoved: (deviceId: string) => Promise<void>;
}

function createNetworkDevicesFake(initialDevices: EnyoNetworkDevice[] = []): NetworkDevicesFake {
    const accessChangeListeners: { id: string; fn: AccessChangeListener }[] = [];
    const detectedListeners: { id: string; fn: DetectedListener }[] = [];
    const removedListeners: { id: string; fn: RemovedListener }[] = [];
    let counter = 0;

    const fake: NetworkDevicesFake = {
        getDevices: vi.fn(async () => initialDevices),
        getDevice: vi.fn(async (id: string) => initialDevices.find(d => d.id === id) ?? null),
        requestDeviceAccess: vi.fn(async () => ({status: 'granted' as EnyoNetworkDeviceAccessStatus})),
        listenForDeviceAccessChange: vi.fn((fn: AccessChangeListener) => {
            const id = `access-${++counter}`;
            accessChangeListeners.push({id, fn});
            return id;
        }),
        listenForDetectedDevice: vi.fn((fn: DetectedListener) => {
            const id = `detected-${++counter}`;
            detectedListeners.push({id, fn});
            return id;
        }),
        listenForNetworkDeviceRemoved: vi.fn((fn: RemovedListener) => {
            const id = `removed-${++counter}`;
            removedListeners.push({id, fn});
            return id;
        }),
        removeListener: vi.fn((id: string) => {
            for (const arr of [accessChangeListeners, detectedListeners, removedListeners]) {
                const idx = arr.findIndex(l => l.id === id);
                if (idx >= 0) arr.splice(idx, 1);
            }
        }),
        get accessChangeListenerOrder() {
            return accessChangeListeners.map(l => l.fn);
        },
        emitAccessChange: async (deviceId, status) => {
            for (const {fn} of [...accessChangeListeners]) await fn(deviceId, status);
        },
        emitAccessChangeReverse: async (deviceId, status) => {
            for (const {fn} of [...accessChangeListeners].reverse()) await fn(deviceId, status);
        },
        emitDetected: async (devices) => {
            for (const {fn} of [...detectedListeners]) await fn(devices);
        },
        emitRemoved: async (deviceId) => {
            for (const {fn} of [...removedListeners]) await fn(deviceId);
        },
    };
    return fake;
}

function createEnergyAppFake(networkDevices: NetworkDevicesFake): EnergyApp {
    return {
        useNetworkDevices: () => networkDevices,
    } as unknown as EnergyApp;
}

interface ApplianceManagerStub {
    manager: ApplianceManager;
    updateApplianceState: ReturnType<typeof vi.fn>;
    findAppliancesByNetworkDeviceId: ReturnType<typeof vi.fn>;
}

function createApplianceManagerStub(appliances: EnyoAppliance[] = []): ApplianceManagerStub {
    const updateApplianceState = vi.fn(async () => undefined);
    const findAppliancesByNetworkDeviceId = vi.fn(
        (networkDeviceId: string) =>
            appliances.filter(a => a.networkDeviceIds.includes(networkDeviceId)),
    );
    return {
        manager: {
            updateApplianceState,
            findAppliancesByNetworkDeviceId,
        } as unknown as ApplianceManager,
        updateApplianceState,
        findAppliancesByNetworkDeviceId,
    };
}

function makeAppliance(id: string, networkDeviceIds: string[], overrides: Partial<EnyoAppliance> = {}): EnyoAppliance {
    return {
        id,
        name: [{language: 'en', name: id}],
        type: EnyoApplianceTypeEnum.Inverter,
        networkDeviceIds,
        metadata: {
            connectionType: EnyoApplianceConnectionType.Connector,
            state: EnyoApplianceStateEnum.Connected,
        },
        ...overrides,
    };
}

function makeNetworkDevice(id: string, overrides: Partial<EnyoNetworkDevice> = {}): EnyoNetworkDevice {
    return {
        id,
        hostname: `host-${id}`,
        ipAddress: '10.0.0.1',
        isOnline: true,
        lastSeen: new Date(),
        accessStatus: 'granted',
        detectedAt: [],
        ...overrides,
    };
}

const silent = {enableLogging: false};

describe('NetworkDeviceManager', () => {
    let sdk: NetworkDevicesFake;
    let applianceManagerStub: ApplianceManagerStub;
    let energyApp: EnergyApp;

    function buildManager(
        ownedAppliances: EnyoAppliance[],
        config: Partial<Parameters<typeof NetworkDeviceManager.prototype.constructor>[2]> = {},
    ): NetworkDeviceManager {
        sdk = createNetworkDevicesFake();
        applianceManagerStub = createApplianceManagerStub(ownedAppliances);
        energyApp = createEnergyAppFake(sdk);
        return new NetworkDeviceManager(energyApp, applianceManagerStub.manager, {
            ports: [502],
            ...silent,
            ...config,
        });
    }

    describe('single-instance invariant', () => {
        it('throws when constructed twice on the same EnergyApp without disposing first', () => {
            sdk = createNetworkDevicesFake();
            applianceManagerStub = createApplianceManagerStub();
            energyApp = createEnergyAppFake(sdk);
            new NetworkDeviceManager(energyApp, applianceManagerStub.manager, {
                ports: [502],
                ...silent,
            });

            expect(() =>
                new NetworkDeviceManager(energyApp, applianceManagerStub.manager, {
                    ports: [502],
                    ...silent,
                }),
            ).toThrow(NetworkDeviceManagerAlreadyInitializedError);
        });

        it('allows constructing a fresh manager after the previous one is disposed', () => {
            sdk = createNetworkDevicesFake();
            applianceManagerStub = createApplianceManagerStub();
            energyApp = createEnergyAppFake(sdk);
            const first = new NetworkDeviceManager(energyApp, applianceManagerStub.manager, {
                ports: [502],
                ...silent,
            });
            first.dispose();

            expect(() =>
                new NetworkDeviceManager(energyApp, applianceManagerStub.manager, {
                    ports: [502],
                    ...silent,
                }),
            ).not.toThrow();
        });
    });

    describe('partial-init cleanup', () => {
        // If listener registration throws mid-construction, the manager must:
        //   1. Unregister any listener it already managed to register,
        //   2. Skip the `active` WeakMap registration so a retry is permitted,
        //   3. Propagate the original error (not swallow it).
        // Without these guarantees, the throw would leak SDK listeners that
        // continue firing into a half-built manager.

        it('removes any partially-registered listeners and does not claim the active slot when listener registration throws mid-init', () => {
            sdk = createNetworkDevicesFake();
            applianceManagerStub = createApplianceManagerStub();
            energyApp = createEnergyAppFake(sdk);

            // First call to listenForDeviceAccessChange (the manager's own)
            // succeeds and returns an ID. Second call (the guard's, made via
            // `new NetworkAccessGuard` inside the constructor) throws.
            const original = sdk.listenForDeviceAccessChange.getMockImplementation()!;
            let calls = 0;
            sdk.listenForDeviceAccessChange.mockImplementation((fn) => {
                calls++;
                if (calls === 2) throw new Error('SDK refused listener registration');
                return original(fn);
            });

            expect(() =>
                new NetworkDeviceManager(energyApp, applianceManagerStub.manager, {
                    ports: [502],
                    ...silent,
                }),
            ).toThrow(/SDK refused listener registration/);

            // The first listener was registered, so removeListener MUST have
            // been called to release it. Without cleanupPartialInit this would
            // be zero.
            expect(sdk.removeListener).toHaveBeenCalledTimes(1);
            expect(sdk.removeListener.mock.calls[0][0]).toBe(sdk.listenForDeviceAccessChange.mock.results[0].value);

            // Reset the listener impl back to a working one for the retry.
            sdk.listenForDeviceAccessChange.mockImplementation(original);

            // The `active` WeakMap slot must NOT have been claimed by the
            // failed manager — a fresh construction should succeed without
            // tripping the singleton invariant.
            expect(() =>
                new NetworkDeviceManager(energyApp, applianceManagerStub.manager, {
                    ports: [502],
                    ...silent,
                }),
            ).not.toThrow();
        });
    });

    describe('listener registration', () => {
        it('registers all three SDK listeners on construction', () => {
            buildManager([]);
            expect(sdk.listenForDeviceAccessChange).toHaveBeenCalled();
            expect(sdk.listenForDetectedDevice).toHaveBeenCalledTimes(1);
            expect(sdk.listenForNetworkDeviceRemoved).toHaveBeenCalledTimes(1);
        });

        it('registers two access-change listeners (manager + guard)', () => {
            buildManager([]);
            expect(sdk.accessChangeListenerOrder).toHaveLength(2);
            expect(sdk.listenForDeviceAccessChange).toHaveBeenCalledTimes(2);
        });
    });

    describe('initialize', () => {
        it('primes the device cache from the SDK', async () => {
            const device = makeNetworkDevice('dev-1');
            sdk = createNetworkDevicesFake([device]);
            applianceManagerStub = createApplianceManagerStub();
            energyApp = createEnergyAppFake(sdk);

            const manager = await NetworkDeviceManager.initialize(
                energyApp,
                applianceManagerStub.manager,
                {ports: [502], ...silent},
            );

            // getDevice should be served from cache without a new SDK call.
            sdk.getDevice.mockClear();
            await expect(manager.getDevice('dev-1')).resolves.toEqual(device);
            expect(sdk.getDevice).not.toHaveBeenCalled();

            manager.dispose();
        });
    });

    describe('access-restored dispatch', () => {
        it('fires onApplianceAccessRestored for every appliance on a granted device', async () => {
            const a = makeAppliance('appl-1', ['dev-1']);
            const b = makeAppliance('appl-2', ['dev-1']);
            const c = makeAppliance('appl-3', ['dev-other']);
            const onApplianceAccessRestored = vi.fn();

            buildManager([a, b, c], {onApplianceAccessRestored});

            await sdk.emitAccessChange('dev-1', 'granted');

            expect(onApplianceAccessRestored).toHaveBeenCalledTimes(2);
            expect(onApplianceAccessRestored).toHaveBeenCalledWith(expect.objectContaining({
                applianceId: 'appl-1',
                networkDeviceId: 'dev-1',
            }));
            expect(onApplianceAccessRestored).toHaveBeenCalledWith(expect.objectContaining({
                applianceId: 'appl-2',
                networkDeviceId: 'dev-1',
            }));
        });

        it('transitions appliances to Connected when autoToggleApplianceState is set', async () => {
            const a = makeAppliance('appl-1', ['dev-1']);

            buildManager([a], {autoToggleApplianceState: true});

            await sdk.emitAccessChange('dev-1', 'granted');

            expect(applianceManagerStub.updateApplianceState).toHaveBeenCalledWith(
                'appl-1',
                EnyoApplianceConnectionType.Connector,
                EnyoApplianceStateEnum.Connected,
            );
        });

        it('fires exactly once on async grant for a device being recovered (no double-fire)', async () => {
            const a = makeAppliance('appl-1', ['dev-1']);
            const onApplianceAccessRestored = vi.fn();
            const manager = buildManager([a], {onApplianceAccessRestored});

            // Hang the recover request so the guard stays in pending.
            sdk.requestDeviceAccess.mockImplementationOnce(() => new Promise(() => {}));
            void manager.getAccessGuard().recoverAccess('dev-1');
            await Promise.resolve();
            expect(onApplianceAccessRestored).not.toHaveBeenCalled();

            // SDK fires 'granted' — both the manager's listener and the guard's
            // listener observe it. The first one to reach dispatchAccessRestored
            // marks the device as already-dispatched; the second one short-circuits.
            await sdk.emitAccessChange('dev-1', 'granted');

            expect(onApplianceAccessRestored).toHaveBeenCalledTimes(1);
        });

        it('dedups regardless of listener firing order (manager-first or guard-first)', async () => {
            const a = makeAppliance('appl-1', ['dev-1']);
            const onApplianceAccessRestored = vi.fn();
            const manager = buildManager([a], {onApplianceAccessRestored});

            sdk.requestDeviceAccess.mockImplementationOnce(() => new Promise(() => {}));
            void manager.getAccessGuard().recoverAccess('dev-1');
            await Promise.resolve();

            // Replay listeners in REVERSE order — guard-first, manager-second.
            // Without restoredAlreadyDispatched this would double-fire (the guard
            // would clear pending, then the manager would see !isRecovering and
            // dispatch a second time).
            await sdk.emitAccessChangeReverse('dev-1', 'granted');

            expect(onApplianceAccessRestored).toHaveBeenCalledTimes(1);
        });

        it('re-fires restored after a non-granted transition resets the dedup mark', async () => {
            const a = makeAppliance('appl-1', ['dev-1']);
            const onApplianceAccessRestored = vi.fn();
            buildManager([a], {onApplianceAccessRestored});

            await sdk.emitAccessChange('dev-1', 'granted');
            await sdk.emitAccessChange('dev-1', 'denied');
            await sdk.emitAccessChange('dev-1', 'granted');

            expect(onApplianceAccessRestored).toHaveBeenCalledTimes(2);
        });
    });

    describe('access-revoked dispatch', () => {
        it.each<EnyoNetworkDeviceAccessStatus>(['denied', 'pending'])(
            'fires onApplianceAccessRevoked on status %s',
            async (status) => {
                const a = makeAppliance('appl-1', ['dev-1']);
                const onApplianceAccessRevoked = vi.fn();
                buildManager([a], {onApplianceAccessRevoked});

                await sdk.emitAccessChange('dev-1', status);

                expect(onApplianceAccessRevoked).toHaveBeenCalledTimes(1);
                expect(onApplianceAccessRevoked).toHaveBeenCalledWith({
                    appliance: a,
                    applianceId: 'appl-1',
                    networkDeviceId: 'dev-1',
                    status,
                });
            },
        );

        it('transitions appliances to Offline on revocation when autoToggleApplianceState is set', async () => {
            const a = makeAppliance('appl-1', ['dev-1']);
            buildManager([a], {autoToggleApplianceState: true});

            await sdk.emitAccessChange('dev-1', 'denied');

            expect(applianceManagerStub.updateApplianceState).toHaveBeenCalledWith(
                'appl-1',
                EnyoApplianceConnectionType.Connector,
                EnyoApplianceStateEnum.Offline,
            );
        });

        it('does not fire revoked when no appliances match', async () => {
            const a = makeAppliance('appl-1', ['dev-other']);
            const onApplianceAccessRevoked = vi.fn();
            buildManager([a], {onApplianceAccessRevoked});

            await sdk.emitAccessChange('dev-1', 'denied');

            expect(onApplianceAccessRevoked).not.toHaveBeenCalled();
        });
    });

    describe('access-denied dispatch (runtime error)', () => {
        it('fires onApplianceAccessDenied for affected appliances when withAccessGuard catches the error', async () => {
            const a = makeAppliance('appl-1', ['dev-1']);
            const onApplianceAccessDenied = vi.fn();
            // Leave the device in pending so the denied handler fires but restored doesn't.
            const manager = buildManager([a], {onApplianceAccessDenied});
            sdk.requestDeviceAccess.mockImplementationOnce(() => new Promise(() => {}));

            const action = vi.fn().mockRejectedValueOnce(new Error('Network access denied: ...'));
            await expect(manager.withAccessGuard('dev-1', action)).rejects.toThrow(/Network access denied/);
            // Recovery runs in the background.
            await new Promise(resolve => setImmediate(resolve));

            expect(onApplianceAccessDenied).toHaveBeenCalledTimes(1);
            expect(onApplianceAccessDenied).toHaveBeenCalledWith(expect.objectContaining({
                applianceId: 'appl-1',
                networkDeviceId: 'dev-1',
            }));
        });

        it('marks appliances offline on access-denied error when autoToggleApplianceState is set', async () => {
            const a = makeAppliance('appl-1', ['dev-1']);
            const manager = buildManager([a], {autoToggleApplianceState: true});
            sdk.requestDeviceAccess.mockImplementationOnce(() => new Promise(() => {}));

            const action = vi.fn().mockRejectedValueOnce(new Error('Network access denied: ...'));
            await expect(manager.withAccessGuard('dev-1', action)).rejects.toThrow();
            await new Promise(resolve => setImmediate(resolve));

            expect(applianceManagerStub.updateApplianceState).toHaveBeenCalledWith(
                'appl-1',
                EnyoApplianceConnectionType.Connector,
                EnyoApplianceStateEnum.Offline,
            );
        });
    });

    describe('network-device-removed dispatch', () => {
        it('fires onApplianceNetworkDeviceRemoved for each affected appliance', async () => {
            const a = makeAppliance('appl-1', ['dev-1']);
            const b = makeAppliance('appl-2', ['dev-1']);
            const onApplianceNetworkDeviceRemoved = vi.fn();
            buildManager([a, b], {onApplianceNetworkDeviceRemoved});

            await sdk.emitRemoved('dev-1');

            expect(onApplianceNetworkDeviceRemoved).toHaveBeenCalledTimes(2);
        });

        it('clears the device from the local cache', async () => {
            const device = makeNetworkDevice('dev-1');
            sdk = createNetworkDevicesFake([device]);
            applianceManagerStub = createApplianceManagerStub();
            energyApp = createEnergyAppFake(sdk);

            const manager = await NetworkDeviceManager.initialize(
                energyApp,
                applianceManagerStub.manager,
                {ports: [502], ...silent},
            );

            await sdk.emitRemoved('dev-1');

            sdk.getDevice.mockClear();
            sdk.getDevice.mockResolvedValueOnce(null);
            await manager.getDevice('dev-1');
            // Cache was cleared, so a fresh SDK call should happen.
            expect(sdk.getDevice).toHaveBeenCalledWith('dev-1');

            manager.dispose();
        });

        it('is a no-op when no appliances are bound to the device', async () => {
            const onApplianceNetworkDeviceRemoved = vi.fn();
            buildManager([], {onApplianceNetworkDeviceRemoved});

            await sdk.emitRemoved('dev-orphan');

            expect(onApplianceNetworkDeviceRemoved).not.toHaveBeenCalled();
            expect(applianceManagerStub.updateApplianceState).not.toHaveBeenCalled();
        });

        it('clears the restored dedup mark so a subsequent grant fires again', async () => {
            const device = makeNetworkDevice('dev-1');
            sdk = createNetworkDevicesFake([device]);
            applianceManagerStub = createApplianceManagerStub([makeAppliance('appl-1', ['dev-1'])]);
            energyApp = createEnergyAppFake(sdk);

            const onApplianceAccessRestored = vi.fn();
            const manager = await NetworkDeviceManager.initialize(
                energyApp,
                applianceManagerStub.manager,
                {ports: [502], ...silent, onApplianceAccessRestored},
            );

            await sdk.emitAccessChange('dev-1', 'granted');
            await sdk.emitRemoved('dev-1');
            await sdk.emitAccessChange('dev-1', 'granted');

            expect(onApplianceAccessRestored).toHaveBeenCalledTimes(2);

            manager.dispose();
        });
    });

    describe('network-device-detected dispatch', () => {
        it('fires onNetworkDeviceDetected and populates the cache', async () => {
            const onNetworkDeviceDetected = vi.fn();
            const manager = buildManager([], {onNetworkDeviceDetected});

            const device = makeNetworkDevice('dev-new');
            await sdk.emitDetected([device]);

            expect(onNetworkDeviceDetected).toHaveBeenCalledWith([device]);
            // getDevice should now hit the cache, not the SDK.
            sdk.getDevice.mockClear();
            await expect(manager.getDevice('dev-new')).resolves.toEqual(device);
            expect(sdk.getDevice).not.toHaveBeenCalled();
        });

        it('dedupes devices sharing the same IP within a single emission', async () => {
            const onNetworkDeviceDetected = vi.fn();
            buildManager([], {onNetworkDeviceDetected});

            const a = makeNetworkDevice('dev-a', {ipAddress: '10.0.0.42'});
            const b = makeNetworkDevice('dev-b', {ipAddress: '10.0.0.42'});

            await sdk.emitDetected([a, b]);

            expect(onNetworkDeviceDetected).toHaveBeenCalledTimes(1);
            expect(onNetworkDeviceDetected).toHaveBeenCalledWith([a]);
        });

        it('coalesces repeated detections of the same IP across emissions', async () => {
            const onNetworkDeviceDetected = vi.fn();
            buildManager([], {onNetworkDeviceDetected});

            const first = makeNetworkDevice('dev-1', {ipAddress: '10.0.0.42'});
            const repeat = makeNetworkDevice('dev-1-bis', {ipAddress: '10.0.0.42'});

            await sdk.emitDetected([first]);
            await sdk.emitDetected([repeat]);

            expect(onNetworkDeviceDetected).toHaveBeenCalledTimes(1);
            expect(onNetworkDeviceDetected).toHaveBeenCalledWith([first]);
        });

        it('re-fires for an IP after the SDK reports its device removed', async () => {
            const onNetworkDeviceDetected = vi.fn();
            buildManager([], {onNetworkDeviceDetected});

            const first = makeNetworkDevice('dev-1', {ipAddress: '10.0.0.42'});
            const reborn = makeNetworkDevice('dev-1-reborn', {ipAddress: '10.0.0.42'});

            await sdk.emitDetected([first]);
            await sdk.emitDetected([reborn]);
            await sdk.emitRemoved('dev-1');
            await sdk.emitDetected([reborn]);

            expect(onNetworkDeviceDetected).toHaveBeenCalledTimes(2);
            expect(onNetworkDeviceDetected).toHaveBeenNthCalledWith(1, [first]);
            expect(onNetworkDeviceDetected).toHaveBeenNthCalledWith(2, [reborn]);
        });

        it('forwards devices on distinct IPs in the same emission', async () => {
            const onNetworkDeviceDetected = vi.fn();
            buildManager([], {onNetworkDeviceDetected});

            const a = makeNetworkDevice('dev-a', {ipAddress: '10.0.0.1'});
            const b = makeNetworkDevice('dev-b', {ipAddress: '10.0.0.2'});

            await sdk.emitDetected([a, b]);

            expect(onNetworkDeviceDetected).toHaveBeenCalledTimes(1);
            expect(onNetworkDeviceDetected).toHaveBeenCalledWith([a, b]);
        });

        it('always forwards devices without an ipAddress', async () => {
            const onNetworkDeviceDetected = vi.fn();
            buildManager([], {onNetworkDeviceDetected});

            const a = makeNetworkDevice('dev-a', {ipAddress: ''});
            const b = makeNetworkDevice('dev-b', {ipAddress: ''});

            await sdk.emitDetected([a]);
            await sdk.emitDetected([b]);

            expect(onNetworkDeviceDetected).toHaveBeenCalledTimes(2);
            expect(onNetworkDeviceDetected).toHaveBeenNthCalledWith(1, [a]);
            expect(onNetworkDeviceDetected).toHaveBeenNthCalledWith(2, [b]);
        });

        it('refreshes the cache for suppressed devices even when the handler is not invoked', async () => {
            const onNetworkDeviceDetected = vi.fn();
            const manager = buildManager([], {onNetworkDeviceDetected});

            const first = makeNetworkDevice('dev-1', {ipAddress: '10.0.0.42', hostname: 'old'});
            const repeat = makeNetworkDevice('dev-1', {ipAddress: '10.0.0.42', hostname: 'new'});

            await sdk.emitDetected([first]);
            await sdk.emitDetected([repeat]);

            expect(onNetworkDeviceDetected).toHaveBeenCalledTimes(1);
            sdk.getDevice.mockClear();
            await expect(manager.getDevice('dev-1')).resolves.toMatchObject({hostname: 'new'});
            expect(sdk.getDevice).not.toHaveBeenCalled();
        });
    });

    describe('raw onNetworkDeviceAccessChanged', () => {
        it.each<EnyoNetworkDeviceAccessStatus>(['granted', 'denied', 'pending'])(
            'fires for every transition (%s) regardless of appliance binding',
            async (status) => {
                const onNetworkDeviceAccessChanged = vi.fn();
                buildManager([], {onNetworkDeviceAccessChanged});

                await sdk.emitAccessChange('dev-orphan', status);

                expect(onNetworkDeviceAccessChanged).toHaveBeenCalledWith('dev-orphan', status);
            },
        );
    });

    describe('handler register / unregister', () => {
        it('removes a per-appliance handler via the returned disposer', async () => {
            const a = makeAppliance('appl-1', ['dev-1']);
            const manager = buildManager([a]);
            const handler = vi.fn();
            const dispose = manager.onApplianceAccessRestored(handler);

            dispose();
            await sdk.emitAccessChange('dev-1', 'granted');

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('delegation', () => {
        it('ensureAccess delegates to the underlying guard', async () => {
            const manager = buildManager([]);
            sdk.requestDeviceAccess.mockResolvedValueOnce({status: 'granted'});

            await expect(manager.ensureAccess('dev-1')).resolves.toBe(true);
            expect(sdk.requestDeviceAccess).toHaveBeenCalledWith('dev-1', [502]);
        });

        it('withAccessGuard passes through and recovers on access-denied', async () => {
            const manager = buildManager([]);
            sdk.requestDeviceAccess.mockResolvedValueOnce({status: 'granted'});

            await expect(
                manager.withAccessGuard('dev-1', async () => 'ok'),
            ).resolves.toBe('ok');

            const action = vi.fn().mockRejectedValueOnce(new Error('Network access denied: ...'));
            await expect(manager.withAccessGuard('dev-1', action)).rejects.toThrow();
            await new Promise(resolve => setImmediate(resolve));

            expect(sdk.requestDeviceAccess).toHaveBeenCalledTimes(1);
        });
    });

    describe('getAppliancesForDevice', () => {
        it('reads from the ApplianceManager cache without an SDK call', () => {
            const a = makeAppliance('appl-1', ['dev-1']);
            const b = makeAppliance('appl-2', ['dev-2']);
            const c = makeAppliance('appl-3', ['dev-1', 'dev-2']);
            const manager = buildManager([a, b, c]);

            expect(manager.getAppliancesForDevice('dev-1')).toEqual([a, c]);
            expect(manager.getAppliancesForDevice('dev-2')).toEqual([b, c]);
            expect(manager.getAppliancesForDevice('dev-other')).toEqual([]);
            expect(applianceManagerStub.findAppliancesByNetworkDeviceId).toHaveBeenCalledTimes(3);
        });
    });

    describe('dispose', () => {
        it('removes all SDK listeners (manager + guard)', () => {
            const manager = buildManager([]);
            manager.dispose();

            // 3 listeners from the manager (access-change, detected, removed)
            // plus 1 from the guard's internal subscription.
            expect(sdk.removeListener).toHaveBeenCalledTimes(4);
        });

        it('is idempotent', () => {
            const manager = buildManager([]);
            manager.dispose();
            manager.dispose();

            expect(sdk.removeListener).toHaveBeenCalledTimes(4);
        });

        it('stops dispatching after dispose', async () => {
            const a = makeAppliance('appl-1', ['dev-1']);
            const onApplianceAccessRestored = vi.fn();
            const manager = buildManager([a], {onApplianceAccessRestored});

            manager.dispose();
            await sdk.emitAccessChange('dev-1', 'granted');

            expect(onApplianceAccessRestored).not.toHaveBeenCalled();
        });
    });
});
