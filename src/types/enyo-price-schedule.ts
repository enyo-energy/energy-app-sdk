/**
 * Shared scheduling primitives for time-dependent price components
 * (dynamic grid fees and tariff bonuses).
 *
 * All amounts in this module are expressed **per kilowatt hour** and are always
 * a positive magnitude — the direction is defined by the component that carries
 * the schedule: a grid fee is *added* to the energy price, a tariff bonus is
 * *subtracted* from it. Keeping magnitudes unsigned removes the single most
 * common integration mistake (an inverted sign silently flipping an optimizer's
 * decisions) and is enforced by the validators in
 * `implementations/pricing/price-schedule-validators.ts`.
 */

/**
 * The kind of schedule a price component follows.
 */
export enum EnyoPriceScheduleTypeEnum {
    /** One amount that applies at every point in time. */
    Constant = 'constant',
    /**
     * Calendar-recurring windows — used for high-tariff/low-tariff (HT/NT)
     * network charges, seasonal charges, and weekday-dependent bonuses.
     */
    Recurring = 'recurring',
    /**
     * Explicit absolute time windows — used for grid fees or bonuses published
     * as a dated series (e.g. a day-ahead publication by the grid operator).
     */
    Absolute = 'absolute',
}

/**
 * Which energy direction a price component applies to.
 */
export enum EnyoPriceAppliesToEnum {
    /** Applies to energy drawn from the grid. */
    Consumption = 'consumption',
    /** Applies to energy fed into the grid. */
    FeedIn = 'feed-in',
    /** Applies to both directions. */
    Both = 'both',
}

/**
 * A calendar-recurring price window.
 *
 * Times are wall-clock times in the owning component's `timezone`, so a window
 * survives daylight-saving transitions: `'22:00'` stays 22:00 local time all
 * year round.
 */
export interface EnyoRecurringPriceWindow {
    /**
     * Inclusive start of the window as a local wall-clock time in `HH:mm`
     * 24-hour notation, e.g. `'22:00'`.
     */
    startTimeOfDay: string;
    /**
     * Exclusive end of the window as a local wall-clock time in `HH:mm`
     * notation. May be **earlier** than `startTimeOfDay`, in which case the
     * window wraps past midnight (e.g. `'22:00'` → `'06:00'`).
     */
    endTimeOfDay: string;
    /**
     * Days of the week the window applies to, `0` = Sunday … `6` = Saturday.
     * Omit for "every day".
     *
     * For a window that wraps past midnight the day is evaluated against the
     * day the window **starts** — a Monday 22:00–06:00 window covers Monday
     * evening and the early hours of Tuesday.
     */
    daysOfWeek?: number[];
    /**
     * Months the window applies to, `1` = January … `12` = December. Omit for
     * "every month". Evaluated against the day the window starts, exactly as
     * {@link daysOfWeek}.
     */
    months?: number[];
    /** Positive amount per kWh that applies inside the window. */
    amountPerKwh: number;
}

/**
 * An explicit, absolutely-dated price window.
 */
export interface EnyoAbsolutePriceWindow {
    /** Inclusive start of the window in ISO format. */
    startIso: string;
    /** Exclusive end of the window in ISO format. */
    endIso: string;
    /** Positive amount per kWh that applies inside the window. */
    amountPerKwh: number;
}

/**
 * A single amount that applies at all times.
 */
export interface EnyoConstantPriceSchedule {
    type: EnyoPriceScheduleTypeEnum.Constant;
    /** Positive amount per kWh, applied to every interval. */
    amountPerKwh: number;
}

/**
 * A set of calendar-recurring windows. Intervals not covered by any window
 * resolve to `0`.
 */
export interface EnyoRecurringPriceSchedule {
    type: EnyoPriceScheduleTypeEnum.Recurring;
    /** The recurring windows. Must not overlap each other. */
    windows: EnyoRecurringPriceWindow[];
}

/**
 * A set of absolutely-dated windows. Intervals not covered by any window
 * resolve to `0`.
 */
export interface EnyoAbsolutePriceSchedule {
    type: EnyoPriceScheduleTypeEnum.Absolute;
    /** The dated windows. Must not overlap each other. */
    windows: EnyoAbsolutePriceWindow[];
}

/**
 * Any supported price component schedule, discriminated by `type`.
 */
export type EnyoPriceSchedule =
    | EnyoConstantPriceSchedule
    | EnyoRecurringPriceSchedule
    | EnyoAbsolutePriceSchedule;

/**
 * One resolved 15-minute interval produced by expanding an
 * {@link EnyoPriceSchedule} over a time range.
 */
export interface EnyoResolvedPriceEntry {
    /** Start of the 15-minute interval in ISO format. */
    timestampIso: string;
    /** Resolved positive amount per kWh for this interval; `0` when uncovered. */
    amountPerKwh: number;
}

/**
 * Restricts a price component query to a time range.
 */
export interface EnyoPriceRangeFilter {
    /** Start of the requested range in ISO format (inclusive). */
    fromIso: string;
    /** End of the requested range in ISO format (exclusive). */
    untilIso: string;
}
