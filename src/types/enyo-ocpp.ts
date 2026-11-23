/**
 * One entry of a charging schedule sent with
 * {@link EnyoDataBusSetChargingScheduleV1}: from {@link seconds} on, the
 * charger may draw at most {@link chargingPowerLimitW} until the next entry
 * starts.
 */
export interface EnyoOcppRelativeSchedule {
    /**
     * Relative delay in seconds, 0 is now, 300 is in 5 minutes.
     *
     * Counted from {@link EnyoDataBusSetChargingScheduleV1.data.startScheduleIso}
     * when the command carries one, otherwise from the moment the command
     * arrives.
     */
    seconds: number;
    /** Charging power limit in Watts from this entry on; `0` means no charging. */
    chargingPowerLimitW: number;
    /**
     * Number of grid phases the charger should use in this entry (1, 2 or 3),
     * as on {@link ChargerForecastScheduleEntry.numberOfPhases}. Omit when the
     * charger should choose, or when it cannot switch phases.
     */
    numberOfPhases?: 1 | 2 | 3;
    /**
     * Expected grid price during this entry, in cents per kWh, as on
     * {@link ChargerForecastScheduleEntry.priceCtPerKwh}. May be negative;
     * absent means the sender has no price for the slot.
     */
    priceCtPerKwh?: number;
}
