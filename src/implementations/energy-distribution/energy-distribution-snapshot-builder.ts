import {EnyoApplianceTypeEnum} from '../../types/enyo-appliance.js';
import {
    EnyoDataBusCommandReason,
    EnyoDataBusCommandReasonTypeEnum,
} from '../../types/enyo-data-bus-value.js';
import {
    EnyoDistributionParticipantKindEnum,
    EnyoDistributionParticipantStateEnum,
    EnyoDistributionProgress,
    EnyoEnergyDistributionParticipant,
    EnyoEnergyDistributionSnapshot,
} from '../../types/enyo-energy-distribution.js';

/** One appliance row, as the caller states it. `kind` is implied and `rank` is explicit. */
export interface EnergyDistributionApplianceRow {
    /**
     * The order the energy manager served this appliance in, 0 = first.
     *
     * Pass the rank the allocation actually used. Do not re-derive it from a category
     * precedence the builder or the consumer happens to know: the ordering strategy is
     * swappable, and a second copy of the rule disagrees silently the day it is swapped.
     */
    rank: number;
    /** The appliance this row speaks for. */
    applianceId: string;
    /** The appliance's category. */
    applianceType: EnyoApplianceTypeEnum;
    /** What the owner calls it. */
    name: string;
    /** What it is doing in the current slot. */
    state: EnyoDistributionParticipantStateEnum;
    /** Signed power in this slot (W): positive = drawing, negative = supplying. */
    powerW: number;
    /** Why it is in that state — enriched with its end-user translation before it gets here. */
    reason: EnyoDataBusCommandReason;
    /**
     * How far toward its own goal it is. Leave it out where there is no goal — a charger with
     * no car, a pump that wants no heat. Absent means "no bar", which is an answer.
     */
    progress?: EnyoDistributionProgress;
    /**
     * When the plan next gives this appliance power (ISO 8601). State it on every row that is
     * waiting: it is what makes the "wartet · ab 11:05" subline and the card's "Als Nächstes"
     * header exact instead of replayed from a command forecast. Absent means not planned
     * again today.
     */
    plannedStartIso?: string;
    /** The {@link rank} of the participant this one is queued behind ("wartet auf Speicher"). */
    waitingForRank?: number;
    /**
     * When a released offer expires (ISO 8601). Only on
     * {@link EnyoDistributionParticipantStateEnum.Offered} rows — the builder rejects it
     * anywhere else rather than letting an offer nobody made reach a consumer.
     */
    offerEndsAtIso?: string;
    /** Of {@link powerW}, how much is locally generated (W) — the "Sonne" half of the split. */
    pvPowerW?: number;
    /** Of {@link powerW}, how much is imported (W) — the "Netz" half of the split. */
    gridPowerW?: number;
}

/** A row for something measured rather than planned: household draw, feed-in, grid import. */
export interface EnergyDistributionMeasuredRow {
    /** Signed power (W): positive = drawing from the site, negative = leaving it. */
    powerW: number;
    /** What the owner calls it — "Haushalt", "Einspeisung". */
    name: string;
    /**
     * The order this row is rendered in. Defaults to the next rank after everything added so
     * far, which puts the measured rows below the planned ones — where the card shows them.
     */
    rank?: number;
    /**
     * Why, when there is something to say. Defaults to
     * {@link EnyoDataBusCommandReasonTypeEnum.SelfConsumptionOptimization} for household draw
     * and feed-in alike: neither is a decision the energy manager took.
     */
    reason?: EnyoDataBusCommandReason;
    /**
     * When the plan next expects this row to have power flowing (ISO 8601) — a feed-in row
     * that expects to export from 17:40 states it here.
     *
     * This is why the field lives on the participant rather than on an appliance forecast:
     * household, feed-in and grid-import rows have no forecast to replay, so without it their
     * tracks stay empty.
     */
    plannedStartIso?: string;
}

/** When the snapshot describes. */
export interface EnergyDistributionSnapshotStamp {
    /** Start of the slot the figures belong to (epoch ms). */
    slotStartMs: number;
    /** When the snapshot was assembled (epoch ms). Defaults to now. */
    nowMs?: number;
}

/**
 * Assembles an {@link EnyoEnergyDistributionSnapshot} row by row.
 *
 * Exists so every energy manager does not re-implement the same three rules and get one of them
 * subtly wrong: the rows come out ordered by stated rank, the measured rows can never carry a
 * goal they do not have, and the timestamps are stamped once at {@link build}.
 *
 * The builder deliberately does NOT invent anything. It will not rank rows for you, will not
 * translate a reason, and will not decide that a full bar means a finished run — each of those
 * belongs to whoever owns the fact. What it does own is the shape.
 *
 * A builder is single-use per snapshot: {@link build} returns the snapshot and the instance may
 * be discarded.
 *
 * @example
 * ```typescript
 * const snapshot = new EnergyDistributionSnapshotBuilder()
 *     .addAppliance({
 *         rank: 0,
 *         applianceId: 'charger-1',
 *         applianceType: EnyoApplianceTypeEnum.Charger,
 *         name: 'Wallbox Garage',
 *         state: EnyoDistributionParticipantStateEnum.Drawing,
 *         powerW: 7400,
 *         reason: chargerReason,
 *         progress: makeProgress({
 *             unit: EnyoDistributionProgressUnitEnum.Energy,
 *             current: 8400,
 *             target: 22000,
 *         }),
 *     })
 *     .addAppliance({
 *         rank: 1,
 *         applianceId: 'battery-1',
 *         applianceType: EnyoApplianceTypeEnum.Storage,
 *         name: 'Hausbatterie',
 *         state: EnyoDistributionParticipantStateEnum.Supplying,
 *         powerW: -1200,
 *         reason: batteryReason,
 *         progress: makeProgress({
 *             unit: EnyoDistributionProgressUnitEnum.StateOfCharge,
 *             start: 52,
 *             current: 58,
 *             target: 70,
 *         }),
 *     })
 *     .addHousehold({powerW: 620, name: 'Haushalt'})
 *     .build({slotStartMs: slotStart});
 * ```
 */
export class EnergyDistributionSnapshotBuilder {
    /** The rows added so far, in call order; {@link build} sorts them by rank. */
    private readonly participants: EnyoEnergyDistributionParticipant[] = [];

    /**
     * Adds a planned appliance row.
     *
     * Add a row for every appliance the energy manager knows about, including the ones that
     * asked for nothing this slot — with
     * {@link EnyoDistributionParticipantStateEnum.NotAsking} or
     * {@link EnyoDistributionParticipantStateEnum.Skipped} and a reason that says why. A row
     * that is simply left out reads, to an owner, as an appliance that stopped existing.
     *
     * @param row - The appliance's rank, identity, state, power, reason and optional progress,
     *   planned start, dependency, offer expiry and PV / grid split.
     * @returns This builder, for chaining.
     * @throws {RangeError} When `offerEndsAtIso` is given for a row that is not
     *   {@link EnyoDistributionParticipantStateEnum.Offered}.
     */
    addAppliance(row: EnergyDistributionApplianceRow): this {
        const participant: EnyoEnergyDistributionParticipant = {
            kind: EnyoDistributionParticipantKindEnum.Appliance,
            rank: row.rank,
            applianceId: row.applianceId,
            applianceType: row.applianceType,
            name: row.name,
            state: row.state,
            powerW: row.powerW,
            reason: row.reason,
        };
        if (row.progress !== undefined) participant.progress = row.progress;
        if (row.plannedStartIso !== undefined) participant.plannedStartIso = row.plannedStartIso;
        if (row.waitingForRank !== undefined) participant.waitingForRank = row.waitingForRank;
        if (row.offerEndsAtIso !== undefined) {
            if (row.state !== EnyoDistributionParticipantStateEnum.Offered) {
                throw new RangeError(
                    `offerEndsAtIso was given for '${row.name}' but its state is '${row.state}'; only an '${EnyoDistributionParticipantStateEnum.Offered}' row has an offer to expire.`,
                );
            }
            participant.offerEndsAtIso = row.offerEndsAtIso;
        }
        if (row.pvPowerW !== undefined) participant.pvPowerW = row.pvPowerW;
        if (row.gridPowerW !== undefined) participant.gridPowerW = row.gridPowerW;
        this.participants.push(participant);
        return this;
    }

    /**
     * Adds the household row — everything the house draws that the energy manager does not
     * steer. Measured, never planned, so it carries no progress bar.
     *
     * @param row - Power, name, and optionally an explicit rank, reason and planned start.
     * @returns This builder, for chaining.
     */
    addHousehold(row: EnergyDistributionMeasuredRow): this {
        return this.addMeasured(EnyoDistributionParticipantKindEnum.Household, row);
    }

    /**
     * Adds the feed-in row — power leaving the site. The residual of the balance rather than a
     * goal anyone is working toward, so it carries no progress bar.
     *
     * @param row - Power (negative when exporting), name, and optionally rank, reason and
     *   planned start — a feed-in row that expects to export from 17:40 states it.
     * @returns This builder, for chaining.
     */
    addFeedIn(row: EnergyDistributionMeasuredRow): this {
        return this.addMeasured(EnyoDistributionParticipantKindEnum.FeedIn, row);
    }

    /**
     * Adds the grid-import row — power bought to cover what the site could not supply itself.
     * Measured, so it carries no progress bar.
     *
     * @param row - Power, name, and optionally rank, reason and planned start.
     * @returns This builder, for chaining.
     */
    addGridImport(row: EnergyDistributionMeasuredRow): this {
        return this.addMeasured(EnyoDistributionParticipantKindEnum.GridImport, row);
    }

    /**
     * Produces the snapshot: rows ordered by stated rank, timestamps stamped.
     *
     * Rows with an equal rank keep the order they were added in, so a caller that ranks only its
     * appliances still gets a stable result. The snapshot is not validated here — publishing it
     * through `useEnergyManager().publishEnergyDistribution()` does that, and
     * {@link validateEnergyDistributionSnapshot} can be called directly in a test.
     *
     * @param stamp - The slot this describes, and optionally when it was assembled.
     * @returns The finished snapshot.
     */
    build(stamp: EnergyDistributionSnapshotStamp): EnyoEnergyDistributionSnapshot {
        const participants = [...this.participants].sort((a, b) => a.rank - b.rank);
        return {
            generatedAtIso: new Date(stamp.nowMs ?? Date.now()).toISOString(),
            slotStartIso: new Date(stamp.slotStartMs).toISOString(),
            participants,
        };
    }

    /**
     * Shared implementation of the measured rows: no appliance identity, and structurally no
     * progress — the "household has no bar" rule lives here rather than in every caller's head.
     *
     * @param kind - Which measured row this is.
     * @param row - Power, name, and optionally rank and reason.
     * @returns This builder, for chaining.
     */
    private addMeasured(
        kind: EnyoDistributionParticipantKindEnum,
        row: EnergyDistributionMeasuredRow,
    ): this {
        const participant: EnyoEnergyDistributionParticipant = {
            kind,
            rank: row.rank ?? this.participants.length,
            name: row.name,
            state: row.powerW < 0
                ? EnyoDistributionParticipantStateEnum.Supplying
                : EnyoDistributionParticipantStateEnum.Drawing,
            powerW: row.powerW,
            reason: row.reason ?? {
                type: EnyoDataBusCommandReasonTypeEnum.SelfConsumptionOptimization,
            },
        };
        if (row.plannedStartIso !== undefined) participant.plannedStartIso = row.plannedStartIso;
        this.participants.push(participant);
        return this;
    }
}
