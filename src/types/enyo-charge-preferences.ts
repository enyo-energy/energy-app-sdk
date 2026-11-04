import type {EnyoChargeModeEnum, EnyoPriceLimitModeEnum} from "./enyo-data-bus-value.js";

/**
 * The charging preferences a vehicle and a wallbox both carry — the same
 * fields with the same meaning in both places.
 *
 * {@link EnyoVehicle} and {@link EnyoChargerApplianceMetadata} both extend this
 * interface, so the two cannot drift apart. A session resolves each preference
 * from the most specific place that has one: **session → vehicle → wallbox**.
 * The vehicle's preferences follow the car to every wallbox it is plugged into;
 * the wallbox's are the fallback for a car that is not recognised or has none
 * set. There is no house-wide copy in the energy manager settings.
 *
 * Every field is optional, and omitted means "not set here" — the next place
 * in the chain is consulted. Check a value with `validateChargePreferences()`
 * before storing it.
 */
export interface EnyoChargePreferences {
    /**
     * Target state of charge for every session, in percent (0-100).
     *
     * Only enforceable when the car reports its state of charge; on a wallbox
     * this is the target for whichever car is plugged in.
     */
    defaultChargeLimitPercent?: number;
    /**
     * The charge mode applied when a session starts without an explicit one —
     * see {@link EnyoChargeModeEnum} (e.g. immediate, cost-optimized,
     * price-limit).
     */
    defaultChargeMode?: EnyoChargeModeEnum;
    /**
     * How the price ceiling for grid energy is expressed, or omitted for **no
     * ceiling** — a deliberate and common answer ("Preisgrenze: Aus") rather
     * than a missing value. See {@link EnyoPriceLimitModeEnum}.
     *
     * The mode decides which of {@link priceLimitCtPerKwh} and
     * {@link priceLimitSharePercent} is read; the other is ignored. Only
     * applies to sessions in {@link EnyoChargeModeEnum.CostOptimized}, the only
     * mode that imports at all. The source that won is recorded on the charge
     * as {@link EnyoChargePriceLimitSourceEnum}.
     */
    priceLimitMode?: EnyoPriceLimitModeEnum;
    /**
     * Absolute ceiling for grid energy, in **cents per kWh** — `25` means
     * 25 ct/kWh, matching the figure the user types. Divide by 100 before
     * comparing it with the SDK's EUR/kWh price fields such as
     * {@link EnyoDiagnosticsActionReason.electricityPricePerKwh} — a unit
     * mix-up here is off by 100× and plausible-looking on both sides.
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
     * "The day" is the prices *known* at evaluation time, so the resulting
     * threshold moves when tomorrow's prices publish — re-evaluate rather
     * than resolving it once.
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
     * Omitted means no deadline at this level: without one anywhere in the
     * chain, the car charges PV surplus and is never obliged to finish "in
     * time". The source that won is recorded on the charge as
     * {@link EnyoChargeCompleteAtSourceEnum}.
     *
     * Wall-clock rather than an absolute instant: the requirement is "ready
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
