import type {EnyoChargeModeEnum, EnyoPriceLimitModeEnum} from "./enyo-data-bus-value.js";

/**
 * Represents a vehicle in the enyo system.
 *
 * A vehicle carries both its identity and **the charging behaviour that
 * belongs to the car rather than to the wall**: charge limit, default mode,
 * price ceiling, immediate reserve and departure time follow the vehicle to
 * every wallbox it is plugged into. Two cars sharing one wallbox would
 * otherwise have to share a departure time, which is wrong for both of them.
 *
 * The state of charge is deliberately *not* part of this object — it is a
 * reading with an age, not a property of the car. Read it with
 * `useVehicle().getSoc(id)`, which returns an {@link EnyoVehicleSoc} or
 * `undefined`.
 */
export interface EnyoVehicle {
    /** Unique identifier for the vehicle */
    id: string;
    name: string;
    licensePlate?: string;
    batterySizeKwh?: number;
    pinnedChargingCardId?: string;
    /**
     * Last known state of charge in percent.
     *
     * @deprecated A percentage without an age cannot be aged out: a reading
     * from three days ago is indistinguishable from one taken a minute ago, is
     * presented to the user as current, and makes a planner size the session
     * against the wrong amount of energy. Use `useVehicle().getSoc(id)`
     * instead, which carries {@link EnyoVehicleSoc.measuredAtIso} and answers
     * `undefined` when nothing is known. Kept for compatibility with apps
     * compiled against earlier SDK versions.
     */
    socPercent?: number;

    /** Manufacturer as shown to the user, e.g. `"Tesla"`. */
    manufacturer?: string;
    /** Model line, e.g. `"Model Y Long Range"`. */
    model?: string;
    /**
     * The highest charging power the car itself accepts, in kW.
     *
     * A session is planned against the lower of this and the wallbox's
     * maximum: a 3.7 kW car on an 11 kW wallbox still takes three times as
     * long, and a planner that assumes the wallbox figure promises a deadline
     * it cannot meet.
     */
    maxChargingPowerKw?: number;
    /** How many phases the car charges over — typically `1` or `3`. */
    numberOfPhases?: number;

    /** Target state of charge for every session, in percent (0-100). */
    defaultChargeLimitPercent?: number;
    /** The mode applied whenever this vehicle is recognised or picked. */
    defaultChargeMode?: EnyoChargeModeEnum;
    /**
     * How this car's price ceiling is expressed, or omitted for **no
     * ceiling** — a deliberate and common answer rather than a missing value.
     *
     * The mode decides which of {@link priceLimitCtPerKwh} and
     * {@link priceLimitSharePercent} is read; the other is ignored. Only
     * meaningful under {@link EnyoChargeModeEnum.CostOptimized}, the only mode
     * that imports at all.
     */
    priceLimitMode?: EnyoPriceLimitModeEnum;
    /**
     * Absolute ceiling for grid energy, in **cents per kWh** — `25` means
     * 25 ct/kWh, matching the figure the user types and every other ct-native
     * field in the settings vocabulary. Divide by 100 before comparing it with
     * the SDK's EUR/kWh price fields such as
     * {@link EnyoDiagnosticsActionReason.electricityPricePerKwh}.
     *
     * Negative values are legal: wholesale prices go negative, and "only
     * import when I am paid to" is a real preference.
     *
     * Only read while {@link priceLimitMode} is
     * {@link EnyoPriceLimitModeEnum.CtPerKwh}.
     */
    priceLimitCtPerKwh?: number;
    /**
     * Relative ceiling: import only during the cheapest share of the day, in
     * percent — `25` is the cheapest quarter. Integer, 1 to 100.
     *
     * Only read while {@link priceLimitMode} is
     * {@link EnyoPriceLimitModeEnum.CheapestShare}.
     */
    priceLimitSharePercent?: number;
    /**
     * Energy delivered at full power straight after plugging in, in kWh,
     * before any optimisation starts. `0` or omitted means off.
     *
     * Counted from the state of charge at plug-in, and it runs **before every
     * mode** — including {@link EnyoChargeModeEnum.PriceLimit} ("Nur Sonne").
     * The point is that the driver may have to leave unexpectedly, and the sun
     * is not a guarantee.
     */
    immediateReserveKwh?: number;

    /**
     * When the car has to be ready, as a 24-hour wall-clock `HH:mm` in
     * {@link departureTimezone} — e.g. `"07:30"`. The same time every day.
     *
     * Omitted means the car has no deadline at all: it charges PV surplus and
     * is never obliged to finish "in time".
     *
     * Wall-clock rather than an absolute instant, matching
     * {@link EnyoDefaultChargeMode.completeAtTime}: the requirement is "ready
     * by half seven", which an instant cannot express — it would expire the
     * first time it passed and need re-setting every evening.
     *
     * The state of charge to reach by then is
     * {@link defaultChargeLimitPercent}.
     */
    departureTimeHHmm?: string;
    /**
     * IANA timezone {@link departureTimeHHmm} is expressed in, e.g.
     * `"Europe/Berlin"`. Set it whenever the time is set — without it the
     * wall-clock value cannot be resolved across a DST boundary, which is
     * exactly the night a mis-planned charge gets noticed.
     */
    departureTimezone?: string;
}

/**
 * Where a state-of-charge reading came from, and therefore how much it can be
 * trusted.
 *
 * The app tells the user which it is — "Jetzt 60 % · von enyo geschätzt" reads
 * very differently from a figure the car itself reported — and a planner may
 * want to widen its margins on a derived value.
 */
export enum EnyoVehicleSocSourceEnum {
    /**
     * The vehicle reported it: ISO 15118, a manufacturer cloud integration, or
     * any other channel that asks the car directly. The most trustworthy
     * source.
     */
    Vehicle = 'vehicle',
    /**
     * The charge point reported it, typically in OCPP meter values. Comes from
     * the car over the cable, so it is as current as the session.
     */
    Charger = 'charger',
    /**
     * Derived rather than read — energy delivered since plug-in added to an
     * earlier figure, or a model of the vehicle's usage. Drifts with every
     * assumption it rests on, and is the reason a reading must carry
     * {@link EnyoVehicleSoc.measuredAtIso}.
     */
    Estimated = 'estimated',
    /** The user typed or corrected it on the charging screen. */
    UserProvided = 'user-provided',
}

/**
 * Why no state of charge could be given for a vehicle.
 *
 * Carried by the response to a request for an estimate. The members are
 * deliberately separate so a consumer can say something useful instead of "not
 * available": {@link NoSocSource} is permanent for this car,
 * {@link VehicleNotConnected} resolves when it is plugged in, and
 * {@link ReadingTooOld} means a value exists but the caller asked for a fresher
 * one.
 */
export enum EnyoVehicleSocUnavailableReasonEnum {
    /** No vehicle with the requested id exists. */
    VehicleNotFound = 'vehicle-not-found',
    /**
     * Nothing in the system can report this vehicle's charge — no integration
     * reads the car and no charge point on site reports one. Permanent until
     * the setup changes, so a consumer should stop asking rather than retry.
     */
    NoSocSource = 'no-soc-source',
    /**
     * A source exists but needs the car connected to read it, and it is not
     * plugged in. Resolves on the next session.
     */
    VehicleNotConnected = 'vehicle-not-connected',
    /**
     * A reading exists but is older than the `maxAgeMs` the request asked for.
     * Ask again without the constraint to take the stale value anyway — the
     * responder does not decide for the caller what is too old.
     */
    ReadingTooOld = 'reading-too-old',
    /**
     * The source could not be reached right now — the vehicle's cloud API is
     * down, the charge point is offline, the integration is still starting.
     * Transient: a later request may succeed.
     */
    TemporarilyUnavailable = 'temporarily-unavailable',
    /**
     * No more specific reason applies. Prefer any of the members above; this
     * exists so a sender never has to omit the field.
     */
    Unknown = 'unknown',
}

/**
 * A state-of-charge reading for a vehicle, together with the age that makes it
 * usable.
 *
 * Returned by `useVehicle().getSoc(id)`. The age is part of the reading and
 * not an optional extra: without it a value cannot be aged out, and a stale
 * percentage is shown to the user as current and planned against as current.
 */
export interface EnyoVehicleSoc {
    /** State of charge of the traction battery in percent (0-100). */
    socPercent: number;
    /**
     * When the reading was taken, ISO 8601 — not when it was stored or read
     * back. Compare it against the present before trusting the value; how old
     * is too old depends on the app, so the SDK does not decide for you.
     */
    measuredAtIso: string;
    /** Total usable capacity of the traction battery in kWh, if the reporting source knew it. */
    batterySizeKwh?: number;
    /**
     * Where the reading came from. Omitted when the host cannot attribute it.
     *
     * Worth surfacing: a user shown a percentage wants to know whether the car
     * said so or enyo worked it out.
     */
    source?: EnyoVehicleSocSourceEnum;
}
