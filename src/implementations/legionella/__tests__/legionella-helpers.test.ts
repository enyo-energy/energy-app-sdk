import {describe, expect, it} from 'vitest';
import {EnyoDataBusLegionellaStatusV1, EnyoDataBusMessageEnum} from '../../../types/enyo-data-bus-value.js';
import {
    EnyoLegionellaProgramMetadata,
    EnyoLegionellaRunStateEnum as State,
    EnyoLegionellaSlotAdjustableEnum,
} from '../../../types/enyo-legionella.js';
import {EnyoSourceEnum} from '../../../types/enyo-source.enum.js';
import {LegionellaRunDetector} from '../legionella-run-detector.js';
import {
    applyLegionellaSchedule,
    buildLegionellaStatusMessage,
    nextLegionellaRunIso,
    reconcileLegionellaProgram,
    validateLegionellaStatusMessage,
} from '../legionella-validators.js';

const OWNER = {dayOfWeek: 6, timeOfDay: '01:00'};
const MOVED = {dayOfWeek: 6, timeOfDay: '13:00'};
const PROGRAM: EnyoLegionellaProgramMetadata = {ownerSlot: OWNER, activeSlot: OWNER, adjustable: EnyoLegionellaSlotAdjustableEnum.TimeOnly};
const MINUTE = 60_000;

describe('applyLegionellaSchedule', () => {
    it('sets the energy manager slot on a move and clears it on restore, keeping the owner slot', () => {
        const moved = applyLegionellaSchedule(PROGRAM, {slot: MOVED, nextRunIso: 'x', ownerRunIso: 'x'});
        expect(moved).toEqual({...PROGRAM, activeSlot: MOVED, energyManagerSlot: MOVED});
        const restored = applyLegionellaSchedule(moved, {slot: OWNER, nextRunIso: 'x', ownerRunIso: 'x', restored: true});
        expect(restored).toEqual({...PROGRAM, activeSlot: OWNER});
        expect('energyManagerSlot' in restored).toBe(false);
    });
});

describe('reconcileLegionellaProgram', () => {
    it('keeps the owner slot while the device holds the energy manager slot or the owner slot', () => {
        const moved = {...PROGRAM, energyManagerSlot: MOVED};
        expect(reconcileLegionellaProgram(moved, MOVED)).toEqual({program: {...moved, activeSlot: MOVED}, ownerChanged: false});
        expect(reconcileLegionellaProgram(PROGRAM, OWNER)).toEqual({program: PROGRAM, ownerChanged: false});
    });

    it('takes any other slot as the owner\'s change and forgets the energy manager slot', () => {
        const byHand = {dayOfWeek: 0, timeOfDay: '12:00'};
        const result = reconcileLegionellaProgram({...PROGRAM, energyManagerSlot: MOVED}, byHand);
        expect(result.ownerChanged).toBe(true);
        expect(result.program.ownerSlot).toEqual(byHand);
        expect(result.program.activeSlot).toEqual(byHand);
        expect(result.program.energyManagerSlot).toBeUndefined();
        // The owner's slot on the device while the energy manager's slot was expected: also a change by the owner.
        expect(reconcileLegionellaProgram({...PROGRAM, energyManagerSlot: MOVED}, OWNER).ownerChanged).toBe(true);
    });
});

describe('nextLegionellaRunIso', () => {
    it('finds the next local slot in winter and summer time', () => {
        // Thursday 2026-11-26 10:00 Berlin (UTC+1) → Saturday 01:00 local = Friday 24:00 UTC.
        expect(nextLegionellaRunIso(OWNER, 'Europe/Berlin', Date.parse('2026-11-26T09:00:00Z'))).toBe('2026-11-28T00:00:00.000Z');
        // Summer (UTC+2): Saturday 2026-07-04 13:00 local = 11:00 UTC.
        expect(nextLegionellaRunIso(MOVED, 'Europe/Berlin', Date.parse('2026-07-01T09:00:00Z'))).toBe('2026-07-04T11:00:00.000Z');
    });

    it('takes next week once the slot of this week has passed or is now', () => {
        expect(nextLegionellaRunIso(OWNER, 'Europe/Berlin', Date.parse('2026-11-28T00:00:00Z'))).toBe('2026-12-05T00:00:00.000Z');
        expect(nextLegionellaRunIso(OWNER, 'Europe/Berlin', Date.parse('2026-11-28T05:00:00Z'))).toBe('2026-12-05T00:00:00.000Z');
    });

    it('follows a DST change between now and the run', () => {
        // Sunday 2026-03-29 is the spring change in Berlin; Saturday 2026-04-04 01:00 is UTC+2.
        expect(nextLegionellaRunIso(OWNER, 'Europe/Berlin', Date.parse('2026-03-28T12:00:00Z'))).toBe('2026-04-03T23:00:00.000Z');
    });

    it('throws for a malformed slot', () => {
        expect(() => nextLegionellaRunIso({dayOfWeek: 7, timeOfDay: '01:00'}, 'Europe/Berlin')).toThrow();
    });
});

describe('LegionellaStatusV1', () => {
    const status = (data: Partial<EnyoDataBusLegionellaStatusV1['data']>): EnyoDataBusLegionellaStatusV1 => ({
        id: 's-1',
        type: 'message',
        message: EnyoDataBusMessageEnum.LegionellaStatusV1,
        source: EnyoSourceEnum.Device,
        applianceId: 'rod-1',
        timestampIso: '2026-11-28T12:00:00.000Z',
        data: {state: State.Running, slot: MOVED, movedByEnergyManager: true, startedIso: '2026-11-28T12:00:00.000Z', ...data},
    });

    it('accepts each state with its required fields', () => {
        expect(validateLegionellaStatusMessage(status({state: State.Scheduled, startedIso: undefined, nextRunIso: '2026-11-28T12:00:00.000Z'})).ok)
            .toBe(true);
        expect(validateLegionellaStatusMessage(status({})).ok).toBe(true);
        expect(validateLegionellaStatusMessage(status({state: State.Completed, completedIso: '2026-11-28T13:00:00.000Z'})).ok).toBe(true);
        expect(validateLegionellaStatusMessage(status({state: State.Failed, failureReason: 'too cold'})).ok).toBe(true);
    });

    it('reports missing state fields and a stray failure reason', () => {
        expect(validateLegionellaStatusMessage(status({state: State.Scheduled, startedIso: undefined})).errors)
            .toEqual(['nextRunIso is required when state is scheduled']);
        expect(validateLegionellaStatusMessage(status({state: State.Completed})).errors)
            .toEqual(['completedIso is required when state is completed']);
        expect(validateLegionellaStatusMessage(status({state: State.Failed})).errors)
            .toEqual(['failureReason is required when state is failed']);
        expect(validateLegionellaStatusMessage(status({failureReason: 'x'})).ok).toBe(false);
        expect(validateLegionellaStatusMessage(status({movedByEnergyManager: undefined as unknown as boolean})).ok).toBe(false);
    });

    it('builds a message for heating rod apps', () => {
        const message = buildLegionellaStatusMessage('rod-1', status({}).data, EnyoSourceEnum.Device);
        expect(message.message).toBe(EnyoDataBusMessageEnum.LegionellaStatusV1);
        expect(message.applianceId).toBe('rod-1');
        expect(() => buildLegionellaStatusMessage('rod-1', status({state: State.Completed}).data, EnyoSourceEnum.Device)).toThrow();
    });
});

describe('LegionellaRunDetector', () => {
    const START = Date.parse('2026-11-28T12:00:00.000Z');

    it('goes running at the start and completed once the target held long enough', () => {
        const detector = new LegionellaRunDetector({targetTemperatureC: 60, holdMinutes: 30});
        detector.schedule(new Date(START).toISOString());
        expect(detector.update(48, START - MINUTE)).toBeUndefined();
        expect(detector.update(50, START)?.state).toBe(State.Running);
        expect(detector.update(59.5, START + 60 * MINUTE)).toBeUndefined();
        expect(detector.update(57, START + 70 * MINUTE)).toBeUndefined(); // dropped below: hold restarts
        expect(detector.update(60, START + 75 * MINUTE)).toBeUndefined();
        const done = detector.update(61, START + 105 * MINUTE);
        expect(done).toMatchObject({state: State.Completed, reachedTemperatureC: 61, completedIso: new Date(START + 105 * MINUTE).toISOString()});
        expect(detector.update(61, START + 110 * MINUTE)).toBeUndefined();
    });

    it('fails when the target is not held within the maximum duration', () => {
        const detector = new LegionellaRunDetector({maxDurationMinutes: 120});
        detector.schedule(new Date(START).toISOString());
        detector.update(50, START);
        const failed = detector.update(55, START + 120 * MINUTE);
        expect(failed?.state).toBe(State.Failed);
        expect(failed?.failureReason).toMatch(/not held/);
        expect(detector.currentState).toBe(State.Failed);
    });
});
