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
 * {@link Complete} is reached ONLY on a stated
 * {@link EnyoDataBusCommandReasonTypeEnum.SessionComplete} — never because
 * {@link EnyoDistributionProgress.percent} hit 100. The two disagree routinely: a meter reading
 * overshoots a target that was revised mid-session, and a session can be finished while the last
 * reading still lags behind it.
 */
export enum EnyoDistributionParticipantStateEnum {
    /** Drawing power in this slot — {@link EnyoEnergyDistributionParticipant.powerW} is positive. */
    Drawing = 'drawing',
    /** Supplying power in this slot (a discharging battery) — `powerW` is negative. */
    Supplying = 'supplying',
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
