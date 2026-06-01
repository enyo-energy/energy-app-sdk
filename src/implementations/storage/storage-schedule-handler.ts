import {EnergyAppDataBus} from '../../packages/energy-app-data-bus.js';
import {EnergyAppInterval} from '../../packages/energy-app-interval.js';
import {EnergyAppStorage} from '../../packages/energy-app-storage.js';
import {
    EnyoDataBusMessageEnum,
    EnyoDataBusSetStorageScheduleV1,
    EnyoStorageScheduleDirectionEnum,
    EnyoStorageScheduleEntry,
    EnyoStorageScheduleModeEnum,
} from '../../types/enyo-data-bus-value.js';

/**
 * Snapshot of the currently-active entry within an installed storage
 * schedule. Handed to {@link StorageScheduleHandler.onChange} every
 * time the active entry changes — including the very first entry
 * (which receives `previous === undefined`).
 *
 * The enriched timing fields let subclasses render UI ("entry 3 of 8,
 * started 12 s ago") and compute remaining seconds against the next
 * entry without re-deriving the timing context themselves.
 */
export interface ActiveStorageScheduleEntry {
    /** The raw schedule entry — direction, powerW, and the entry's own `seconds` offset. */
    entry: EnyoStorageScheduleEntry;
    /** Index of this entry within the installed schedule (0-based). */
    indexInSchedule: number;
    /** Total number of entries in the installed schedule. */
    totalEntries: number;
    /** Wall-clock milliseconds at which the carrying schedule was installed. */
    scheduleStartedAtMs: number;
    /** Wall-clock milliseconds at which this entry became the active one. */
    entryStartedAtMs: number;
}

/**
 * Unwrapped input accepted by
 * {@link StorageScheduleHandler.applySchedule} — the same shape as
 * {@link EnyoDataBusSetStorageScheduleV1.data} minus the optional
 * `reason` field, so callers driving the handler from non-data-bus
 * sources (a UI control, an optimizer output, a replay of stored plans)
 * do not have to fabricate a reason.
 */
export interface StorageScheduleInput {
    /** Control mode: hand control back to the appliance, or follow a schedule. */
    mode: EnyoStorageScheduleModeEnum;
    /**
     * Relative schedule the appliance should follow when {@link mode} is
     * {@link EnyoStorageScheduleModeEnum.Schedule}. Sorted ascending by
     * `seconds`; the first entry should be at `seconds = 0`. Omitted (or
     * empty) when `mode` is {@link EnyoStorageScheduleModeEnum.Auto}.
     */
    relativeSchedule?: EnyoStorageScheduleEntry[];
}

/**
 * Construction options for {@link StorageScheduleHandler}.
 *
 * The handler only takes runtime wiring — data bus, interval source,
 * storage (for restart-safe persistence of the rollback registers),
 * the appliance id it is bound to, and an optional `now` test seam.
 * Lifecycle reactions (`onInit`, `onChange`, `onRollback`) are
 * mandatory and live on the subclass as abstract methods.
 */
export interface StorageScheduleHandlerOptions {
    /**
     * Data-bus service the handler subscribes to. On construction the
     * handler registers a single listener for
     * {@link EnyoDataBusMessageEnum.SetStorageScheduleV1} messages; the
     * listener is removed in {@link StorageScheduleHandler.dispose}.
     */
    dataBus: EnergyAppDataBus;
    /**
     * Interval service driving the 1-second tick that advances the
     * active entry. Inject a fake in tests; the production
     * implementation uses `EnergyApp.useInterval()`.
     */
    interval: EnergyAppInterval;
    /**
     * Persistent key-value store the handler uses to make rollback
     * restart-safe. The result of {@link StorageScheduleHandler.onInit}
     * is written here when a schedule starts running and cleared after
     * the matching {@link StorageScheduleHandler.onRollback}. On
     * construction, the handler checks for a previously-persisted
     * payload and invokes `onRollback` immediately if one is found —
     * so a process that died mid-schedule still gets its rollback the
     * next time around.
     */
    storage: EnergyAppStorage;
    /**
     * Optional appliance id this handler is bound to.
     *
     * When set, inbound `SetStorageScheduleV1` messages whose
     * `applianceId` does not match are silently ignored — so multiple
     * handlers can safely share one data bus.
     *
     * When omitted, the handler accepts every `SetStorageScheduleV1`
     * message it sees. Useful for singletons that own the only
     * battery / storage appliance on the device.
     *
     * The storage key under which the rollback registers are persisted
     * incorporates the appliance id; an omitted id keys against the
     * literal string `"null"`. This keeps per-appliance handlers and a
     * single unbound handler from colliding in storage.
     */
    applianceId?: string;
    /**
     * Wall-clock source. Defaults to `() => Date.now()`. Override in
     * tests to advance time deterministically without
     * `vi.useFakeTimers`.
     */
    now?: () => number;
}

interface PersistedRegisters<TRegisters> {
    registers: TRegisters;
}

interface IdleState {
    kind: 'idle';
}

interface RunningState<TRegisters> {
    kind: 'running';
    schedule: EnyoStorageScheduleEntry[];
    scheduleStartedAtMs: number;
    activeIndex: number;
    entryStartedAtMs: number;
    intervalId: string;
    registers: TRegisters;
}

type HandlerState<TRegisters> = IdleState | RunningState<TRegisters>;

/**
 * Abstract base class that drives a battery / storage appliance
 * through an {@link EnyoDataBusSetStorageScheduleV1}-style relative
 * schedule on a 1-second tick.
 *
 * Subclasses **must** implement three lifecycle hooks; the handler
 * cannot operate without them, so they are declared `abstract` rather
 * than optional callbacks on the options bag:
 *
 * - {@link onInit} — an `async` setup hook called once per schedule
 *   install. Returns a `TRegisters` payload (a snapshot of the
 *   pre-schedule device state, the initial register values, anything
 *   the subclass needs to restore later) or throws to abort the
 *   install. The returned registers are persisted to
 *   {@link StorageScheduleHandlerOptions.storage} so a process that
 *   dies mid-schedule still gets a rollback next time it starts.
 * - {@link onChange} — fires for every active-entry transition,
 *   including the first one (the entry at index 0, with
 *   `previous === undefined`). This is where subclasses apply the
 *   setpoint to the underlying battery driver.
 * - {@link onRollback} — fires when a previously-running schedule is
 *   released (mode switched to auto, replaced, invalid input from the
 *   running state, handler disposed, or restart recovery). Receives
 *   the `TRegisters` originally returned by `onInit` so the subclass
 *   can restore the pre-schedule state.
 *
 * Subclasses **may** override {@link onError} to observe invalid
 * input; the default implementation is a no-op.
 *
 * Wall-clock time is the source of truth for entry advancement; the
 * `'1s'` interval is the sampling rate. Tests pump time
 * deterministically via the injected `now` seam without
 * `vi.useFakeTimers`.
 *
 * All public mutating methods serialise through an internal operation
 * chain, so a rapid sequence of `applySchedule` calls observes them
 * in order without races even though `onInit` and storage I/O are
 * async.
 *
 * @typeParam TRegisters - The shape the subclass uses to remember
 *                         pre-schedule state. Must be JSON-serialisable
 *                         since it is round-tripped through
 *                         {@link EnergyAppStorage}.
 *
 * @example
 * ```typescript
 * interface MyRegisters { previousMode: string; previousLimitW: number; }
 *
 * class MyStorage extends StorageScheduleHandler<MyRegisters> {
 *     protected async onInit(): Promise<MyRegisters> {
 *         return {
 *             previousMode: await this.driver.readMode(),
 *             previousLimitW: await this.driver.readLimit(),
 *         };
 *     }
 *     protected onChange(active: ActiveStorageScheduleEntry): void {
 *         this.driver.applySetpoint(active.entry.direction, active.entry.powerW);
 *     }
 *     protected onRollback(registers: MyRegisters): void {
 *         this.driver.applyMode(registers.previousMode);
 *         this.driver.applyLimit(registers.previousLimitW);
 *     }
 * }
 * ```
 */
export abstract class StorageScheduleHandler<TRegisters> {
    private readonly options: StorageScheduleHandlerOptions;
    private readonly now: () => number;
    private readonly storageKey: string;
    private readonly listenerId: string;
    private state: HandlerState<TRegisters> = {kind: 'idle'};
    private disposed = false;
    private operationChain: Promise<void> = Promise.resolve();

    /**
     * @param options - {@link StorageScheduleHandlerOptions}. Required:
     *                  `dataBus`, `interval`, `storage`. Optional:
     *                  `applianceId`, `now`.
     */
    protected constructor(options: StorageScheduleHandlerOptions) {
        this.options = options;
        this.now = options.now ?? (() => Date.now());
        this.storageKey = `storage-schedule-handler:${options.applianceId ?? 'null'}`;
        this.listenerId = options.dataBus.listenForMessages(
            [EnyoDataBusMessageEnum.SetStorageScheduleV1],
            // Returns the in-flight promise so a runtime / test that
            // wants to await message processing can; the SDK contract
            // is fire-and-forget so this is purely additive (TypeScript
            // allows returning a Promise from a void-returning callback).
            (msg) => this.applyMessage(msg as EnyoDataBusSetStorageScheduleV1).catch((err) => {
                this.onError(err instanceof Error ? err : new Error(String(err)));
            }),
        );
        this.enqueue(() => this.tryRecoverFromStorage());
    }

    /**
     * Snapshot the pre-schedule state of the underlying appliance and
     * return it as `TRegisters`. Called once per schedule install,
     * before any {@link onChange} fires.
     *
     * The returned value is persisted to storage and handed back to
     * {@link onRollback} when the schedule is released. Throwing from
     * `onInit` aborts the install — no schedule is started, no
     * registers are persisted, and {@link onError} is invoked with
     * the thrown error.
     *
     * @param active - Snapshot of the entry that *will* become active
     *                 if `onInit` succeeds. Subclasses do not need to
     *                 apply this setpoint here — `onChange` fires
     *                 immediately after a successful `onInit` with the
     *                 same active entry.
     * @returns Registers describing how to restore the pre-schedule
     *          state. Must be JSON-serialisable.
     */
    protected abstract onInit(active: ActiveStorageScheduleEntry): Promise<TRegisters>;

    /**
     * Apply a schedule setpoint to the underlying appliance. Fires:
     *
     * - Immediately after a successful {@link onInit} with
     *   `active = entries[0]` and `previous = undefined`.
     * - On every subsequent active-entry transition with
     *   `previous` set to the entry that was active immediately before.
     *
     * Errors thrown from `onChange` are not caught by the handler —
     * subclasses are responsible for their own error handling here.
     *
     * @param active - Snapshot of the now-active entry.
     * @param previous - Snapshot of the previously-active entry, or
     *                   `undefined` on the first call of a schedule.
     */
    protected abstract onChange(
        active: ActiveStorageScheduleEntry,
        previous: ActiveStorageScheduleEntry | undefined,
    ): void;

    /**
     * Restore the appliance to its pre-schedule state using the
     * registers originally returned by {@link onInit}. Fires when a
     * running schedule is released (mode switched to auto, replaced
     * by another schedule, invalid input from the running state,
     * handler disposed) **and** during restart recovery (a previous
     * process saved registers but exited without rolling back).
     *
     * Errors thrown from `onRollback` are not caught by the handler.
     *
     * @param registers - The registers returned by the matching
     *                    `onInit`, or — on restart recovery — the
     *                    registers persisted by the previous process.
     */
    protected abstract onRollback(registers: TRegisters): void;

    /**
     * Invoked when {@link applySchedule} receives invalid input
     * (empty schedule while `mode === 'schedule'`, unsorted /
     * duplicate / negative `seconds`, non-finite `powerW`, missing
     * direction) **or** when {@link onInit} throws. The default
     * implementation is a no-op; subclasses may override to log or
     * surface the error.
     *
     * After `onError`, the handler always lands in a defined state
     * (idle), regardless of whether `onError` is observed.
     *
     * @param _err - Description of what went wrong.
     */
    protected onError(_err: Error): void {
        // Default: no-op. Subclasses may override to surface errors.
    }

    /**
     * Apply a schedule directly, bypassing the data bus. Useful when
     * the schedule comes from a UI control, an optimizer, or a replay
     * of stored plans. Equivalent to receiving an
     * {@link EnyoDataBusSetStorageScheduleV1} whose `data` matches
     * `input`.
     *
     * Disposed handlers silently ignore the call. Concurrent calls
     * are serialised internally — the returned promise resolves once
     * the call's effects (including any preceding rollback and any
     * `onInit` await) are complete.
     *
     * @param input - {@link StorageScheduleInput} carrying mode and
     *                optional schedule.
     */
    public applySchedule(input: StorageScheduleInput): Promise<void> {
        return this.enqueue(() => this.doApplySchedule(input));
    }

    /**
     * Apply an incoming {@link EnyoDataBusSetStorageScheduleV1} message.
     * Messages whose `applianceId` does not match the handler's bound
     * appliance are silently ignored — the data-bus subscription
     * registered in the constructor routes through this method.
     *
     * @param msg - The data-bus message.
     */
    public applyMessage(msg: EnyoDataBusSetStorageScheduleV1): Promise<void> {
        if (this.options.applianceId !== undefined && msg.applianceId !== this.options.applianceId) {
            return Promise.resolve();
        }
        return this.applySchedule({
            mode: msg.data.mode,
            relativeSchedule: msg.data.relativeSchedule,
        });
    }

    /**
     * Snapshot of the currently-active entry, or `undefined` when the
     * handler is idle (no schedule installed, or
     * {@link EnyoStorageScheduleModeEnum.Auto} has been applied).
     */
    public getActiveEntry(): ActiveStorageScheduleEntry | undefined {
        if (this.state.kind !== 'running') {
            return undefined;
        }
        return this.makeActive(this.state, this.state.activeIndex);
    }

    /**
     * Stop the interval, unsubscribe from the data bus, and — if a
     * schedule was active — fire {@link onRollback} with the
     * in-memory registers exactly once. The persisted copy is removed
     * best-effort (fire-and-forget); restart recovery still works
     * even if the removal does not land.
     *
     * Idempotent: subsequent calls are no-ops, and further
     * `applySchedule` / `applyMessage` calls are silently ignored
     * (they do not restart the interval).
     */
    public dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.options.dataBus.unsubscribe(this.listenerId);
        if (this.state.kind === 'running') {
            const state = this.state;
            this.options.interval.stopInterval(state.intervalId);
            const registers = state.registers;
            this.state = {kind: 'idle'};
            this.onRollback(registers);
            // Best-effort persisted clear; rollback already fired in-process.
            void this.options.storage.remove(this.storageKey).catch(() => {});
        }
    }

    private enqueue(op: () => Promise<void>): Promise<void> {
        const next = this.operationChain.then(() => op());
        // The chain swallows errors so one failure does not freeze subsequent ops;
        // the returned promise still propagates them to the caller.
        this.operationChain = next.catch(() => {});
        return next;
    }

    private async doApplySchedule(input: StorageScheduleInput): Promise<void> {
        if (this.disposed) {
            return;
        }
        if (input.mode === EnyoStorageScheduleModeEnum.Auto) {
            await this.doReleaseSchedule();
            return;
        }
        const validation = this.validate(input.relativeSchedule);
        if (!validation.ok) {
            this.onError(validation.error);
            await this.doReleaseSchedule();
            return;
        }
        await this.doInstallSchedule(validation.entries);
    }

    private async doReleaseSchedule(): Promise<void> {
        if (this.state.kind !== 'running') {
            return;
        }
        const state = this.state;
        this.options.interval.stopInterval(state.intervalId);
        const registers = state.registers;
        this.state = {kind: 'idle'};
        this.onRollback(registers);
        await this.options.storage.remove(this.storageKey);
    }

    private async doInstallSchedule(entries: EnyoStorageScheduleEntry[]): Promise<void> {
        if (this.state.kind === 'running') {
            await this.doReleaseSchedule();
            if (this.disposed) {
                return;
            }
        }
        const scheduleStartedAtMs = this.now();
        const provisional: ActiveStorageScheduleEntry = {
            entry: entries[0],
            indexInSchedule: 0,
            totalEntries: entries.length,
            scheduleStartedAtMs,
            entryStartedAtMs: scheduleStartedAtMs,
        };
        let registers: TRegisters;
        try {
            registers = await this.onInit(provisional);
        } catch (err) {
            if (this.disposed) {
                return;
            }
            this.onError(err instanceof Error ? err : new Error(String(err)));
            return;
        }
        if (this.disposed) {
            // We received registers but the handler was disposed during the await.
            // Roll back immediately so the appliance is not left in a half-set state.
            this.onRollback(registers);
            return;
        }
        const payload: PersistedRegisters<TRegisters> = {registers};
        await this.options.storage.save(this.storageKey, payload);
        if (this.disposed) {
            this.onRollback(registers);
            void this.options.storage.remove(this.storageKey).catch(() => {});
            return;
        }
        const intervalId = this.options.interval.createInterval('1s', () => this.onTick());
        const running: RunningState<TRegisters> = {
            kind: 'running',
            schedule: entries,
            scheduleStartedAtMs,
            activeIndex: 0,
            entryStartedAtMs: scheduleStartedAtMs,
            intervalId,
            registers,
        };
        this.state = running;
        this.onChange(this.makeActive(running, 0), undefined);
    }

    private async tryRecoverFromStorage(): Promise<void> {
        if (this.disposed || this.state.kind !== 'idle') {
            return;
        }
        const stored = await this.options.storage.load<PersistedRegisters<TRegisters>>(this.storageKey);
        if (!stored || this.disposed || this.state.kind !== 'idle') {
            return;
        }
        this.onRollback(stored.registers);
        await this.options.storage.remove(this.storageKey);
    }

    private onTick(): void {
        if (this.state.kind !== 'running') {
            return;
        }
        const state = this.state;
        const elapsedMs = this.now() - state.scheduleStartedAtMs;
        const targetIndex = this.findTargetIndex(state.schedule, elapsedMs);
        while (state.activeIndex < targetIndex) {
            const previous = this.makeActive(state, state.activeIndex);
            state.activeIndex += 1;
            state.entryStartedAtMs = state.scheduleStartedAtMs
                + state.schedule[state.activeIndex].seconds * 1000;
            const active = this.makeActive(state, state.activeIndex);
            this.onChange(active, previous);
        }
    }

    private findTargetIndex(entries: EnyoStorageScheduleEntry[], elapsedMs: number): number {
        let target = 0;
        for (let i = 1; i < entries.length; i += 1) {
            if (entries[i].seconds * 1000 <= elapsedMs) {
                target = i;
            } else {
                break;
            }
        }
        return target;
    }

    private makeActive(state: RunningState<TRegisters>, index: number): ActiveStorageScheduleEntry {
        const entryStartedAtMs = index === state.activeIndex
            ? state.entryStartedAtMs
            : state.scheduleStartedAtMs + state.schedule[index].seconds * 1000;
        return {
            entry: state.schedule[index],
            indexInSchedule: index,
            totalEntries: state.schedule.length,
            scheduleStartedAtMs: state.scheduleStartedAtMs,
            entryStartedAtMs,
        };
    }

    private validate(
        entries: EnyoStorageScheduleEntry[] | undefined,
    ): {ok: true; entries: EnyoStorageScheduleEntry[]} | {ok: false; error: Error} {
        if (!entries || entries.length === 0) {
            return {ok: false, error: new Error('relativeSchedule must contain at least one entry when mode is "schedule"')};
        }
        let previousSeconds = -Infinity;
        for (let i = 0; i < entries.length; i += 1) {
            const e = entries[i];
            if (!Number.isFinite(e.seconds) || e.seconds < 0) {
                return {ok: false, error: new Error(`relativeSchedule[${i}].seconds must be a non-negative finite number`)};
            }
            if (e.seconds <= previousSeconds) {
                return {ok: false, error: new Error(`relativeSchedule must be strictly increasing by seconds (entry ${i} = ${e.seconds}, previous = ${previousSeconds})`)};
            }
            if (!Number.isFinite(e.powerW) || e.powerW < 0) {
                return {ok: false, error: new Error(`relativeSchedule[${i}].powerW must be a non-negative finite number`)};
            }
            if (e.direction !== EnyoStorageScheduleDirectionEnum.Charge
                && e.direction !== EnyoStorageScheduleDirectionEnum.Discharge) {
                return {ok: false, error: new Error(`relativeSchedule[${i}].direction must be 'charge' or 'discharge'`)};
            }
            previousSeconds = e.seconds;
        }
        return {ok: true, entries};
    }
}
