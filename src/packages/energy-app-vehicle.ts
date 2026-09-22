import {
    EnyoLinkedVehicle,
    EnyoVehicle,
    EnyoVehiclePairHandler,
    EnyoVehicleSoc,
    EnyoVehicleUnpairHandler
} from "../types/enyo-vehicle.js";

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
 *
 * ## Pairing a car integration
 *
 * A package in the `vehicle` category — a manufacturer cloud integration —
 * does not invent vehicles either. The user creates the {@link EnyoVehicle} in
 * the enyo app, signs into the vendor account through
 * {@link EnergyAppAuthentication}, and then picks this package to link the car
 * to. The host calls the handler registered with {@link onPairVehicle}, and
 * from then on the package knows which `vehicleId` its readings belong to.
 *
 * ```typescript
 * const vehicles = energyApp.useVehicle();
 *
 * vehicles.onPairVehicle(async (vehicle, selection) => {
 *     const cars = await tesla.listVehicles();
 *     if (cars.length > 1 && !selection) {
 *         return {
 *             paired: false,
 *             failureReason: EnyoVehiclePairFailureReasonEnum.SelectionRequired,
 *             candidates: cars.map(c => ({ externalId: c.id, displayName: c.name, vin: c.vin })),
 *         };
 *     }
 *     const car = selection ? cars.find(c => c.id === selection.externalId) : cars[0];
 *     return { paired: true, externalId: car.id, vin: car.vin, batterySizeKwh: car.batteryKwh };
 * });
 *
 * vehicles.onUnpairVehicle(async (link) => stopPolling(link.externalId));
 *
 * // after a restart, pick the links back up
 * for (const link of await vehicles.listLinkedVehicles()) startPolling(link);
 * ```
 *
 * Pairing requires the `VehicleIntegration` permission; reading vehicles needs
 * only `Vehicle`.
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

    /**
     * Registers the handler the host calls when the user links one of their
     * vehicles to this package.
     *
     * At most one handler per package; registering again replaces it. The
     * handler receives the {@link EnyoVehicle} the user picked and answers
     * whether it found the matching car in the vendor account — see
     * {@link EnyoVehiclePairHandler} for the two-call flow that resolves an
     * account holding several cars.
     *
     * Requires the `VehicleIntegration` permission. A package in the `vehicle`
     * category that registers no handler can never be linked to anything, and
     * so can never report a state of charge.
     *
     * @param handler - Called with each pairing request.
     */
    onPairVehicle: (handler: EnyoVehiclePairHandler) => void;

    /**
     * Registers the handler the host calls when a link is torn down from the
     * outside — the user unlinking one car in the enyo app, deleting the
     * vehicle, or signing out of the vendor account (once per remaining link).
     *
     * At most one handler per package; registering again replaces it. The link
     * is already gone when the handler runs, so treat it as a notification:
     * stop polling and drop cached state. It is **not** called for an unpair
     * this package itself requested through {@link unpairVehicle}.
     *
     * Requires the `VehicleIntegration` permission.
     *
     * @param handler - Called with each torn-down link and why it went.
     */
    onUnpairVehicle: (handler: EnyoVehicleUnpairHandler) => void;

    /**
     * Every link this package currently holds.
     *
     * Read it on startup. Handlers only fire on change, so a package that has
     * just restarted — or was installed while the hub was offline — otherwise
     * has no idea which cars it is responsible for polling, and would sit idle
     * on a vehicle the user believes is connected.
     *
     * Requires the `VehicleIntegration` permission.
     *
     * @returns The links, or an empty array when the package has none.
     */
    listLinkedVehicles: () => Promise<EnyoLinkedVehicle[]>;

    /**
     * Drops a link from the package's own side.
     *
     * The counterpart to {@link onUnpairVehicle}: that one is the user
     * unlinking a car, this one is the package deciding it can no longer serve
     * it — the car disappeared from the vendor account, the vendor revoked
     * access to it, the subscription that allowed remote readout lapsed.
     * Without it the enyo app would keep showing a car as connected that the
     * package stopped being able to read, which reads to the user as enyo being
     * broken.
     *
     * Does not call {@link onUnpairVehicle} — the package already knows.
     * Unlinking a `vehicleId` this package holds no link for is a no-op rather
     * than an error, so a cleanup path can call it without checking first.
     *
     * Requires the `VehicleIntegration` permission.
     *
     * @param vehicleId - The {@link EnyoVehicle.id} to unlink.
     * @returns Resolves once the link is gone.
     */
    unpairVehicle: (vehicleId: string) => Promise<void>;
}
