import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
    EnyoCommandAcknowledgeAnswerEnum,
    EnyoDataBusHeatpumpControlV3,
    EnyoDataBusHeatpumpFlexibilityAnnouncementV3,
    EnyoDataBusMessageEnum,
    EnyoHeatpumpControlAction,
    EnyoHeatpumpControlTargetEnum,
    EnyoHeatpumpFlexibilityOption,
    EnyoHeatpumpHeatSourceEnum,
    EnyoPowerSourceEnum,
} from '../../../types/enyo-data-bus-value.js';
import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum as Feature,
    EnyoHeatpumpApplianceMetadata,
} from '../../../types/enyo-heatpump-appliance.js';
import {EnyoSourceEnum} from '../../../types/enyo-source.enum.js';
import {
    heatpumpFlexibilityOfferId,
    validateHeatpumpFlexibilityAnnouncement,
} from '../heatpump-flexibility-validators.js';
import {validateHeatpumpControlAction} from '../heatpump-control-validators.js';
import {validateHeatpumpAdvancedMetadata} from '../heatpump-metadata-validators.js';
import {installSdk, TestHeatpump} from './heatpump-test-harness.js';

const {Accepted, Rejected} = EnyoCommandAcknowledgeAnswerEnum;

const METADATA: EnyoHeatpumpApplianceMetadata = {
    availableFeatures: [
        Feature.FlexibilityAnnouncementV3,
        Feature.DomesticHotWaterOverheating,
        Feature.BufferTankOverheating,
        Feature.HeatingRodControllable,
    ],
    domesticHotWater: [{index: 0, targetTemperatureC: 50, maxTemperatureC: 60}],
    bufferTanks: [{index: 0}],
};

const COMPRESSOR = {
    heatSource: EnyoHeatpumpHeatSourceEnum.Compressor as const,
    power: {minWatt: 800, maxWatt: 2300, stepWatt: 100},
    estimatedElectricalKwh: 1.4,
};
const ROD = {
    heatSource: EnyoHeatpumpHeatSourceEnum.HeatingRod as const,
    power: {minWatt: 3000, maxWatt: 3000, stepWatt: 3000},
    estimatedElectricalKwh: 4.1,
};

const dhwOption = (overrides: Partial<EnyoHeatpumpFlexibilityOption> = {}): EnyoHeatpumpFlexibilityOption => ({
    target: EnyoHeatpumpControlTargetEnum.Dhw,
    index: 0,
    currentTemperatureC: 47,
    setpointC: 50,
    maxDeltaK: 10,
    heatSources: [COMPRESSOR, ROD],
    ...overrides,
});

const offerData = (
    options: EnyoHeatpumpFlexibilityOption[] = [dhwOption()],
): EnyoDataBusHeatpumpFlexibilityAnnouncementV3['data'] => ({
    offerId: heatpumpFlexibilityOfferId(options),
    validUntilIso: '2026-10-14T10:15:00.000Z',
    options,
});

describe('heatpumpFlexibilityOfferId', () => {
    it('ignores measured values and option order, but changes with the substance', () => {
        const buffer: EnyoHeatpumpFlexibilityOption = {
            target: EnyoHeatpumpControlTargetEnum.BufferTank, maxDeltaK: 5, heatSources: [COMPRESSOR],
        };
        const id = heatpumpFlexibilityOfferId([dhwOption(), buffer]);
        expect(heatpumpFlexibilityOfferId([buffer, dhwOption({currentTemperatureC: 49})])).toBe(id);
        expect(heatpumpFlexibilityOfferId([dhwOption({maxDeltaK: 8}), buffer])).not.toBe(id);
        expect(id).toMatch(/^[0-9a-f]{8}$/);
    });
});

describe('validateHeatpumpFlexibilityAnnouncement', () => {
    it('accepts a well-formed offer without warnings', () => {
        expect(validateHeatpumpFlexibilityAnnouncement(offerData([dhwOption({
            required: {deltaK: 3, byIso: '2026-10-14T18:00:00.000Z'},
            earliestStartIso: '2026-10-14T10:00:00.000Z',
            latestStartIso: '2026-10-14T16:00:00.000Z',
        })]), METADATA)).toEqual({ok: true, errors: [], warnings: []});
    });

    it('accepts an empty offer (nothing offered)', () => {
        expect(validateHeatpumpFlexibilityAnnouncement(offerData([]), METADATA).ok).toBe(true);
    });

    it('rejects a malformed option', () => {
        const check = (option: Partial<EnyoHeatpumpFlexibilityOption>) =>
            validateHeatpumpFlexibilityAnnouncement(offerData([dhwOption(option)])).errors.join('\n');
        expect(check({maxDeltaK: 0})).toMatch(/maxDeltaK must be a finite positive/);
        expect(check({heatSources: []})).toMatch(/at least one heat source/);
        expect(check({heatSources: [COMPRESSOR, COMPRESSOR]})).toMatch(/offered twice/);
        expect(check({heatSources: [{...COMPRESSOR, power: {minWatt: 2000, maxWatt: 800, stepWatt: 100}}]}))
            .toMatch(/power band/);
        expect(check({earliestStartIso: '2026-10-14T16:00:00Z', latestStartIso: '2026-10-14T10:00:00Z'}))
            .toMatch(/earliestStartIso must lie before latestStartIso/);
        expect(check({required: {deltaK: 12, byIso: '2026-10-14T18:00:00Z'}})).toMatch(/exceeds maxDeltaK/);
        expect(check({required: {deltaK: 3, byIso: 'tonight'}})).toMatch(/required.byIso/);
        expect(check({minDeltaK: 12})).toMatch(/minDeltaK 12 K exceeds maxDeltaK/);
        expect(check({minDeltaK: 0})).toMatch(/minDeltaK must be a finite positive/);
    });

    it('rejects the same zone offered twice, an omitted index counting as 0', () => {
        const {errors} = validateHeatpumpFlexibilityAnnouncement(offerData([dhwOption(), dhwOption({index: undefined})]));
        expect(errors.join()).toMatch(/offered more than once/);
    });

    it('checks the offer against the metadata', () => {
        const check = (option: Partial<EnyoHeatpumpFlexibilityOption>, metadata = METADATA) =>
            validateHeatpumpFlexibilityAnnouncement(offerData([dhwOption(option)]), metadata);
        expect(check({maxDeltaK: 11}).errors.join()).toMatch(/exceeds maxTemperatureC 60/);
        expect(check({}, {...METADATA, availableFeatures: [Feature.FlexibilityAnnouncementV3, Feature.DomesticHotWaterOverheating]})
            .errors.join()).toMatch(/HeatingRodControllable/);
        expect(check({target: EnyoHeatpumpControlTargetEnum.Room}).errors.join()).toMatch(/RoomOverheating/);
        expect(check({}, {...METADATA, availableFeatures: METADATA.availableFeatures.filter((f) => f !== Feature.FlexibilityAnnouncementV3)})
            .warnings.join()).toMatch(/does not declare FlexibilityAnnouncementV3/);
    });
});

describe('validateHeatpumpControlAction — against an offer', () => {
    const PV = [{source: EnyoPowerSourceEnum.Pv, powerW: 3000}];
    const action = (overrides: Partial<EnyoHeatpumpControlAction> = {}): EnyoHeatpumpControlAction => ({
        target: EnyoHeatpumpControlTargetEnum.Dhw, index: 0, deltaK: 8, ...overrides,
    });
    const offerOnlyCompressor = offerData([dhwOption({heatSources: [COMPRESSOR]})]);

    it('accepts an action inside the offer', () => {
        expect(validateHeatpumpControlAction(action(), METADATA, PV, offerData()).answer).toBe(Accepted);
        expect(validateHeatpumpControlAction(action({heatSource: EnyoHeatpumpHeatSourceEnum.Both}), METADATA, PV, offerData()).answer)
            .toBe(Accepted);
    });

    it('rejects a zone that was not offered', () => {
        const result = validateHeatpumpControlAction(
            action({target: EnyoHeatpumpControlTargetEnum.BufferTank}), METADATA, PV, offerData(),
        );
        expect(result.answer).toBe(Rejected);
        expect(result.rejectionReason).toMatch(/does not offer buffer-tank/);
    });

    it('rejects a deltaK above the offered maxDeltaK', () => {
        const result = validateHeatpumpControlAction(action({deltaK: 9}), METADATA, PV, offerData([dhwOption({maxDeltaK: 6})]));
        expect(result.rejectionReason).toMatch(/exceeds the offered maxDeltaK of 6/);
    });

    it('rejects a heat source that was not offered, Both needing both', () => {
        for (const heatSource of [EnyoHeatpumpHeatSourceEnum.HeatingRod, EnyoHeatpumpHeatSourceEnum.Both]) {
            expect(validateHeatpumpControlAction(action({heatSource}), METADATA, PV, offerOnlyCompressor).answer, heatSource)
                .toBe(Rejected);
        }
        expect(validateHeatpumpControlAction(action({heatSource: EnyoHeatpumpHeatSourceEnum.Compressor}), METADATA, PV, offerOnlyCompressor).answer)
            .toBe(Accepted);
    });
});

describe('validateHeatpumpAdvancedMetadata — FlexibilityAnnouncementV3', () => {
    it('warns when no overheating feature makes the offers controllable', () => {
        expect(validateHeatpumpAdvancedMetadata({availableFeatures: [Feature.FlexibilityAnnouncementV3]}).warnings.join())
            .toMatch(/without any overheating feature/);
        expect(validateHeatpumpAdvancedMetadata({availableFeatures: METADATA.availableFeatures}).warnings).toEqual([]);
    });
});

const T0 = Date.parse('2026-10-14T10:00:00.000Z');

describe('HeatpumpIntegrationEnergyApp.publishHeatpumpFlexibility', () => {
    let app: TestHeatpump;
    let sent: ReturnType<typeof installSdk>['sent'];

    const offers = () => sent.filter(
        (m) => m.message === EnyoDataBusMessageEnum.HeatpumpFlexibilityAnnouncementV3,
    ) as EnyoDataBusHeatpumpFlexibilityAnnouncementV3[];

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(T0);
        ({sent} = installSdk({'hp-1': {heatpump: METADATA}}));
        app = new TestHeatpump();
    });
    afterEach(() => {
        app.stop();
        vi.useRealTimers();
    });

    it('sends the offer with an offerId and validUntilIso', async () => {
        const offerId = await app.publishHeatpumpFlexibility('hp-1', [dhwOption()]);
        expect(offers()).toHaveLength(1);
        expect(offers()[0]!.applianceId).toBe('hp-1');
        expect(offers()[0]!.data).toEqual({
            offerId,
            validUntilIso: new Date(T0 + 900_000).toISOString(),
            options: [dhwOption()],
        });
    });

    it('repeats the offer with a fresh validUntilIso and the same offerId', async () => {
        const offerId = await app.publishHeatpumpFlexibility('hp-1', [dhwOption()], {validForSeconds: 120, repeatEverySeconds: 60});
        await vi.advanceTimersByTimeAsync(60_000);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(offers().map((m) => m.data.validUntilIso)).toEqual([
            new Date(T0 + 120_000).toISOString(),
            new Date(T0 + 180_000).toISOString(),
            new Date(T0 + 240_000).toISOString(),
        ]);
        expect(new Set(offers().map((m) => m.data.offerId))).toEqual(new Set([offerId]));
    });

    it('replaces the repeated offer on the next call, and stops repeating an empty one', async () => {
        await app.publishHeatpumpFlexibility('hp-1', [dhwOption()], {validForSeconds: 120, repeatEverySeconds: 60});
        await app.publishHeatpumpFlexibility('hp-1', [dhwOption({maxDeltaK: 5})], {validForSeconds: 120, repeatEverySeconds: 60});
        await vi.advanceTimersByTimeAsync(60_000);
        expect(offers().map((m) => m.data.options[0]!.maxDeltaK)).toEqual([10, 5, 5]);

        await app.publishHeatpumpFlexibility('hp-1', []);
        await vi.advanceTimersByTimeAsync(600_000);
        expect(offers()).toHaveLength(4);
        expect(offers()[3]!.data.options).toEqual([]);
    });

    it('stops repeating on stop()', async () => {
        await app.publishHeatpumpFlexibility('hp-1', [dhwOption()], {validForSeconds: 120, repeatEverySeconds: 60});
        app.stop();
        await vi.advanceTimersByTimeAsync(300_000);
        expect(offers()).toHaveLength(1);
    });

    it('refuses an invalid offer or a repeat interval not shorter than the validity', async () => {
        await expect(app.publishHeatpumpFlexibility('hp-1', [dhwOption({maxDeltaK: 11})]))
            .rejects.toThrow(/exceeds maxTemperatureC/);
        await expect(app.publishHeatpumpFlexibility('hp-1', [dhwOption()], {validForSeconds: 60, repeatEverySeconds: 60}))
            .rejects.toThrow(/repeatEverySeconds/);
        expect(offers()).toHaveLength(0);
    });

    it('checks the actions of a session naming an offerId against the current offer', async () => {
        const offerId = await app.publishHeatpumpFlexibility('hp-1', [dhwOption({maxDeltaK: 6, heatSources: [COMPRESSOR]})]);
        const control = (deltaK: number, withOfferId: boolean): EnyoDataBusHeatpumpControlV3 => ({
            id: `c-${deltaK}-${withOfferId}`,
            type: 'message',
            message: EnyoDataBusMessageEnum.HeatpumpControlV3,
            source: EnyoSourceEnum.Device,
            applianceId: 'hp-1',
            timestampIso: new Date().toISOString(),
            data: {
                sessionId: `s-${deltaK}-${withOfferId}`,
                ...(withOfferId ? {offerId} : {}),
                validUntilIso: new Date(Date.now() + 60_000).toISOString(),
                actions: [{target: EnyoHeatpumpControlTargetEnum.Dhw, index: 0, deltaK}],
            },
        });

        expect((await app.check(control(5, true)))[0]!.answer).toBe(Accepted);
        const [tooFar] = await app.check(control(8, true));
        expect(tooFar!.answer).toBe(Rejected);
        expect(tooFar!.rejectionReason).toMatch(/offered maxDeltaK of 6/);
        // Without an offerId the session is the energy manager's own plan: only the metadata applies.
        expect((await app.check(control(8, false)))[0]!.answer).toBe(Accepted);
    });

    it('no longer checks against a withdrawn offer', async () => {
        await app.publishHeatpumpFlexibility('hp-1', [dhwOption({maxDeltaK: 6})]);
        await app.publishHeatpumpFlexibility('hp-1', []);
        const [result] = await app.check({
            id: 'c', type: 'message', message: EnyoDataBusMessageEnum.HeatpumpControlV3,
            source: EnyoSourceEnum.Device, applianceId: 'hp-1', timestampIso: new Date().toISOString(),
            data: {
                sessionId: 's', offerId: 'withdrawn', validUntilIso: new Date(Date.now() + 60_000).toISOString(),
                actions: [{target: EnyoHeatpumpControlTargetEnum.Dhw, index: 0, deltaK: 8}],
            },
        });
        expect(result!.answer).toBe(Accepted);
    });
});
