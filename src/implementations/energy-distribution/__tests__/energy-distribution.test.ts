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
