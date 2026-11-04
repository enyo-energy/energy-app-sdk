import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
    EnyoCommandAcknowledgeAnswerEnum,
    EnyoDataBusCommandReasonTypeEnum,
    EnyoDataBusVacationStartedV1,
    EnyoVacationHeatingEnum,
} from '../../../types/enyo-data-bus-value.js';
import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum as Feature,
    EnyoHeatpumpApplianceMetadata,
} from '../../../types/enyo-heatpump-appliance.js';
import {VACATION_FROST_PROTECTION_C} from '../../../types/enyo-vacation.js';
import {validateVacationStarted, validateVacationStopped} from '../heatpump-control-validators.js';
import {validateHeatpumpAdvancedMetadata} from '../heatpump-metadata-validators.js';
import {installSdk, TestHeatpump} from './heatpump-test-harness.js';

const {Accepted, Rejected, NotSupported} = EnyoCommandAcknowledgeAnswerEnum;
const NOW = Date.parse('2026-12-01T08:00:00.000Z');
const RETURN_ISO = new Date(NOW + 14 * 86_400_000).toISOString();

const METADATA: EnyoHeatpumpApplianceMetadata = {
    availableFeatures: [Feature.VacationFrostProtection, Feature.VacationLowered, Feature.VacationHotWaterPause],
    vacationLoweredRangeC: {minC: 10, maxC: 20},
    heatingCircuits: [{index: 0}],
    domesticHotWater: [{index: 0, targetTemperatureC: 50}],
};

type StartedData = EnyoDataBusVacationStartedV1['data'];
type HeatpumpData = NonNullable<StartedData['heatpump']>;
const FROST = {mode: EnyoVacationHeatingEnum.FrostProtection, targetTemperatureC: VACATION_FROST_PROTECTION_C};
const started = (overrides: Partial<StartedData> = {}): StartedData => ({
    vacationId: 'vacation-1',
    returnIso: RETURN_ISO,
    heatpump: {heating: FROST, domesticHotWater: {pause: true}},
    reason: {type: EnyoDataBusCommandReasonTypeEnum.UserRequest},
    ...overrides,
});
const withHeatpump = (heatpump: HeatpumpData) => started({heatpump});
const lowered = (targetTemperatureC: number) =>
    withHeatpump({heating: {mode: EnyoVacationHeatingEnum.Lowered, targetTemperatureC}, domesticHotWater: {pause: true}});
const withFeatures = (...availableFeatures: Feature[]) => ({...METADATA, availableFeatures});

describe('validateVacationStarted', () => {
    it('accepts frost protection, a lowered target inside the range and no heating at all', () => {
        expect(validateVacationStarted(started(), METADATA).answer).toBe(Accepted);
        expect(validateVacationStarted(lowered(15), METADATA).answer).toBe(Accepted);
        expect(validateVacationStarted(withHeatpump({domesticHotWater: {pause: false}}), METADATA).answer).toBe(Accepted);
        expect(validateVacationStarted(started({heatpump: undefined}), METADATA).answer).toBe(Accepted);
        expect(validateVacationStarted(started({battery: {gridServing: true, minSocAtReturnPercent: 50}}), METADATA).answer)
            .toBe(Accepted);
    });

    it('rejects malformed data', () => {
        const malformed = [
            started({vacationId: ''}),
            started({returnIso: 'soon'}),
            withHeatpump({domesticHotWater: {pause: 'yes' as unknown as boolean}}),
            withHeatpump({heating: {mode: 'normal' as EnyoVacationHeatingEnum, targetTemperatureC: 20}}),
            lowered(Number.NaN),
            started({battery: {gridServing: 'yes' as unknown as boolean, minSocAtReturnPercent: 50}}),
            started({battery: {gridServing: true, minSocAtReturnPercent: 120}}),
        ];
        for (const data of malformed) {
            expect(validateVacationStarted(data, METADATA).answer).toBe(Rejected);
        }
    });

    it('answers NotSupported when the requested heating mode is not declared', () => {
        expect(validateVacationStarted(started(), withFeatures(Feature.VacationLowered, Feature.VacationHotWaterPause)).answer)
            .toBe(NotSupported);
        expect(validateVacationStarted(lowered(15), withFeatures(Feature.VacationFrostProtection, Feature.VacationHotWaterPause)).answer)
            .toBe(NotSupported);
    });

    it('answers NotSupported for a lowered target outside the range or without one', () => {
        expect(validateVacationStarted(lowered(7), METADATA).answer).toBe(NotSupported);
        expect(validateVacationStarted(lowered(21), METADATA).answer).toBe(NotSupported);
        expect(validateVacationStarted(lowered(15), {...METADATA, vacationLoweredRangeC: undefined}).answer).toBe(NotSupported);
    });

    it('answers NotSupported for a hot water pause without VacationHotWaterPause', () => {
        const metadata = withFeatures(Feature.VacationFrostProtection);
        expect(validateVacationStarted(started(), metadata).answer).toBe(NotSupported);
        expect(validateVacationStarted(withHeatpump({heating: FROST, domesticHotWater: {pause: false}}), metadata).answer)
            .toBe(Accepted);
        expect(validateVacationStarted(withHeatpump({heating: FROST}), metadata).answer).toBe(Accepted);
    });

    it('without metadata checks only the message itself', () => {
        expect(validateVacationStarted(lowered(30), undefined).answer).toBe(Accepted);
        expect(validateVacationStarted(started({returnIso: 'soon'}), undefined).answer).toBe(Rejected);
    });
});

describe('validateVacationStopped', () => {
    it('accepts a stop and rejects only a malformed one', () => {
        expect(validateVacationStopped({vacationId: 'vacation-1'}).answer).toBe(Accepted);
        expect(validateVacationStopped({vacationId: ''}).answer).toBe(Rejected);
    });
});

describe('validateHeatpumpAdvancedMetadata — vacation', () => {
    it('accepts VacationLowered with a valid range', () => {
        expect(validateHeatpumpAdvancedMetadata(METADATA).errors).toEqual([]);
    });

    it('requires the range with VacationLowered and only with it', () => {
        expect(validateHeatpumpAdvancedMetadata({...METADATA, vacationLoweredRangeC: undefined}).errors.join('\n'))
            .toMatch(/vacationLoweredRangeC is missing/);
        expect(validateHeatpumpAdvancedMetadata(withFeatures(Feature.VacationFrostProtection)).errors.join('\n'))
            .toMatch(/does not declare VacationLowered/);
    });

    it('flags an inverted range', () => {
        const result = validateHeatpumpAdvancedMetadata({...METADATA, vacationLoweredRangeC: {minC: 20, maxC: 10}});
        expect(result.errors.join('\n')).toMatch(/minC above maxC/);
    });
});

describe('HeatpumpIntegrationEnergyApp — VacationStartedV1 / VacationStoppedV1', () => {
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
        expect((await app.vacationStarted(started())).answer).toBe(NotSupported);
        expect((await app.vacationStopped({vacationId: 'vacation-1'})).answer).toBe(NotSupported);
    });

    it('passes a valid start and stop to the handlers', async () => {
        app.vacationStartedResponse = async () => ({answer: Accepted});
        app.vacationStoppedResponse = async () => ({answer: Accepted});
        expect((await app.vacationStarted(started())).answer).toBe(Accepted);
        expect((await app.vacationStopped({vacationId: 'vacation-1'})).answer).toBe(Accepted);
        expect(app.vacationStarts.map((m) => m.data)).toEqual([started()]);
        expect(app.vacationStops.map((m) => m.data)).toEqual([{vacationId: 'vacation-1'}]);
    });

    it('does not call the handler for an unsupported start', async () => {
        app.vacationStartedResponse = async () => ({answer: Accepted});
        const response = await app.vacationStarted(lowered(25));
        expect(response.answer).toBe(NotSupported);
        expect(response.rejectionReason).toMatch(/vacationLoweredRangeC/);
        expect(app.vacationStarts).toEqual([]);
    });
});
