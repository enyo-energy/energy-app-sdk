/**
 * Lifecycle state of a single retryable instance tracked by {@link RetryManager}.
 */
export enum RetryState {
    /** Registered but no attempt has run yet (or the instance was reset). */
    Idle = 'idle',
    /** An attempt is currently executing. */
    Running = 'running',
    /** The previous attempt failed and the manager is sleeping before the next one. */
    Waiting = 'waiting',
    /** The most recent attempt succeeded. */
    Succeeded = 'succeeded',
    /** All attempts have been used (or the error was non-retryable). */
    Exhausted = 'exhausted',
}

/**
 * Backoff curve used to compute the delay between retry attempts.
 *
 * The same shape covers fixed, linear and exponential strategies so callers
 * configure backoff with plain data instead of constructing strategy classes.
 */
export interface BackoffConfig {
    /** Backoff curve. `exponential` is the typical default for network I/O. */
    type: 'fixed' | 'linear' | 'exponential';
    /** Base delay for the first retry, in milliseconds. Must be `>= 0`. */
    initialMs: number;
    /** Optional upper bound (ms) applied after the curve and before jitter. */
    maxMs?: number;
    /** Growth factor for `exponential`. Defaults to `2`. Must be `>= 1`. */
    factor?: number;
    /**
     * Random jitter ratio in `[0, 1]`. `0.2` means the final delay is uniformly
     * distributed in `[delay * 0.8, delay * 1.2]`. Defaults to `0`.
     */
    jitter?: number;
}

/**
 * Per-instance retry policy. Registered with {@link RetryManager.register}.
 */
export interface RetryPolicy {
    /** Total attempts allowed including the first call. Use `Infinity` for endless retry. */
    maxAttempts: number;
    /** Backoff curve applied between attempts. */
    backoff: BackoffConfig;
    /**
     * Predicate consulted after each failure. Returning `false` short-circuits
     * to {@link RetryState.Exhausted} without further retries (e.g. for auth or 4xx errors).
     * Defaults to "always retryable".
     */
    isRetryable?: (error: unknown) => boolean;
}

/**
 * Snapshot of a single instance's current retry state.
 */
export interface RetryStatus {
    /** Identifier the instance was registered under. */
    id: string;
    /** Current lifecycle state. */
    state: RetryState;
    /** Number of attempts that have started so far in the current cycle. */
    attempts: number;
    /** Error from the most recent failed attempt, if any. */
    lastError?: unknown;
    /** Delay (ms) the manager is sleeping for, set only while `state === Waiting`. */
    nextDelayMs?: number;
}

/**
 * Listener invoked on every state transition for any registered instance.
 *
 * @param status Snapshot of the instance immediately after the transition.
 */
export type RetryStateListener = (status: RetryStatus) => void;
