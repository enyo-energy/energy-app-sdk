import {
    RetryState,
    type RetryPolicy,
    type RetryStateListener,
    type RetryStatus,
} from '../../types/enyo-retry-manager.js';
import {computeBackoffDelay} from './backoff.js';
import {RetryExhaustedError} from './retry-errors.js';

interface RetryInstance {
    id: string;
    policy: RetryPolicy;
    state: RetryState;
    attempts: number;
    lastError?: unknown;
    nextDelayMs?: number;
}

/**
 * Options controlling how a {@link RetryManager} interacts with the outside world.
 *
 * Both fields exist purely so unit tests can inject deterministic substitutes;
 * production code should use the defaults.
 */
export interface RetryManagerOptions {
    /** Replacement for `setTimeout`-based sleeping. Defaults to a `setTimeout` wrapper. */
    sleep?: (ms: number) => Promise<void>;
    /** Source of randomness for backoff jitter. Defaults to `Math.random`. */
    rng?: () => number;
}

const defaultSleep = (ms: number): Promise<void> =>
    new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Protocol-agnostic retry coordinator.
 *
 * Each *instance* (a Modbus connection, an MQTT client, a REST endpoint, …) is
 * registered under a string `id` together with its own {@link RetryPolicy}.
 * Callers then run an operation through {@link RetryManager.execute}; the
 * manager handles attempt counting, backoff, and state transitions and reports
 * progress through {@link RetryManager.onStateChange}.
 *
 * @example
 * ```ts
 * const retries = new RetryManager();
 * retries.register('modbus-inverter-1', {
 *     maxAttempts: 5,
 *     backoff: { type: 'exponential', initialMs: 200, maxMs: 5000, jitter: 0.2 },
 * });
 *
 * await retries.execute('modbus-inverter-1', () => client.connect());
 * ```
 */
export class RetryManager {
    private readonly instances = new Map<string, RetryInstance>();
    private readonly listeners = new Set<RetryStateListener>();
    private readonly sleep: (ms: number) => Promise<void>;
    private readonly rng: () => number;

    /**
     * @param options Test hooks for sleep and randomness. Production callers can omit this argument.
     */
    constructor(options: RetryManagerOptions = {}) {
        this.sleep = options.sleep ?? defaultSleep;
        this.rng = options.rng ?? Math.random;
    }

    /**
     * Registers a new retry instance.
     *
     * @param id Identifier used for all subsequent operations and reported in {@link RetryStatus}.
     * @param policy Retry policy applied to this instance.
     * @throws Error if `id` is already registered.
     */
    register(id: string, policy: RetryPolicy): void {
        if (this.instances.has(id)) {
            throw new Error(`Retry instance "${id}" is already registered`);
        }
        if (policy.maxAttempts < 1) {
            throw new RangeError(`maxAttempts must be >= 1, got ${policy.maxAttempts}`);
        }
        this.instances.set(id, {id, policy, state: RetryState.Idle, attempts: 0});
    }

    /**
     * Removes the instance from the manager. No-op if `id` is not registered.
     */
    unregister(id: string): void {
        this.instances.delete(id);
    }

    /**
     * Returns whether `id` is registered.
     */
    has(id: string): boolean {
        return this.instances.has(id);
    }

    /**
     * Returns a snapshot of `id`'s current state, or `undefined` if not registered.
     */
    status(id: string): RetryStatus | undefined {
        const instance = this.instances.get(id);
        return instance ? toStatus(instance) : undefined;
    }

    /**
     * Returns snapshots for every registered instance.
     */
    statuses(): RetryStatus[] {
        return Array.from(this.instances.values(), toStatus);
    }

    /**
     * Resets `id` to {@link RetryState.Idle} with zero attempts. The policy is preserved.
     *
     * @throws Error if `id` is not registered.
     */
    reset(id: string): void {
        const instance = this.requireInstance(id);
        instance.state = RetryState.Idle;
        instance.attempts = 0;
        instance.lastError = undefined;
        instance.nextDelayMs = undefined;
        this.emit(instance);
    }

    /**
     * Subscribes to state-change events for every registered instance.
     *
     * @param listener Called once per transition with the post-transition snapshot.
     * @returns Unsubscribe function.
     */
    onStateChange(listener: RetryStateListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Runs `fn` under the policy registered for `id`.
     *
     * Each invocation starts a fresh attempt cycle: counters and `lastError` are
     * cleared before the first attempt so the same instance can be re-used after
     * a previous success or exhaustion.
     *
     * @param id Identifier registered via {@link RetryManager.register}.
     * @param fn Operation to execute. Rejecting causes a retry (subject to the policy).
     * @returns Whatever `fn` resolves to.
     * @throws RetryExhaustedError when all attempts have been used or `isRetryable` returns `false`.
     * @throws Error when `id` is not registered.
     */
    async execute<T>(id: string, fn: () => Promise<T>): Promise<T> {
        const instance = this.requireInstance(id);
        instance.attempts = 0;
        instance.lastError = undefined;
        instance.nextDelayMs = undefined;

        const {maxAttempts, backoff, isRetryable} = instance.policy;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            instance.attempts = attempt;
            instance.nextDelayMs = undefined;
            this.transition(instance, RetryState.Running);

            try {
                const result = await fn();
                instance.lastError = undefined;
                this.transition(instance, RetryState.Succeeded);
                return result;
            } catch (error) {
                instance.lastError = error;
                const retryable = isRetryable ? isRetryable(error) : true;
                const hasMore = attempt < maxAttempts;
                if (!retryable || !hasMore) {
                    this.transition(instance, RetryState.Exhausted);
                    throw new RetryExhaustedError(id, attempt, error);
                }
                const delay = computeBackoffDelay(backoff, attempt, this.rng);
                instance.nextDelayMs = delay;
                this.transition(instance, RetryState.Waiting);
                await this.sleep(delay);
            }
        }

        // Unreachable: the loop either returns, throws, or completes by entering
        // the catch branch on the final attempt (which throws Exhausted above).
        throw new RetryExhaustedError(id, instance.attempts, instance.lastError);
    }

    private requireInstance(id: string): RetryInstance {
        const instance = this.instances.get(id);
        if (!instance) {
            throw new Error(`Retry instance "${id}" is not registered`);
        }
        return instance;
    }

    private transition(instance: RetryInstance, state: RetryState): void {
        instance.state = state;
        this.emit(instance);
    }

    private emit(instance: RetryInstance): void {
        if (this.listeners.size === 0) return;
        const snapshot = toStatus(instance);
        for (const listener of this.listeners) {
            listener(snapshot);
        }
    }
}

function toStatus(instance: RetryInstance): RetryStatus {
    return {
        id: instance.id,
        state: instance.state,
        attempts: instance.attempts,
        lastError: instance.lastError,
        nextDelayMs: instance.nextDelayMs,
    };
}
