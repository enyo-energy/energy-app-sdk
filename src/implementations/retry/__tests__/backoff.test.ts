import {describe, expect, it} from 'vitest';
import {computeBackoffDelay} from '../backoff.js';

const seededRng = (values: number[]): (() => number) => {
    let i = 0;
    return () => values[i++ % values.length]!;
};

describe('computeBackoffDelay', () => {
    describe('fixed', () => {
        it('returns initialMs for any attempt', () => {
            const config = {type: 'fixed' as const, initialMs: 250};
            expect(computeBackoffDelay(config, 1)).toBe(250);
            expect(computeBackoffDelay(config, 7)).toBe(250);
        });
    });

    describe('linear', () => {
        it('multiplies initialMs by attempt', () => {
            const config = {type: 'linear' as const, initialMs: 100};
            expect(computeBackoffDelay(config, 1)).toBe(100);
            expect(computeBackoffDelay(config, 4)).toBe(400);
        });

        it('clamps at maxMs', () => {
            const config = {type: 'linear' as const, initialMs: 100, maxMs: 250};
            expect(computeBackoffDelay(config, 5)).toBe(250);
        });
    });

    describe('exponential', () => {
        it('uses default factor of 2', () => {
            const config = {type: 'exponential' as const, initialMs: 100};
            expect(computeBackoffDelay(config, 1)).toBe(100);
            expect(computeBackoffDelay(config, 2)).toBe(200);
            expect(computeBackoffDelay(config, 4)).toBe(800);
        });

        it('honours a custom factor', () => {
            const config = {type: 'exponential' as const, initialMs: 100, factor: 3};
            expect(computeBackoffDelay(config, 3)).toBe(900);
        });

        it('clamps at maxMs', () => {
            const config = {type: 'exponential' as const, initialMs: 100, maxMs: 500};
            expect(computeBackoffDelay(config, 10)).toBe(500);
        });

        it('rejects factor < 1', () => {
            expect(() =>
                computeBackoffDelay({type: 'exponential', initialMs: 100, factor: 0.5}, 1),
            ).toThrow(RangeError);
        });
    });

    describe('jitter', () => {
        it('returns base delay when jitter is 0', () => {
            const config = {type: 'fixed' as const, initialMs: 100, jitter: 0};
            expect(computeBackoffDelay(config, 1, () => 0)).toBe(100);
        });

        it('shifts the delay deterministically when seeded', () => {
            const config = {type: 'fixed' as const, initialMs: 100, jitter: 0.5};
            // rng=1.0 -> 1 + (1*2 - 1)*0.5 = 1.5 -> 150
            expect(computeBackoffDelay(config, 1, seededRng([1]))).toBe(150);
            // rng=0.0 -> 1 + (0*2 - 1)*0.5 = 0.5 -> 50
            expect(computeBackoffDelay(config, 1, seededRng([0]))).toBe(50);
            // rng=0.5 -> 1 + (0.5*2 - 1)*0.5 = 1   -> 100
            expect(computeBackoffDelay(config, 1, seededRng([0.5]))).toBe(100);
        });

        it('never returns a negative delay', () => {
            const config = {type: 'fixed' as const, initialMs: 0, jitter: 1};
            expect(computeBackoffDelay(config, 1, () => 0)).toBe(0);
        });

        it('rejects jitter outside [0, 1]', () => {
            expect(() =>
                computeBackoffDelay({type: 'fixed', initialMs: 100, jitter: -0.1}, 1),
            ).toThrow(RangeError);
            expect(() =>
                computeBackoffDelay({type: 'fixed', initialMs: 100, jitter: 1.5}, 1),
            ).toThrow(RangeError);
        });
    });

    describe('validation', () => {
        it('rejects non-positive attempts', () => {
            expect(() => computeBackoffDelay({type: 'fixed', initialMs: 100}, 0)).toThrow(RangeError);
            expect(() => computeBackoffDelay({type: 'fixed', initialMs: 100}, -1)).toThrow(RangeError);
        });

        it('rejects negative initialMs', () => {
            expect(() => computeBackoffDelay({type: 'fixed', initialMs: -1}, 1)).toThrow(RangeError);
        });

        it('rejects negative maxMs', () => {
            expect(() => computeBackoffDelay({type: 'fixed', initialMs: 100, maxMs: -1}, 1)).toThrow(
                RangeError,
            );
        });
    });
});
