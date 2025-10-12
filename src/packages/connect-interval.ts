/**
 * Supported interval durations for scheduled tasks.
 * Provides predefined time intervals from 1 second to 1 hour.
 */
export type IntervalDuration = '1s' | '10s' | '30s' | '1m' | '5m' | '1hr';

/**
 * Interface for managing scheduled intervals in Connect EMS packages.
 * Provides functionality to create and manage recurring tasks.
 */
export interface ConnectInterval {
    /** Create a new interval that executes the callback at the specified duration */
    createInterval: (duration: IntervalDuration, callback: () => void) => string;
    /** Stop an existing interval by its ID */
    stopInterval: (intervalId: string) => void;
}