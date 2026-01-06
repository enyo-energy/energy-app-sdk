import type {IConnectionHealth} from './interfaces.js';

export class EnergyAppModbusConnectionHealth implements IConnectionHealth {
    private _consecutiveFailures = 0;
    private _lastError?: Error;
    private _lastSuccessTime = new Date();
    private readonly _maxFailures = 5;
    private readonly _staleThresholdMs = 5 * 60 * 1000; // 5 minutes

    recordSuccess(): void {
        this._consecutiveFailures = 0;
        this._lastError = undefined;
        this._lastSuccessTime = new Date();
    }

    recordFailure(error: Error): void {
        this._consecutiveFailures++;
        this._lastError = error;
    }

    isHealthy(): boolean {
        const isNotFailing = this._consecutiveFailures < this._maxFailures;
        const isNotStale = (Date.now() - this._lastSuccessTime.getTime()) < this._staleThresholdMs;

        return isNotFailing && isNotStale;
    }

    getConsecutiveFailures(): number {
        return this._consecutiveFailures;
    }

    getLastError(): Error | undefined {
        return this._lastError;
    }

    getLastSuccessTime(): Date {
        return new Date(this._lastSuccessTime);
    }

    isStale(): boolean {
        return (Date.now() - this._lastSuccessTime.getTime()) > this._staleThresholdMs;
    }
}