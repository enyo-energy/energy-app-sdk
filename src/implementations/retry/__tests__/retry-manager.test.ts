import {beforeEach, describe, expect, it, vi} from 'vitest';
import {RetryState, type RetryPolicy, type RetryStatus} from '../../../types/enyo-retry-manager.js';
import {RetryManager} from '../retry-manager.js';
import {RetryExhaustedError} from '../retry-errors.js';

const fixedPolicy = (overrides: Partial<RetryPolicy> = {}): RetryPolicy => ({
    maxAttempts: 3,
    backoff: {type: 'fixed', initialMs: 10},
    ...overrides,
});

const recordingSleep = () => {
    const calls: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
        calls.push(ms);
    });
    return {sleep, calls};
};

describe('RetryManager', () => {
    let sleep: ReturnType<typeof vi.fn>;
    let sleepCalls: number[];
    let manager: RetryManager;

    beforeEach(() => {
        const recorder = recordingSleep();
        sleep = recorder.sleep;
        sleepCalls = recorder.calls;
        manager = new RetryManager({sleep});
    });

    describe('registration', () => {
        it('register / has / unregister / status round-trip', () => {
            manager.register('a', fixedPolicy());
            expect(manager.has('a')).toBe(true);
            expect(manager.status('a')).toEqual<RetryStatus>({
                id: 'a',
                state: RetryState.Idle,
                attempts: 0,
                lastError: undefined,
                nextDelayMs: undefined,
            });
            manager.unregister('a');
            expect(manager.has('a')).toBe(false);
            expect(manager.status('a')).toBeUndefined();
        });

        it('rejects duplicate registration', () => {
            manager.register('a', fixedPolicy());
            expect(() => manager.register('a', fixedPolicy())).toThrow();
        });

        it('rejects maxAttempts < 1', () => {
            expect(() => manager.register('a', fixedPolicy({maxAttempts: 0}))).toThrow(RangeError);
        });

        it('lists statuses for every registered instance', () => {
            manager.register('a', fixedPolicy());
            manager.register('b', fixedPolicy());
            const ids = manager.statuses().map(s => s.id).sort();
            expect(ids).toEqual(['a', 'b']);
        });
    });

    describe('execute - happy path', () => {
        it('returns the result on first-try success without sleeping', async () => {
            manager.register('ok', fixedPolicy());
            const fn = vi.fn().mockResolvedValue('value');

            await expect(manager.execute('ok', fn)).resolves.toBe('value');

            expect(fn).toHaveBeenCalledTimes(1);
            expect(sleep).not.toHaveBeenCalled();
            expect(manager.status('ok')).toMatchObject({state: RetryState.Succeeded, attempts: 1});
        });

        it('retries until success and sleeps between attempts', async () => {
            manager.register('flaky', fixedPolicy({backoff: {type: 'linear', initialMs: 50}}));
            const fn = vi
                .fn<() => Promise<string>>()
                .mockRejectedValueOnce(new Error('boom-1'))
                .mockRejectedValueOnce(new Error('boom-2'))
                .mockResolvedValue('done');

            await expect(manager.execute('flaky', fn)).resolves.toBe('done');

            expect(fn).toHaveBeenCalledTimes(3);
            // linear: attempt 1 -> 50, attempt 2 -> 100
            expect(sleepCalls).toEqual([50, 100]);
            expect(manager.status('flaky')).toMatchObject({
                state: RetryState.Succeeded,
                attempts: 3,
                lastError: undefined,
            });
        });
    });

    describe('execute - failure path', () => {
        it('throws RetryExhaustedError after maxAttempts and preserves the cause', async () => {
            manager.register('dead', fixedPolicy({maxAttempts: 2}));
            const cause = new Error('always fails');
            const fn = vi.fn().mockRejectedValue(cause);

            await expect(manager.execute('dead', fn)).rejects.toMatchObject({
                name: 'RetryExhaustedError',
                id: 'dead',
                attempts: 2,
                cause,
            });

            expect(fn).toHaveBeenCalledTimes(2);
            expect(sleepCalls).toEqual([10]); // sleeps once between the two attempts
            const status = manager.status('dead')!;
            expect(status.state).toBe(RetryState.Exhausted);
            expect(status.lastError).toBe(cause);
        });

        it('short-circuits when isRetryable returns false', async () => {
            const isRetryable = vi.fn(() => false);
            manager.register('auth', fixedPolicy({maxAttempts: 5, isRetryable}));
            const fn = vi.fn().mockRejectedValue(new Error('401'));

            await expect(manager.execute('auth', fn)).rejects.toBeInstanceOf(RetryExhaustedError);

            expect(fn).toHaveBeenCalledTimes(1);
            expect(sleep).not.toHaveBeenCalled();
            expect(isRetryable).toHaveBeenCalledTimes(1);
            expect(manager.status('auth')!.state).toBe(RetryState.Exhausted);
        });
    });

    describe('reset', () => {
        it('returns the instance to Idle with zero attempts', async () => {
            manager.register('r', fixedPolicy({maxAttempts: 1}));
            await manager.execute('r', () => Promise.resolve('ok'));
            expect(manager.status('r')!.state).toBe(RetryState.Succeeded);

            manager.reset('r');

            expect(manager.status('r')).toEqual<RetryStatus>({
                id: 'r',
                state: RetryState.Idle,
                attempts: 0,
                lastError: undefined,
                nextDelayMs: undefined,
            });
        });

        it('throws when the id is not registered', () => {
            expect(() => manager.reset('nope')).toThrow();
        });
    });

    describe('execute - unknown id', () => {
        it('rejects when the id is not registered', async () => {
            await expect(manager.execute('ghost', () => Promise.resolve(1))).rejects.toThrow();
        });
    });

    describe('isolation', () => {
        it('keeps per-instance state independent', async () => {
            manager.register('a', fixedPolicy({maxAttempts: 1}));
            manager.register('b', fixedPolicy({maxAttempts: 2}));

            await expect(manager.execute('a', () => Promise.reject(new Error('a-fail')))).rejects.toBeInstanceOf(
                RetryExhaustedError,
            );
            await manager.execute('b', () => Promise.resolve('b-ok'));

            expect(manager.status('a')!.state).toBe(RetryState.Exhausted);
            expect(manager.status('b')!.state).toBe(RetryState.Succeeded);
            expect(manager.status('b')!.lastError).toBeUndefined();
        });

        it('runs concurrent executes for two ids without cross-talk', async () => {
            manager.register('a', fixedPolicy({maxAttempts: 1}));
            manager.register('b', fixedPolicy({maxAttempts: 1}));

            const [aRes, bRes] = await Promise.all([
                manager.execute('a', () => Promise.resolve('A')),
                manager.execute('b', () => Promise.resolve('B')),
            ]);

            expect(aRes).toBe('A');
            expect(bRes).toBe('B');
            expect(manager.status('a')!.attempts).toBe(1);
            expect(manager.status('b')!.attempts).toBe(1);
        });
    });

    describe('listeners', () => {
        it('fires onStateChange for every transition', async () => {
            manager.register('l', fixedPolicy({maxAttempts: 2}));
            const events: Array<{state: RetryState; attempts: number}> = [];
            const unsub = manager.onStateChange(s => {
                events.push({state: s.state, attempts: s.attempts});
            });

            const fn = vi
                .fn<() => Promise<string>>()
                .mockRejectedValueOnce(new Error('once'))
                .mockResolvedValue('ok');

            await manager.execute('l', fn);

            expect(events).toEqual([
                {state: RetryState.Running, attempts: 1},
                {state: RetryState.Waiting, attempts: 1},
                {state: RetryState.Running, attempts: 2},
                {state: RetryState.Succeeded, attempts: 2},
            ]);

            unsub();
            manager.reset('l');
            // No event should arrive after unsubscribe.
            expect(events).toHaveLength(4);
        });

        it('exposes nextDelayMs on the Waiting snapshot', async () => {
            manager.register('w', fixedPolicy({backoff: {type: 'fixed', initialMs: 42}}));
            const seen: Array<RetryStatus> = [];
            manager.onStateChange(s => {
                seen.push({...s});
            });

            const fn = vi
                .fn<() => Promise<string>>()
                .mockRejectedValueOnce(new Error('x'))
                .mockResolvedValue('ok');
            await manager.execute('w', fn);

            const waiting = seen.find(s => s.state === RetryState.Waiting);
            expect(waiting?.nextDelayMs).toBe(42);
        });
    });

    describe('cycle reuse', () => {
        it('clears state at the start of each execute call', async () => {
            manager.register('c', fixedPolicy({maxAttempts: 1}));
            await expect(manager.execute('c', () => Promise.reject(new Error('1')))).rejects.toBeInstanceOf(
                RetryExhaustedError,
            );
            expect(manager.status('c')!.state).toBe(RetryState.Exhausted);

            // Calling execute again should start a fresh cycle without an explicit reset.
            await expect(manager.execute('c', () => Promise.resolve('ok'))).resolves.toBe('ok');
            expect(manager.status('c')).toMatchObject({
                state: RetryState.Succeeded,
                attempts: 1,
                lastError: undefined,
            });
        });
    });
});
