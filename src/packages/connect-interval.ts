export type IntervalDuration = '1s' | '10s' | '30s' | '1m' | '5m' | '1hr';

export interface ConnectInterval {
    createInterval: (duration: IntervalDuration, callback: () => void) => string;
    stopInterval: (intervalId: string) => void;
}