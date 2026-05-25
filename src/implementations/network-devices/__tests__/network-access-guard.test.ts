import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {EnergyApp} from '../../../energy-app.js';
import type {EnyoNetworkDeviceAccessStatus} from '../../../types/enyo-network-device.js';
import {NetworkAccessGuard} from '../network-access-guard.js';

type AccessChangeListener = (deviceId: string, status: EnyoNetworkDeviceAccessStatus) => void | Promise<void>;

interface NetworkDevicesFake {
    requestDeviceAccess: ReturnType<typeof vi.fn>;
    listenForDeviceAccessChange: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    /** Manually invoke the registered access-change listener from a test. */
    emitAccessChange: (deviceId: string, status: EnyoNetworkDeviceAccessStatus) => Promise<void>;
}

function createNetworkDevicesFake(): NetworkDevicesFake {
    const listeners: { id: string; fn: AccessChangeListener }[] = [];
    let counter = 0;
    return {
        requestDeviceAccess: vi.fn(async () => ({status: 'granted' as EnyoNetworkDeviceAccessStatus})),
        listenForDeviceAccessChange: vi.fn((fn: AccessChangeListener) => {
            const id = `listener-${++counter}`;
            listeners.push({id, fn});
            return id;
        }),
        removeListener: vi.fn((id: string) => {
            const idx = listeners.findIndex(l => l.id === id);
            if (idx >= 0) listeners.splice(idx, 1);
        }),
        emitAccessChange: async (deviceId, status) => {
            for (const {fn} of [...listeners]) await fn(deviceId, status);
        },
    };
}

function createEnergyAppFake(networkDevices: NetworkDevicesFake): EnergyApp {
    return {
        useNetworkDevices: () => networkDevices,
    } as unknown as EnergyApp;
}

const silentLogging = {enableLogging: false};

describe('NetworkAccessGuard', () => {
    describe('isAccessDeniedError', () => {
        it.each([
            ['Error with "Network access denied"', new Error('[NET] Network access denied: ...')],
            ['Error with "not in the allowed list"', new Error('Host 192.168.1.5:502 is not in the allowed list')],
            ['mixed case "NETWORK ACCESS DENIED"', new Error('NETWORK ACCESS DENIED')],
            ['plain string with the substring', 'foo Network access denied bar'],
        ])('matches %s', (_label, error) => {
            expect(NetworkAccessGuard.isAccessDeniedError(error)).toBe(true);
        });

        it.each([
            ['unrelated Error', new Error('ECONNRESET')],
            ['null', null],
            ['undefined', undefined],
            ['plain string without substring', 'something else'],
        ])('does not match %s', (_label, error) => {
            expect(NetworkAccessGuard.isAccessDeniedError(error)).toBe(false);
        });
    });

    describe('construction', () => {
        it('registers a single access-change listener with the SDK', () => {
            const sdk = createNetworkDevicesFake();
            new NetworkAccessGuard(createEnergyAppFake(sdk), {ports: [502], ...silentLogging});
            expect(sdk.listenForDeviceAccessChange).toHaveBeenCalledTimes(1);
        });
    });

    describe('ensureAccess', () => {
        let sdk: NetworkDevicesFake;
        let guard: NetworkAccessGuard;

        beforeEach(() => {
            sdk = createNetworkDevicesFake();
            guard = new NetworkAccessGuard(createEnergyAppFake(sdk), {ports: [502], ...silentLogging});
        });

        it('forwards the configured ports to requestDeviceAccess', async () => {
            sdk.requestDeviceAccess.mockResolvedValueOnce({status: 'granted'});
            await guard.ensureAccess('dev-1');
            expect(sdk.requestDeviceAccess).toHaveBeenCalledWith('dev-1', [502]);
        });

        it('returns true on a granted response', async () => {
            sdk.requestDeviceAccess.mockResolvedValueOnce({status: 'granted'});
            await expect(guard.ensureAccess('dev-1')).resolves.toBe(true);
        });

        it('returns false on a denied response', async () => {
            sdk.requestDeviceAccess.mockResolvedValueOnce({status: 'denied'});
            await expect(guard.ensureAccess('dev-1')).resolves.toBe(false);
        });

        it('returns false on a pending response', async () => {
            sdk.requestDeviceAccess.mockResolvedValueOnce({status: 'pending'});
            await expect(guard.ensureAccess('dev-1')).resolves.toBe(false);
        });

        it('returns false when requestDeviceAccess throws', async () => {
            sdk.requestDeviceAccess.mockRejectedValueOnce(new Error('boom'));
            await expect(guard.ensureAccess('dev-1')).resolves.toBe(false);
        });

        it('coalesces concurrent calls for the same device into one SDK round-trip', async () => {
            sdk.requestDeviceAccess.mockImplementationOnce(
                () => new Promise(resolve => setImmediate(() => resolve({status: 'granted'}))),
            );

            const [a, b, c] = await Promise.all([
                guard.ensureAccess('dev-1'),
                guard.ensureAccess('dev-1'),
                guard.ensureAccess('dev-1'),
            ]);

            expect(sdk.requestDeviceAccess).toHaveBeenCalledTimes(1);
            expect([a, b, c]).toEqual([true, true, true]);
        });

        it('still hits the SDK for distinct devices in parallel', async () => {
            sdk.requestDeviceAccess.mockResolvedValue({status: 'granted'});

            await Promise.all([
                guard.ensureAccess('dev-1'),
                guard.ensureAccess('dev-2'),
            ]);

            expect(sdk.requestDeviceAccess).toHaveBeenCalledTimes(2);
        });

        it('allows a fresh SDK call once the in-flight promise has settled', async () => {
            sdk.requestDeviceAccess.mockResolvedValue({status: 'granted'});

            await guard.ensureAccess('dev-1');
            await guard.ensureAccess('dev-1');

            expect(sdk.requestDeviceAccess).toHaveBeenCalledTimes(2);
        });
    });

    describe('recoverAccess', () => {
        let sdk: NetworkDevicesFake;
        let onAccessRestored: ReturnType<typeof vi.fn>;
        let onAccessDenied: ReturnType<typeof vi.fn>;
        let guard: NetworkAccessGuard;

        beforeEach(() => {
            sdk = createNetworkDevicesFake();
            onAccessRestored = vi.fn();
            onAccessDenied = vi.fn();
            guard = new NetworkAccessGuard(createEnergyAppFake(sdk), {
                ports: [502],
                onAccessRestored,
                onAccessDenied,
                ...silentLogging,
            });
        });

        it('fires onAccessDenied once, then onAccessRestored once, on a synchronous grant', async () => {
            sdk.requestDeviceAccess.mockResolvedValueOnce({status: 'granted'});

            await guard.recoverAccess('dev-1');

            expect(onAccessDenied).toHaveBeenCalledTimes(1);
            expect(onAccessDenied).toHaveBeenCalledWith('dev-1');
            expect(onAccessRestored).toHaveBeenCalledTimes(1);
            expect(onAccessRestored).toHaveBeenCalledWith('dev-1');
            expect(guard.isRecovering('dev-1')).toBe(false);
        });

        it('clears pending on a non-granted response so a later access-denied error can drive a fresh recovery', async () => {
            sdk.requestDeviceAccess
                .mockResolvedValueOnce({status: 'pending'})
                .mockResolvedValueOnce({status: 'granted'});

            await guard.recoverAccess('dev-1');

            // First attempt fired onAccessDenied and got a non-granted response.
            expect(onAccessDenied).toHaveBeenCalledTimes(1);
            expect(onAccessRestored).not.toHaveBeenCalled();
            // Critical: the device is NOT held in pending forever — otherwise
            // subsequent access-denied errors would coalesce into a no-op.
            expect(guard.isRecovering('dev-1')).toBe(false);

            // A second access-denied error can therefore drive a fresh attempt.
            await guard.recoverAccess('dev-1');

            expect(sdk.requestDeviceAccess).toHaveBeenCalledTimes(2);
            expect(onAccessDenied).toHaveBeenCalledTimes(2);
            expect(onAccessRestored).toHaveBeenCalledTimes(1);
        });

        it('ignores asynchronous "granted" listener events for devices not currently in recovery', async () => {
            sdk.requestDeviceAccess.mockResolvedValueOnce({status: 'pending'});

            await guard.recoverAccess('dev-1');
            // Non-granted response cleared the pending mark, so a late
            // SDK listener event for the same device must not fire restored.
            await sdk.emitAccessChange('dev-1', 'granted');

            expect(onAccessRestored).not.toHaveBeenCalled();
        });

        it('does not fire restored when the listener reports a non-granted status', async () => {
            // While the recovery request itself is unresolved we ARE pending.
            sdk.requestDeviceAccess.mockImplementationOnce(() => new Promise(() => {}));
            void guard.recoverAccess('dev-1');
            await Promise.resolve();

            await sdk.emitAccessChange('dev-1', 'denied');
            await sdk.emitAccessChange('dev-1', 'pending');

            expect(onAccessRestored).not.toHaveBeenCalled();
        });

        it('ignores listener events for devices not currently in recovery', async () => {
            await sdk.emitAccessChange('untracked-device', 'granted');
            expect(onAccessRestored).not.toHaveBeenCalled();
        });

        it('coalesces concurrent recoverAccess calls for the same device', async () => {
            sdk.requestDeviceAccess.mockImplementationOnce(() => new Promise(() => {}));

            void guard.recoverAccess('dev-1');
            void guard.recoverAccess('dev-1');
            void guard.recoverAccess('dev-1');
            // Drain microtasks so the first call reaches ensureAccess.
            await new Promise(resolve => setImmediate(resolve));

            expect(sdk.requestDeviceAccess).toHaveBeenCalledTimes(1);
            expect(onAccessDenied).toHaveBeenCalledTimes(1);
        });

        it('isolates recovery state across devices', async () => {
            // dev-1's request hangs so we can observe per-device state mid-flight.
            sdk.requestDeviceAccess
                .mockImplementationOnce(() => new Promise(() => {}))
                .mockResolvedValueOnce({status: 'granted'});

            void guard.recoverAccess('dev-1');
            await Promise.resolve();
            await guard.recoverAccess('dev-2');

            expect(guard.isRecovering('dev-1')).toBe(true);
            expect(guard.isRecovering('dev-2')).toBe(false);
            expect(onAccessRestored).toHaveBeenCalledTimes(1);
            expect(onAccessRestored).toHaveBeenCalledWith('dev-2');
        });

        it('no-ops after dispose', async () => {
            guard.dispose();
            await guard.recoverAccess('dev-1');
            expect(sdk.requestDeviceAccess).not.toHaveBeenCalled();
        });
    });

    describe('withAccessGuard', () => {
        let sdk: NetworkDevicesFake;
        let onAccessRestored: ReturnType<typeof vi.fn>;
        let onAccessDenied: ReturnType<typeof vi.fn>;
        let guard: NetworkAccessGuard;

        beforeEach(() => {
            sdk = createNetworkDevicesFake();
            onAccessRestored = vi.fn();
            onAccessDenied = vi.fn();
            guard = new NetworkAccessGuard(createEnergyAppFake(sdk), {
                ports: [502],
                onAccessRestored,
                onAccessDenied,
                ...silentLogging,
            });
        });

        it('returns the action result on success without triggering recovery', async () => {
            const action = vi.fn().mockResolvedValue('value');
            await expect(guard.withAccessGuard('dev-1', action)).resolves.toBe('value');
            expect(sdk.requestDeviceAccess).not.toHaveBeenCalled();
            expect(onAccessDenied).not.toHaveBeenCalled();
        });

        it('triggers recovery and re-throws on an access-denied error', async () => {
            sdk.requestDeviceAccess.mockResolvedValueOnce({status: 'granted'});
            const action = vi.fn().mockRejectedValueOnce(new Error('Network access denied: ...'));

            await expect(guard.withAccessGuard('dev-1', action)).rejects.toThrow(/Network access denied/);

            // Recovery runs in the background — flush the microtask queue.
            await new Promise(resolve => setImmediate(resolve));

            expect(onAccessDenied).toHaveBeenCalledTimes(1);
            expect(onAccessRestored).toHaveBeenCalledTimes(1);
            expect(sdk.requestDeviceAccess).toHaveBeenCalledWith('dev-1', [502]);
        });

        it('re-throws unrelated errors without triggering recovery', async () => {
            const action = vi.fn().mockRejectedValueOnce(new Error('ECONNRESET'));

            await expect(guard.withAccessGuard('dev-1', action)).rejects.toThrow(/ECONNRESET/);

            // Flush microtasks to be safe — recovery should still not have fired.
            await new Promise(resolve => setImmediate(resolve));

            expect(sdk.requestDeviceAccess).not.toHaveBeenCalled();
            expect(onAccessDenied).not.toHaveBeenCalled();
        });
    });

    describe('handler registration', () => {
        let sdk: NetworkDevicesFake;
        let guard: NetworkAccessGuard;

        beforeEach(() => {
            sdk = createNetworkDevicesFake();
            guard = new NetworkAccessGuard(createEnergyAppFake(sdk), {ports: [502], ...silentLogging});
        });

        it('fires every registered restored handler on a synchronous grant', async () => {
            sdk.requestDeviceAccess.mockResolvedValueOnce({status: 'granted'});
            const a = vi.fn();
            const b = vi.fn();
            guard.onAccessRestored(a);
            guard.onAccessRestored(b);

            await guard.recoverAccess('dev-1');

            expect(a).toHaveBeenCalledWith('dev-1');
            expect(b).toHaveBeenCalledWith('dev-1');
        });

        it('removes a handler when its disposer is called', async () => {
            sdk.requestDeviceAccess.mockResolvedValueOnce({status: 'granted'});
            const a = vi.fn();
            const dispose = guard.onAccessRestored(a);
            dispose();

            await guard.recoverAccess('dev-1');

            expect(a).not.toHaveBeenCalled();
        });

        it('continues firing remaining handlers when one throws', async () => {
            sdk.requestDeviceAccess.mockResolvedValueOnce({status: 'granted'});
            const failing = vi.fn().mockRejectedValue(new Error('handler boom'));
            const ok = vi.fn();
            guard.onAccessRestored(failing);
            guard.onAccessRestored(ok);

            await guard.recoverAccess('dev-1');

            expect(failing).toHaveBeenCalled();
            expect(ok).toHaveBeenCalledTimes(1);
        });

        it('removes denied handlers via the returned disposer', async () => {
            sdk.requestDeviceAccess.mockResolvedValueOnce({status: 'pending'});
            const a = vi.fn();
            const dispose = guard.onAccessDenied(a);
            dispose();

            await guard.recoverAccess('dev-1');

            expect(a).not.toHaveBeenCalled();
        });
    });

    describe('dispose', () => {
        it('removes the SDK access-change listener', () => {
            const sdk = createNetworkDevicesFake();
            const guard = new NetworkAccessGuard(createEnergyAppFake(sdk), {ports: [502], ...silentLogging});

            guard.dispose();

            expect(sdk.removeListener).toHaveBeenCalledTimes(1);
        });

        it('is idempotent', () => {
            const sdk = createNetworkDevicesFake();
            const guard = new NetworkAccessGuard(createEnergyAppFake(sdk), {ports: [502], ...silentLogging});

            guard.dispose();
            guard.dispose();

            expect(sdk.removeListener).toHaveBeenCalledTimes(1);
        });
    });
});
