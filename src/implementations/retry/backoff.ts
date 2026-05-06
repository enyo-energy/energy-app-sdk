import type {BackoffConfig} from '../../types/enyo-retry-manager.js';

/**
 * Computes the delay (ms) the {@link RetryManager} should wait before retry attempt `attempt`.
 *
 * Pure function — no timers, no global state — so it can be called directly by
 * callers that drive their own retry loops.
 *
 * @param config Backoff curve and bounds.
 * @param attempt 1-based attempt number; `1` is the first retry (the call right after the first failure).
 * @param rng Source of randomness for jitter, in `[0, 1)`. Injectable for deterministic tests.
 * @returns Non-negative delay in milliseconds.
 * @throws RangeError on invalid configuration or non-positive `attempt`.
 *
 * @example
 * ```ts
 * computeBackoffDelay({ type: 'exponential', initialMs: 100, maxMs: 5000 }, 4); // 800
 * ```
 */
export function computeBackoffDelay(
    config: BackoffConfig,
    attempt: number,
    rng: () => number = Math.random,
): number {
    if (!Number.isFinite(attempt) || attempt < 1) {
        throw new RangeError(`attempt must be a positive integer, got ${attempt}`);
    }
    if (config.initialMs < 0) {
        throw new RangeError(`initialMs must be >= 0, got ${config.initialMs}`);
    }
    if (config.maxMs !== undefined && config.maxMs < 0) {
        throw new RangeError(`maxMs must be >= 0, got ${config.maxMs}`);
    }
    const factor = config.factor ?? 2;
    if (config.type === 'exponential' && factor < 1) {
        throw new RangeError(`factor must be >= 1, got ${factor}`);
    }
    const jitter = config.jitter ?? 0;
    if (jitter < 0 || jitter > 1) {
        throw new RangeError(`jitter must be in [0, 1], got ${jitter}`);
    }

    let delay: number;
    switch (config.type) {
        case 'fixed':
            delay = config.initialMs;
            break;
        case 'linear':
            delay = config.initialMs * attempt;
            break;
        case 'exponential':
            delay = config.initialMs * factor ** (attempt - 1);
            break;
    }

    if (config.maxMs !== undefined && delay > config.maxMs) {
        delay = config.maxMs;
    }

    if (jitter > 0) {
        delay = delay * (1 + (rng() * 2 - 1) * jitter);
    }

    return delay < 0 ? 0 : delay;
}
