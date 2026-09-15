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
}
