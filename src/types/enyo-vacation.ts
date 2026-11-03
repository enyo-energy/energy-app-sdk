/**
 * What the heatpump heats to while nobody is home, as the customer chose it for
 * an absence ({@link EnyoVacation.heatingMode}).
 */
export enum EnyoVacationHeatingModeEnum {
    /** Only keep the house from freezing — see {@link VACATION_FROST_PROTECTION_C}. */
    FrostProtection = 'frost-protection',
    /** Hold the rooms at {@link EnyoVacation.loweredRoomTemperatureC}. */
    Lowered = 'lowered',
    /** Heat as usual, e.g. someone looks after pets or plants. */
    Normal = 'normal',
}

/** The room temperature in °C frost protection holds ({@link EnyoVacationHeatingModeEnum.FrostProtection}). */
export const VACATION_FROST_PROTECTION_C = 7;

/** Lowest room temperature in °C the customer can choose for {@link EnyoVacationHeatingModeEnum.Lowered}. */
export const VACATION_LOWERED_MIN_C = 10;

/** Highest room temperature in °C the customer can choose for {@link EnyoVacationHeatingModeEnum.Lowered}. */
export const VACATION_LOWERED_MAX_C = 20;

/**
 * One absence of the customer (vacation mode), as set up in the enyo app.
 * Read-only for apps — absences are created, changed and ended by the customer
 * only.
 *
 * Only absences that are not over yet are reported, planned and running ones
 * alike. Two absences never overlap. When the customer returns early, the
 * absence's {@link endIso} is moved to that moment.
 */
export interface EnyoVacation {
    /** ID of the absence. */
    id: string;
    /** ISO 8601 timestamp of the departure — from here on the absence applies. */
    startIso: string;
    /** ISO 8601 timestamp of the planned return — the house should be back to normal by then. */
    endIso: string;
    /** What the heatpump heats to while the customer is away. */
    heatingMode: EnyoVacationHeatingModeEnum;
    /**
     * Room temperature in °C to hold while away, between
     * {@link VACATION_LOWERED_MIN_C} and {@link VACATION_LOWERED_MAX_C}. Only
     * applies with {@link EnyoVacationHeatingModeEnum.Lowered}.
     */
    loweredRoomTemperatureC: number;
    /** Whether hot water is not reheated while away. Legionella protection keeps running. */
    pauseHotWater: boolean;
    /** Whether to heat up again so the house is warm on return. Ignored with {@link EnyoVacationHeatingModeEnum.Normal}. */
    preheatBeforeReturn: boolean;
    /** Whether the battery may serve the grid while away: the house needs almost no power, so charge at cheap prices and feed in surplus. */
    gridServingBattery: boolean;
    /** State of charge in % the battery holds at least when the customer is back. */
    batteryMinSocAtReturnPercent: number;
}

/** Called with every absence that is not over yet whenever one of them is created, changed or removed. */
export type EnyoVacationsChangedListener = (vacations: EnyoVacation[]) => void | Promise<void>;
