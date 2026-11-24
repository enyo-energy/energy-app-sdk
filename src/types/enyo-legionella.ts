/**
 * The legionella program (thermal disinfection): once a week the hot water
 * tank is heated to about 60 °C at a fixed slot the owner set on the device,
 * e.g. Saturday 01:00.
 *
 * Shared by heat pumps (per domestic-hot-water zone,
 * {@link EnyoHeatpumpApplianceDomesticHotWater.legionella}) and heating rods
 * ({@link EnyoHeatingRodApplianceMetadata.legionella}). The energy manager can
 * move the slot to a time with solar power or cheaper electricity — see the
 * control area `LegionellaProgram`
 * ({@link EnyoHeatpumpControlAreaEnum.LegionellaProgram}) and
 * {@link EnyoDataBusSetLegionellaScheduleV1}. It only ever moves the slot; the
 * temperature and the weekly rhythm stay the device's.
 */

/**
 * The longest gap, in hours, the energy manager may leave between the last
 * completed legionella run and the next one when it moves the slot: one week
 * plus one day. The day of slack lets a run move to later on the same weekday
 * (Saturday 01:00 → Saturday 13:00) without breaking the weekly rhythm.
 *
 * Checked by {@link validateLegionellaSchedule} when the device reports
 * {@link EnyoLegionellaProgramMetadata.lastCompletedIso}. Putting the owner's
 * slot back ({@link EnyoDataBusSetLegionellaScheduleV1} with `restored`) is
 * exempt — that is the rhythm the owner chose.
 */
export const LEGIONELLA_PROGRAM_MAX_GAP_HOURS = 8 * 24;

/**
 * How long before the owner's run the energy manager must have moved the
 * slot, in minutes. Closer to it the device may already be heating, and the
 * move would end in two runs in one week. Checked by
 * {@link validateLegionellaSchedule} against
 * {@link EnyoDataBusSetLegionellaScheduleV1} `ownerRunIso`; restoring the
 * owner's slot is exempt.
 */
export const LEGIONELLA_PROGRAM_MIN_LEAD_MINUTES = 60;

/**
 * Where one run of the legionella program stands, reported with
 * {@link EnyoDataBusLegionellaStatusV1}. `Completed` and `Failed` are final for
 * that run.
 */
export enum EnyoLegionellaRunStateEnum {
    /** The next run is set and has not started yet. */
    Scheduled = 'scheduled',
    /** The tank is being heated for the program. */
    Running = 'running',
    /** The target temperature was reached and held. Final. */
    Completed = 'completed',
    /** The run ended without reaching or holding the target. Final. */
    Failed = 'failed',
}

/**
 * Which parts of the legionella slot the integration can write into the
 * device ({@link EnyoLegionellaProgramMetadata.adjustable}).
 */
export enum EnyoLegionellaSlotAdjustableEnum {
    /** Weekday and time of day can both be changed. */
    DayAndTime = 'day-and-time',
    /**
     * Only the time of day can be changed; the weekday stays the owner's
     * ({@link EnyoLegionellaProgramMetadata.ownerSlot}).
     */
    TimeOnly = 'time-only',
}

/**
 * The weekly start of the legionella program, as the device stores it: a
 * weekday and a local wall-clock time of the site — not UTC. Same conventions
 * as {@link EnyoHeatpumpTimeProgramPeriod}.
 *
 * @example
 * ```ts
 * // Saturday 01:00
 * const slot: EnyoLegionellaSlot = {dayOfWeek: 6, timeOfDay: '01:00'};
 * ```
 */
export interface EnyoLegionellaSlot {
    /** Day of the week, `0` = Sunday … `6` = Saturday. */
    dayOfWeek: number;
    /** Local wall-clock start time, `HH:mm` (`00:00` … `23:59`). */
    timeOfDay: string;
}

/**
 * What a heat pump's domestic-hot-water zone or a heating rod reports about
 * its legionella program.
 *
 * Reporting it — at least {@link ownerSlot} — makes the control area
 * `LegionellaProgram` available: the energy manager can then recommend a
 * better slot that the customer sets on the device. Declaring the feature
 * `LegionellaSchedule`
 * ({@link EnyoHeatpumpApplianceAvailableFeaturesEnum.LegionellaSchedule},
 * {@link EnyoHeatingRodApplianceAvailableFeaturesEnum.LegionellaSchedule})
 * together with {@link adjustable} lets it write the slot itself
 * ({@link EnyoDataBusSetLegionellaScheduleV1}).
 *
 * Validate with {@link validateLegionellaProgramMetadata}.
 *
 * @example
 * ```ts
 * const legionella: EnyoLegionellaProgramMetadata = {
 *     ownerSlot: {dayOfWeek: 6, timeOfDay: '01:00'},
 *     activeSlot: {dayOfWeek: 6, timeOfDay: '13:00'},
 *     adjustable: EnyoLegionellaSlotAdjustableEnum.TimeOnly,
 *     granularityMinutes: 15,
 *     targetTemperatureC: 60,
 *     estimatedDurationMinutes: 90,
 *     lastCompletedIso: '2026-11-21T13:00:00+01:00',
 * };
 * ```
 */
export interface EnyoLegionellaProgramMetadata {
    /**
     * The owner's own slot, as set on the device before the energy manager
     * moved it. **The integration keeps it** when the energy manager writes
     * another slot — it is what {@link EnyoDataBusSetLegionellaScheduleV1}
     * with `restored` puts back. It changes only when the owner sets a new
     * slot on the device themselves (see {@link activeSlot}).
     */
    ownerSlot: EnyoLegionellaSlot;
    /**
     * The slot currently written in the device. Equal to {@link ownerSlot}
     * while the energy manager has not moved it. When the device holds a slot
     * the energy manager did not write, the owner changed it by hand: take it
     * as the new {@link ownerSlot}. Omitted means unknown.
     */
    activeSlot?: EnyoLegionellaSlot;
    /**
     * Which parts of the slot the integration can write. Required with the
     * feature `LegionellaSchedule`; without it the energy manager can only
     * recommend a slot the customer sets by hand.
     */
    adjustable?: EnyoLegionellaSlotAdjustableEnum;
    /**
     * The grid the device accepts start times on, in minutes — e.g. `60` when
     * it only takes full hours. The minutes since midnight of a written slot
     * must be a multiple of it. Omitted means any minute.
     */
    granularityMinutes?: number;
    /** The temperature the program heats the tank to, in °C (typically 60). */
    targetTemperatureC?: number;
    /**
     * How long a run usually takes, from start until the temperature has been
     * held long enough, in minutes. Lets the energy manager fit the run into a
     * solar window.
     */
    estimatedDurationMinutes?: number;
    /**
     * When the last run completed, ISO 8601, if the device reports it. The
     * energy manager never moves the next run further than
     * {@link LEGIONELLA_PROGRAM_MAX_GAP_HOURS} after it.
     */
    lastCompletedIso?: string;
    /**
     * The slot the energy manager wrote with the last accepted
     * {@link EnyoDataBusSetLegionellaScheduleV1} — unset while the owner's
     * slot applies (never moved, or `restored`).
     *
     * Stored here, not in memory, so the integration can still tell after a
     * restart whether a slot on the device came from the energy manager or
     * from the owner: see {@link reconcileLegionellaProgram}.
     * `HeatpumpIntegrationEnergyApp` keeps it up to date itself.
     */
    energyManagerSlot?: EnyoLegionellaSlot;
}
