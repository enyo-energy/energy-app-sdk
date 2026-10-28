import {HEATPUMP_CURVE_OPTIMIZATION_DEFAULT_TARGET_C} from "./enyo-heatpump-appliance.js";

/**
 * How warm a room should be compared with the other rooms of its heating
 * circuit, as the customer answered in the enyo app. One flow temperature heats
 * a whole circuit, so this decides which rooms keep their thermostat fully open
 * and lead the heating curve, and which are held back by theirs.
 */
export enum EnyoRoomWarmthEnum {
    /** Cooler than the rest of the circuit, e.g. a bedroom. */
    Cool = 'cool',
    /** As warm as the rest of the circuit. */
    Normal = 'normal',
    /** Warmer than the rest of the circuit, e.g. a bathroom. */
    Warm = 'warm',
}

/**
 * The thermostat a room has, as the customer answered in the enyo app: a manual
 * dial the customer sets once ({@link Steps5}, {@link Steps6},
 * {@link CelsiusDial}), an electronic one that holds its own setpoint
 * ({@link SelfRegulating}), or none.
 */
export enum EnyoRoomThermostatEnum {
    /** Electronic thermostat that holds its own setpoint. */
    SelfRegulating = 'self-regulating',
    /** Manual dial with steps 1–5. */
    Steps5 = 'steps-5',
    /** Manual dial with steps 1–6. */
    Steps6 = 'steps-6',
    /** Manual dial in °C. */
    CelsiusDial = 'celsius-dial',
    /** No thermostat — the room follows the heating curve. */
    None = 'none',
}

/**
 * A room of the home, as the customer set it up in the enyo app. Read-only for
 * apps — rooms are created and changed by the customer only.
 *
 * The room's measured temperatures are not part of it: read them with
 * {@link EnergyAppRoomTemperatures}.
 */
export interface EnyoRoom {
    /** ID of the room. Heating circuits name their rooms by it ({@link EnyoHeatpumpHeatingCurveOptimizationSettings.roomIds}). */
    id: string;
    /** The room's name, as the customer called it — for logs and diagnostics. */
    name: string;
    /** IDs of the appliances the customer placed in this room. */
    applianceIds: string[];
    /**
     * The room temperature in °C the customer wants here — a setpoint for an
     * app's own control, **not** written to any appliance. Absent until the
     * customer sets one; use {@link HEATPUMP_CURVE_OPTIMIZATION_DEFAULT_TARGET_C}
     * then.
     */
    targetTemperatureC?: number;
    /** Warmer or cooler than the rest of its heating circuit. Absent: {@link EnyoRoomWarmthEnum.Normal}. */
    warmth?: EnyoRoomWarmthEnum;
    /** The thermostat in the room. Absent: a dial with steps 1–5 ({@link EnyoRoomThermostatEnum.Steps5}). */
    thermostat?: EnyoRoomThermostatEnum;
}

/** Called with every room of the home whenever one of them changes. */
export type EnyoRoomsChangedListener = (rooms: EnyoRoom[]) => void | Promise<void>;
