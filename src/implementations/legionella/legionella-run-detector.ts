import {EnyoLegionellaRunStateEnum} from '../../types/enyo-legionella.js';

/** Default target temperature of a legionella run, in °C. */
export const LEGIONELLA_RUN_DEFAULT_TARGET_C = 60;

/** Options of a {@link LegionellaRunDetector}. */
export interface LegionellaRunDetectorOptions {
    /** The temperature the run must reach, in °C. Defaults to {@link LEGIONELLA_RUN_DEFAULT_TARGET_C}. */
    targetTemperatureC?: number;
    /** How far below the target still counts as reached, in K (sensor tolerance). Defaults to `1`. */
    toleranceK?: number;
    /** How long the target must hold for the run to count as completed, in minutes. Defaults to `30`. */
    holdMinutes?: number;
    /** After how many minutes from the start a run that has not completed counts as failed. Defaults to `240`. */
    maxDurationMinutes?: number;
}

/**
 * A change of the run's state, returned by {@link LegionellaRunDetector.update}
 * — the fields of an {@link EnyoDataBusLegionellaStatusV1} that the detector
 * knows. Add `slot` and `movedByEnergyManager` and publish it.
 */
export interface LegionellaRunDetectorEvent {
    /** The new state: `Running`, `Completed` or `Failed`. */
    state: EnyoLegionellaRunStateEnum;
    /** When the run started (its scheduled start), ISO 8601. */
    startedIso: string;
    /** When the target had held long enough, ISO 8601. Set for `Completed`. */
    completedIso?: string;
    /** The highest temperature measured during the run, in °C. */
    reachedTemperatureC?: number;
    /** Why the run failed. Set for `Failed`. */
    failureReason?: string;
}

/**
 * Detects the runs of a legionella program from the tank temperature, for
 * devices that run the program but do not report it. Lets such an app
 * declare `LegionellaRunStatus` and publish {@link EnyoDataBusLegionellaStatusV1}.
 *
 * Rules:
 * - **Running** from the scheduled start ({@link schedule}) on — the device
 *   starts heating at its slot.
 * - **Completed** once the temperature has stayed at or above
 *   `targetTemperatureC - toleranceK` for `holdMinutes`.
 * - **Failed** when `maxDurationMinutes` after the start have passed without
 *   completing.
 *
 * After `Completed` or `Failed` the detector waits for the next
 * {@link schedule}. Purely in memory: after a restart, schedule the next run
 * again.
 *
 * @example
 * ```ts
 * const detector = new LegionellaRunDetector({targetTemperatureC: 60});
 * detector.schedule(nextRunIso);
 * // on every temperature reading:
 * const event = detector.update(dhwTemperatureC);
 * if (event) this.publishLegionellaStatus('hp-1', {...event, slot, movedByEnergyManager});
 * ```
 */
export class LegionellaRunDetector {
    private readonly targetC: number;
    private readonly toleranceK: number;
    private readonly holdMs: number;
    private readonly maxDurationMs: number;
    private startMs: number | undefined;
    private state: EnyoLegionellaRunStateEnum | undefined;
    private reachedSinceMs: number | undefined;
    private maxTemperatureC: number | undefined;

    /**
     * @param options - Target, tolerance and timing; see {@link LegionellaRunDetectorOptions}.
     */
    constructor(options: LegionellaRunDetectorOptions = {}) {
        this.targetC = options.targetTemperatureC ?? LEGIONELLA_RUN_DEFAULT_TARGET_C;
        this.toleranceK = options.toleranceK ?? 1;
        this.holdMs = (options.holdMinutes ?? 30) * 60_000;
        this.maxDurationMs = (options.maxDurationMinutes ?? 240) * 60_000;
    }

    /**
     * Sets the start of the next run and resets the detector — call it
     * whenever the slot changes, and after a run finished.
     *
     * @param nextRunIso - The next run's start, ISO 8601.
     * @throws {Error} When `nextRunIso` is not an ISO 8601 timestamp.
     */
    schedule(nextRunIso: string): void {
        const startMs = Date.parse(nextRunIso);
        if (!Number.isFinite(startMs)) throw new Error(`nextRunIso must be an ISO 8601 timestamp; got ${nextRunIso}`);
        this.startMs = startMs;
        this.state = EnyoLegionellaRunStateEnum.Scheduled;
        this.reachedSinceMs = undefined;
        this.maxTemperatureC = undefined;
    }

    /**
     * The state the detector is in: `undefined` before the first
     * {@link schedule}, then `Scheduled`, `Running`, `Completed` or `Failed`.
     *
     * @returns The current state.
     */
    get currentState(): EnyoLegionellaRunStateEnum | undefined {
        return this.state;
    }

    /**
     * Feeds a tank temperature reading.
     *
     * @param temperatureC - The measured tank temperature, in °C.
     * @param now - When it was measured; defaults to now.
     * @returns The new state when it changed with this reading, otherwise `undefined`.
     */
    update(temperatureC: number, now: Date | number = Date.now()): LegionellaRunDetectorEvent | undefined {
        const nowMs = typeof now === 'number' ? now : now.getTime();
        const startMs = this.startMs;
        if (startMs === undefined || nowMs < startMs) return undefined;
        if (this.state !== EnyoLegionellaRunStateEnum.Scheduled && this.state !== EnyoLegionellaRunStateEnum.Running) {
            return undefined;
        }
        if (Number.isFinite(temperatureC)) {
            this.maxTemperatureC = Math.max(this.maxTemperatureC ?? temperatureC, temperatureC);
        }
        const base = {startedIso: new Date(startMs).toISOString(), reachedTemperatureC: this.maxTemperatureC};

        if (Number.isFinite(temperatureC) && temperatureC >= this.targetC - this.toleranceK) {
            this.reachedSinceMs ??= nowMs;
        } else {
            this.reachedSinceMs = undefined;
        }
        if (this.reachedSinceMs !== undefined && nowMs - this.reachedSinceMs >= this.holdMs) {
            this.state = EnyoLegionellaRunStateEnum.Completed;
            return {...base, state: this.state, completedIso: new Date(nowMs).toISOString()};
        }
        if (nowMs - startMs >= this.maxDurationMs) {
            this.state = EnyoLegionellaRunStateEnum.Failed;
            return {
                ...base,
                state: this.state,
                failureReason: `${this.targetC} °C not held for ${this.holdMs / 60_000} min within ${this.maxDurationMs / 60_000} min`,
            };
        }
        if (this.state === EnyoLegionellaRunStateEnum.Scheduled) {
            this.state = EnyoLegionellaRunStateEnum.Running;
            return {...base, state: this.state};
        }
        return undefined;
    }
}
