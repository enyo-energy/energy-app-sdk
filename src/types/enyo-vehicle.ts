import type {EnyoSubscriptionBilling} from "./enyo-subscription.js";
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
    /**
     * Lowest charging current, in Amperes per phase, the car accepts — e.g.
     * `6` (the IEC 61851 minimum) or higher for cars that drop out of a
     * session below a certain current.
     *
     * The EMS must not issue a non-zero current limit below it; a session is
     * held at the higher of this value and the wallbox's
     * {@link EnyoChargerApplianceMetadata.minChargingCurrentAmpere}. Omit when
     * the car has no minimum beyond the wallbox's.
     */
    minChargingCurrentAmpere?: number;
    /**
     * Whether a charging session of this car must not be paused once it has
     * started — some cars stop responding or end the session when charging
     * is paused and do not resume on their own.
     *
     * When `true`, the EMS must not pause the session (setpoint `0`) but hold
     * it at least at its minimum current until it is complete. Applies if
     * either this or the wallbox's
     * {@link EnyoChargerApplianceMetadata.cannotBePaused} is `true`. Omitted
     * means `false`.
     * The command holding the session states
     * {@link EnyoDataBusCommandReasonTypeEnum.CannotBePaused}.
     *
     * @default false
     */
    cannotBePaused?: boolean;
    /**
     * Whether the EMS must not switch phases (1 ↔ 3) while this car charges —
     * some cars abort the session or fault on a phase switch.
     *
     * When `true`, a session stays in the phase configuration it started in.
     * Applies if either this or the wallbox's
     * {@link EnyoChargerApplianceMetadata.phaseSwitchDisabled} is `true`.
     * Omitted means `false`.
     *
     * @default false
     */
    phaseSwitchDisabled?: boolean;

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

/**
 * Why a vehicle could not be paired with a car-integration app.
 *
 * Carried by an {@link EnyoVehiclePairResult} whose `paired` is `false`. The
 * members are deliberately separate so the enyo app can tell the user what to
 * do instead of "pairing failed": {@link NotAuthenticated} sends them to a sign
 * in, {@link SelectionRequired} opens a picker, and
 * {@link TemporarilyUnavailable} is the only one worth retrying unchanged.
 */
export enum EnyoVehiclePairFailureReasonEnum {
    /**
     * The package has no usable session with the vendor's cloud — the user has
     * not signed in yet, or the stored token expired and could not be
     * refreshed. Resolve it through {@link EnergyAppAuthentication}, then pair
     * again.
     */
    NotAuthenticated = 'not-authenticated',
    /**
     * The signed-in account holds more than one car and the handler cannot tell
     * which one the user meant. The result carries
     * {@link EnyoVehiclePairResult.candidates}; the host asks the user to pick
     * and calls the handler again with an {@link EnyoVehiclePairSelection}.
     *
     * Not a failure in the usual sense — the pairing is paused for a question,
     * not abandoned.
     */
    SelectionRequired = 'selection-required',
    /**
     * The account is reachable and unambiguous, but holds no car matching the
     * vehicle the user picked. Typically the wrong vendor account, or a car
     * that was sold.
     */
    NoMatchingVehicle = 'no-matching-vehicle',
    /**
     * The car exists in the account but this package cannot work with it — an
     * unsupported model line, or a car whose vendor subscription does not
     * include remote data.
     */
    VehicleNotSupported = 'vehicle-not-supported',
    /**
     * The car is already paired with a different {@link EnyoVehicle}. Unpair
     * the other one first; a single car reporting into two vehicle records
     * gives the user two half-correct charge histories.
     */
    AlreadyPaired = 'already-paired',
    /**
     * The vendor's cloud could not be reached, rate-limited the request, or the
     * package is still starting up. Transient: pairing again later may succeed.
     */
    TemporarilyUnavailable = 'temporarily-unavailable',
    /**
     * No more specific reason applies. Prefer any of the members above; this
     * exists so a handler never has to omit the field.
     */
    Unknown = 'unknown',
}

/**
 * One car from the vendor account that could be the one the user meant.
 *
 * Offered by a handler that found several and cannot choose — see
 * {@link EnyoVehiclePairFailureReasonEnum.SelectionRequired}. The fields exist
 * to let a user recognise their own car in a list, so fill in whatever the
 * vendor API gives you rather than the bare minimum.
 */
export interface EnyoVehiclePairCandidate {
    /**
     * The package's own stable identifier for this car — typically the vendor
     * account's vehicle id. Echoed back in {@link EnyoVehiclePairSelection}
     * once the user has picked.
     */
    externalId: string;
    /** What to show the user, e.g. `"Model Y (weiß)"`. */
    displayName: string;
    /** Vehicle identification number, when the vendor API exposes one. */
    vin?: string;
    /** Manufacturer as the vendor reports it, e.g. `"Tesla"`. */
    manufacturer?: string;
    /** Model line as the vendor reports it, e.g. `"Model Y Long Range"`. */
    model?: string;
}

/**
 * The user's answer to a {@link EnyoVehiclePairFailureReasonEnum.SelectionRequired}.
 *
 * Passed as the second argument to {@link EnyoVehiclePairHandler} on the second
 * call. Absent on the first call — a handler serving single-car accounts can
 * ignore the parameter entirely.
 */
export interface EnyoVehiclePairSelection {
    /**
     * The {@link EnyoVehiclePairCandidate.externalId} the user picked. Always
     * one the handler itself offered.
     */
    externalId: string;
}

/**
 * What the user chose in the enyo app before the host asked the package to
 * pair a vehicle.
 *
 * Passed as the third argument to {@link EnyoVehiclePairHandler}, on the first
 * and on the second call alike.
 */
export interface EnyoVehiclePairContext {
    /**
     * The vendor (brand) the user selected for the car, e.g. `"BMW"`. Matches
     * the `vendorName` of one of the package's declared `compatibility`
     * vendors. A package serving several brands through one cloud — an
     * aggregator — uses it to pick the right vendor API or account.
     *
     * Absent when the user selected no vendor, for example with a package that
     * declares only one.
     */
    vendorName?: string;
    /**
     * The model the user selected for the car, e.g. `"ID.3"`. Matches a
     * `modelName` of the selected vendor's declared `compatibility` models.
     *
     * Absent when the user selected no model — always the case for a vendor
     * the package declares without models.
     */
    modelName?: string;
    /**
     * The model year the user selected for the car, e.g. `2022`. Lies within
     * the `modelYears` of the selected `compatibility` model when that model
     * declares a range.
     *
     * Absent when the user selected no year.
     */
    modelYear?: number;
}

/**
 * Why a package unlinks a car itself through `useVehicle().unpairVehicle()`.
 *
 * Unlike {@link EnyoVehicleUnpairReasonEnum}, which says why the host tore a
 * link down, this one comes from the package. The host uses it to decide how
 * the removal is billed when the car is a billed unit of a subscription plan
 * ({@link EnyoVehiclePairResult.billing}).
 */
export enum EnyoVehiclePackageUnpairReasonEnum {
    /**
     * The car is no longer in the vendor account — sold, or removed by the
     * user in the vendor's own app. Use it only when the vendor API confirms
     * the car is gone, not after a failed request. Billed like a car the user
     * unlinked: the quantity drops at the next renewal.
     */
    VehicleNotFound = 'vehicle-not-found',
    /**
     * The vendor revoked the package's access to the car — the user withdrew
     * consent, or the vendor's own subscription for remote access lapsed.
     * Usually granted again, so billing stays unchanged.
     */
    AccessRevoked = 'access-revoked',
    /** No more specific reason applies. Billing stays unchanged. */
    Unknown = 'unknown',
}

/**
 * What a car-integration app answers when asked to pair a vehicle.
 *
 * The attribute fields are not decoration: the vendor's cloud usually knows the
 * car's battery size and charging limits better than the user does, and the
 * host may use them to fill in an {@link EnyoVehicle} the user left sparse.
 * Only send a value you actually read — an invented `batterySizeKwh` is planned
 * against as if it were measured.
 */
export interface EnyoVehiclePairResult {
    /**
     * Whether the car is now paired. `true` requires {@link externalId};
     * `false` should carry a {@link failureReason}.
     */
    paired: boolean;
    /**
     * The package's own stable identifier for the paired car — the vendor
     * account's vehicle id rather than the VIN, because not every vendor API
     * exposes a VIN and a link must survive losing one field.
     *
     * Required when {@link paired} is `true`. It is what
     * {@link EnyoLinkedVehicle.externalId} carries from then on.
     */
    externalId?: string;
    /** Vehicle identification number, when the vendor API exposes one. */
    vin?: string;
    /**
     * What the package calls the car. Shown to the user to confirm the right
     * one was found — "wir haben *Model Y (weiß)* verbunden".
     */
    displayName?: string;
    /** Manufacturer as read from the vendor, e.g. `"Tesla"`. */
    manufacturer?: string;
    /** Model line as read from the vendor, e.g. `"Model Y Long Range"`. */
    model?: string;
    /** Usable traction battery capacity in kWh, as read from the vendor. */
    batterySizeKwh?: number;
    /** The highest charging power the car accepts, in kW, as read from the vendor. */
    maxChargingPowerKw?: number;
    /** How many phases the car charges over — typically `1` or `3`. */
    numberOfPhases?: number;
    /**
     * Marks the paired car as a billed unit of one of the package's
     * `per-unit` subscription plans. The host keeps the plan's units in step
     * with the link — added on pairing, removed on unpairing — and reports the
     * unit with the enyo vehicle id. Ignored when {@link paired} is `false`.
     * Omit when the car is not billed.
     */
    billing?: EnyoSubscriptionBilling;
    /**
     * Why pairing did not happen. Set whenever {@link paired} is `false`;
     * omitting it leaves the enyo app with nothing to tell the user.
     */
    failureReason?: EnyoVehiclePairFailureReasonEnum;
    /**
     * The cars the user could have meant, when {@link failureReason} is
     * {@link EnyoVehiclePairFailureReasonEnum.SelectionRequired}. Ignored for
     * every other reason.
     */
    candidates?: EnyoVehiclePairCandidate[];
}

/**
 * A live link between an {@link EnyoVehicle} and a car in the package's vendor
 * account.
 *
 * Returned by `useVehicle().listLinkedVehicles()`, which is how a package that
 * has just restarted learns which cars it is responsible for.
 */
export interface EnyoLinkedVehicle {
    /** The {@link EnyoVehicle.id} this link points at. */
    vehicleId: string;
    /**
     * The package's own identifier for the car, as returned in
     * {@link EnyoVehiclePairResult.externalId}.
     */
    externalId: string;
    /** Vehicle identification number, when one was reported at pairing. */
    vin?: string;
    /** What the package called the car at pairing time. */
    displayName?: string;
    /** The billing mark set at pairing ({@link EnyoVehiclePairResult.billing}), if any. */
    billing?: EnyoSubscriptionBilling;
    /** The vendor the user selected at pairing ({@link EnyoVehiclePairContext.vendorName}), if any. */
    vendorName?: string;
    /** When the link was established, ISO 8601. */
    pairedAtIso: string;
}

/**
 * Why a link is being torn down.
 *
 * A handler usually does the same thing regardless — stop polling, drop cached
 * state — but the reason decides whether the vendor session is still usable:
 * on {@link SignOut} it is already gone, on {@link UserRequest} it is not.
 */
export enum EnyoVehicleUnpairReasonEnum {
    /** The user unlinked this one car in the enyo app. Other links survive. */
    UserRequest = 'user-request',
    /**
     * The user signed out of the vendor account. Every link this package holds
     * is being torn down, one call per link, and the session is gone — do not
     * try to tell the vendor's cloud anything.
     */
    SignOut = 'sign-out',
    /** The {@link EnyoVehicle} itself was deleted in the enyo app. */
    VehicleDeleted = 'vehicle-deleted',
    /** No more specific reason applies. */
    Unknown = 'unknown',
}

/**
 * The handler the host calls when the user links one of their vehicles to this
 * package.
 *
 * Called with the {@link EnyoVehicle} the user picked — the handler's job is to
 * find the matching car in the vendor account it is signed into and answer with
 * an {@link EnyoVehiclePairResult}.
 *
 * `context` carries what the user chose before pairing — the vendor they
 * selected — and is passed on both calls.
 *
 * On the first call `selection` is absent. A handler whose account holds
 * several cars answers
 * {@link EnyoVehiclePairFailureReasonEnum.SelectionRequired} with
 * {@link EnyoVehiclePairResult.candidates}; the host asks the user and calls
 * the handler a second time with their pick.
 *
 * Someone is waiting on a screen — answer promptly, and prefer
 * {@link EnyoVehiclePairFailureReasonEnum.TemporarilyUnavailable} over blocking
 * on a slow vendor API.
 */
export type EnyoVehiclePairHandler = (
    vehicle: EnyoVehicle,
    selection?: EnyoVehiclePairSelection,
    context?: EnyoVehiclePairContext
) => Promise<EnyoVehiclePairResult>;

/**
 * The handler the host calls when a link is torn down from the outside — the
 * user unlinking one car, or signing out of the vendor account.
 *
 * Stop polling the car and drop any cached state for it. The link is already
 * gone by the time the handler runs, so this is a notification rather than a
 * veto: rejecting the promise does not keep the link alive, it only tells the
 * host the cleanup failed.
 *
 * **Not called for an unpair the package itself requested** through
 * `useVehicle().unpairVehicle()` — the package already knows, and calling back
 * into it would invite a loop.
 *
 * When the link was marked as billed ({@link EnyoLinkedVehicle.billing}), the
 * host has already removed the vehicle from the plan's units — only stop
 * serving it.
 */
export type EnyoVehicleUnpairHandler = (
    link: EnyoLinkedVehicle,
    reason: EnyoVehicleUnpairReasonEnum
) => Promise<void>;
