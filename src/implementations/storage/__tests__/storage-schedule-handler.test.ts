import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {EnergyAppDataBus} from '../../../packages/energy-app-data-bus.js';
import type {EnergyAppInterval, IntervalDuration} from '../../../packages/energy-app-interval.js';
import type {EnergyAppStorage} from '../../../packages/energy-app-storage.js';
import {
    EnyoDataBusMessage,
    EnyoDataBusMessageEnum,
    EnyoDataBusSetStorageScheduleV1,
    EnyoStorageScheduleDirectionEnum,
    EnyoStorageScheduleEntry,
    EnyoStorageScheduleModeEnum,
} from '../../../types/enyo-data-bus-value.js';
import {EnyoSourceEnum} from '../../../types/enyo-source.enum.js';
import {
    ActiveStorageScheduleEntry,
    StorageScheduleHandler,
    StorageScheduleHandlerOptions,
} from '../storage-schedule-handler.js';

const APPLIANCE_ID = 'battery-1';

interface TestRegisters {
    snapshotId: string;
    initialMode: string;
}

const DEFAULT_REGISTERS: TestRegisters = {snapshotId: 'snap-default', initialMode: 'auto'};

/**
 * Concrete subclass that records every lifecycle callback so tests can
 * assert call order, count, and payload without bolting `vi.fn()` onto
 * the abstract base. `onInit` returns a configurable registers payload
 * (or throws when {@link initImpl} is set to throw).
 */
class RecordingStorageScheduleHandler extends StorageScheduleHandler<TestRegisters> {
    public readonly initCalls: ActiveStorageScheduleEntry[] = [];
    public readonly changeCalls: Array<{active: ActiveStorageScheduleEntry; previous: ActiveStorageScheduleEntry | undefined}> = [];
    public readonly rollbackCalls: TestRegisters[] = [];
    public readonly errorCalls: Error[] = [];
    public readonly callOrder: Array<'init' | 'change' | 'rollback' | 'error'> = [];
    public initImpl: (active: ActiveStorageScheduleEntry) => Promise<TestRegisters>
        = async () => ({...DEFAULT_REGISTERS});

    public constructor(options: StorageScheduleHandlerOptions) {
        super(options);
    }

    protected async onInit(active: ActiveStorageScheduleEntry): Promise<TestRegisters> {
        this.initCalls.push(active);
        this.callOrder.push('init');
        return this.initImpl(active);
    }

    protected onChange(active: ActiveStorageScheduleEntry, previous: ActiveStorageScheduleEntry | undefined): void {
        this.changeCalls.push({active, previous});
        this.callOrder.push('change');
    }

    protected onRollback(registers: TestRegisters): void {
        this.rollbackCalls.push(registers);
        this.callOrder.push('rollback');
    }

    protected onError(err: Error): void {
        this.errorCalls.push(err);
        this.callOrder.push('error');
    }
}

function entry(seconds: number, powerW: number, direction: EnyoStorageScheduleDirectionEnum = EnyoStorageScheduleDirectionEnum.Charge): EnyoStorageScheduleEntry {
    return {seconds, powerW, direction};
}

function makeMessage(
    data: EnyoDataBusSetStorageScheduleV1['data'],
    applianceId: string = APPLIANCE_ID,
): EnyoDataBusSetStorageScheduleV1 {
    return {
        id: `msg-${Math.random().toString(36).slice(2)}`,
        type: 'message',
        message: EnyoDataBusMessageEnum.SetStorageScheduleV1,
        source: EnyoSourceEnum.Device,
        applianceId,
        timestampIso: new Date().toISOString(),
        data,
    };
}

function makeFakeInterval() {
    let nowMs = 0;
    const intervals = new Map<string, {duration: IntervalDuration; cb: (id: string) => void | Promise<void>}>();
    let nextId = 1;
    const interval: EnergyAppInterval = {
        createInterval: (duration, cb) => {
            const id = `iv-${nextId++}`;
            intervals.set(id, {duration, cb});
            return id;
        },
        stopInterval: (id) => {
            intervals.delete(id);
        },
    };
    return {
        interval,
        now: () => nowMs,
        setNow(ms: number) {
            nowMs = ms;
        },
        advanceMs(deltaMs: number) {
            nowMs += deltaMs;
            for (const {cb} of intervals.values()) {
                void cb('tick');
            }
        },
        activeIntervalIds: () => [...intervals.keys()],
    };
}

function makeFakeDataBus() {
    let nextListenerId = 1;
    const listeners = new Map<string, {types: EnyoDataBusMessageEnum[]; fn: (m: EnyoDataBusMessage) => unknown}>();
    const dataBus: EnergyAppDataBus = {
        sendMessage: vi.fn(),
        sendAnswer: vi.fn(),
        listenForMessages: vi.fn((types, fn) => {
            const id = `db-${nextListenerId++}`;
            listeners.set(id, {types, fn});
            return id;
        }) as unknown as EnergyAppDataBus['listenForMessages'],
        unsubscribe: vi.fn((id: string) => {
            listeners.delete(id);
        }),
    };
    return {
        dataBus,
        /**
         * Awaits each listener so the test sees the full effect of the
         * listener's async work (the handler's listener returns the
         * applyMessage promise even though its declared return type is
         * `void`).
         */
        async emit(msg: EnyoDataBusMessage): Promise<void> {
            for (const {types, fn} of listeners.values()) {
                if (types.includes(msg.message)) {
                    await fn(msg);
                }
            }
        },
        activeListenerIds: () => [...listeners.keys()],
    };
}

function makeFakeStorage() {
    const data = new Map<string, unknown>();
    const storage: EnergyAppStorage = {
        save: vi.fn(async (key: string, value: object) => {
            data.set(key, value);
        }),
        load: vi.fn(async <T,>(key: string): Promise<T | null> => {
            return (data.get(key) as T | undefined) ?? null;
        }) as unknown as EnergyAppStorage['load'],
        remove: vi.fn(async (key: string) => {
            data.delete(key);
        }),
        listKeys: vi.fn(async () => [...data.keys()]),
    };
    return {
        storage,
        get(key: string): unknown {
            return data.get(key);
        },
        has(key: string): boolean {
            return data.has(key);
        },
        preload(key: string, value: unknown): void {
            data.set(key, value);
        },
        keys: () => [...data.keys()],
    };
}

/**
 * Flush enough microtasks for the handler's operation chain to drain.
 * The chain bottoms out through `onInit` (async), `storage.save`
 * (async), and finally state assignment + `onChange` (sync), so a
 * handful of yields is enough; we run more for safety since callbacks
 * may add async work of their own.
 */
async function settle(): Promise<void> {
    for (let i = 0; i < 20; i += 1) {
        await Promise.resolve();
    }
}

describe('StorageScheduleHandler', () => {
    let fakeInterval: ReturnType<typeof makeFakeInterval>;
    let fakeDataBus: ReturnType<typeof makeFakeDataBus>;
    let fakeStorage: ReturnType<typeof makeFakeStorage>;
    let handler: RecordingStorageScheduleHandler;

    function makeHandler(opts?: Partial<StorageScheduleHandlerOptions>): RecordingStorageScheduleHandler {
        return new RecordingStorageScheduleHandler({
            dataBus: fakeDataBus.dataBus,
            interval: fakeInterval.interval,
            storage: fakeStorage.storage,
            applianceId: APPLIANCE_ID,
            now: fakeInterval.now,
            ...opts,
        });
    }

    beforeEach(async () => {
        fakeInterval = makeFakeInterval();
        fakeDataBus = makeFakeDataBus();
        fakeStorage = makeFakeStorage();
        fakeInterval.setNow(1_000_000); // arbitrary non-zero baseline
        handler = makeHandler();
        // Let constructor-time restart recovery settle (no-op on empty storage).
        await settle();
    });

    it('onInit fires once on first apply, persists registers, then onChange fires with previous=undefined', async () => {
        const at = fakeInterval.now();
        const registers: TestRegisters = {snapshotId: 'snap-001', initialMode: 'standby'};
        handler.initImpl = async () => registers;

        await handler.applySchedule({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: [
                entry(0, 1500, EnyoStorageScheduleDirectionEnum.Charge),
                entry(30, 2000, EnyoStorageScheduleDirectionEnum.Charge),
            ],
        });

        expect(handler.initCalls).toHaveLength(1);
        expect(handler.initCalls[0].entry.powerW).toBe(1500);
        expect(handler.initCalls[0].indexInSchedule).toBe(0);
        expect(handler.initCalls[0].scheduleStartedAtMs).toBe(at);

        expect(handler.changeCalls).toHaveLength(1);
        expect(handler.changeCalls[0].previous).toBeUndefined();
        expect(handler.changeCalls[0].active.entry.powerW).toBe(1500);
        expect(handler.callOrder).toEqual(['init', 'change']);

        expect(fakeStorage.has(`storage-schedule-handler:${APPLIANCE_ID}`)).toBe(true);
        expect(fakeStorage.get(`storage-schedule-handler:${APPLIANCE_ID}`)).toEqual({registers});
        expect(handler.rollbackCalls).toHaveLength(0);
        expect(handler.errorCalls).toHaveLength(0);
    });

    it('accepts an Idle entry between Charge and Discharge and routes it through onChange', async () => {
        await handler.applySchedule({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: [
                entry(0, 1500, EnyoStorageScheduleDirectionEnum.Charge),
                entry(30, 0, EnyoStorageScheduleDirectionEnum.Idle),
                entry(60, 2000, EnyoStorageScheduleDirectionEnum.Discharge),
            ],
        });

        expect(handler.errorCalls).toHaveLength(0);
        expect(handler.changeCalls).toHaveLength(1);
        expect(handler.changeCalls[0].active.entry.direction).toBe(EnyoStorageScheduleDirectionEnum.Charge);

        fakeInterval.advanceMs(31_000);
        expect(handler.changeCalls).toHaveLength(2);
        expect(handler.changeCalls[1].active.entry.direction).toBe(EnyoStorageScheduleDirectionEnum.Idle);
        expect(handler.changeCalls[1].active.entry.powerW).toBe(0);

        fakeInterval.advanceMs(30_000);
        expect(handler.changeCalls).toHaveLength(3);
        expect(handler.changeCalls[2].active.entry.direction).toBe(EnyoStorageScheduleDirectionEnum.Discharge);
    });

    it('onInit throwing aborts install: onError fires, no onChange, nothing persisted', async () => {
        handler.initImpl = async () => {
            throw new Error('device offline');
        };

        await handler.applySchedule({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: [entry(0, 1000)],
        });

        expect(handler.initCalls).toHaveLength(1);
        expect(handler.errorCalls).toHaveLength(1);
        expect(handler.errorCalls[0].message).toBe('device offline');
        expect(handler.changeCalls).toHaveLength(0);
        expect(handler.rollbackCalls).toHaveLength(0);
        expect(fakeStorage.has(`storage-schedule-handler:${APPLIANCE_ID}`)).toBe(false);
        expect(fakeInterval.activeIntervalIds()).toHaveLength(0);
        expect(handler.getActiveEntry()).toBeUndefined();
    });

    it('onChange per entry transition has previous defined and matches wall clock', async () => {
        const startedAt = fakeInterval.now();
        await handler.applySchedule({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: [entry(0, 1000), entry(30, 2000), entry(90, 3000)],
        });

        fakeInterval.advanceMs(29_000);
        expect(handler.changeCalls).toHaveLength(1); // only the install-time first call

        fakeInterval.advanceMs(2_000); // 31s elapsed → entries[1] becomes active
        expect(handler.changeCalls).toHaveLength(2);
        const t1 = handler.changeCalls[1];
        expect(t1.previous?.entry.powerW).toBe(1000);
        expect(t1.active.entry.powerW).toBe(2000);
        expect(t1.active.entryStartedAtMs).toBe(startedAt + 30_000);

        fakeInterval.advanceMs(60_000); // 91s elapsed → entries[2]
        expect(handler.changeCalls).toHaveLength(3);
        expect(handler.changeCalls[2].active.entry.powerW).toBe(3000);
    });

    it('a coarse tick advances multiple entries with one onChange per step', async () => {
        await handler.applySchedule({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: [entry(0, 100), entry(1, 200), entry(2, 300), entry(3, 400)],
        });

        fakeInterval.advanceMs(5_000);

        // 1 install-time + 3 transitions
        expect(handler.changeCalls).toHaveLength(4);
        const indices = handler.changeCalls.map((c) => c.active.indexInSchedule);
        expect(indices).toEqual([0, 1, 2, 3]);
    });

    it('mode auto from running rolls back with stored registers and clears persisted state', async () => {
        const registers: TestRegisters = {snapshotId: 'snap-002', initialMode: 'pv-prio'};
        handler.initImpl = async () => registers;
        await handler.applySchedule({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: [entry(0, 1000), entry(5, 2000)],
        });
        expect(fakeInterval.activeIntervalIds()).toHaveLength(1);

        await handler.applySchedule({mode: EnyoStorageScheduleModeEnum.Auto});

        expect(handler.rollbackCalls).toEqual([registers]);
        expect(fakeInterval.activeIntervalIds()).toHaveLength(0);
        expect(fakeStorage.has(`storage-schedule-handler:${APPLIANCE_ID}`)).toBe(false);
        expect(handler.getActiveEntry()).toBeUndefined();

        await handler.applySchedule({mode: EnyoStorageScheduleModeEnum.Auto});
        expect(handler.rollbackCalls).toHaveLength(1); // unchanged
    });

    it('replacement: rollback(A.registers) then init(B) then change(B[0])', async () => {
        const regA: TestRegisters = {snapshotId: 'snap-A', initialMode: 'auto'};
        const regB: TestRegisters = {snapshotId: 'snap-B', initialMode: 'auto'};
        handler.initImpl = async () => regA;
        await handler.applySchedule({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: [entry(0, 100), entry(10, 200), entry(20, 300)],
        });
        fakeInterval.advanceMs(5_000); // still in entries[0]
        const orderBefore = handler.callOrder.length;

        handler.initImpl = async () => regB;
        await handler.applySchedule({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: [entry(0, 999), entry(7, 888)],
        });

        expect(handler.callOrder.slice(orderBefore)).toEqual(['rollback', 'init', 'change']);
        expect(handler.rollbackCalls[handler.rollbackCalls.length - 1]).toEqual(regA);
        expect(handler.changeCalls[handler.changeCalls.length - 1].active.entry.powerW).toBe(999);
        expect(handler.changeCalls[handler.changeCalls.length - 1].previous).toBeUndefined();

        // Persisted registers swap to B's.
        expect(fakeStorage.get(`storage-schedule-handler:${APPLIANCE_ID}`)).toEqual({registers: regB});

        // A's transition at 10s would have fired by now, but A is gone.
        const changesBefore = handler.changeCalls.length;
        fakeInterval.advanceMs(8_000); // 8s since B install → crosses B[1].seconds=7
        expect(handler.changeCalls).toHaveLength(changesBefore + 1);
        expect(handler.changeCalls[changesBefore].active.entry.powerW).toBe(888);
    });

    it('empty relativeSchedule while running rolls back and reports an error', async () => {
        const registers: TestRegisters = {snapshotId: 'snap-003', initialMode: 'auto'};
        handler.initImpl = async () => registers;
        await handler.applySchedule({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: [entry(0, 100)],
        });

        await handler.applySchedule({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: [],
        });

        expect(handler.errorCalls).toHaveLength(1);
        expect(handler.rollbackCalls).toEqual([registers]);
        expect(fakeInterval.activeIntervalIds()).toHaveLength(0);
        expect(fakeStorage.has(`storage-schedule-handler:${APPLIANCE_ID}`)).toBe(false);
    });

    it.each([
        ['duplicate seconds', [entry(0, 100), entry(0, 200)]],
        ['unsorted', [entry(10, 100), entry(5, 200)]],
        ['negative seconds', [entry(-1, 100)]],
        ['idle direction with non-zero power', [entry(0, 100, EnyoStorageScheduleDirectionEnum.Idle)]],
    ])('rejects invalid schedule from idle: %s', async (_label, bad) => {
        await handler.applySchedule({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: bad,
        });

        expect(handler.errorCalls).toHaveLength(1);
        expect(handler.initCalls).toHaveLength(0);
        expect(handler.rollbackCalls).toHaveLength(0);
        expect(handler.getActiveEntry()).toBeUndefined();
        expect(fakeStorage.has(`storage-schedule-handler:${APPLIANCE_ID}`)).toBe(false);
    });

    it('first entry seconds > 0: onInit + onChange fire immediately; next change at entries[1].seconds', async () => {
        await handler.applySchedule({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: [entry(5, 500), entry(30, 600)],
        });
        expect(handler.initCalls).toHaveLength(1);
        expect(handler.changeCalls).toHaveLength(1);
        expect(handler.changeCalls[0].active.entry.powerW).toBe(500);

        fakeInterval.advanceMs(29_000);
        expect(handler.changeCalls).toHaveLength(1);

        fakeInterval.advanceMs(2_000); // 31s elapsed crosses entries[1].seconds=30
        expect(handler.changeCalls).toHaveLength(2);
        expect(handler.changeCalls[1].active.entry.powerW).toBe(600);
    });

    it('dispose mid-schedule rolls back with stored registers; idempotent', async () => {
        const registers: TestRegisters = {snapshotId: 'snap-004', initialMode: 'auto'};
        handler.initImpl = async () => registers;
        await handler.applySchedule({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: [entry(0, 100), entry(60, 200)],
        });

        handler.dispose();
        expect(handler.rollbackCalls).toEqual([registers]);
        expect(fakeInterval.activeIntervalIds()).toHaveLength(0);
        expect(fakeDataBus.activeListenerIds()).toHaveLength(0);

        handler.dispose();
        expect(handler.rollbackCalls).toEqual([registers]); // unchanged

        await handler.applySchedule({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: [entry(0, 999)],
        });
        expect(handler.initCalls).toHaveLength(1); // only the original install
        expect(fakeInterval.activeIntervalIds()).toHaveLength(0);
    });

    it('applyMessage matches applySchedule for an equivalent input', async () => {
        const schedule = [entry(0, 100), entry(20, 200)];
        const secondInterval = makeFakeInterval();
        secondInterval.setNow(fakeInterval.now());
        const secondStorage = makeFakeStorage();
        const second = new RecordingStorageScheduleHandler({
            dataBus: makeFakeDataBus().dataBus,
            interval: secondInterval.interval,
            storage: secondStorage.storage,
            applianceId: APPLIANCE_ID,
            now: fakeInterval.now,
        });
        await settle();

        await handler.applySchedule({mode: EnyoStorageScheduleModeEnum.Schedule, relativeSchedule: schedule});
        await second.applyMessage(makeMessage({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: schedule,
        }));

        expect(handler.initCalls).toHaveLength(1);
        expect(second.initCalls).toHaveLength(1);
        expect(handler.initCalls[0].entry).toEqual(second.initCalls[0].entry);
        expect(handler.changeCalls[0].active.entry).toEqual(second.changeCalls[0].active.entry);
    });

    it('data-bus subscription routes by applianceId; ignores others', async () => {
        await fakeDataBus.emit(makeMessage({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: [entry(0, 1234)],
        }, 'some-other-appliance'));
        expect(handler.initCalls).toHaveLength(0);

        await fakeDataBus.emit(makeMessage({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: [entry(0, 4321)],
        }));
        expect(handler.initCalls).toHaveLength(1);
        expect(handler.changeCalls[0].active.entry.powerW).toBe(4321);
    });

    it('omitted applianceId: accepts every SetStorageScheduleV1 and keys storage under "null"', async () => {
        // Fresh fakes so the default handler's data-bus listener does not also fire.
        const localInterval = makeFakeInterval();
        const localDataBus = makeFakeDataBus();
        const localStorage = makeFakeStorage();
        localInterval.setNow(2_000_000);
        const registers: TestRegisters = {snapshotId: 'snap-null', initialMode: 'auto'};
        const unbound = new RecordingStorageScheduleHandler({
            dataBus: localDataBus.dataBus,
            interval: localInterval.interval,
            storage: localStorage.storage,
            now: localInterval.now,
        });
        unbound.initImpl = async () => registers;
        await settle();

        await localDataBus.emit(makeMessage({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: [entry(0, 4242)],
        }, 'any-appliance-id'));

        expect(unbound.initCalls).toHaveLength(1);
        expect(localStorage.has('storage-schedule-handler:null')).toBe(true);
        expect(localStorage.get('storage-schedule-handler:null')).toEqual({registers});

        unbound.dispose();
        expect(unbound.rollbackCalls).toEqual([registers]);
    });

    it('restart recovery: pre-populated storage triggers onRollback at construction and clears the key', async () => {
        const localInterval = makeFakeInterval();
        const localDataBus = makeFakeDataBus();
        const localStorage = makeFakeStorage();
        const persisted: TestRegisters = {snapshotId: 'snap-prior', initialMode: 'cost-opt'};
        localStorage.preload(`storage-schedule-handler:${APPLIANCE_ID}`, {registers: persisted});

        const recovered = new RecordingStorageScheduleHandler({
            dataBus: localDataBus.dataBus,
            interval: localInterval.interval,
            storage: localStorage.storage,
            applianceId: APPLIANCE_ID,
            now: localInterval.now,
        });
        await settle();

        expect(recovered.rollbackCalls).toEqual([persisted]);
        expect(recovered.initCalls).toHaveLength(0);
        expect(localStorage.has(`storage-schedule-handler:${APPLIANCE_ID}`)).toBe(false);
    });

    it('restart recovery: empty storage at construction does not fire onRollback', async () => {
        // The default beforeEach handler already covers this scenario;
        // assert no rollback fired during its constructor settle.
        expect(handler.rollbackCalls).toHaveLength(0);
        expect(handler.callOrder).toHaveLength(0);
    });

    it('getActiveEntry reflects current state across lifecycle', async () => {
        expect(handler.getActiveEntry()).toBeUndefined();

        await handler.applySchedule({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: [entry(0, 100), entry(5, 200)],
        });
        expect(handler.getActiveEntry()?.indexInSchedule).toBe(0);

        fakeInterval.advanceMs(6_000);
        expect(handler.getActiveEntry()?.indexInSchedule).toBe(1);
        expect(handler.getActiveEntry()?.entry.powerW).toBe(200);

        await handler.applySchedule({mode: EnyoStorageScheduleModeEnum.Auto});
        expect(handler.getActiveEntry()).toBeUndefined();

        await handler.applySchedule({
            mode: EnyoStorageScheduleModeEnum.Schedule,
            relativeSchedule: [entry(0, 999)],
        });
        expect(handler.getActiveEntry()?.entry.powerW).toBe(999);

        handler.dispose();
        expect(handler.getActiveEntry()).toBeUndefined();
    });
});
