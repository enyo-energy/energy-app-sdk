import {EnyoVacation, EnyoVacationsChangedListener} from "../types/enyo-vacation.js";

/**
 * Interface for reading the customer's absences (vacation mode).
 *
 * The customer plans absences in the enyo app: when they leave and return,
 * what the heatpump heats to meanwhile, whether hot water pauses, whether to
 * pre-heat for the return and how the battery is used. The energy manager
 * reads them and steers the appliances accordingly. Apps only read them.
 *
 * Access to this API requires the `EnergyManager` permission
 * ({@link EnergyAppPermissionType}).
 *
 * @example
 * ```typescript
 * const vacations = energyApp.useVacations();
 *
 * // On boot: read the absences.
 * applyVacations(await vacations.getVacations());
 *
 * // Afterwards: react to the customer planning, changing or ending one.
 * vacations.listenForVacationsChanged((all) => applyVacations(all));
 * ```
 */
export interface EnergyAppVacations {
    /**
     * Returns every absence that is not over yet — planned and running ones.
     *
     * @returns Promise that resolves to the absences, in no particular order
     * @throws {EnergyAppPermissionNotGrantedError} If the `EnergyManager` permission is not granted.
     */
    getVacations(): Promise<EnyoVacation[]>;
    /**
     * Registers a listener called with every absence that is not over yet
     * whenever the customer creates, changes or removes one — including an
     * early return, which moves the absence's `endIso` to that moment.
     *
     * @param listener - Callback invoked with all absences after the change
     * @returns A listener ID that can be passed to {@link removeListener}
     * @throws {EnergyAppPermissionNotGrantedError} If the `EnergyManager` permission is not granted.
     */
    listenForVacationsChanged(listener: EnyoVacationsChangedListener): string;
    /**
     * Removes a listener registered with {@link listenForVacationsChanged}.
     *
     * @param listenerId - The ID returned when the listener was registered
     */
    removeListener(listenerId: string): void;
}
