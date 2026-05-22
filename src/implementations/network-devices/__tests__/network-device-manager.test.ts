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
import {NetworkDeviceManager} from '../network-device-manager.js';

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
    /** Lists every listener in the order it was registered — used to assert manager-before-guard ordering. */
    accessChangeListenerOrder: AccessChangeListener[];
    emitAccessChange: (deviceId: string, status: EnyoNetworkDeviceAccessStatus) => Promise<void>;
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
        emitDetected: async (devices) => {
            for (const {fn} of [...detectedListeners]) await fn(devices);
        },
        emitRemoved: async (deviceId) => {
            for (const {fn} of [...removedListeners]) await fn(deviceId);
        },
    };
    return fake;
}

interface AppliancesFake {
    list: ReturnType<typeof vi.fn>;
}

function createAppliancesFake(appliances: EnyoAppliance[]): AppliancesFake {
    return {
        list: vi.fn(async () => appliances),
    };
}

function createEnergyAppFake(networkDevices: NetworkDevicesFake, appliances: AppliancesFake): EnergyApp {
    return {
        useNetworkDevices: () => networkDevices,
        useAppliances: () => appliances,
    } as unknown as EnergyApp;
}

function createApplianceManagerStub(): {
    manager: ApplianceManager;
    updateApplianceState: ReturnType<typeof vi.fn>;
} {
    const updateApplianceState = vi.fn(async () => undefined);
    return {
        manager: {updateApplianceState} as unknown as ApplianceManager,
        updateApplianceState,
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

function makeNetworkDevice(id: string): EnyoNetworkDevice {
    return {
        id,
        hostname: `host-${id}`,
        ipAddress: '10.0.0.1',
        isOnline: true,
        lastSeen: new Date(),
        accessStatus: 'granted',
        detectedAt: [],
    };
}

const silent = {enableLogging: false};

describe('NetworkDeviceManager', () => {
    let sdk: NetworkDevicesFake;
    let appliances: AppliancesFake;
    let applianceManagerStub: ReturnType<typeof createApplianceManagerStub>;
    let energyApp: EnergyApp;

    function buildManager(
        ownedAppliances: EnyoAppliance[],
        config: Partial<Parameters<typeof NetworkDeviceManager.prototype.constructor>[2]> = {},
    ): NetworkDeviceManager {
        sdk = createNetworkDevicesFake();
        appliances = createAppliancesFake(ownedAppliances);
        applianceManagerStub = createApplianceManagerStub();
        energyApp = createEnergyAppFake(sdk, appliances);
        return new NetworkDeviceManager(energyApp, applianceManagerStub.manager, {
            ports: [502],
            ...silent,
            ...config,
        });
    }

    describe('listener registration', () => {
        it('registers all three SDK listeners on construction', () => {
            buildManager([]);
            expect(sdk.listenForDeviceAccessChange).toHaveBeenCalled();
            expect(sdk.listenForDetectedDevice).toHaveBeenCalledTimes(1);
            expect(sdk.listenForNetworkDeviceRemoved).toHaveBeenCalledTimes(1);
        });

        it("registers the manager's access-change listener before the guard's", () => {
            buildManager([]);
            // Two access-change listeners are expected: the manager's and the guard's.
            expect(sdk.accessChangeListenerOrder).toHaveLength(2);
            // The manager registers its own listener first (so isRecovering dedup works);
            // the second one belongs to the guard.
            expect(sdk.listenForDeviceAccessChange).toHaveBeenCalledTimes(2);
        });
    });

    describe('initialize', () => {
        it('primes the device cache from the SDK', async () => {
            const device = makeNetworkDevice('dev-1');
            sdk = createNetworkDevicesFake([device]);
            appliances = createAppliancesFake([]);
            applianceManagerStub = createApplianceManagerStub();
            energyApp = createEnergyAppFake(sdk, appliances);

            const manager = await NetworkDeviceManager.initialize(
                energyApp,
                applianceManagerStub.manager,
                {ports: [502], ...silent},
            );

            // getDevice should be served from cache without a new SDK call.
            sdk.getDevice.mockClear();
            await expect(manager.getDevice('dev-1')).resolves.toEqual(device);
            expect(sdk.getDevice).not.toHaveBeenCalled();
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

            // Force the guard into pending state via a recover that defers.
            sdk.requestDeviceAccess.mockResolvedValueOnce({status: 'pending'});
            await manager.getAccessGuard().recoverAccess('dev-1');
            expect(onApplianceAccessRestored).not.toHaveBeenCalled();

            // SDK fires 'granted' — both the manager's listener and the guard's
            // listener observe it. Manager runs first, sees isRecovering=true,
            // skips. Guard runs second, clears pending, fires its restored
            // callback which dispatches to the manager. Net: ONE dispatch.
            await sdk.emitAccessChange('dev-1', 'granted');

            expect(onApplianceAccessRestored).toHaveBeenCalledTimes(1);
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
            sdk.requestDeviceAccess.mockResolvedValueOnce({status: 'pending'});

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
            sdk.requestDeviceAccess.mockResolvedValueOnce({status: 'pending'});

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
            appliances = createAppliancesFake([]);
            applianceManagerStub = createApplianceManagerStub();
            energyApp = createEnergyAppFake(sdk, appliances);

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
        });

        it('is a no-op when no appliances are bound to the device', async () => {
            const onApplianceNetworkDeviceRemoved = vi.fn();
            buildManager([], {onApplianceNetworkDeviceRemoved});

            await sdk.emitRemoved('dev-orphan');

            expect(onApplianceNetworkDeviceRemoved).not.toHaveBeenCalled();
            expect(applianceManagerStub.updateApplianceState).not.toHaveBeenCalled();
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
        it('returns only appliances bound to the given NetworkDevice', async () => {
            const a = makeAppliance('appl-1', ['dev-1']);
            const b = makeAppliance('appl-2', ['dev-2']);
            const c = makeAppliance('appl-3', ['dev-1', 'dev-2']);
            const manager = buildManager([a, b, c]);

            await expect(manager.getAppliancesForDevice('dev-1')).resolves.toEqual([a, c]);
            await expect(manager.getAppliancesForDevice('dev-2')).resolves.toEqual([b, c]);
            await expect(manager.getAppliancesForDevice('dev-other')).resolves.toEqual([]);
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
