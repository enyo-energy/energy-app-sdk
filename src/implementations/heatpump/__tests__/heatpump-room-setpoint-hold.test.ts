import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
    EnyoCommandAcknowledgeAnswerEnum,
    EnyoDataBusCommandReasonTypeEnum,
    EnyoDataBusHeatpumpRoomSetpointHoldV1,
} from '../../../types/enyo-data-bus-value.js';
import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum as Feature,
    EnyoHeatpumpApplianceMetadata,
} from '../../../types/enyo-heatpump-appliance.js';
import {VACATION_FROST_PROTECTION_C} from '../../../types/enyo-vacation.js';
import {
    isHeatpumpHoldEnding,
    validateHeatpumpDomesticHotWaterPause,
    validateHeatpumpRoomSetpointHold,
} from '../heatpump-control-validators.js';
import {validateHeatpumpAdvancedMetadata} from '../heatpump-metadata-validators.js';
import {installSdk, TestHeatpump} from './heatpump-test-harness.js';

const {Accepted, Rejected, NotSupported} = EnyoCommandAcknowledgeAnswerEnum;
const NOW = Date.parse('2026-12-01T08:00:00.000Z');
const inDays = (days: number) => new Date(NOW + days * 86_400_000).toISOString();

const METADATA: EnyoHeatpumpApplianceMetadata = {
    availableFeatures: [Feature.RoomSetpointHold, Feature.DomesticHotWaterPause],
    heatingCircuits: [
        {index: 0, roomSetpointHoldRangeC: {minC: 5, maxC: 20}},
        {index: 1, roomSetpointHoldRangeC: {minC: 7, maxC: 7}},
    ],
    domesticHotWater: [{index: 0, targetTemperatureC: 50}],
};

type HoldData = EnyoDataBusHeatpumpRoomSetpointHoldV1['data'];
const frost = (overrides: Partial<HoldData> = {}): HoldData => ({
    targetTemperatureC: VACATION_FROST_PROTECTION_C,
    untilIso: inDays(14),
    reason: {type: EnyoDataBusCommandReasonTypeEnum.UserRequest},
    ...overrides,
});

describe('validateHeatpumpRoomSetpointHold', () => {
    it('accepts a hold of every circuit inside all their ranges', () => {
        expect(validateHeatpumpRoomSetpointHold(frost(), METADATA, NOW).answer).toBe(Accepted);
    });

    it('rejects a temperature outside the range of an addressed circuit', () => {
        expect(validateHeatpumpRoomSetpointHold(frost({targetTemperatureC: 17}), METADATA, NOW).answer).toBe(Rejected);
        expect(validateHeatpumpRoomSetpointHold(frost({index: 0, targetTemperatureC: 17}), METADATA, NOW).answer).toBe(Accepted);
    });

    it('rejects a malformed message and an unknown circuit', () => {
        for (const data of [frost({untilIso: 'soon'}), frost({index: -1}), frost({targetTemperatureC: Number.NaN})]) {
            expect(validateHeatpumpRoomSetpointHold(data, METADATA, NOW).answer).toBe(Rejected);
        }
        expect(validateHeatpumpRoomSetpointHold(frost({index: 3}), METADATA, NOW).answer).toBe(Rejected);
    });

    it('answers NotSupported without the feature or without a range on an addressed circuit', () => {
        expect(validateHeatpumpRoomSetpointHold(frost(), {...METADATA, availableFeatures: []}, NOW).answer).toBe(NotSupported);
        const noRange = {...METADATA, heatingCircuits: [{index: 0}]};
        expect(validateHeatpumpRoomSetpointHold(frost(), noRange, NOW).answer).toBe(NotSupported);
    });

    it('accepts ending the hold regardless of the range', () => {
        const ending = frost({targetTemperatureC: 30, untilIso: new Date(NOW).toISOString()});
        expect(isHeatpumpHoldEnding(ending.untilIso, NOW)).toBe(true);
        expect(validateHeatpumpRoomSetpointHold(ending, METADATA, NOW).answer).toBe(Accepted);
    });

    it('without metadata checks only the message itself', () => {
        expect(validateHeatpumpRoomSetpointHold(frost({index: 7}), undefined, NOW).answer).toBe(Accepted);
        expect(validateHeatpumpRoomSetpointHold(frost({untilIso: 'soon'}), undefined, NOW).answer).toBe(Rejected);
    });
});

describe('validateHeatpumpDomesticHotWaterPause', () => {
    it('accepts a pause of every or a known zone', () => {
        expect(validateHeatpumpDomesticHotWaterPause({untilIso: inDays(14)}, METADATA).answer).toBe(Accepted);
        expect(validateHeatpumpDomesticHotWaterPause({index: 0, untilIso: inDays(14)}, METADATA).answer).toBe(Accepted);
    });

    it('rejects an unknown zone or a malformed untilIso', () => {
        expect(validateHeatpumpDomesticHotWaterPause({index: 1, untilIso: inDays(14)}, METADATA).answer).toBe(Rejected);
        expect(validateHeatpumpDomesticHotWaterPause({untilIso: 'soon'}, METADATA).answer).toBe(Rejected);
    });

    it('answers NotSupported without the feature', () => {
        const metadata = {...METADATA, availableFeatures: [Feature.RoomSetpointHold]};
        expect(validateHeatpumpDomesticHotWaterPause({untilIso: inDays(14)}, metadata).answer).toBe(NotSupported);
    });
});

describe('validateHeatpumpAdvancedMetadata — room setpoint hold', () => {
    it('accepts valid hold ranges', () => {
        const result = validateHeatpumpAdvancedMetadata(METADATA);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
    });

    it('flags an inverted range and a range without the feature', () => {
        const result = validateHeatpumpAdvancedMetadata({
            availableFeatures: [],
            heatingCircuits: [{index: 0, roomSetpointHoldRangeC: {minC: 20, maxC: 7}}],
        });
        expect(result.errors.join('\n')).toMatch(/minC above maxC/);
        expect(result.warnings.join('\n')).toMatch(/does not declare RoomSetpointHold/);
    });

    it('warns when RoomSetpointHold is declared without any range', () => {
        const result = validateHeatpumpAdvancedMetadata({availableFeatures: [Feature.RoomSetpointHold], heatingCircuits: [{index: 0}]});
        expect(result.warnings.join('\n')).toMatch(/no heating circuit has a roomSetpointHoldRangeC/);
    });
});

describe('HeatpumpIntegrationEnergyApp — HeatpumpRoomSetpointHoldV1 / HeatpumpDomesticHotWaterPauseV1', () => {
    let app: TestHeatpump;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        installSdk({'hp-1': {heatpump: METADATA}});
        app = new TestHeatpump();
    });

    afterEach(() => {
        app.stop();
        vi.useRealTimers();
    });

    it('answers NotSupported by default', async () => {
        expect((await app.roomSetpointHold(frost())).answer).toBe(NotSupported);
        expect((await app.domesticHotWaterPause({untilIso: inDays(14)})).answer).toBe(NotSupported);
    });

    it('passes a valid hold and pause to the handlers', async () => {
        app.holdResponse = async () => ({answer: Accepted});
        app.dhwPauseResponse = async () => ({answer: Accepted});
        expect((await app.roomSetpointHold(frost())).answer).toBe(Accepted);
        expect((await app.domesticHotWaterPause({untilIso: inDays(14)})).answer).toBe(Accepted);
        expect(app.holds.map((m) => m.data)).toEqual([frost()]);
        expect(app.dhwPauses.map((m) => m.data)).toEqual([{untilIso: inDays(14)}]);
    });

    it('does not call the handler for an invalid hold', async () => {
        app.holdResponse = async () => ({answer: Accepted});
        const response = await app.roomSetpointHold(frost({index: 3}));
        expect(response.answer).toBe(Rejected);
        expect(response.rejectionReason).toMatch(/index 3/);
        expect(app.holds).toEqual([]);
    });
});
