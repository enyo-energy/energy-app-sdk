/**
 * Thrown by {@link RetryManager.execute} when all attempts have been used or
 * the policy's `isRetryable` predicate rejected the last error.
 *
 * The original failure is preserved on {@link RetryExhaustedError.cause} so
 * callers can inspect or rethrow it.
 */
export class RetryExhaustedError extends Error {
    /**
     * @param id Identifier of the retry instance that gave up.
     * @param attempts Number of attempts that ran before giving up.
     * @param cause The error from the final failing attempt.
     */
    constructor(
        public readonly id: string,
        public readonly attempts: number,
        public readonly cause: unknown,
    ) {
        super(`Retry exhausted for "${id}" after ${attempts} attempt(s)`);
        this.name = 'RetryExhaustedError';
    }
}
