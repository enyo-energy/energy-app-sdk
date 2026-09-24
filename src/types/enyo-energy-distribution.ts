// The energy-distribution snapshot: who is being served right now, in what order, how far
// along each one is toward its OWN goal, and why. The data behind the cockpit's "wer bekommt
// gerade Strom" card.
//
// The central rule of this model: every number here is STATED by whoever owns it and carried
// through verbatim. A consumer never re-derives a rank from a tie-break rule it happens to know,
// never reads "done" off a progress bar, and never reconstructs a goal from a remaining-energy
// figure that shrinks each cycle. Each of those has told an owner something untrue in the past.

import {EnyoApplianceTypeEnum} from "./enyo-appliance.js";
import {EnyoDataBusCommandReason} from "./enyo-data-bus-value.js";

/**
 * The unit a participant's progress is measured in — what the bar counts up in.
 *
 * Each unit implies where the pair of numbers comes from: energy from the session meter,
 * state of charge from the pack, temperature from the store's sensor and its target.
 */
export enum EnyoDistributionProgressUnitEnum {
    /** Watt-hours delivered toward watt-hours planned (a charging session). */
    Energy = 'energy',
    /** Percent now toward percent target (a battery, or a car reporting its SoC). */
    StateOfCharge = 'state-of-charge',
    /** Degrees Celsius now toward the target temperature (a tank, a buffer, a room). */
    Temperature = 'temperature',
}

/**
 * What kind of row this is. Only {@link Appliance} rows are planned participants with a goal;
 * the rest are measured facts about the site that the card shows alongside them.
 */
export enum EnyoDistributionParticipantKindEnum {
    /** A controllable appliance the energy manager allocated for. */
    Appliance = 'appliance',
    /** Everything else the house is drawing — measured, never planned, so never a goal. */
    Household = 'household',
    /** Power leaving the site. The residual of the balance, so never a goal. */
    FeedIn = 'feed-in',
    /** Power bought from the grid to cover what the site could not. Never a goal. */
    GridImport = 'grid-import',
}

/**
 * What a participant is doing in the current slot.
 *
 * The three "drawing" cases are deliberately separate states rather than a state plus flags:
 * {@link Drawing} follows the allocation, {@link DrawingOutsidePlan} ignores it, and
 * {@link Offered} has been allowed to draw and has not started. A row can only be in one of
 * them, which is what makes the set renderable without a second rule.
 *
 * {@link Complete} is reached ONLY on a stated
 * {@link EnyoDataBusCommandReasonTypeEnum.SessionComplete} — never because
 * {@link EnyoDistributionProgress.percent} hit 100. The two disagree routinely: a meter reading
 * overshoots a target that was revised mid-session, and a session can be finished while the last
 * reading still lags behind it.
 */
export enum EnyoDistributionParticipantStateEnum {
    /** Drawing power in this slot — {@link EnyoEnergyDistributionParticipant.powerW} is positive. */
    Drawing = 'drawing',
    /**
     * Drawing power the plan did not allocate to it — the appliance decided on its own (a
     * defrost cycle, a manual start, its own comfort logic). The manager re-plans around it;
     * the other participants get less until it stops.
     *
     * STATED, and mutually exclusive with {@link Drawing}: a row is either following the
     * allocation or it is not. A consumer must not derive this by comparing measured power
     * against a command forecast — an appliance whose app publishes no forecast could then
     * never be shown as off-plan, and a forecast one cycle stale would paint a perfectly
     * planned run as a deviation. Only the manager knows which draw it allocated.
     */
    DrawingOutsidePlan = 'drawing-outside-plan',
    /** Supplying power in this slot (a discharging battery) — `powerW` is negative. */
    Supplying = 'supplying',
    /**
     * Power was released for it to use at its own discretion, and it is not using it (yet).
     *
     * A good state, not a warning: the manager made power available and left the timing to the
     * appliance ("freigegeben — sie entscheidet selbst, wann"). Distinct from
     * {@link NotAsking}, which is a participant with nothing to ask for, and from
     * {@link Skipped}, which asked and did not get it. `powerW` is `0` — the offer is not a
     * draw; {@link EnyoEnergyDistributionParticipant.offerEndsAtIso} says how long it stands.
     */
    Offered = 'offered',
    /** Asked for power and did not get it this slot; `reason` says who or what took it. */
    Skipped = 'skipped',
    /** Did not ask at all — no car on the cable, outside its schedule, no heat wanted. */
    NotAsking = 'not-asking',
    /** The goal is reached and the run is over. */
    Complete = 'complete',
}

/**
 * How far a participant is toward its own goal, in the unit the owner sees.
 *
 * The pair is stated by whoever owns the goal — the appliance manager — because the energy
 * manager's own figures cannot express it: an announcement states what is STILL NEEDED, and that
 * shrinks every cycle as the appliance fills. A required energy falling from 20 kWh to 2 kWh
 * looks exactly like a target that was always 2 kWh, so progress derived from it reads as a flat
 * bar for a session that is in fact nearly done.
 *
 * Build one with `makeProgress()` rather than by hand, so {@link percent} is computed the same
 * way everywhere.
 */
export interface EnyoDistributionProgress {
    /** The unit {@link start}, {@link current} and {@link target} are all expressed in. */
    unit: EnyoDistributionProgressUnitEnum;
    /**
     * Where the run began — the bar's zero.
     *
     * Absent means zero, which is right for an energy bar and wrong for every other unit: a tank
     * at 20 °C heading for 48 °C has done nothing yet, but `current / target` would draw it 42 %
     * full. State it wherever a run starts from something other than nothing.
     */
    start?: number;
    /** Where the participant stands now, measured. */
    current: number;
    /** The goal the plan is driving it to. Must differ from {@link start}. */
    target: number;
    /**
     * How full the bar is, 0–100, clamped — `(current − start) / (target − start)`.
     *
     * Carried rather than left to the consumer so that the cockpit, the app and a third-party
     * display cannot disagree with each other by a rounding or clamping rule.
     */
    percent: number;
    /**
     * When the plan expects {@link target} to be reached (ISO 8601).
     *
     * STATED, because it is the planner's own arithmetic: it follows from the power the plan
     * intends to give this participant over the coming slots, which no consumer holds. The
     * remaining distance to the target can be subtracted from the triple above; the *time*
     * cannot.
     *
     * Absent means the plan does not say when — a consumer then shows the remainder without a
     * time, rather than guessing one from the current power.
     */
    targetReachedAtIso?: string;
}

/**
 * One row of the distribution snapshot: a participant, what it is doing, why, and how far along
 * it is.
 */
export interface EnyoEnergyDistributionParticipant {
    /** Which kind of row this is — only {@link EnyoDistributionParticipantKindEnum.Appliance} has a goal. */
    kind: EnyoDistributionParticipantKindEnum;
    /**
     * The order the energy manager served this participant in, 0 = first served.
     *
     * STATED by the component that did the ordering. A consumer must not sort by category
     * precedence of its own: the ordering strategy is swappable (fixed category order today,
     * urgency tomorrow), and a second copy of the rule disagrees silently the day it changes.
     * Rows that are not planned participants (household, feed-in) still carry a rank so the card
     * has one unambiguous order to render.
     */
    rank: number;
    /** The appliance this row speaks for; absent on household / feed-in / grid rows. */
    applianceId?: string;
    /** The appliance's category; absent on household / feed-in / grid rows. */
    applianceType?: EnyoApplianceTypeEnum;
    /** What the owner calls this row — the appliance's name, or "Haushalt" / "Einspeisung". */
    name: string;
    /** What this participant is doing in the current slot. */
    state: EnyoDistributionParticipantStateEnum;
    /**
     * Signed power in this slot (W): positive = drawing, negative = supplying.
     *
     * One field rather than two so a row can never claim both at once — the plan decides one
     * direction per slot.
     */
    powerW: number;
    /**
     * Why this row is in the state it is, ready to render: the coarse type, plus the per-language
     * end-user sentence in {@link EnyoDataBusCommandReason.translation}.
     *
     * Enrich it before publishing. A reason that arrives with only a `type` leaves every consumer
     * to invent its own wording, and they will not match.
     */
    reason: EnyoDataBusCommandReason;
    /**
     * How far toward its goal this participant is.
     *
     * ABSENT MEANS NO BAR, and that is a real answer, not missing data: household draw is
     * measured rather than planned, feed-in is the residual, and a charger with no car has no
     * goal to be part-way through.
     */
    progress?: EnyoDistributionProgress;
    /**
     * When the plan next gives this participant power (ISO 8601).
     *
     * STATED, and the single most load-bearing optional field on this row: it makes every
     * "wartet · ab 11:05" subline — and the card's "Als Nächstes" header, which is simply the
     * earliest `plannedStartIso` among the rows that are not running — correct without a
     * consumer holding a second stream of command forecasts and replaying a relative schedule
     * against the timestamp it was published at.
     *
     * Absent means the plan does not give it power again today, which is what a consumer then
     * says. It is phrased on the participant rather than on the appliance forecast on purpose:
     * rows that are not appliances have no forecast at all, and a {@link
     * EnyoDistributionParticipantKindEnum.FeedIn} row that expects to export from 17:40 states
     * it here.
     *
     * Must not be before {@link EnyoEnergyDistributionSnapshot.slotStartIso} — it is the *next*
     * start, not a past one.
     */
    plannedStartIso?: string;
    /**
     * The participant this one is queued behind — its {@link rank}.
     *
     * Lets a consumer draw the dependency ("wartet auf Speicher") without parsing it out of the
     * reason sentence. Must name the rank of another row in the same snapshot, never this row's
     * own.
     */
    waitingForRank?: number;
    /**
     * When the offer expires (ISO 8601). Only on
     * {@link EnyoDistributionParticipantStateEnum.Offered} rows.
     *
     * Absent on an `Offered` row means the offer stands with no stated end — the consumer shows
     * the release without a countdown rather than inventing one.
     */
    offerEndsAtIso?: string;
    /**
     * Of {@link powerW}, how much is locally generated (W) — the "4,8 kW Sonne" half of the
     * split under a row.
     *
     * STATED per row, because the snapshot's totals cannot be solved for it: with one signed
     * `powerW` per participant and a single site-level {@link
     * EnyoDistributionParticipantKindEnum.GridImport} row, two appliances drawing while the
     * site imports have no recoverable split.
     *
     * A magnitude, so never negative, and only meaningful on a row that is drawing. When both
     * halves are stated they add up to {@link powerW}; stating only one leaves the other
     * unknown rather than zero.
     */
    pvPowerW?: number;
    /**
     * Of {@link powerW}, how much is imported from the grid (W) — the "6,2 kW Netz" half of the
     * split. See {@link pvPowerW} for why it is stated rather than derived.
     */
    gridPowerW?: number;
}

/**
 * The whole picture for one slot: every participant, in served order.
 *
 * Published by the energy manager once per allocation cycle (and on the slot boundary) with
 * `publishEnergyDistribution()`; read by consumers with `getEnergyDistribution()` /
 * `listenForEnergyDistribution()`.
 */
export interface EnyoEnergyDistributionSnapshot {
    /** When this snapshot was assembled (ISO 8601). */
    generatedAtIso: string;
    /** The start of the slot it describes (ISO 8601) — what "right now" means for these figures. */
    slotStartIso: string;
    /**
     * The participants, ordered by {@link EnyoEnergyDistributionParticipant.rank}.
     *
     * Complete for the slot: an appliance that asked for nothing is present with
     * {@link EnyoDistributionParticipantStateEnum.NotAsking} and a reason, rather than being left
     * out. A row that simply vanishes reads, to an owner, as an appliance that stopped existing.
     */
    participants: EnyoEnergyDistributionParticipant[];
}
