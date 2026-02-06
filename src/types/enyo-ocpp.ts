export interface EnyoOcppRelativeSchedule {
    /** Relative delay in seconds, 0 is now, 300 is in 5 minutes*/
    seconds: number;
    chargingPowerLimitW: number;
}