import {
    EnyoHeatpumpRoomTemperatureSensorReference,
    HEATPUMP_CURVE_OPTIMIZATION_DEFAULT_TARGET_C,
} from "./enyo-heatpump-appliance.js";

/**
 * How warm a room should be compared with the other rooms of its heating
 * circuit, as the customer answered in the enyo app. One flow temperature heats
 * a whole circuit, so this decides which rooms keep their thermostat fully open
 * and lead the heating curve, and which are held back by theirs.
 */
export type EnyoRoomWarmth = 'cool' | 'normal' | 'warm';

/**
 * The thermostat a room has, as the customer answered in the enyo app: a manual
 * dial the customer sets once (`steps-5`, `steps-6`, `celsius-dial`), an
 * electronic one that holds its own setpoint (`self-regulating`), or none.
 */
export type EnyoRoomThermostat = 'self-regulating' | 'steps-5' | 'steps-6' | 'celsius-dial' | 'none';

/**
 * A room of the home, as the customer set it up in the enyo app. Read-only for
 * apps — rooms are created and changed by the customer only.
 */
export interface EnyoRoom {
    /** ID of the room. Heating circuits name their rooms by it ({@link EnyoHeatpumpHeatingCurveOptimizationSettings.roomIds}). */
    id: string;
    /** The room's name, as the customer called it — for logs and diagnostics. */
    name: string;
    /** IDs of the appliances the customer placed in this room. */
    applianceIds: string[];
    /**
     * The room temperature sensors among those appliances. An outdoor sensor
     * placed in a room is left out. With several, the coldest counts.
     */
    temperatureSensors: EnyoHeatpumpRoomTemperatureSensorReference[];
    /**
     * The room temperature in °C the customer wants here — a setpoint for an
     * app's own control, **not** written to any appliance.
     * {@link HEATPUMP_CURVE_OPTIMIZATION_DEFAULT_TARGET_C} until the customer sets one.
     */
    targetTemperatureC: number;
    /** Warmer or cooler than the rest of its heating circuit. Absent: `normal`. */
    warmth?: EnyoRoomWarmth;
    /** The thermostat in the room. Absent: a dial with steps 1–5 (`steps-5`). */
    thermostat?: EnyoRoomThermostat;
}

/** Called with every room of the home whenever one of them changes. */
export type EnyoRoomsChangedListener = (rooms: EnyoRoom[]) => void | Promise<void>;
