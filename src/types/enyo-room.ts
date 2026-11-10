import {HEATPUMP_CURVE_OPTIMIZATION_DEFAULT_TARGET_C} from "./enyo-heatpump-appliance.js";

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
}

/** Called with every room of the home whenever one of them changes. */
export type EnyoRoomsChangedListener = (rooms: EnyoRoom[]) => void | Promise<void>;
