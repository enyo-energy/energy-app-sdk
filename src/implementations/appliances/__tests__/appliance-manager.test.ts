import {describe, expect, it, vi} from 'vitest';
import type {EnergyApp} from '../../../energy-app.js';
import {
    type EnyoAppliance,
    EnyoApplianceAvailableFeaturesEnum,
    type EnyoApplianceGroup,
    EnyoApplianceConnectionType,
    EnyoApplianceStateEnum,
    EnyoApplianceTypeEnum,
} from '../../../types/enyo-appliance.js';
import {
    EnyoHeatingRodApplianceAvailableFeaturesEnum,
    EnyoHeatingRodApplianceModeEnum,
} from '../../../types/enyo-heating-rod-appliance.js';
import {
    EnyoSmartPlugApplianceAvailableFeaturesEnum,
    EnyoSmartPlugApplianceIconEnum,
    EnyoSmartPlugApplianceStateEnum,
} from '../../../types/enyo-smart-plug-appliance.js';
import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum,
    EnyoHeatpumpApplianceModeEnum,
    EnyoHeatpumpSgReadyFunctionEnum,
    EnyoHeatpumpSgReadyStateEnum,
    EnyoHeatpumpTimeProgramLevelEnum,
} from '../../../types/enyo-heatpump-appliance.js';
import type {EnyoApplianceCreatedFilter} from '../../../packages/energy-app-appliance.js';
import {
    type ApplianceConfig,
    ApplianceGroupNotFoundError,
    ApplianceManager,
    ApplianceManagerDisposedError,
    MissingIdentifierError,
} from '../appliance-manager.js';
import {InMemoryApplianceManager} from '../in-memory-appliance-manager.js';
import {
    HostnameStrategy,
    IdentifierStrategyFactory,
    NetworkDeviceIdStrategy,
    SerialNumberStrategy,
} from '../identifier-strategies.js';

type AppliancesFake = {
    list: ReturnType<typeof vi.fn>;
    listAll: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    removeById: ReturnType<typeof vi.fn>;
    listenForApplianceUpdated: ReturnType<typeof vi.fn>;
    listenForApplianceRemoved: ReturnType<typeof vi.fn>;
    listenForApplianceCreated: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    saveGroup: ReturnType<typeof vi.fn>;
    listGroups: ReturnType<typeof vi.fn>;
    removeGroup: ReturnType<typeof vi.fn>;
    emitUpdated: (appliance: EnyoAppliance) => Promise<void>;
    emitRemoved: (id: string) => Promise<void>;
    emitCreated: (appliance: EnyoAppliance) => Promise<void>;
};

function createAppliancesFake(seed: EnyoAppliance[] = [], groupSeed: EnyoApplianceGroup[] = []): AppliancesFake {
    const store = new Map(seed.map(a => [a.id, structuredClone(a)]));
    const groups = new Map(groupSeed.map(g => [g.id, structuredClone(g)]));
    let nextGroupId = groupSeed.length + 1;
    const updatedListeners: { id: string; fn: (a: EnyoAppliance) => void | Promise<void> }[] = [];
    const removedListeners: { id: string; fn: (id: string) => void | Promise<void> }[] = [];
    const createdListeners: {
        id: string;
        fn: (a: EnyoAppliance) => void | Promise<void>;
        filter?: EnyoApplianceCreatedFilter;
    }[] = [];
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
        listenForApplianceCreated: vi.fn((fn, filter?: EnyoApplianceCreatedFilter) => {
            const id = `crt-${++listenerCounter}`;
            createdListeners.push({id, fn, filter});
            return id;
        }),
        removeListener: vi.fn((id: string) => {
            for (const arr of [updatedListeners, removedListeners, createdListeners]) {
                const idx = arr.findIndex(l => l.id === id);
                if (idx >= 0) arr.splice(idx, 1);
            }
        }),
        saveGroup: vi.fn(async (data: Omit<EnyoApplianceGroup, 'id'>, id?: string) => {
            // Mirror the host rule: an appliance belongs to at most one group.
            for (const other of groups.values()) {
                if (other.id !== id && other.applianceIds.some(a => data.applianceIds.includes(a))) {
                    throw new Error(`appliance already in group ${other.id}`);
                }
            }
            const groupId = id ?? `grp-${nextGroupId++}`;
            groups.set(groupId, {...structuredClone(data), id: groupId});
            return groupId;
        }),
        listGroups: vi.fn(async () => Array.from(groups.values()).map(g => structuredClone(g))),
        removeGroup: vi.fn(async (id: string) => {
            groups.delete(id);
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
        emitCreated: async (appliance) => {
            // Mirror the SDK behaviour: the store reflects the new appliance,
            // then each listener whose filter matches is invoked. The fake
            // applies the `types` category filter; `scope` is a host-side
            // concern and is not simulated here.
            store.set(appliance.id, structuredClone(appliance));
            for (const {fn, filter} of [...createdListeners]) {
                if (filter?.types && !filter.types.includes(appliance.type)) continue;
                await fn(appliance);
            }
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

/** Returns {@link makeConfig}'s config without the `networkDevices` key, as an app sends it on a later save. */
function makeConfigWithoutNetworkDevices(serialNumber: string): ApplianceConfig {
    const {networkDevices: _, ...config} = makeConfig(serialNumber);
    return config;
}

/** Returns a config without serial number on the given network devices, reporting the given hostname. */
function makeHostnameConfig(networkDeviceIds: string[], hostname: string, type = EnyoApplianceTypeEnum.Inverter): ApplianceConfig {
    return {...makeConfig('', networkDeviceIds), type, metadata: {hostname}};
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
            const renamed = {...a, metadata: {...a.metadata!, serialNumber: 'SN-new'}};
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
        it('keeps an SG Ready relay another app linked into the heat pump when the heat pump app sends its own relays', async () => {
            const ownRelay = {
                index: 0,
                function: EnyoHeatpumpSgReadyFunctionEnum.Heating,
                activeState: EnyoHeatpumpSgReadyStateEnum.Normal,
            };
            const linkedRelay = {
                index: 1,
                function: EnyoHeatpumpSgReadyFunctionEnum.DhwHeatpump,
                zoneIndex: 1,
                supportedStates: [EnyoHeatpumpSgReadyStateEnum.Normal, EnyoHeatpumpSgReadyStateEnum.Recommended],
                applianceId: 'shelly-plug',
            };
            const a = makeAppliance('appl-1', {
                type: EnyoApplianceTypeEnum.Heatpump,
                heatpump: {availableFeatures: [], sgReadyRelays: [ownRelay, linkedRelay]},
            }, 'SN-1');
            const sdk = createAppliancesFake([a]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            const raised = {...ownRelay, activeState: EnyoHeatpumpSgReadyStateEnum.Recommended};
            await manager.updateAppliance('appl-1', {heatpump: {availableFeatures: [], sgReadyRelays: [raised]}});

            const saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.heatpump?.sgReadyRelays).toEqual([raised, linkedRelay]);

            manager.dispose();
        });

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

        it('preserves stored networkDeviceIds when an update omits networkDevices', async () => {
            const sdk = createAppliancesFake();
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            await manager.createOrUpdateAppliance(makeConfig('SN-1', ['dev-1']));
            await manager.createOrUpdateAppliance(makeConfigWithoutNetworkDevices('SN-1'));

            const saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(sdk.save.mock.calls.at(-1)![1]).toBeDefined();
            expect(saved.networkDeviceIds).toEqual(['dev-1']);

            manager.dispose();
        });

        it('clears stored networkDeviceIds when an update passes networkDevices: []', async () => {
            const existing = makeAppliance('existing-1', {networkDeviceIds: ['dev-1']}, 'SN-1');
            const sdk = createAppliancesFake([existing]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            await manager.createOrUpdateAppliance({...makeConfig('SN-1'), networkDevices: []});

            const saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.networkDeviceIds).toEqual([]);

            manager.dispose();
        });

        it('creates a new appliance with empty networkDeviceIds when networkDevices are omitted', async () => {
            const sdk = createAppliancesFake();
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            await manager.createOrUpdateAppliance(makeConfigWithoutNetworkDevices('SN-1'));

            const saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.networkDeviceIds).toEqual([]);

            manager.dispose();
        });

        it('updates the same appliance by network device id when the hostname changes', async () => {
            const sdk = createAppliancesFake();
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), {
                ...silent,
                identifierStrategy: IdentifierStrategyFactory.networkDeviceId(),
            });

            const first = await manager.createOrUpdateAppliance({
                ...makeConfig('', ['dev-1']),
                metadata: {hostname: 'lambda-6.fritz.box'},
            });
            const second = await manager.createOrUpdateAppliance({
                ...makeConfig('', ['dev-1']),
                metadata: {hostname: 'lambda-7.fritz.box'},
            });

            expect(second).toBe(first);
            expect(sdk.save).toHaveBeenCalledTimes(2);
            expect(sdk.save.mock.calls[1][1]).toBe(first);

            manager.dispose();
        });

        it('preserves stored hidden flag when an update omits it, and unhides when false is supplied', async () => {
            const existing = makeAppliance('existing-1', {hidden: true}, 'SN-1');
            const sdk = createAppliancesFake([existing]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            // Omit hidden — must be preserved.
            await manager.createOrUpdateAppliance(makeConfig('SN-1'));
            let saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.hidden).toBe(true);

            // Supply false — must unhide.
            await manager.createOrUpdateAppliance({...makeConfig('SN-1'), hidden: false});
            saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.hidden).toBe(false);

            manager.dispose();
        });

        it('shallow-merges heatingRod metadata when patching only a subset', async () => {
            const a = makeAppliance('appl-1', {
                type: EnyoApplianceTypeEnum.HeatingRod,
                heatingRod: {
                    availableFeatures: [EnyoHeatingRodApplianceAvailableFeaturesEnum.Power],
                    mode: EnyoHeatingRodApplianceModeEnum.Idle,
                    ratedPowerW: 3000,
                    heatpumpApplianceId: 'hp-1',
                },
            }, 'SN-1');
            const sdk = createAppliancesFake([a]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            // Patch only the mode — the other heatingRod fields must survive.
            await manager.updateAppliance('appl-1', {
                heatingRod: {
                    availableFeatures: [EnyoHeatingRodApplianceAvailableFeaturesEnum.Power],
                    mode: EnyoHeatingRodApplianceModeEnum.Heating,
                },
            });

            const saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.heatingRod).toEqual({
                availableFeatures: [EnyoHeatingRodApplianceAvailableFeaturesEnum.Power],
                mode: EnyoHeatingRodApplianceModeEnum.Heating,
                ratedPowerW: 3000,
                heatpumpApplianceId: 'hp-1',
            });

            manager.dispose();
        });

        it('preserves stored heatingRod metadata when createOrUpdateAppliance omits it', async () => {
            const existing = makeAppliance('existing-1', {
                type: EnyoApplianceTypeEnum.HeatingRod,
                heatingRod: {
                    availableFeatures: [
                        EnyoHeatingRodApplianceAvailableFeaturesEnum.AvailablePowerAnnouncement,
                    ],
                    mode: EnyoHeatingRodApplianceModeEnum.Idle,
                    ratedPowerW: 4500,
                },
            }, 'SN-1');
            const sdk = createAppliancesFake([existing]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            // makeConfig does not set heatingRod — a metadata-only update must not clear it.
            await manager.createOrUpdateAppliance(makeConfig('SN-1'));

            const saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.heatingRod).toEqual({
                availableFeatures: [
                    EnyoHeatingRodApplianceAvailableFeaturesEnum.AvailablePowerAnnouncement,
                ],
                mode: EnyoHeatingRodApplianceModeEnum.Idle,
                ratedPowerW: 4500,
            });

            manager.dispose();
        });

        it('shallow-merges smartPlug metadata when patching only a subset', async () => {
            const a = makeAppliance('appl-1', {
                type: EnyoApplianceTypeEnum.SmartPlug,
                smartPlug: {
                    availableFeatures: [
                        EnyoSmartPlugApplianceAvailableFeaturesEnum.Switching,
                        EnyoSmartPlugApplianceAvailableFeaturesEnum.Power,
                    ],
                    state: EnyoSmartPlugApplianceStateEnum.Off,
                    channel: 1,
                    ratedPowerW: 3500,
                    defaults: {
                        showInCockpit: true,
                        onOffSwitchShown: true,
                        icon: EnyoSmartPlugApplianceIconEnum.Dishwasher,
                    },
                },
            }, 'SN-1');
            const sdk = createAppliancesFake([a]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            // Patch only the relay state — the other smartPlug fields must survive.
            await manager.updateAppliance('appl-1', {
                smartPlug: {
                    availableFeatures: [
                        EnyoSmartPlugApplianceAvailableFeaturesEnum.Switching,
                        EnyoSmartPlugApplianceAvailableFeaturesEnum.Power,
                    ],
                    state: EnyoSmartPlugApplianceStateEnum.On,
                },
            });

            const saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.smartPlug).toEqual({
                availableFeatures: [
                    EnyoSmartPlugApplianceAvailableFeaturesEnum.Switching,
                    EnyoSmartPlugApplianceAvailableFeaturesEnum.Power,
                ],
                state: EnyoSmartPlugApplianceStateEnum.On,
                channel: 1,
                ratedPowerW: 3500,
                defaults: {
                    showInCockpit: true,
                    onOffSwitchShown: true,
                    icon: EnyoSmartPlugApplianceIconEnum.Dishwasher,
                },
            });

            manager.dispose();
        });

        it('preserves stored heatpump cooling metadata when createOrUpdateAppliance omits it', async () => {
            const existing = makeAppliance('existing-1', {
                type: EnyoApplianceTypeEnum.Heatpump,
                heatpump: {
                    availableFeatures: [EnyoHeatpumpApplianceAvailableFeaturesEnum.Cooling],
                    mode: EnyoHeatpumpApplianceModeEnum.Cooling,
                    heatingCircuits: [
                        {index: 0, targetRoomTemperatureC: 21, targetCoolingRoomTemperatureC: 24},
                    ],
                },
            }, 'SN-1');
            const sdk = createAppliancesFake([existing]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            // makeConfig does not set heatpump — a metadata-only update must not clear it.
            await manager.createOrUpdateAppliance(makeConfig('SN-1'));

            const saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.heatpump).toEqual({
                availableFeatures: [EnyoHeatpumpApplianceAvailableFeaturesEnum.Cooling],
                mode: EnyoHeatpumpApplianceModeEnum.Cooling,
                heatingCircuits: [
                    {index: 0, targetRoomTemperatureC: 21, targetCoolingRoomTemperatureC: 24},
                ],
            });

            manager.dispose();
        });
    });

    describe('updateHeatpumpHeatingCircuit / updateHeatpumpDomesticHotWater', () => {
        const curve = {
            points: [
                {outdoorTemperatureC: -10, flowTemperatureC: 45},
                {outdoorTemperatureC: 15, flowTemperatureC: 28},
            ],
        };
        const heatpump = () => makeAppliance('hp-1', {
            type: EnyoApplianceTypeEnum.Heatpump,
            heatpump: {
                availableFeatures: [EnyoHeatpumpApplianceAvailableFeaturesEnum.HeatingCurve],
                mode: EnyoHeatpumpApplianceModeEnum.Heating,
                heatingCircuits: [
                    {index: 0, customName: 'Ground floor', targetRoomTemperatureC: 21},
                    {index: 2, customName: 'Attic'},
                ],
                domesticHotWater: [{index: 0, targetTemperatureC: 50, tankSizeLiter: 300}],
            },
        }, 'SN-HP');

        it('merges the patch into the matching circuit and leaves the others untouched', async () => {
            const sdk = createAppliancesFake([heatpump()]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            await manager.updateHeatpumpHeatingCircuit('hp-1', 0, {heatingCurve: curve});

            const saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.heatpump?.heatingCircuits).toEqual([
                {index: 0, customName: 'Ground floor', targetRoomTemperatureC: 21, heatingCurve: curve},
                {index: 2, customName: 'Attic'},
            ]);
            // Sibling heatpump metadata survives.
            expect(saved.heatpump?.mode).toBe(EnyoHeatpumpApplianceModeEnum.Heating);
            expect(saved.heatpump?.domesticHotWater).toHaveLength(1);

            manager.dispose();
        });

        it('appends a missing circuit in index order', async () => {
            const sdk = createAppliancesFake([heatpump()]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            await manager.updateHeatpumpHeatingCircuit('hp-1', 1, {customName: 'First floor'});

            const saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.heatpump?.heatingCircuits?.map(c => c.index)).toEqual([0, 1, 2]);
            expect(saved.heatpump?.heatingCircuits?.[1]).toEqual({index: 1, customName: 'First floor'});

            manager.dispose();
        });

        it('patches a DHW zone and refuses to append one without targetTemperatureC', async () => {
            const sdk = createAppliancesFake([heatpump()]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);
            const timeProgram = {
                defaultLevel: EnyoHeatpumpTimeProgramLevelEnum.Reduced,
                periods: [{
                    daysOfWeek: [1, 2, 3, 4, 5],
                    startTimeOfDay: '05:00',
                    endTimeOfDay: '07:00',
                    level: EnyoHeatpumpTimeProgramLevelEnum.Comfort,
                }],
            };

            await manager.updateHeatpumpDomesticHotWater('hp-1', 0, {timeProgram});

            const saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.heatpump?.domesticHotWater).toEqual([
                {index: 0, targetTemperatureC: 50, tankSizeLiter: 300, timeProgram},
            ]);

            await expect(manager.updateHeatpumpDomesticHotWater('hp-1', 1, {timeProgram}))
                .rejects.toThrow(/targetTemperatureC/);

            manager.dispose();
        });

        it('remembers the initial heating curve once and clears it again', async () => {
            const sdk = createAppliancesFake([heatpump()]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);
            const shifted = {points: curve.points.map(p => ({...p, flowTemperatureC: p.flowTemperatureC - 2}))};

            expect(await manager.rememberHeatpumpInitialHeatingCurve('hp-1', 0, curve)).toBe(true);
            // A later, already shifted curve must not replace the initial one.
            expect(await manager.rememberHeatpumpInitialHeatingCurve('hp-1', 0, shifted)).toBe(false);
            await manager.updateHeatpumpHeatingCircuit('hp-1', 0, {activeHeatingCurveOffsetK: -2});

            let saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.heatpump?.heatingCircuits?.[0]).toEqual({
                index: 0, customName: 'Ground floor', targetRoomTemperatureC: 21,
                initialHeatingCurve: curve, activeHeatingCurveOffsetK: -2,
            });

            await manager.clearHeatpumpInitialHeatingCurve('hp-1', 0);

            saved = sdk.save.mock.calls.at(-1)![0] as Omit<EnyoAppliance, 'id'>;
            expect(saved.heatpump?.heatingCircuits).toEqual([
                {index: 0, customName: 'Ground floor', targetRoomTemperatureC: 21, activeHeatingCurveOffsetK: 0},
                {index: 2, customName: 'Attic'},
            ]);

            manager.dispose();
        });

        it('does nothing for an unknown appliance', async () => {
            const sdk = createAppliancesFake([heatpump()]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            await manager.updateHeatpumpHeatingCircuit('missing', 0, {customName: 'x'});

            expect(sdk.save).not.toHaveBeenCalled();
            manager.dispose();
        });
    });

    describe('onApplianceCreated', () => {
        it('fires for newly-created appliances', async () => {
            const sdk = createAppliancesFake([]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            const created: EnyoAppliance[] = [];
            manager.onApplianceCreated(a => {
                created.push(a);
            });

            await sdk.emitCreated(makeAppliance('new-1', {}, 'SN-NEW'));

            expect(created).toHaveLength(1);
            expect(created[0]!.id).toBe('new-1');

            manager.dispose();
        });

        it('only fires for appliances whose category is in the types filter', async () => {
            const sdk = createAppliancesFake([]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            const seen: string[] = [];
            manager.onApplianceCreated(a => {
                seen.push(a.id);
            }, {types: [EnyoApplianceTypeEnum.Heatpump]});

            await sdk.emitCreated(makeAppliance('hp-1', {type: EnyoApplianceTypeEnum.Heatpump}, 'SN-HP'));
            await sdk.emitCreated(makeAppliance('inv-1', {type: EnyoApplianceTypeEnum.Inverter}, 'SN-INV'));

            expect(seen).toEqual(['hp-1']);

            manager.dispose();
        });

        it('stops firing after the returned unsubscribe function is called', async () => {
            const sdk = createAppliancesFake([]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            let count = 0;
            const unsubscribe = manager.onApplianceCreated(() => {
                count++;
            });

            await sdk.emitCreated(makeAppliance('new-1', {}, 'SN-1'));
            unsubscribe();
            await sdk.emitCreated(makeAppliance('new-2', {}, 'SN-2'));

            expect(count).toBe(1);
            expect(sdk.removeListener).toHaveBeenCalledTimes(1);

            manager.dispose();
        });

        it('removes a still-active created listener on dispose', async () => {
            const sdk = createAppliancesFake([]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            let count = 0;
            manager.onApplianceCreated(() => {
                count++;
            });

            manager.dispose();
            await sdk.emitCreated(makeAppliance('new-1', {}, 'SN-1'));

            expect(count).toBe(0);
        });

        it('throws when called after dispose', async () => {
            const sdk = createAppliancesFake([]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);
            manager.dispose();

            expect(() => manager.onApplianceCreated(() => {})).toThrow(ApplianceManagerDisposedError);
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
            expect(cached.metadata?.state).toBe(EnyoApplianceStateEnum.Offline);

            manager.dispose();
        });

        it('updateApplianceState reflects the new state in the cache without waiting for a listener', async () => {
            const a = makeAppliance('appl-1', {}, 'SN-1');
            const sdk = createAppliancesFake([a]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            await manager.updateApplianceState(
                'appl-1',
                EnyoApplianceConnectionType.Connector,
                EnyoApplianceStateEnum.ConfigurationRequired,
            );

            const [cached] = await manager.findByIdentifier('SN-1');
            expect(cached.metadata?.state).toBe(EnyoApplianceStateEnum.ConfigurationRequired);

            manager.dispose();
        });

        it('bulkUpdate reflects per-item patches in the cache without waiting for a listener', async () => {
            const a = makeAppliance('appl-1', {}, 'SN-1');
            const b = makeAppliance('appl-2', {}, 'SN-2');
            const sdk = createAppliancesFake([a, b]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            await manager.bulkUpdate([
                {applianceId: 'appl-1', data: {metadata: {connectionType: EnyoApplianceConnectionType.Connector, state: EnyoApplianceStateEnum.Offline}}},
                {applianceId: 'appl-2', data: {metadata: {connectionType: EnyoApplianceConnectionType.Connector, state: EnyoApplianceStateEnum.ConfigurationRequired}}},
            ]);

            const [a1] = await manager.findByIdentifier('SN-1');
            const [a2] = await manager.findByIdentifier('SN-2');
            expect(a1.metadata?.state).toBe(EnyoApplianceStateEnum.Offline);
            expect(a2.metadata?.state).toBe(EnyoApplianceStateEnum.ConfigurationRequired);

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
                {applianceId: 'appl-1', data: {metadata: {connectionType: EnyoApplianceConnectionType.Connector, state: EnyoApplianceStateEnum.Offline}}},
                {applianceId: 'appl-2', data: {metadata: {connectionType: EnyoApplianceConnectionType.Connector, state: EnyoApplianceStateEnum.ConfigurationRequired}}},
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
            expect(savesByApplianceId.get('appl-1')?.metadata?.state).toBe(EnyoApplianceStateEnum.Offline);
            expect(savesByApplianceId.get('appl-2')?.metadata?.state).toBe(EnyoApplianceStateEnum.ConfigurationRequired);

            manager.dispose();
        });

        it('routes unknown IDs to failed without calling save for them', async () => {
            const a = makeAppliance('appl-1', {}, 'SN-1');
            const sdk = createAppliancesFake([a]);
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

            sdk.save.mockClear();
            const result = await manager.bulkUpdate([
                {applianceId: 'appl-1', data: {metadata: {connectionType: EnyoApplianceConnectionType.Connector, state: EnyoApplianceStateEnum.Offline}}},
                {applianceId: 'does-not-exist', data: {metadata: {connectionType: EnyoApplianceConnectionType.Connector, state: EnyoApplianceStateEnum.Offline}}},
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
                {applianceId: 'appl-1', data: {metadata: {connectionType: EnyoApplianceConnectionType.Connector, state: EnyoApplianceStateEnum.Offline}}},
                {applianceId: 'appl-2', data: {metadata: {connectionType: EnyoApplianceConnectionType.Connector, state: EnyoApplianceStateEnum.Offline}}},
                {applianceId: 'appl-3', data: {metadata: {connectionType: EnyoApplianceConnectionType.Connector, state: EnyoApplianceStateEnum.Offline}}},
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

describe('ApplianceManager appliance groups', () => {
    const name = [{language: 'en', name: 'Roof inverters'}] as EnyoApplianceGroup['name'];

    it('creates a group and updates it in place on the same key', async () => {
        const sdk = createAppliancesFake();
        const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

        const id = await manager.createOrUpdateGroup({key: 'gw-1', name, applianceIds: ['a1', 'a2']});
        const updatedId = await manager.createOrUpdateGroup({key: 'gw-1', name, applianceIds: ['a1', 'a2', 'a3']});

        expect(updatedId).toBe(id);
        const groups = await manager.getGroups();
        expect(groups).toHaveLength(1);
        expect(groups[0]).toEqual({id, key: 'gw-1', name, applianceIds: ['a1', 'a2', 'a3']});

        manager.dispose();
    });

    it('moves members out of another group and removes a group left empty', async () => {
        const sdk = createAppliancesFake([], [
            {id: 'grp-a', key: 'a', name, applianceIds: ['a1', 'a2']},
            {id: 'grp-b', key: 'b', name, applianceIds: ['a3']},
        ]);
        const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

        await manager.createOrUpdateGroup({key: 'c', name, applianceIds: ['a2', 'a3']});

        expect((await manager.findGroupByKey('a'))?.applianceIds).toEqual(['a1']);
        expect(await manager.findGroupByKey('b')).toBeNull();
        expect((await manager.findGroupOfAppliance('a3'))?.key).toBe('c');

        manager.dispose();
    });

    it('rejects a group without appliances', async () => {
        const sdk = createAppliancesFake();
        const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

        await expect(manager.createOrUpdateGroup({key: 'gw-1', name, applianceIds: []})).rejects.toThrow();
        expect(sdk.saveGroup).not.toHaveBeenCalled();

        manager.dispose();
    });

    it('adds an appliance to an existing group and throws for an unknown key', async () => {
        const sdk = createAppliancesFake([], [{id: 'grp-1', key: 'gw-1', name, applianceIds: ['a1']}]);
        const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

        expect(await manager.addApplianceToGroup('gw-1', 'a2')).toBe('grp-1');
        expect((await manager.findGroupByKey('gw-1'))?.applianceIds).toEqual(['a1', 'a2']);
        await expect(manager.addApplianceToGroup('missing', 'a3')).rejects.toBeInstanceOf(ApplianceGroupNotFoundError);

        manager.dispose();
    });

    it('takes an appliance out of its group and removes the group once empty', async () => {
        const sdk = createAppliancesFake([], [{id: 'grp-1', key: 'gw-1', name, applianceIds: ['a1', 'a2']}]);
        const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

        expect(await manager.removeApplianceFromGroup('a1')).toBe(true);
        expect((await manager.findGroupByKey('gw-1'))?.applianceIds).toEqual(['a2']);
        expect(await manager.removeApplianceFromGroup('a2')).toBe(true);
        expect(await manager.getGroups()).toEqual([]);
        expect(await manager.removeApplianceFromGroup('a2')).toBe(false);

        manager.dispose();
    });

    it('removes a group by key', async () => {
        const sdk = createAppliancesFake([], [{id: 'grp-1', key: 'gw-1', name, applianceIds: ['a1']}]);
        const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

        expect(await manager.removeGroup('gw-1')).toBe(true);
        expect(sdk.removeGroup).toHaveBeenCalledWith('grp-1');
        expect(await manager.removeGroup('gw-1')).toBe(false);

        manager.dispose();
    });

    it('keeps groups in memory for InMemoryApplianceManager and drops removed appliances', async () => {
        const sdk = createAppliancesFake();
        const manager = new InMemoryApplianceManager(createEnergyAppFake(sdk), silent);
        const a1 = await manager.createOrUpdateAppliance(makeConfig('SN-1'));
        const a2 = await manager.createOrUpdateAppliance(makeConfig('SN-2'));

        await manager.createOrUpdateGroup({key: 'gw-1', name, applianceIds: [a1, a2]});
        await manager.removeAppliance(a1);

        expect((await manager.findGroupByKey('gw-1'))?.applianceIds).toEqual([a2]);
        expect(sdk.saveGroup).not.toHaveBeenCalled();

        manager.dispose();
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

    it('preserves type-specific and top-level fields when an update omits them', async () => {
        const manager = makeInMemoryManager();

        // Seed a HeatingRod appliance carrying type-specific metadata plus the two
        // non-mergeable top-level fields (availableFeatures, cloudPackageId).
        const id = await manager.createOrUpdateAppliance({
            ...makeConfig('SN-1'),
            type: EnyoApplianceTypeEnum.HeatingRod,
            heatingRod: {
                availableFeatures: [
                    EnyoHeatingRodApplianceAvailableFeaturesEnum.AvailablePowerAnnouncement,
                ],
                mode: EnyoHeatingRodApplianceModeEnum.Idle,
                ratedPowerW: 4500,
            },
            availableFeatures: [EnyoApplianceAvailableFeaturesEnum.LimitPowerConsumption],
            cloudPackageId: 'pkg-1',
        });

        // A metadata-only update for the same appliance (matched by serial number)
        // must not drop the previously stored fields.
        const updatedId = await manager.createOrUpdateAppliance(makeConfig('SN-1'));
        expect(updatedId).toBe(id);

        const stored = await manager.getApplianceById(id);
        expect(stored?.heatingRod).toEqual({
            availableFeatures: [
                EnyoHeatingRodApplianceAvailableFeaturesEnum.AvailablePowerAnnouncement,
            ],
            mode: EnyoHeatingRodApplianceModeEnum.Idle,
            ratedPowerW: 4500,
        });
        expect(stored?.availableFeatures).toEqual([EnyoApplianceAvailableFeaturesEnum.LimitPowerConsumption]);
        expect(stored?.cloudPackageId).toBe('pkg-1');

        manager.dispose();
    });
});

describe('InMemoryApplianceManager networkDeviceIds', () => {
    it('keeps stored networkDeviceIds when an update omits networkDevices, and clears them on []', async () => {
        const manager = new InMemoryApplianceManager(createEnergyAppFake(createAppliancesFake()), silent);
        const id = await manager.createOrUpdateAppliance(makeConfig('SN-1', ['dev-1']));

        await manager.createOrUpdateAppliance(makeConfigWithoutNetworkDevices('SN-1'));
        expect((await manager.getApplianceById(id))?.networkDeviceIds).toEqual(['dev-1']);

        await manager.createOrUpdateAppliance({...makeConfig('SN-1'), networkDevices: []});
        expect((await manager.getApplianceById(id))?.networkDeviceIds).toEqual([]);

        manager.dispose();
    });
});

describe('NetworkDeviceIdStrategy', () => {
    it('extracts type and network device id from a config and a stored appliance alike', () => {
        const strategy = new NetworkDeviceIdStrategy();
        const config = makeConfig('SN-1', ['dev-1', 'dev-2']);
        const stored = makeAppliance('appl-1', {networkDeviceIds: ['dev-1', 'dev-2']});

        expect(strategy.extract(config)).toBe(`${EnyoApplianceTypeEnum.Inverter}:dev-1`);
        expect(strategy.extract(stored)).toBe(strategy.extract(config));
    });

    it('returns undefined without a network device', () => {
        const strategy = new NetworkDeviceIdStrategy();
        expect(strategy.extract(makeConfigWithoutNetworkDevices('SN-1'))).toBeUndefined();
        expect(strategy.extract(makeConfig('SN-1'))).toBeUndefined();
        expect(strategy.extract(makeAppliance('appl-1'))).toBeUndefined();
    });

    it('appends the sub-key and requires it when an extractor is given', () => {
        const strategy = new NetworkDeviceIdStrategy(a => a.metadata?.modbus?.unitId);
        const config: ApplianceConfig = {...makeConfig('SN-1', ['dev-1']), metadata: {modbus: {unitId: 3}}};
        const stored = makeAppliance('appl-1', {networkDeviceIds: ['dev-1']});
        stored.metadata = {...stored.metadata!, modbus: {unitId: 3}};

        expect(strategy.name).toBe('networkDeviceId+subKey');
        expect(strategy.extract(config)).toBe(`${EnyoApplianceTypeEnum.Inverter}:dev-1:3`);
        expect(strategy.extract(stored)).toBe(strategy.extract(config));
        expect(strategy.extract(makeConfig('SN-1', ['dev-1']))).toBeUndefined();
    });

    it('keeps several appliances of the same type behind one network device apart', async () => {
        const sdk = createAppliancesFake();
        const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), {
            ...silent,
            identifierStrategy: IdentifierStrategyFactory.networkDeviceId(a => a.metadata?.modbus?.unitId),
        });

        const unit1 = await manager.createOrUpdateAppliance({...makeConfig('', ['dev-1']), metadata: {modbus: {unitId: 1}}});
        const unit2 = await manager.createOrUpdateAppliance({...makeConfig('', ['dev-1']), metadata: {modbus: {unitId: 2}}});

        expect(unit2).not.toBe(unit1);

        manager.dispose();
    });
});

describe('createOrUpdateAppliance networkDeviceIds', () => {
    it('keeps a link added from the backoffice while the save updates other fields', async () => {
        const sdk = createAppliancesFake();
        const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);
        const id = await manager.createOrUpdateAppliance(makeConfig('SN-1', ['dev-1']));

        // The backoffice adds a second network device to the appliance.
        const stored = (await sdk.getById(id)) as EnyoAppliance;
        await sdk.emitUpdated({...stored, networkDeviceIds: ['dev-1', 'dev-bo']});

        await manager.createOrUpdateAppliance({
            ...makeConfigWithoutNetworkDevices('SN-1'),
            name: [{language: 'en', name: 'renamed'}],
        });
        await manager.createOrUpdateAppliance(makeConfigWithoutNetworkDevices('SN-1'));

        const saved = (await sdk.getById(id)) as EnyoAppliance;
        expect(saved.networkDeviceIds).toEqual(['dev-1', 'dev-bo']);
        expect(sdk.save).toHaveBeenCalledTimes(3);

        manager.dispose();
    });

    it('applies the other fields of an update that omits networkDevices', async () => {
        const existing = makeAppliance('existing-1', {networkDeviceIds: ['dev-1']}, 'SN-1');
        const sdk = createAppliancesFake([existing]);
        const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

        await manager.createOrUpdateAppliance({
            ...makeConfigWithoutNetworkDevices('SN-1'),
            name: [{language: 'en', name: 'renamed'}],
        });

        const saved = (await sdk.getById('existing-1')) as EnyoAppliance;
        expect(saved.name).toEqual([{language: 'en', name: 'renamed'}]);
        expect(saved.networkDeviceIds).toEqual(['dev-1']);

        manager.dispose();
    });

    it('replaces the stored ids instead of merging them when networkDevices are passed', async () => {
        const existing = makeAppliance('existing-1', {networkDeviceIds: ['dev-1', 'dev-2']}, 'SN-1');
        const sdk = createAppliancesFake([existing]);
        const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);

        await manager.createOrUpdateAppliance(makeConfig('SN-1', ['dev-3']));

        expect(((await sdk.getById('existing-1')) as EnyoAppliance).networkDeviceIds).toEqual(['dev-3']);

        manager.dispose();
    });

    it('keeps the reverse network device lookup after an update without networkDevices, and drops it after []', async () => {
        const sdk = createAppliancesFake();
        const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), silent);
        const id = await manager.createOrUpdateAppliance(makeConfig('SN-1', ['dev-1']));

        await manager.createOrUpdateAppliance(makeConfigWithoutNetworkDevices('SN-1'));
        expect(manager.findAppliancesByNetworkDeviceId('dev-1').map(a => a.id)).toEqual([id]);

        await manager.createOrUpdateAppliance({...makeConfig('SN-1'), networkDevices: []});
        expect(manager.findAppliancesByNetworkDeviceId('dev-1')).toEqual([]);

        manager.dispose();
    });

    it('InMemoryApplianceManager replaces the stored ids when networkDevices are passed', async () => {
        const manager = new InMemoryApplianceManager(createEnergyAppFake(createAppliancesFake()), silent);
        const id = await manager.createOrUpdateAppliance(makeConfig('SN-1', ['dev-1', 'dev-2']));

        await manager.createOrUpdateAppliance(makeConfig('SN-1', ['dev-3']));

        expect((await manager.getApplianceById(id))?.networkDeviceIds).toEqual(['dev-3']);

        manager.dispose();
    });

    it('InMemoryApplianceManager creates a new appliance with empty networkDeviceIds when networkDevices are omitted', async () => {
        const manager = new InMemoryApplianceManager(createEnergyAppFake(createAppliancesFake()), silent);

        const id = await manager.createOrUpdateAppliance(makeConfigWithoutNetworkDevices('SN-1'));

        expect((await manager.getApplianceById(id))?.networkDeviceIds).toEqual([]);

        manager.dispose();
    });
});

describe('NetworkDeviceIdStrategy extraction', () => {
    it('is named networkDeviceId without a sub-key and is built by the factory', () => {
        const strategy = IdentifierStrategyFactory.networkDeviceId();

        expect(strategy).toBeInstanceOf(NetworkDeviceIdStrategy);
        expect(strategy.name).toBe('networkDeviceId');
        expect(IdentifierStrategyFactory.networkDeviceId(() => 1).name).toBe('networkDeviceId+subKey');
    });

    it('gives different keys to different appliance types on the same network device', () => {
        const strategy = new NetworkDeviceIdStrategy();
        const inverter = makeHostnameConfig(['dev-1'], 'gw', EnyoApplianceTypeEnum.Inverter);
        const storage = makeHostnameConfig(['dev-1'], 'gw', EnyoApplianceTypeEnum.Storage);

        expect(strategy.extract(inverter)).not.toBe(strategy.extract(storage));
    });

    it('uses only the first network device', () => {
        const strategy = new NetworkDeviceIdStrategy();
        const config = makeConfig('SN-1', ['dev-1', 'dev-2']);

        expect(strategy.extract(config)).toBe(strategy.extract(makeAppliance('a', {networkDeviceIds: ['dev-1']})));
        expect(strategy.extract(config)).not.toBe(strategy.extract(makeAppliance('b', {networkDeviceIds: ['dev-2', 'dev-1']})));
    });

    it('ignores the serial number and the hostname', () => {
        const strategy = new NetworkDeviceIdStrategy();

        expect(strategy.extract(makeConfig('SN-1', ['dev-1'])))
            .toBe(strategy.extract(makeHostnameConfig(['dev-1'], '192.168.178.20')));
    });

    it('returns undefined for an empty network device id', () => {
        const strategy = new NetworkDeviceIdStrategy();

        expect(strategy.extract(makeConfig('SN-1', ['']))).toBeUndefined();
        expect(strategy.extract(makeAppliance('a', {networkDeviceIds: ['']}))).toBeUndefined();
    });

    it('accepts 0 as a sub-key but not an empty string', () => {
        const config = makeConfig('SN-1', ['dev-1']);

        expect(new NetworkDeviceIdStrategy(() => 0).extract(config)).toBe(`${EnyoApplianceTypeEnum.Inverter}:dev-1:0`);
        expect(new NetworkDeviceIdStrategy(() => '').extract(config)).toBeUndefined();
    });

    it('accepts a string sub-key such as a battery index', () => {
        const strategy = new NetworkDeviceIdStrategy(a => a.metadata?.modelName);
        const config: ApplianceConfig = {...makeConfig('', ['dev-1']), metadata: {modelName: 'battery-2'}};

        expect(strategy.extract(config)).toBe(`${EnyoApplianceTypeEnum.Inverter}:dev-1:battery-2`);
    });

    it('does not call the sub-key extractor without a network device', () => {
        const subKey = vi.fn(() => 1);

        expect(new NetworkDeviceIdStrategy(subKey).extract(makeConfig('SN-1'))).toBeUndefined();
        expect(subKey).not.toHaveBeenCalled();
    });
});

describe('ApplianceManager with NetworkDeviceIdStrategy', () => {
    const strategyConfig = {...silent, identifierStrategy: IdentifierStrategyFactory.networkDeviceId()};

    it('updates an appliance stored before the manager started', async () => {
        const existing = makeAppliance('existing-1', {networkDeviceIds: ['dev-1'], metadata: {
            connectionType: EnyoApplianceConnectionType.Connector,
            hostname: '192.168.178.20',
        }});
        const sdk = createAppliancesFake([existing]);
        const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), strategyConfig);

        const id = await manager.createOrUpdateAppliance(makeHostnameConfig(['dev-1'], 'lambda.fritz.box'));

        expect(id).toBe('existing-1');
        expect(((await sdk.getById(id)) as EnyoAppliance).metadata?.hostname).toBe('lambda.fritz.box');
        expect(await sdk.list()).toHaveLength(1);

        manager.dispose();
    });

    it('creates a separate appliance per type behind one network device', async () => {
        const sdk = createAppliancesFake();
        const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), strategyConfig);

        const inverter = await manager.createOrUpdateAppliance(makeHostnameConfig(['dev-1'], 'gw', EnyoApplianceTypeEnum.Inverter));
        const storage = await manager.createOrUpdateAppliance(makeHostnameConfig(['dev-1'], 'gw', EnyoApplianceTypeEnum.Storage));
        const inverterAgain = await manager.createOrUpdateAppliance(makeHostnameConfig(['dev-1'], 'gw-renamed', EnyoApplianceTypeEnum.Inverter));

        expect(storage).not.toBe(inverter);
        expect(inverterAgain).toBe(inverter);

        manager.dispose();
    });

    it('updates the matching unit when several units sit behind one network device', async () => {
        const sdk = createAppliancesFake();
        const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), {
            ...silent,
            identifierStrategy: IdentifierStrategyFactory.networkDeviceId(a => a.metadata?.modbus?.unitId),
        });
        const unitConfig = (unitId: number, hostname: string): ApplianceConfig =>
            ({...makeConfig('', ['dev-1']), metadata: {hostname, modbus: {unitId}}});

        const unit1 = await manager.createOrUpdateAppliance(unitConfig(1, 'gw-6'));
        const unit2 = await manager.createOrUpdateAppliance(unitConfig(2, 'gw-6'));
        const unit2Again = await manager.createOrUpdateAppliance(unitConfig(2, 'gw-7'));

        expect(unit2Again).toBe(unit2);
        expect(((await sdk.getById(unit1)) as EnyoAppliance).metadata?.hostname).toBe('gw-6');
        expect(((await sdk.getById(unit2)) as EnyoAppliance).metadata?.hostname).toBe('gw-7');

        manager.dispose();
    });

    it('throws MissingIdentifierError and saves nothing when an update omits networkDevices', async () => {
        const sdk = createAppliancesFake();
        const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), strategyConfig);
        await manager.createOrUpdateAppliance(makeConfig('SN-1', ['dev-1']));
        sdk.save.mockClear();

        await expect(manager.createOrUpdateAppliance(makeConfigWithoutNetworkDevices('SN-1')))
            .rejects.toThrow(MissingIdentifierError);
        expect(sdk.save).not.toHaveBeenCalled();

        manager.dispose();
    });

    it('throws DuplicateIdentifierError when two stored appliances of one type share the network device', async () => {
        const a = makeAppliance('appl-1', {networkDeviceIds: ['dev-1']});
        const b = makeAppliance('appl-2', {networkDeviceIds: ['dev-1']});
        const sdk = createAppliancesFake([a, b]);
        const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), strategyConfig);

        await expect(manager.createOrUpdateAppliance(makeHostnameConfig(['dev-1'], 'gw')))
            .rejects.toMatchObject({name: 'DuplicateIdentifierError', applianceIds: ['appl-1', 'appl-2']});
        expect(sdk.save).not.toHaveBeenCalled();

        manager.dispose();
    });

    it('finds stored appliances after switching to the strategy with setIdentifierStrategy', async () => {
        const existing = makeAppliance('existing-1', {networkDeviceIds: ['dev-1']});
        const sdk = createAppliancesFake([existing]);
        const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), {
            ...silent,
            identifierStrategy: new HostnameStrategy(),
        });

        await manager.setIdentifierStrategy(IdentifierStrategyFactory.networkDeviceId(), false);
        const id = await manager.createOrUpdateAppliance(makeHostnameConfig(['dev-1'], 'new-hostname'));

        expect(id).toBe('existing-1');

        manager.dispose();
    });

    it('as a fallback after the serial number, prefers the serial and otherwise uses the network device', async () => {
        const sdk = createAppliancesFake();
        const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), {
            ...silent,
            identifierStrategy: IdentifierStrategyFactory.fallback([
                IdentifierStrategyFactory.serialNumber(),
                IdentifierStrategyFactory.networkDeviceId(),
            ]),
        });

        // With a serial number, a move to another network device updates the same appliance.
        const withSerial = await manager.createOrUpdateAppliance(makeConfig('SN-1', ['dev-1']));
        expect(await manager.createOrUpdateAppliance(makeConfig('SN-1', ['dev-2']))).toBe(withSerial);

        // Without one, a hostname change on the same network device updates the same appliance.
        const withoutSerial = await manager.createOrUpdateAppliance(makeHostnameConfig(['dev-3'], 'sonnen-6'));
        expect(await manager.createOrUpdateAppliance(makeHostnameConfig(['dev-3'], 'sonnen-7'))).toBe(withoutSerial);

        expect(withoutSerial).not.toBe(withSerial);
        expect(await sdk.list()).toHaveLength(2);

        manager.dispose();
    });

    it('creates a second appliance with HostnameStrategy where NetworkDeviceIdStrategy updates the first', async () => {
        const run = async (identifierStrategy: HostnameStrategy | NetworkDeviceIdStrategy) => {
            const sdk = createAppliancesFake();
            const manager = await ApplianceManager.initialize(createEnergyAppFake(sdk), {...silent, identifierStrategy});
            await manager.createOrUpdateAppliance(makeHostnameConfig(['dev-1'], '192.168.178.20'));
            await manager.createOrUpdateAppliance(makeHostnameConfig(['dev-1'], 'lambda.fritz.box'));
            manager.dispose();
            return (await sdk.list()).length;
        };

        expect(await run(new HostnameStrategy())).toBe(2);
        expect(await run(new NetworkDeviceIdStrategy())).toBe(1);
    });

    it('InMemoryApplianceManager updates the same appliance across hostname changes', async () => {
        const manager = new InMemoryApplianceManager(createEnergyAppFake(createAppliancesFake()), strategyConfig);

        const first = await manager.createOrUpdateAppliance(makeHostnameConfig(['dev-1'], 'solarmax-6'));
        const second = await manager.createOrUpdateAppliance(makeHostnameConfig(['dev-1'], 'solarmax-7'));

        expect(second).toBe(first);
        expect((await manager.getApplianceById(first))?.metadata?.hostname).toBe('solarmax-7');

        manager.dispose();
    });
});
