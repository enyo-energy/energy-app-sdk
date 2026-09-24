import {describe, expect, it} from 'vitest';

import {EnyoApplianceTypeEnum} from '../../../types/enyo-appliance.js';
import {EnyoDataBusCommandReasonTypeEnum} from '../../../types/enyo-data-bus-value.js';
import {
    EnyoDistributionParticipantStateEnum,
    EnyoDistributionProgressUnitEnum,
} from '../../../types/enyo-energy-distribution.js';
import {makeProgress, progressPercent} from '../energy-distribution-progress.js';
import {EnergyDistributionSnapshotBuilder} from '../energy-distribution-snapshot-builder.js';
import {
    EnergyDistributionValidationError,
    validateEnergyDistributionSnapshot,
} from '../energy-distribution-validators.js';

const SLOT_START_MS = Date.parse('2026-09-20T10:00:00.000Z');
const NOW_MS = Date.parse('2026-09-20T10:03:00.000Z');

/** A charging session that has delivered `deliveredWh` of a `requiredWh` target. */
const chargerRow = (deliveredWh: number, requiredWh: number) => ({
    rank: 0,
    applianceId: 'charger-1',
    applianceType: EnyoApplianceTypeEnum.Charger,
    name: 'Wallbox Garage',
    state: EnyoDistributionParticipantStateEnum.Drawing,
    powerW: 7400,
    reason: {type: EnyoDataBusCommandReasonTypeEnum.PvSurplusAvailable},
    progress: makeProgress({
        unit: EnyoDistributionProgressUnitEnum.Energy,
        current: deliveredWh,
        target: requiredWh,
    }),
});

describe('makeProgress', () => {
    it('measures the journey from start, not the absolute ratio', () => {
        const tank = makeProgress({
            unit: EnyoDistributionProgressUnitEnum.Temperature,
            start: 20,
            current: 31,
            target: 48,
        });
        // 11 K of the 28 K the run has to cover — not 31/48.
        expect(tank.percent).toBe(39.3);
    });

    it('treats an absent start as zero, which is what an energy target wants', () => {
        expect(makeProgress({
            unit: EnyoDistributionProgressUnitEnum.Energy,
            current: 8400,
            target: 22000,
        }).percent).toBe(38.2);
    });

    it('clamps an overshoot to 100 rather than reporting 104 %', () => {
        expect(progressPercent({
            unit: EnyoDistributionProgressUnitEnum.Energy,
            current: 23000,
            target: 22000,
        })).toBe(100);
    });

    it('clamps below the start to 0 — a cooling tank is at the beginning, not behind it', () => {
        expect(progressPercent({
            unit: EnyoDistributionProgressUnitEnum.Temperature,
            start: 20,
            current: 18,
            target: 48,
        })).toBe(0);
    });

    it('refuses a goal with no distance to travel', () => {
        expect(() => makeProgress({
            unit: EnyoDistributionProgressUnitEnum.StateOfCharge,
            start: 70,
            current: 70,
            target: 70,
        })).toThrow(RangeError);
    });
});

describe('a shrinking remaining energy', () => {
    it('produces a rising bar, because the goal is stated rather than derived', () => {
        // The announcement's remaining energy falls 22 kWh → 13.6 kWh → 2 kWh across cycles.
        // The bar is built from delivered-vs-target, so it climbs instead of standing still.
        const percents = [
            {delivered: 0, remaining: 22000},
            {delivered: 8400, remaining: 13600},
            {delivered: 20000, remaining: 2000},
        ].map(({delivered, remaining}) => progressPercent({
            unit: EnyoDistributionProgressUnitEnum.Energy,
            current: delivered,
            target: delivered + remaining,
        }));

        expect(percents).toEqual([0, 38.2, 90.9]);
    });
});

describe('EnergyDistributionSnapshotBuilder', () => {
    it('orders rows by stated rank and stamps both timestamps', () => {
        const snapshot = new EnergyDistributionSnapshotBuilder()
            .addAppliance({
                ...chargerRow(8400, 22000),
                rank: 1,
            })
            .addAppliance({
                rank: 0,
                applianceId: 'battery-1',
                applianceType: EnyoApplianceTypeEnum.Storage,
                name: 'Hausbatterie',
                state: EnyoDistributionParticipantStateEnum.Supplying,
                powerW: -1200,
                reason: {type: EnyoDataBusCommandReasonTypeEnum.BatterySoCHigh},
            })
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});

        expect(snapshot.participants.map((p) => p.name)).toEqual(['Hausbatterie', 'Wallbox Garage']);
        expect(snapshot.slotStartIso).toBe('2026-09-20T10:00:00.000Z');
        expect(snapshot.generatedAtIso).toBe('2026-09-20T10:03:00.000Z');
    });

    it('gives the measured rows no goal and no appliance identity', () => {
        const snapshot = new EnergyDistributionSnapshotBuilder()
            .addHousehold({powerW: 620, name: 'Haushalt'})
            .addFeedIn({powerW: -1300, name: 'Einspeisung'})
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});

        for (const participant of snapshot.participants) {
            expect(participant.progress).toBeUndefined();
            expect(participant.applianceId).toBeUndefined();
        }
        expect(snapshot.participants[1]!.state).toBe(EnyoDistributionParticipantStateEnum.Supplying);
        validateEnergyDistributionSnapshot(snapshot);
    });
});

describe('validateEnergyDistributionSnapshot', () => {
    const build = (rows: Parameters<EnergyDistributionSnapshotBuilder['addAppliance']>[0][]) =>
        rows
            .reduce(
                (builder, row) => builder.addAppliance(row),
                new EnergyDistributionSnapshotBuilder(),
            )
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});

    it('accepts a well-formed snapshot', () => {
        expect(() => validateEnergyDistributionSnapshot(build([chargerRow(8400, 22000)]))).not.toThrow();
    });

    it('accepts a completed session with a full bar, even on a slight overshoot', () => {
        const snapshot = build([{
            ...chargerRow(22400, 22000),
            state: EnyoDistributionParticipantStateEnum.Complete,
            powerW: 0,
            reason: {type: EnyoDataBusCommandReasonTypeEnum.SessionComplete},
        }]);

        expect(snapshot.participants[0]!.progress?.percent).toBe(100);
        expect(() => validateEnergyDistributionSnapshot(snapshot)).not.toThrow();
    });

    it('rejects Complete that was inferred from a full bar rather than stated', () => {
        const snapshot = build([{
            ...chargerRow(22000, 22000),
            state: EnyoDistributionParticipantStateEnum.Complete,
            powerW: 0,
            reason: {type: EnyoDataBusCommandReasonTypeEnum.ScheduledOptimization},
        }]);

        expect(() => validateEnergyDistributionSnapshot(snapshot))
            .toThrow(EnergyDistributionValidationError);
    });

    it('rejects a duplicated rank', () => {
        const snapshot = build([
            chargerRow(8400, 22000),
            {
                ...chargerRow(1000, 5000),
                applianceId: 'charger-2',
                name: 'Wallbox Hof',
            },
        ]);

        expect(() => validateEnergyDistributionSnapshot(snapshot))
            .toThrow(/rank=0 is duplicated/);
    });

    it('rejects a percentage that does not follow from its own numbers', () => {
        const snapshot = build([chargerRow(8400, 22000)]);
        snapshot.participants[0]!.progress!.percent = 95;

        expect(() => validateEnergyDistributionSnapshot(snapshot))
            .toThrow(/does not follow from/);
    });

    it('rejects a skipped row that is still drawing power', () => {
        const snapshot = build([{
            ...chargerRow(8400, 22000),
            state: EnyoDistributionParticipantStateEnum.Skipped,
            reason: {type: EnyoDataBusCommandReasonTypeEnum.PvSurplusAllocatedElsewhere},
        }]);

        expect(() => validateEnergyDistributionSnapshot(snapshot))
            .toThrow(/must carry powerW=0/);
    });

    it('rejects a bar on a household row', () => {
        const snapshot = new EnergyDistributionSnapshotBuilder()
            .addHousehold({powerW: 620, name: 'Haushalt'})
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});
        snapshot.participants[0]!.progress = makeProgress({
            unit: EnyoDistributionProgressUnitEnum.Energy,
            current: 1,
            target: 2,
        });

        expect(() => validateEnergyDistributionSnapshot(snapshot))
            .toThrow(/must not carry progress/);
    });

    it('rejects a snapshot generated before the slot it describes', () => {
        const snapshot = build([chargerRow(8400, 22000)]);
        snapshot.generatedAtIso = '2026-09-20T09:59:00.000Z';

        expect(() => validateEnergyDistributionSnapshot(snapshot))
            .toThrow(/must be at or after slotStartIso/);
    });
});

describe('the waterfall fields', () => {
    /** A waiting heatpump row, the shape every test below varies one field of. */
    const waitingRow = () => ({
        rank: 1,
        applianceId: 'heatpump-1',
        applianceType: EnyoApplianceTypeEnum.Heatpump,
        name: 'Wärmepumpe',
        state: EnyoDistributionParticipantStateEnum.NotAsking,
        powerW: 0,
        reason: {type: EnyoDataBusCommandReasonTypeEnum.OtherApplianceTurn},
    });

    it('carries a planned start, a dependency and a target time through the builder', () => {
        const snapshot = new EnergyDistributionSnapshotBuilder()
            .addAppliance({
                ...chargerRow(8400, 22000),
                progress: makeProgress({
                    unit: EnyoDistributionProgressUnitEnum.Energy,
                    current: 8400,
                    target: 22000,
                    targetReachedAtIso: '2026-09-20T12:40:00.000Z',
                }),
                pvPowerW: 4800,
                gridPowerW: 2600,
            })
            .addAppliance({
                ...waitingRow(),
                plannedStartIso: '2026-09-20T11:05:00.000Z',
                waitingForRank: 0,
            })
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});

        expect(() => validateEnergyDistributionSnapshot(snapshot)).not.toThrow();
        expect(snapshot.participants[0]!.progress?.targetReachedAtIso).toBe(
            '2026-09-20T12:40:00.000Z',
        );
        expect(snapshot.participants[0]!.pvPowerW).toBe(4800);
        expect(snapshot.participants[1]!.plannedStartIso).toBe('2026-09-20T11:05:00.000Z');
        expect(snapshot.participants[1]!.waitingForRank).toBe(0);
    });

    it('lets a feed-in row state when it expects to export', () => {
        const snapshot = new EnergyDistributionSnapshotBuilder()
            .addAppliance(chargerRow(8400, 22000))
            .addFeedIn({
                powerW: 0,
                name: 'Einspeisung',
                plannedStartIso: '2026-09-20T17:40:00.000Z',
            })
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});

        expect(() => validateEnergyDistributionSnapshot(snapshot)).not.toThrow();
        expect(snapshot.participants[1]!.plannedStartIso).toBe('2026-09-20T17:40:00.000Z');
    });

    it('rejects a planned start that lies before the slot being described', () => {
        const snapshot = new EnergyDistributionSnapshotBuilder()
            .addAppliance(chargerRow(8400, 22000))
            .addAppliance({...waitingRow(), plannedStartIso: '2026-09-20T09:05:00.000Z'})
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});

        expect(() => validateEnergyDistributionSnapshot(snapshot)).toThrow(
            /plannedStartIso .* is before the slot/,
        );
    });

    it('rejects a dependency on a rank no row holds', () => {
        const snapshot = new EnergyDistributionSnapshotBuilder()
            .addAppliance(chargerRow(8400, 22000))
            .addAppliance({...waitingRow(), waitingForRank: 7})
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});

        expect(() => validateEnergyDistributionSnapshot(snapshot)).toThrow(
            /names no participant in this snapshot/,
        );
    });

    it('rejects a row queued behind itself', () => {
        const snapshot = new EnergyDistributionSnapshotBuilder()
            .addAppliance(chargerRow(8400, 22000))
            .addAppliance({...waitingRow(), waitingForRank: 1})
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});

        expect(() => validateEnergyDistributionSnapshot(snapshot)).toThrow(
            /cannot be queued behind itself/,
        );
    });

    it('accepts an off-plan draw as a drawing state', () => {
        const snapshot = new EnergyDistributionSnapshotBuilder()
            .addAppliance({
                ...waitingRow(),
                rank: 0,
                state: EnyoDistributionParticipantStateEnum.DrawingOutsidePlan,
                powerW: 1800,
                reason: {
                    type: EnyoDataBusCommandReasonTypeEnum.ApplianceInitiatedDraw,
                    powerW: 1800,
                },
            })
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});

        expect(() => validateEnergyDistributionSnapshot(snapshot)).not.toThrow();
    });

    it('rejects an off-plan draw with a negative power — that is supplying', () => {
        const snapshot = new EnergyDistributionSnapshotBuilder()
            .addAppliance({
                ...waitingRow(),
                rank: 0,
                state: EnyoDistributionParticipantStateEnum.DrawingOutsidePlan,
                powerW: -1800,
                reason: {type: EnyoDataBusCommandReasonTypeEnum.ApplianceInitiatedDraw},
            })
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});

        expect(() => validateEnergyDistributionSnapshot(snapshot)).toThrow(
            /drawing-outside-plan.*negative/,
        );
    });

    it('accepts an offer with its expiry, and holds it to powerW=0', () => {
        const offered = {
            ...waitingRow(),
            rank: 0,
            state: EnyoDistributionParticipantStateEnum.Offered,
            reason: {type: EnyoDataBusCommandReasonTypeEnum.PowerOffered, powerW: 2000},
            offerEndsAtIso: '2026-09-20T14:00:00.000Z',
        };
        const snapshot = new EnergyDistributionSnapshotBuilder()
            .addAppliance(offered)
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});
        expect(() => validateEnergyDistributionSnapshot(snapshot)).not.toThrow();
        expect(snapshot.participants[0]!.offerEndsAtIso).toBe('2026-09-20T14:00:00.000Z');

        const drawing = new EnergyDistributionSnapshotBuilder()
            .addAppliance({...offered, powerW: 1500})
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});
        expect(() => validateEnergyDistributionSnapshot(drawing)).toThrow(
            /state='offered' must carry powerW=0/,
        );
    });

    it('refuses an offer expiry on a row that was never offered anything', () => {
        const builder = new EnergyDistributionSnapshotBuilder();
        expect(() =>
            builder.addAppliance({
                ...waitingRow(),
                rank: 0,
                offerEndsAtIso: '2026-09-20T14:00:00.000Z',
            }),
        ).toThrow(RangeError);

        // And the validator catches a hand-built payload that bypassed the builder.
        const snapshot = new EnergyDistributionSnapshotBuilder()
            .addAppliance({...waitingRow(), rank: 0})
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});
        snapshot.participants[0]!.offerEndsAtIso = '2026-09-20T14:00:00.000Z';
        expect(() => validateEnergyDistributionSnapshot(snapshot)).toThrow(
            EnergyDistributionValidationError,
        );
    });

    it('rejects a PV / grid split that does not add up to the row it describes', () => {
        const snapshot = new EnergyDistributionSnapshotBuilder()
            .addAppliance({...chargerRow(8400, 22000), pvPowerW: 4800, gridPowerW: 1000})
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});

        expect(() => validateEnergyDistributionSnapshot(snapshot)).toThrow(
            /does not add up to powerW=7400/,
        );
    });

    it('accepts one half of the split on its own — an unknown share is not zero', () => {
        const snapshot = new EnergyDistributionSnapshotBuilder()
            .addAppliance({...chargerRow(8400, 22000), pvPowerW: 4800})
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});

        expect(() => validateEnergyDistributionSnapshot(snapshot)).not.toThrow();
    });

    it('rejects a split on a supplying row', () => {
        const snapshot = new EnergyDistributionSnapshotBuilder()
            .addAppliance({
                rank: 0,
                applianceId: 'battery-1',
                applianceType: EnyoApplianceTypeEnum.Storage,
                name: 'Hausbatterie',
                state: EnyoDistributionParticipantStateEnum.Supplying,
                powerW: -1200,
                reason: {type: EnyoDataBusCommandReasonTypeEnum.SelfConsumptionOptimization},
                pvPowerW: 1200,
            })
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});

        expect(() => validateEnergyDistributionSnapshot(snapshot)).toThrow(
            /a supplying row has none/,
        );
    });

    it('rejects a share larger than the whole', () => {
        const snapshot = new EnergyDistributionSnapshotBuilder()
            .addAppliance({...chargerRow(8400, 22000), gridPowerW: 9000})
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});

        expect(() => validateEnergyDistributionSnapshot(snapshot)).toThrow(
            /exceeds powerW=7400/,
        );
    });

    it('rejects an unparseable target time', () => {
        const snapshot = new EnergyDistributionSnapshotBuilder()
            .addAppliance(chargerRow(8400, 22000))
            .build({slotStartMs: SLOT_START_MS, nowMs: NOW_MS});
        snapshot.participants[0]!.progress!.targetReachedAtIso = 'ca. 12:40';

        expect(() => validateEnergyDistributionSnapshot(snapshot)).toThrow(
            /targetReachedAtIso/,
        );
    });
});
