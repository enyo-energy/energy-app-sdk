import {EnyoVehicle, EnyoVehicleSoc} from "../types/enyo-vehicle.js";

/**
 * Interface for managing vehicles in enyo packages.
 *
 * Reading is **read-only by design**: a vehicle's identity and its charging
 * behaviour are configured by the user in the enyo app, and an energy app
 * plans against them rather than changing them. There is no `update()` — if
 * you are looking for one, see the note on the state of charge below.
 *
 * ## Writing a state of charge
 *
 * An app that can read the car — a wallbox speaking ISO 15118, a manufacturer
 * cloud integration, an OCPP charge point reporting SoC in its meter values —
 * publishes it on the data bus as `EnyoDataBusVehicleSocUpdateV1`. The host
 * ingests the message and it becomes readable through {@link getSoc}:
 *
 * ```typescript
 * energyApp.useDataBus().sendMessage([{
 *     type: 'message',
 *     message: 'VehicleSocUpdateV1',
 *     data: {
 *         vehicleId,
 *         socPercent: 62,
 *         measuredAtIso: new Date().toISOString(),
 *     },
 * }]);
 * ```
 *
 * That message is the only write path for a state of charge; publishing it
 * requires the `SendDataBusValues` permission.
 */
export interface EnergyAppVehicle {
    /** Get a list of all registered vehicles */
    list: () => Promise<EnyoVehicle[]>;
    /** Get a specific vehicle by its ID */
    getById: (id: string) => Promise<EnyoVehicle | null>;
    /**
     * Get the most recent state-of-charge reading for a vehicle.
     *
     * Resolves to `undefined` when nothing is known about the car's charge —
     * no source has ever reported one, or the host does not keep readings
     * this old. `undefined` is an ordinary answer, not an error: plenty of
     * vehicles have no SoC source at all, and a planner must cope without one
     * rather than assume a number.
     *
     * The reading carries {@link EnyoVehicleSoc.measuredAtIso}, so decide for
     * yourself how old is too old before showing it to a user or sizing a
     * session against it.
     *
     * @param id - ID of the vehicle to read.
     * @returns The reading and its age, or `undefined` when none is known.
     */
    getSoc: (id: string) => Promise<EnyoVehicleSoc | undefined>;
}
