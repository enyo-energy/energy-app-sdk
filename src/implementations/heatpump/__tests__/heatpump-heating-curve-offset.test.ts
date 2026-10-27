import {beforeEach, describe, expect, it} from 'vitest';
import {EnyoCommandAcknowledgeAnswerEnum} from '../../../types/enyo-data-bus-value.js';
import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum as Feature,
    EnyoHeatpumpApplianceHeatingCurve,
    EnyoHeatpumpApplianceMetadata,
} from '../../../types/enyo-heatpump-appliance.js';
import {validateHeatpumpHeatingCurveOffset} from '../heatpump-control-validators.js';
import {validateHeatpumpAdvancedMetadata} from '../heatpump-metadata-validators.js';
import {
    interpolateHeatingCurve,
    isHeatingCurveManuallyChanged,
    shiftHeatingCurve,
} from '../heatpump-heating-curve-offset.js';
import {installSdk, TestHeatpump} from './heatpump-test-harness.js';

const {Accepted, Rejected, NotSupported} = EnyoCommandAcknowledgeAnswerEnum;

// A floor-heating curve.
const CURVE: EnyoHeatpumpApplianceHeatingCurve = {
    points: [
        [-20, 42.2], [-15, 41.4], [-10, 39], [-5, 36.6], [0, 34], [5, 31.4], [10, 28.5], [15, 25.3], [20, 21],
    ].map(([outdoorTemperatureC, flowTemperatureC]) => ({outdoorTemperatureC, flowTemperatureC})),
    parallelShiftK: 0,
};

const METADATA: EnyoHeatpumpApplianceMetadata = {
    availableFeatures: [Feature.HeatingCurve, Feature.HeatingCurveOffset],
    heatingCircuits: [
        {index: 0, heatingCurve: CURVE, heatingCurveOffsetRangeK: {minK: -5, maxK: 5}},
        {index: 1},
    ],
};

describe('validateHeatpumpHeatingCurveOffset', () => {
    it('accepts an offset within the range and 0 everywhere', () => {
        expect(validateHeatpumpHeatingCurveOffset({heatingCircuitIndex: 0, offsetK: -2.5}, METADATA).answer).toBe(Accepted);
        expect(validateHeatpumpHeatingCurveOffset({heatingCircuitIndex: 0, offsetK: 0}, METADATA).answer).toBe(Accepted);
        expect(validateHeatpumpHeatingCurveOffset({heatingCircuitIndex: 1, offsetK: 0}, METADATA).answer).toBe(Accepted);
    });

    it('rejects an offset outside the range or on a circuit without a range', () => {
        expect(validateHeatpumpHeatingCurveOffset({heatingCircuitIndex: 0, offsetK: -5.5}, METADATA).answer).toBe(Rejected);
        expect(validateHeatpumpHeatingCurveOffset({heatingCircuitIndex: 1, offsetK: -1}, METADATA).answer).toBe(Rejected);
    });

    it('rejects an unknown circuit and malformed values', () => {
        expect(validateHeatpumpHeatingCurveOffset({heatingCircuitIndex: 3, offsetK: -1}, METADATA).answer).toBe(Rejected);
        expect(validateHeatpumpHeatingCurveOffset({heatingCircuitIndex: -1, offsetK: -1}, undefined).answer).toBe(Rejected);
        expect(validateHeatpumpHeatingCurveOffset({heatingCircuitIndex: 0, offsetK: Number.NaN}, undefined).answer).toBe(Rejected);
    });

    it('answers NotSupported without the feature', () => {
        const result = validateHeatpumpHeatingCurveOffset(
            {heatingCircuitIndex: 0, offsetK: -1}, {...METADATA, availableFeatures: [Feature.HeatingCurve]},
        );
        expect(result.answer).toBe(NotSupported);
    });

    it('without metadata checks only the message itself', () => {
        expect(validateHeatpumpHeatingCurveOffset({heatingCircuitIndex: 7, offsetK: -9}, undefined).answer).toBe(Accepted);
    });
});

describe('HeatpumpIntegrationEnergyApp — SetHeatpumpHeatingCurveOffsetV1', () => {
    let heatpump: TestHeatpump;
    beforeEach(() => {
        installSdk({'hp-1': {heatpump: METADATA}});
        heatpump = new TestHeatpump();
    });

    it('answers NotSupported when the integration does not override the handler', async () => {
        expect((await heatpump.heatingCurveOffset({heatingCircuitIndex: 0, offsetK: -1})).answer).toBe(NotSupported);
    });

    it('passes a valid offset to the handler', async () => {
        heatpump.curveOffsetResponse = async () => ({answer: Accepted});
        expect((await heatpump.heatingCurveOffset({heatingCircuitIndex: 0, offsetK: -1.5})).answer).toBe(Accepted);
        expect(heatpump.curveOffsets.map((m) => m.data.offsetK)).toEqual([-1.5]);
    });

    it('rejects an invalid offset without calling the handler', async () => {
        heatpump.curveOffsetResponse = async () => ({answer: Accepted});
        const response = await heatpump.heatingCurveOffset({heatingCircuitIndex: 0, offsetK: -8});
        expect(response.answer).toBe(Rejected);
        expect(response.rejectionReason).toMatch(/outside the range/);
        expect(heatpump.curveOffsets).toHaveLength(0);
    });

    it('answers NotSupported without the feature, even when the handler is overridden', async () => {
        installSdk({'hp-1': {heatpump: {...METADATA, availableFeatures: []}}});
        heatpump = new TestHeatpump();
        heatpump.curveOffsetResponse = async () => ({answer: Accepted});
        expect((await heatpump.heatingCurveOffset({heatingCircuitIndex: 0, offsetK: -1})).answer).toBe(NotSupported);
        expect(heatpump.curveOffsets).toHaveLength(0);
    });
});

describe('heating curve helpers', () => {
    it('interpolates linearly and clamps outside the curve', () => {
        expect(interpolateHeatingCurve(CURVE.points, 7.5)).toBeCloseTo(29.95);
        expect(interpolateHeatingCurve(CURVE.points, -30)).toBe(42.2);
        expect(interpolateHeatingCurve(CURVE.points, 25)).toBe(21);
        expect(interpolateHeatingCurve([], 0)).toBeUndefined();
    });

    it('shifts every point without touching the original', () => {
        const shifted = shiftHeatingCurve(CURVE, -2);
        expect(shifted.points[4]).toEqual({outdoorTemperatureC: 0, flowTemperatureC: 32});
        expect(shifted.parallelShiftK).toBe(0);
        expect(CURVE.points[4].flowTemperatureC).toBe(34);
    });

    it('detects a manual change beyond 0.5 K, but not the expected offset', () => {
        expect(isHeatingCurveManuallyChanged(CURVE, -2, shiftHeatingCurve(CURVE, -2))).toBe(false);
        expect(isHeatingCurveManuallyChanged(CURVE, -2, shiftHeatingCurve(CURVE, -1.6))).toBe(false);
        expect(isHeatingCurveManuallyChanged(CURVE, -2, shiftHeatingCurve(CURVE, -1))).toBe(true);
        expect(isHeatingCurveManuallyChanged(CURVE, 0, shiftHeatingCurve(CURVE, -2))).toBe(true);
    });

    it('compares curves sampled at different outdoor temperatures', () => {
        const line = (step: number) => ({
            points: Array.from({length: 40 / step + 1}, (_, i) => -20 + i * step)
                .map((outdoorTemperatureC) => ({outdoorTemperatureC, flowTemperatureC: 35 - 0.4 * outdoorTemperatureC})),
        });
        expect(isHeatingCurveManuallyChanged(line(5), 0, line(20))).toBe(false);
        const steeper = {points: line(20).points.map((p) => ({...p, flowTemperatureC: p.flowTemperatureC + (p.outdoorTemperatureC < 0 ? 2 : 0)}))};
        expect(isHeatingCurveManuallyChanged(line(5), 0, steeper)).toBe(true);
    });
});

describe('validateHeatpumpAdvancedMetadata — heating curve offset', () => {
    it('accepts valid offset fields and customer settings', () => {
        const result = validateHeatpumpAdvancedMetadata({
            ...METADATA,
            heatingCircuits: [{
                index: 0,
                heatingCurve: shiftHeatingCurve(CURVE, -1.5),
                heatingCurveOffsetRangeK: {minK: -5, maxK: 5},
                activeHeatingCurveOffsetK: -1.5,
                initialHeatingCurve: CURVE,
                curveOptimization: {
                    enabled: true,
                    roomIds: ['living', 'bath', 'hall'],
                    rooms: [
                        {roomId: 'living', name: 'Wohnzimmer', targetRoomTemperatureC: 21, sensors: [{applianceId: 'shelly-1', sensorId: '0'}]},
                        {roomId: 'bath', targetRoomTemperatureC: 23, sensors: [{applianceId: 'shelly-2', sensorId: '0'}]},
                        {roomId: 'hall', targetRoomTemperatureC: 21, sensors: []},
                    ],
                },
            }],
        });
        expect(result).toEqual({ok: true, errors: [], warnings: []});
    });

    it('reports a range without 0, an active offset outside it and bad customer settings', () => {
        const result = validateHeatpumpAdvancedMetadata({
            ...METADATA,
            heatingCircuits: [{
                index: 0,
                heatingCurveOffsetRangeK: {minK: 1, maxK: 5},
                activeHeatingCurveOffsetK: -2,
                initialHeatingCurve: {points: [{outdoorTemperatureC: 0, flowTemperatureC: 34}]},
                curveOptimization: {
                    enabled: true,
                    roomIds: [''],
                    rooms: [
                        {roomId: 'living', targetRoomTemperatureC: 21, sensors: [{applianceId: 'shelly-1', sensorId: ''}]},
                        {roomId: '', targetRoomTemperatureC: 30, sensors: []},
                    ],
                },
            }],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.join('\n')).toMatch(/must contain 0/);
        expect(result.errors.join('\n')).toMatch(/activeHeatingCurveOffsetK -2 K is outside/);
        expect(result.errors.join('\n')).toMatch(/initialHeatingCurve/);
        expect(result.errors.join('\n')).toMatch(/roomIds\[0\] must be a non-empty string/);
        expect(result.errors.join('\n')).toMatch(/rooms\[0\]\.sensors\[0\] needs applianceId and sensorId/);
        expect(result.errors.join('\n')).toMatch(/rooms\[1\] needs a roomId/);
        expect(result.errors.join('\n')).toMatch(/rooms\[1\]\.targetRoomTemperatureC must lie within 16…26 °C; got 30/);
    });

    it('warns when HeatingCurveOffset is declared without any range', () => {
        const result = validateHeatpumpAdvancedMetadata({...METADATA, heatingCircuits: [{index: 0}]});
        expect(result.warnings.join('\n')).toMatch(/no heating circuit has a heatingCurveOffsetRangeK/);
    });
});
