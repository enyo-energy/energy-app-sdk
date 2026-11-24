import {describe, expect, it} from 'vitest';
import {
    EnyoCommandAcknowledgeAnswerEnum,
    EnyoDataBusMessageEnum,
    EnyoDataBusSetLegionellaScheduleV1,
} from '../../../types/enyo-data-bus-value.js';
import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum as Feature,
    EnyoHeatpumpApplianceMetadata,
} from '../../../types/enyo-heatpump-appliance.js';
import {EnyoLegionellaRunStateEnum, EnyoLegionellaSlotAdjustableEnum} from '../../../types/enyo-legionella.js';
import {EnyoSourceEnum} from '../../../types/enyo-source.enum.js';
import {validateHeatpumpAdvancedMetadata} from '../heatpump-metadata-validators.js';
import {installSdk, TestHeatpump} from './heatpump-test-harness.js';

const {Accepted, NotSupported} = EnyoCommandAcknowledgeAnswerEnum;

const METADATA: EnyoHeatpumpApplianceMetadata = {
    availableFeatures: [Feature.LegionellaSchedule],
    domesticHotWater: [{
        index: 0,
        targetTemperatureC: 50,
        legionella: {ownerSlot: {dayOfWeek: 6, timeOfDay: '01:00'}, adjustable: EnyoLegionellaSlotAdjustableEnum.TimeOnly},
    }],
};

/** A heat pump that writes every legionella slot it gets. */
class LegionellaHeatpump extends TestHeatpump {
    readonly schedules: EnyoDataBusSetLegionellaScheduleV1[] = [];

    protected async handleLegionellaSchedule(message: EnyoDataBusSetLegionellaScheduleV1) {
        this.schedules.push(message);
        return {answer: Accepted};
    }
}

/** The private dispatcher of the base class, as the data bus would call it. */
type Dispatch = {dispatchLegionellaSchedule(message: EnyoDataBusSetLegionellaScheduleV1): Promise<{answer: EnyoCommandAcknowledgeAnswerEnum}>};

const message = (data: EnyoDataBusSetLegionellaScheduleV1['data']): EnyoDataBusSetLegionellaScheduleV1 => ({
    id: 'legionella-1',
    type: 'message',
    message: EnyoDataBusMessageEnum.SetLegionellaScheduleV1,
    source: EnyoSourceEnum.Device,
    applianceId: 'hp-1',
    timestampIso: new Date().toISOString(),
    data,
});
const nextRunIso = () => new Date(Date.now() + 86_400_000).toISOString();
const ownerRunIso = () => new Date(Date.now() + 12 * 3_600_000).toISOString();

describe('HeatpumpIntegrationEnergyApp — SetLegionellaScheduleV1', () => {
    it('subscribes to the command', () => {
        const {listeners} = installSdk({'hp-1': {heatpump: METADATA}});
        const app = new LegionellaHeatpump();
        app.start();
        expect(listeners.some((l) => l.types.includes(EnyoDataBusMessageEnum.SetLegionellaScheduleV1))).toBe(true);
        app.stop();
    });

    it('hands a valid slot to handleLegionellaSchedule', async () => {
        installSdk({'hp-1': {heatpump: METADATA}});
        const app = new LegionellaHeatpump();
        const response = await (app as unknown as Dispatch).dispatchLegionellaSchedule(
            message({slot: {dayOfWeek: 6, timeOfDay: '13:00'}, nextRunIso: nextRunIso(), ownerRunIso: ownerRunIso()}),
        );
        expect(response.answer).toBe(Accepted);
        expect(app.schedules).toHaveLength(1);
    });

    it('stops an invalid slot before the handler', async () => {
        installSdk({'hp-1': {heatpump: METADATA}});
        const app = new LegionellaHeatpump();
        const response = await (app as unknown as Dispatch).dispatchLegionellaSchedule(
            message({slot: {dayOfWeek: 5, timeOfDay: '13:00'}, nextRunIso: nextRunIso(), ownerRunIso: ownerRunIso()}),
        );
        expect(response.answer).toBe(NotSupported);
        expect(app.schedules).toEqual([]);
    });

    it('answers NotSupported by default', async () => {
        installSdk({'hp-1': {heatpump: METADATA}});
        const app = new TestHeatpump();
        const response = await (app as unknown as Dispatch).dispatchLegionellaSchedule(
            message({slot: {dayOfWeek: 6, timeOfDay: '13:00'}, nextRunIso: nextRunIso(), ownerRunIso: ownerRunIso()}),
        );
        expect(response.answer).toBe(NotSupported);
    });
});

describe('HeatpumpIntegrationEnergyApp — remembers the energy manager slot', () => {
    it('stores an accepted slot as energyManagerSlot and clears it on restore', async () => {
        const {saved} = installSdk({'hp-1': {heatpump: METADATA}});
        const app = new LegionellaHeatpump();
        const dispatch = (app as unknown as Dispatch).dispatchLegionellaSchedule.bind(app);

        await dispatch(message({slot: {dayOfWeek: 6, timeOfDay: '13:00'}, nextRunIso: nextRunIso(), ownerRunIso: ownerRunIso()}));
        const afterMove = (saved.at(-1)!.appliance as {heatpump: EnyoHeatpumpApplianceMetadata}).heatpump.domesticHotWater![0].legionella!;
        expect(afterMove.energyManagerSlot).toEqual({dayOfWeek: 6, timeOfDay: '13:00'});
        expect(afterMove.activeSlot).toEqual({dayOfWeek: 6, timeOfDay: '13:00'});
        expect(afterMove.ownerSlot).toEqual({dayOfWeek: 6, timeOfDay: '01:00'});

        await dispatch(message({slot: {dayOfWeek: 6, timeOfDay: '01:00'}, nextRunIso: nextRunIso(), ownerRunIso: nextRunIso(), restored: true}));
        const afterRestore = (saved.at(-1)!.appliance as {heatpump: EnyoHeatpumpApplianceMetadata}).heatpump.domesticHotWater![0].legionella!;
        expect(afterRestore.energyManagerSlot).toBeUndefined();
        expect(afterRestore.activeSlot).toEqual({dayOfWeek: 6, timeOfDay: '01:00'});
    });

    it('stores nothing when the handler does not accept', async () => {
        const {saved} = installSdk({'hp-1': {heatpump: METADATA}});
        const app = new TestHeatpump();
        await (app as unknown as Dispatch).dispatchLegionellaSchedule(
            message({slot: {dayOfWeek: 6, timeOfDay: '13:00'}, nextRunIso: nextRunIso(), ownerRunIso: ownerRunIso()}),
        );
        expect(saved).toEqual([]);
    });

    it('publishes a valid status and refuses an invalid one', () => {
        const {sent} = installSdk({'hp-1': {heatpump: METADATA}});
        const app = new TestHeatpump();
        app.publishLegionellaStatus('hp-1', {
            state: EnyoLegionellaRunStateEnum.Scheduled,
            slot: {dayOfWeek: 6, timeOfDay: '13:00'},
            movedByEnergyManager: true,
            nextRunIso: nextRunIso(),
        });
        expect(sent.map((m) => m.message)).toEqual([EnyoDataBusMessageEnum.LegionellaStatusV1]);
        expect(() => app.publishLegionellaStatus('hp-1', {
            state: EnyoLegionellaRunStateEnum.Completed,
            slot: {dayOfWeek: 6, timeOfDay: '13:00'},
            movedByEnergyManager: true,
        })).toThrow(/startedIso is required/);
    });
});

describe('validateHeatpumpAdvancedMetadata — legionella', () => {
    it('checks the legionella program of each zone', () => {
        expect(validateHeatpumpAdvancedMetadata({...METADATA, heatingCircuits: []}).ok).toBe(true);
        const broken = {
            ...METADATA,
            heatingCircuits: [],
            domesticHotWater: [{index: 0, targetTemperatureC: 50, legionella: {ownerSlot: {dayOfWeek: 6, timeOfDay: '1:00'}}}],
        };
        expect(validateHeatpumpAdvancedMetadata(broken).errors).toEqual([
            'domesticHotWater[index=0].legionella: ownerSlot.timeOfDay must be HH:mm between 00:00 and 23:59; got 1:00',
            'domesticHotWater[index=0].legionella: LegionellaSchedule is declared but adjustable is missing',
        ]);
    });

    it('warns when the feature is declared but no zone reports a program', () => {
        const result = validateHeatpumpAdvancedMetadata({availableFeatures: [Feature.LegionellaSchedule], heatingCircuits: [], domesticHotWater: []});
        expect(result.warnings).toContain('LegionellaSchedule is declared but no domesticHotWater zone reports legionella');
    });
});
