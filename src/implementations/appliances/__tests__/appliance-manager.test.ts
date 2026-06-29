import {describe, expect, it, vi} from 'vitest';
import type {EnergyApp} from '../../../energy-app.js';
import {
    type EnyoAppliance,
    EnyoApplianceAvailableFeaturesEnum,
    EnyoApplianceConnectionType,
    EnyoApplianceStateEnum,
    EnyoApplianceTypeEnum,
} from '../../../types/enyo-appliance.js';
import {
    type ApplianceConfig,
    ApplianceManager,
    ApplianceManagerDisposedError,
    MissingIdentifierError,
} from '../appliance-manager.js';
import {InMemoryApplianceManager} from '../in-memory-appliance-manager.js';
import {HostnameStrategy, SerialNumberStrategy} from '../identifier-strategies.js';

type AppliancesFake = {
    list: ReturnType<typeof vi.fn>;
    listAll: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    removeById: ReturnType<typeof vi.fn>;
    listenForApplianceUpdated: ReturnType<typeof vi.fn>;
    listenForApplianceRemoved: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    emitUpdated: (appliance: EnyoAppliance) => Promise<void>;
    emitRemoved: (id: string) => Promise<void>;
};

function createAppliancesFake(seed: EnyoAppliance[] = []): AppliancesFake {
    const store = new Map(seed.map(a => [a.id, structuredClone(a)]));
    const updatedListeners: { id: string; fn: (a: EnyoAppliance) => void | Promise<void> }[] = [];
    const removedListeners: { id: string; fn: (id: string) => void | Promise<void> }[] = [];
    let nextId = seed.length + 1;
    let listenerCounter = 0;

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
        listenForApplianceUpdated: vi.fn((fn) => {
            const id = `upd-${++listenerCounter}`;
            updatedListeners.push({id, fn});
            return id;
        }),
        listenForApplianceRemoved: vi.fn((fn) => {
            const id = `rm-${++listenerCounter}`;
            removedListeners.push({id, fn});
            return id;
        }),
        removeListener: vi.fn((id: string) => {
            for (const arr of [updatedListeners, removedListeners]) {
                const idx = arr.findIndex(l => l.id === id);
                if (idx >= 0) arr.splice(idx, 1);
            }
        }),
        emitUpdated: async (appliance) => {
            // Mirror the SDK behaviour where the listener fires *after* the store reflects the change.
            store.set(appliance.id, structuredClone(appliance));
            for (const {fn} of [...updatedListeners]) await fn(appliance);
        },
        emitRemoved: async (id) => {
            store.delete(id);
            for (const {fn} of [...removedListeners]) await fn(id);
        },
    };
}

function createEnergyAppFake(appliances: AppliancesFake): EnergyApp {
    return {
        useAppliances: () => appliances,
    } as unknown as EnergyApp;
}

function makeAppliance(
    id: string,
    overrides: Partial<EnyoAppliance> = {},
    serialNumber?: string,
): EnyoAppliance {
    return {
        id,
        name: [{language: 'en', name: id}],
        type: EnyoApplianceTypeEnum.Inverter,
        networkDeviceIds: [],
        metadata: {
            connectionType: EnyoApplianceConnectionType.Connector,
            state: EnyoApplianceStateEnum.Connected,
            ...(serialNumber ? {serialNumber} : {}),
        },
        ...overrides,
    };
}

function makeConfig(serialNumber: string, networkDeviceIds: string[] = []): ApplianceConfig {
    return {
        name: [{language: 'en', name: serialNumber}],
        type: EnyoApplianceTypeEnum.Inverter,
        networkDevices: networkDeviceIds.map(id => ({
            id,
            hostname: `host-${id}`,
            ipAddress: '10.0.0.1',
            isOnline: true,
            lastSeen: new Date(),
            accessStatus: 'granted',
            detectedAt: [],
        })),
        metadata: {serialNumber},
    };
}

const silent = {enableLogging: false};

describe('ApplianceManager', () => {
    describe('initialize', () => {
        it('primes the cache from the SDK and subscribes to listeners', async () => {
            const a = makeAppliance('appl-1', {}, 'SN-1');
            const sdk = createAppliancesFake([a]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            expect(sdk.list).toHaveBeenCalledTimes(1);
            expect(sdk.listenForApplianceUpdated).toHaveBeenCalledTimes(1);
            expect(sdk.listenForApplianceRemoved).toHaveBeenCalledTimes(1);

            // Cached: a subsequent findByIdentifier reads from the index without hitting SDK.list again.
            sdk.list.mockClear();
            await expect(manager.findByIdentifier('SN-1')).resolves.toHaveLength(1);
            expect(sdk.list).not.toHaveBeenCalled();

            manager.dispose();
        });
    });

    describe('createOrUpdateAppliance', () => {
        it('creates a new appliance when the identifier is unknown', async () => {
            const sdk = createAppliancesFake([]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            const id = await manager.createOrUpdateAppliance(makeConfig('SN-1'));

            expect(sdk.save).toHaveBeenCalledTimes(1);
            expect(sdk.save.mock.calls[0][1]).toBeUndefined();
            await expect(manager.findApplianceById(id)).resolves.toBeTruthy();

            manager.dispose();
        });

        it('updates the existing appliance when the identifier already maps to one', async () => {
            const existing = makeAppliance('existing-1', {}, 'SN-1');
            const sdk = createAppliancesFake([existing]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            const id = await manager.createOrUpdateAppliance(makeConfig('SN-1'));

            expect(id).toBe('existing-1');
            expect(sdk.save).toHaveBeenCalledTimes(1);
            expect(sdk.save.mock.calls[0][1]).toBe('existing-1');

            manager.dispose();
        });

        it('throws MissingIdentifierError when the strategy returns undefined', async () => {
            const sdk = createAppliancesFake([]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            const configWithoutSerial: ApplianceConfig = {
                name: [{language: 'en', name: 'X'}],
                type: EnyoApplianceTypeEnum.Inverter,
                metadata: {connectionType: EnyoApplianceConnectionType.Connector},
            };

            await expect(manager.createOrUpdateAppliance(configWithoutSerial))
                .rejects.toThrow(MissingIdentifierError);
            expect(sdk.save).not.toHaveBeenCalled();

            manager.dispose();
        });

        it('throws DuplicateIdentifierError when the identifier maps to more than one appliance', async () => {
            const a = makeAppliance('appl-1', {}, 'SN-DUP');
            const b = makeAppliance('appl-2', {}, 'SN-DUP');
            const sdk = createAppliancesFake([a, b]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            await expect(manager.createOrUpdateAppliance(makeConfig('SN-DUP')))
                .rejects.toMatchObject({
                    name: 'DuplicateIdentifierError',
                    applianceIds: ['appl-1', 'appl-2'],
                });
            expect(sdk.save).not.toHaveBeenCalled();

            manager.dispose();
        });
    });

    describe('cache integrity', () => {
        it('drops stale identifier-index entries when an appliance is updated to a new identifier', async () => {
            const a = makeAppliance('appl-1', {}, 'SN-old');
            const sdk = createAppliancesFake([a]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            // Move the appliance to a new serial number via an SDK-fired update.
            const renamed = {...a, metadata: {...a.metadata, serialNumber: 'SN-new'}};
            await sdk.emitUpdated(renamed);

            await expect(manager.findByIdentifier('SN-new')).resolves.toEqual([renamed]);
            await expect(manager.findByIdentifier('SN-old')).resolves.toEqual([]);

            manager.dispose();
        });

        it('drops network-device-index entries when an appliance is removed', async () => {
            const a = makeAppliance('appl-1', {networkDeviceIds: ['dev-1', 'dev-2']}, 'SN-1');
            const sdk = createAppliancesFake([a]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            expect(manager.findAppliancesByNetworkDeviceId('dev-1')).toHaveLength(1);

            await sdk.emitRemoved('appl-1');

            expect(manager.findAppliancesByNetworkDeviceId('dev-1')).toEqual([]);
            expect(manager.findAppliancesByNetworkDeviceId('dev-2')).toEqual([]);

            manager.dispose();
        });
    });

    describe('findApplianceById', () => {
        it('returns null when the SDK reports the appliance is not found', async () => {
            const sdk = createAppliancesFake([]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            await expect(manager.findApplianceById('missing')).resolves.toBeNull();

            manager.dispose();
        });

        it('propagates SDK errors instead of swallowing them as null', async () => {
            const sdk = createAppliancesFake([]);
            sdk.getById.mockRejectedValueOnce(new Error('boom'));
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            await expect(manager.findApplianceById('any')).rejects.toThrow(/boom/);

            manager.dispose();
        });
    });

    describe('findAppliancesByNetworkDeviceId', () => {
        it('returns only appliances bound to the device, sourced from the cache', async () => {
            const a = makeAppliance('appl-1', {networkDeviceIds: ['dev-1']}, 'SN-1');
            const b = makeAppliance('appl-2', {networkDeviceIds: ['dev-1', 'dev-2']}, 'SN-2');
            const c = makeAppliance('appl-3', {networkDeviceIds: ['dev-2']}, 'SN-3');
            const sdk = createAppliancesFake([a, b, c]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            sdk.list.mockClear();
            expect(manager.findAppliancesByNetworkDeviceId('dev-1').map(x => x.id).sort())
                .toEqual(['appl-1', 'appl-2']);
            expect(manager.findAppliancesByNetworkDeviceId('dev-2').map(x => x.id).sort())
                .toEqual(['appl-2', 'appl-3']);
            expect(manager.findAppliancesByNetworkDeviceId('dev-orphan')).toEqual([]);
            // Reads from the in-memory index — no SDK list call.
            expect(sdk.list).not.toHaveBeenCalled();

            manager.dispose();
        });
    });

    describe('setIdentifierStrategy', () => {
        it('rebuilds only the in-memory identifier index when rebuildCache=false', async () => {
            const a = makeAppliance('appl-1', {
                metadata: {
                    connectionType: EnyoApplianceConnectionType.Connector,
                    state: EnyoApplianceStateEnum.Connected,
                    serialNumber: 'SN-1',
                    hostname: 'host-1'
                }
            }, 'SN-1');
            const sdk = createAppliancesFake([a]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            sdk.list.mockClear();
            await manager.setIdentifierStrategy(new HostnameStrategy(), false);

            expect(sdk.list).not.toHaveBeenCalled();
            // The identifier index has been rebuilt from the cache against the new strategy.
            await expect(manager.findByIdentifier('host-1')).resolves.toEqual([a]);

            manager.dispose();
        });

        it('rebuilds the cache from the SDK when rebuildCache=true', async () => {
            const sdk = createAppliancesFake([]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            sdk.list.mockClear();
            await manager.setIdentifierStrategy(new HostnameStrategy(), true);

            expect(sdk.list).toHaveBeenCalledTimes(1);

            manager.dispose();
        });
    });

    describe('updateAppliance (mergeApplianceData)', () => {
        it('preserves existing metadata keys when patching only a subset', async () => {
            const a = makeAppliance('appl-1', {
                metadata: {
                    connectionType: EnyoApplianceConnectionType.Connector,
                    state: EnyoApplianceStateEnum.Connected,
                    serialNumber: 'SN-1',
                    vendorName: 'ACME',
                },
            }, 'SN-1');
            const sdk = createAppliancesFake([a]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            await manager.updateAppliance('appl-1', {
                metadata: {state: EnyoApplianceStateEnum.Offline},
            });

            const saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.metadata).toMatchObject({
                serialNumber: 'SN-1',
                vendorName: 'ACME',
                state: EnyoApplianceStateEnum.Offline,
                connectionType: EnyoApplianceConnectionType.Connector,
            });

            manager.dispose();
        });

        it('preserves stored availableFeatures when an update omits the field', async () => {
            const existing = makeAppliance('existing-1', {
                availableFeatures: [EnyoApplianceAvailableFeaturesEnum.LimitPowerConsumption],
            }, 'SN-1');
            const sdk = createAppliancesFake([existing]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            // makeConfig does not set availableFeatures — a metadata-only update.
            await manager.createOrUpdateAppliance(makeConfig('SN-1'));

            const saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.availableFeatures).toEqual([
                EnyoApplianceAvailableFeaturesEnum.LimitPowerConsumption,
            ]);

            manager.dispose();
        });

        it('clears availableFeatures when an update passes an explicit empty array', async () => {
            const existing = makeAppliance('existing-1', {
                availableFeatures: [EnyoApplianceAvailableFeaturesEnum.LimitPowerConsumption],
            }, 'SN-1');
            const sdk = createAppliancesFake([existing]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            await manager.createOrUpdateAppliance({...makeConfig('SN-1'), availableFeatures: []});

            const saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.availableFeatures).toEqual([]);

            manager.dispose();
        });

        it('preserves stored cloudPackageId when an update omits it, and replaces it when supplied', async () => {
            const existing = makeAppliance('existing-1', {cloudPackageId: 'pkg-1'}, 'SN-1');
            const sdk = createAppliancesFake([existing]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            // Omit cloudPackageId — must be preserved.
            await manager.createOrUpdateAppliance(makeConfig('SN-1'));
            let saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.cloudPackageId).toBe('pkg-1');

            // Supply a new value — must replace.
            await manager.createOrUpdateAppliance({...makeConfig('SN-1'), cloudPackageId: 'pkg-2'});
            saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.cloudPackageId).toBe('pkg-2');

            manager.dispose();
        });
    });

    describe('setAppliancesStateByIdentifier', () => {
        it('updates state for every appliance matching the identifier', async () => {
            const a = makeAppliance('appl-1', {}, 'SN-DUP');
            const b = makeAppliance('appl-2', {}, 'SN-DUP');
            const sdk = createAppliancesFake([a, b]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            const count = await manager.setAppliancesStateByIdentifier(
                'SN-DUP',
                EnyoApplianceStateEnum.Offline,
            );

            expect(count).toBe(2);
            // Two getById calls (one per updateApplianceState) + two saves.
            expect(sdk.save).toHaveBeenCalledTimes(2);

            manager.dispose();
        });
    });

    describe('cache priming after mutations', () => {
        // The mutating methods do not rely on the SDK's appliance-updated
        // listener to refresh the cache — they re-fetch synchronously after
        // save() so a subsequent read returns the new state immediately.

        it('updateAppliance reflects the patch in the cache without waiting for a listener', async () => {
            const a = makeAppliance('appl-1', {
                metadata: {
                    connectionType: EnyoApplianceConnectionType.Connector,
                    state: EnyoApplianceStateEnum.Connected,
                    serialNumber: 'SN-1',
                },
            }, 'SN-1');
            const sdk = createAppliancesFake([a]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            await manager.updateAppliance('appl-1', {
                metadata: {state: EnyoApplianceStateEnum.Offline},
            });

            // Cache read should already show the new state — without us having
            // to call emitUpdated to simulate the listener.
            const [cached] = await manager.findByIdentifier('SN-1');
            expect(cached.metadata.state).toBe(EnyoApplianceStateEnum.Offline);

            manager.dispose();
        });

        it('updateApplianceState reflects the new state in the cache without waiting for a listener', async () => {
            const a = makeAppliance('appl-1', {}, 'SN-1');
            const sdk = createAppliancesFake([a]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            await manager.updateApplianceState(
                'appl-1',
                EnyoApplianceConnectionType.Connector,
                EnyoApplianceStateEnum.Error,
            );

            const [cached] = await manager.findByIdentifier('SN-1');
            expect(cached.metadata.state).toBe(EnyoApplianceStateEnum.Error);

            manager.dispose();
        });

        it('bulkUpdate reflects per-item patches in the cache without waiting for a listener', async () => {
            const a = makeAppliance('appl-1', {}, 'SN-1');
            const b = makeAppliance('appl-2', {}, 'SN-2');
            const sdk = createAppliancesFake([a, b]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            await manager.bulkUpdate([
                {applianceId: 'appl-1', data: {metadata: {state: EnyoApplianceStateEnum.Offline}}},
                {applianceId: 'appl-2', data: {metadata: {state: EnyoApplianceStateEnum.Error}}},
            ]);

            const [a1] = await manager.findByIdentifier('SN-1');
            const [a2] = await manager.findByIdentifier('SN-2');
            expect(a1.metadata.state).toBe(EnyoApplianceStateEnum.Offline);
            expect(a2.metadata.state).toBe(EnyoApplianceStateEnum.Error);

            manager.dispose();
        });
    });

    describe('bulkUpdate', () => {
        it('saves each appliance with the patched data and returns the correct succeeded/failed buckets', async () => {
            const a = makeAppliance('appl-1', {}, 'SN-1');
            const b = makeAppliance('appl-2', {}, 'SN-2');
            const sdk = createAppliancesFake([a, b]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            sdk.save.mockClear();
            const result = await manager.bulkUpdate([
                {applianceId: 'appl-1', data: {metadata: {state: EnyoApplianceStateEnum.Offline}}},
                {applianceId: 'appl-2', data: {metadata: {state: EnyoApplianceStateEnum.Error}}},
            ]);

            // Return-shape contract.
            expect(result).toEqual({succeeded: ['appl-1', 'appl-2'], failed: []});

            // ...and the save calls actually happened, with the right IDs and
            // payloads. Without these, an implementation that fabricated the
            // return shape without doing the work would pass the test.
            expect(sdk.save).toHaveBeenCalledTimes(2);
            const savesByApplianceId = new Map(
                sdk.save.mock.calls.map(([data, id]) => [id, data as Omit<EnyoAppliance, 'id'>]),
            );
            expect(savesByApplianceId.get('appl-1')?.metadata.state).toBe(EnyoApplianceStateEnum.Offline);
            expect(savesByApplianceId.get('appl-2')?.metadata.state).toBe(EnyoApplianceStateEnum.Error);

            manager.dispose();
        });

        it('routes unknown IDs to failed without calling save for them', async () => {
            const a = makeAppliance('appl-1', {}, 'SN-1');
            const sdk = createAppliancesFake([a]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            sdk.save.mockClear();
            const result = await manager.bulkUpdate([
                {applianceId: 'appl-1', data: {metadata: {state: EnyoApplianceStateEnum.Offline}}},
                {applianceId: 'does-not-exist', data: {metadata: {state: EnyoApplianceStateEnum.Offline}}},
            ]);

            expect(result.succeeded).toEqual(['appl-1']);
            expect(result.failed).toEqual(['does-not-exist']);
            expect(sdk.save).toHaveBeenCalledTimes(1);
            expect(sdk.save.mock.calls[0][1]).toBe('appl-1');

            manager.dispose();
        });

        it('continues after a save failure mid-batch and reports the failing ID', async () => {
            const a = makeAppliance('appl-1', {}, 'SN-1');
            const b = makeAppliance('appl-2', {}, 'SN-2');
            const c = makeAppliance('appl-3', {}, 'SN-3');
            const sdk = createAppliancesFake([a, b, c]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            // Fail the SAVE for appl-2 only; let the others through.
            const realSave = sdk.save.getMockImplementation()!;
            sdk.save.mockImplementation(async (data, id) => {
                if (id === 'appl-2') throw new Error('save boom');
                return realSave(data, id);
            });

            const result = await manager.bulkUpdate([
                {applianceId: 'appl-1', data: {metadata: {state: EnyoApplianceStateEnum.Offline}}},
                {applianceId: 'appl-2', data: {metadata: {state: EnyoApplianceStateEnum.Offline}}},
                {applianceId: 'appl-3', data: {metadata: {state: EnyoApplianceStateEnum.Offline}}},
            ]);

            expect(result.succeeded).toEqual(['appl-1', 'appl-3']);
            expect(result.failed).toEqual(['appl-2']);

            manager.dispose();
        });

        it('returns empty buckets for an empty input', async () => {
            const sdk = createAppliancesFake([]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            const result = await manager.bulkUpdate([]);

            expect(result).toEqual({succeeded: [], failed: []});
            expect(sdk.save).not.toHaveBeenCalled();

            manager.dispose();
        });
    });

    describe('dispose', () => {
        it('releases SDK listeners', async () => {
            const sdk = createAppliancesFake([]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            manager.dispose();

            expect(sdk.removeListener).toHaveBeenCalledTimes(2);
        });

        it('is idempotent', async () => {
            const sdk = createAppliancesFake([]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            manager.dispose();
            manager.dispose();

            expect(sdk.removeListener).toHaveBeenCalledTimes(2);
        });

        it('throws on subsequent public method calls', async () => {
            const sdk = createAppliancesFake([]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            manager.dispose();

            await expect(manager.findByIdentifier('x')).rejects.toThrow(ApplianceManagerDisposedError);
            await expect(manager.findApplianceById('x')).rejects.toThrow(ApplianceManagerDisposedError);
            await expect(manager.createOrUpdateAppliance(makeConfig('SN-x'))).rejects.toThrow(ApplianceManagerDisposedError);
            await expect(manager.refreshCache()).rejects.toThrow(ApplianceManagerDisposedError);
            await expect(manager.removeAppliance('x')).rejects.toThrow(ApplianceManagerDisposedError);
            await expect(manager.updateAppliance('x', {})).rejects.toThrow(ApplianceManagerDisposedError);
            await expect(manager.bulkUpdate([])).rejects.toThrow(ApplianceManagerDisposedError);
            await expect(manager.setIdentifierStrategy(new SerialNumberStrategy(), false)).rejects.toThrow(ApplianceManagerDisposedError);
            expect(() => manager.findAppliancesByNetworkDeviceId('x')).toThrow(ApplianceManagerDisposedError);
        });

        it('listener bodies short-circuit on the disposed flag (no debug log fires post-dispose, no SDK re-entry)', async () => {
            const a = makeAppliance('appl-1', {}, 'SN-1');
            const sdk = createAppliancesFake([a]);
            // Logging ON so we can use `console.debug` as a signal that the
            // listener body executed past its `if (this.disposed) return` guard.
            const manager = await ApplianceManager.initialize(
                createEnergyAppFake(sdk),
                {enableLogging: true},
            );

            // Grab the manager's listener functions directly from the spy.
            // Going through `sdk.emitUpdated/Removed` would walk the fake's
            // listener array — which `dispose` has already de-registered from
            // — so the manager's listener would never be invoked at all, and
            // the test would tell us nothing about the listener body's guard.
            const updatedListener = sdk.listenForApplianceUpdated.mock.calls[0][0] as (a: EnyoAppliance) => void | Promise<void>;
            const removedListener = sdk.listenForApplianceRemoved.mock.calls[0][0] as (id: string) => void | Promise<void>;

            const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {
            });
            try {
                // Sanity: pre-dispose, the listener body runs to the end and
                // logs. If the early-return guard was *always* on, this would
                // also be silent — so this assertion pins the "logs when alive"
                // direction.
                updatedListener(a);
                expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Appliance updated event'));
                debugSpy.mockClear();

                // ---- dispose ----
                manager.dispose();

                const callsBefore = {
                    save: sdk.save.mock.calls.length,
                    list: sdk.list.mock.calls.length,
                    getById: sdk.getById.mock.calls.length,
                };

                expect(() => updatedListener(a)).not.toThrow();
                expect(() => removedListener('appl-1')).not.toThrow();

                // The discriminating assertion: the listener body's guard
                // short-circuits BEFORE the debug-log line. Removing
                // `if (this.disposed) return` from either listener would
                // cause this to fail (the debug log would fire).
                expect(debugSpy).not.toHaveBeenCalled();

                // Belt-and-braces: no SDK re-entry from the listener bodies
                // (also catches a hypothetical regression where the listener
                // started doing SDK work directly).
                expect(sdk.save.mock.calls.length).toBe(callsBefore.save);
                expect(sdk.list.mock.calls.length).toBe(callsBefore.list);
                expect(sdk.getById.mock.calls.length).toBe(callsBefore.getById);
            } finally {
                debugSpy.mockRestore();
            }

            // Confirms the manager is genuinely disposed — the test isn't
            // accidentally exercising a live manager.
            expect(() => manager.findAppliancesByNetworkDeviceId('any')).toThrow(ApplianceManagerDisposedError);
        });
    });
});

describe('InMemoryApplianceManager disposal contract', () => {
    /**
     * The in-memory subclass overrides several public methods directly
     * (no `super` calls). After dispose, those overrides must also throw
     * {@link ApplianceManagerDisposedError} — otherwise a disposed in-memory
     * manager silently returns data while the parent class throws, breaking
     * substitutability.
     */

    function makeInMemoryManager(): InMemoryApplianceManager {
        // The in-memory class doesn't actually use the EnergyApp for
        // persistence — we pass a minimal stub satisfying the type.
        const energyApp = {
            useAppliances: () => ({
                listenForApplianceUpdated: vi.fn(() => 'noop-upd'),
                listenForApplianceRemoved: vi.fn(() => 'noop-rm'),
                removeListener: vi.fn(),
            }),
        } as unknown as EnergyApp;
        return new InMemoryApplianceManager(energyApp, {enableLogging: false});
    }

    it('throws on overridden methods after dispose, matching the parent contract', async () => {
        const manager = makeInMemoryManager();

        // Sanity: before dispose, the overrides work normally.
        await expect(manager.findByIdentifier('unknown')).resolves.toEqual([]);
        await expect(manager.findFirstByStrategies('unknown', [new SerialNumberStrategy()])).resolves.toBeUndefined();

        manager.dispose();

        // Each override must call throwIfDisposed() — otherwise the
        // disposed manager silently returns `[]` / `undefined`, which is
        // indistinguishable from a legitimate "not found" and masks bugs.
        await expect(manager.findByIdentifier('x'))
            .rejects.toThrow(ApplianceManagerDisposedError);
        await expect(manager.findFirstByStrategies('x', [new SerialNumberStrategy()]))
            .rejects.toThrow(ApplianceManagerDisposedError);

        // Sibling overrides should also throw — covering the full overridden surface.
        await expect(manager.createOrUpdateAppliance(makeConfig('SN-x')))
            .rejects.toThrow(ApplianceManagerDisposedError);
        await expect(manager.getAppliancesByType(EnyoApplianceTypeEnum.Inverter))
            .rejects.toThrow(ApplianceManagerDisposedError);
        await expect(manager.bulkUpdate([]))
            .rejects.toThrow(ApplianceManagerDisposedError);
        await expect(manager.refreshCache())
            .rejects.toThrow(ApplianceManagerDisposedError);
    });
});
