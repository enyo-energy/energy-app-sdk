import {describe, expect, it} from 'vitest';
import {EnyoDataBusHeatpumpRecommendationsV1, EnyoDataBusMessageEnum} from '../../../types/enyo-data-bus-value.js';
import {EnyoHeatpumpControlAreaEnum as Area} from '../../../types/enyo-heatpump-appliance.js';
import {
    EnyoHeatpumpHeatingCurveLoweringRecommendation,
    EnyoHeatpumpPreHeatRecommendation,
    EnyoHeatpumpPreHeatTargetEnum,
    EnyoHeatpumpRecommendation,
    EnyoHeatpumpRecommendationBenefitKindEnum as Benefit,
    EnyoHeatpumpRecommendationCauseEnum as Cause,
    EnyoHeatpumpRecommendationExecutionEnum as Execution,
    EnyoHeatpumpRecommendationTypeEnum as Type,
    EnyoHeatpumpSolarHotWaterBoostRecommendation,
} from '../../../types/enyo-heatpump-recommendation.js';
import {EnyoSourceEnum} from '../../../types/enyo-source.enum.js';
import {
    validateHeatpumpRecommendation,
    validateHeatpumpRecommendationRequestMessage,
    validateHeatpumpRecommendationsMessage,
    validateHeatpumpRecommendationStatusMessage,
} from '../heatpump-recommendation-validators.js';
import {
    EnyoDataBusAcceptHeatpumpRecommendationV1,
    EnyoDataBusHeatpumpRecommendationStatusV1,
} from '../../../types/enyo-data-bus-value.js';
import {
    EnyoHeatpumpRecommendationStateEnum as State,
    EnyoHeatpumpRecommendationStopReasonEnum as StopReason,
} from '../../../types/enyo-heatpump-recommendation.js';

const WINDOW = {startIso: '2026-11-25T11:00:00.000Z', endIso: '2026-11-25T14:00:00.000Z'};

const BOOST: EnyoHeatpumpSolarHotWaterBoostRecommendation = {
    id: 'hp-1:solar-hot-water-boost:2026-11-25T11:00',
    area: Area.SolarHotWater,
    type: Type.SolarHotWaterBoost,
    cause: Cause.SolarSurplus,
    execution: Execution.OneTime,
    window: WINDOW,
    validUntilIso: '2026-11-25T11:00:00.000Z',
    benefit: {kind: Benefit.SolarEnergyKwh, value: 2.4},
    timeline: {baseline: [{startIso: '2026-11-25T17:00:00.000Z', endIso: '2026-11-25T18:00:00.000Z'}], solar: WINDOW, proposed: [WINDOW]},
    floorTemperatureC: 42,
    params: {targetTemperatureC: 55},
};

const PRE_HEAT: EnyoHeatpumpPreHeatRecommendation = {
    id: 'hp-1:pre-heat:2026-11-25T03:00',
    area: Area.CostOptimizedHeating,
    type: Type.PreHeat,
    cause: Cause.CheapHours,
    execution: Execution.OneTime,
    window: {startIso: '2026-11-25T03:00:00.000Z', endIso: '2026-11-25T05:00:00.000Z'},
    validUntilIso: '2026-11-25T03:00:00.000Z',
    benefit: {kind: Benefit.LessElectricityPercent, value: 12},
    params: {target: EnyoHeatpumpPreHeatTargetEnum.BufferTank, deltaK: 5, heatingOnsetIso: '2026-11-25T06:00:00.000Z'},
};

const CURVE: EnyoHeatpumpHeatingCurveLoweringRecommendation = {
    id: 'hp-1:heating-curve-lowering:0:-2',
    area: Area.HeatingCurve,
    type: Type.HeatingCurveLowering,
    cause: Cause.RoomsWarmEnough,
    execution: Execution.Permanent,
    validUntilIso: '2026-11-26T06:00:00.000Z',
    benefit: {kind: Benefit.LessElectricityPercent, value: 6},
    params: {heatingCircuitIndex: 0, offsetK: -2, currentOffsetK: 0},
};

/** A copy of `base` with `changes` applied, typed loosely so invalid combinations can be built. */
function invalid(base: EnyoHeatpumpRecommendation, changes: Record<string, unknown>): EnyoHeatpumpRecommendation {
    return {...base, ...changes} as unknown as EnyoHeatpumpRecommendation;
}

/** The errors of validating `recommendation`. */
function errorsOf(recommendation: EnyoHeatpumpRecommendation): string[] {
    return validateHeatpumpRecommendation(recommendation).errors;
}

describe('validateHeatpumpRecommendation', () => {
    it.each([['solar hot water boost', BOOST], ['pre-heat', PRE_HEAT], ['heating curve lowering', CURVE]])(
        'accepts a valid %s', (_label, recommendation) => {
            expect(validateHeatpumpRecommendation(recommendation)).toEqual({ok: true, errors: []});
        },
    );

    it('accepts a manual heating curve lowering', () => {
        expect(errorsOf({...CURVE, execution: Execution.Manual})).toEqual([]);
    });

    it.each(['', '   '])('rejects the id %j', (id) => {
        expect(errorsOf({...BOOST, id})).toEqual(['id must be a non-empty string']);
    });

    it('rejects an object that is no recommendation', () => {
        expect(validateHeatpumpRecommendation(null as unknown as EnyoHeatpumpRecommendation).ok).toBe(false);
    });

    it('rejects an unknown type', () => {
        expect(errorsOf(invalid(BOOST, {type: 'lower-dhw'}))).toEqual(['type "lower-dhw" is not a valid recommendation type']);
    });

    it.each([
        [BOOST, Area.CostOptimizedHeating],
        [PRE_HEAT, Area.SolarHotWater],
        [CURVE, Area.CostOptimizedHeating],
    ])('rejects area that does not match the type (%#)', (base, area) => {
        expect(errorsOf(invalid(base, {area}))).toEqual([expect.stringContaining(`area "${area}" does not match type`)]);
    });

    it.each([
        [BOOST, Execution.Permanent],
        [PRE_HEAT, Execution.Manual],
    ])('rejects a one-time type with execution %#', (base, execution) => {
        expect(errorsOf(invalid(base, {execution}))).toEqual([expect.stringContaining(`execution "${execution}" does not match`)]);
    });

    it('rejects a heating curve lowering carried out one-time', () => {
        expect(errorsOf(invalid(CURVE, {execution: Execution.OneTime, window: WINDOW})))
            .toEqual([expect.stringContaining('execution "one-time" does not match type "heating-curve-lowering"')]);
    });

    it('rejects an unknown cause', () => {
        expect(errorsOf(invalid(BOOST, {cause: 'sunny'}))).toEqual(['cause "sunny" is not a valid recommendation cause']);
    });

    it('requires a window for one-time execution', () => {
        expect(errorsOf(invalid(BOOST, {window: undefined}))).toEqual(['window is required for execution "one-time"']);
    });

    it.each([
        [{startIso: WINDOW.endIso, endIso: WINDOW.startIso}, 'must be before endIso'],
        [{startIso: WINDOW.startIso, endIso: WINDOW.startIso}, 'must be before endIso'],
        [{startIso: 'tomorrow', endIso: WINDOW.endIso}, 'must be ISO 8601 timestamps'],
    ])('rejects the window %j', (window, message) => {
        expect(errorsOf(invalid(BOOST, {window}))).toEqual([expect.stringContaining(message)]);
    });

    it('rejects an invalid validUntilIso', () => {
        expect(errorsOf({...BOOST, validUntilIso: 'soon'})).toEqual(['validUntilIso must be an ISO 8601 timestamp']);
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects the benefit value %s', (value) => {
        expect(errorsOf({...BOOST, benefit: {kind: Benefit.SolarEnergyKwh, value}}))
            .toEqual(['benefit.value must be a finite number greater than 0']);
    });

    it('accepts 100 % and rejects more than 100 % less electricity', () => {
        expect(errorsOf({...PRE_HEAT, benefit: {kind: Benefit.LessElectricityPercent, value: 100}})).toEqual([]);
        expect(errorsOf({...PRE_HEAT, benefit: {kind: Benefit.LessElectricityPercent, value: 101}}))
            .toEqual(['benefit.value 101 % must be at most 100']);
    });

    it('accepts more than 100 kWh of solar energy', () => {
        expect(errorsOf({...BOOST, benefit: {kind: Benefit.SolarEnergyKwh, value: 150}})).toEqual([]);
    });

    it('rejects an unknown benefit kind', () => {
        expect(errorsOf(invalid(BOOST, {benefit: {kind: 'euro', value: 3}})))
            .toEqual(['benefit.kind "euro" is not a valid benefit kind']);
    });

    it.each([-5, -0.5])('accepts the offset %s K', (offsetK) => {
        expect(errorsOf({...CURVE, params: {...CURVE.params, offsetK}})).toEqual([]);
    });

    it.each([0, 1, -5.5])('rejects the offset %s K', (offsetK) => {
        expect(errorsOf({...CURVE, params: {...CURVE.params, offsetK}}))
            .toEqual([`params.offsetK ${offsetK} K must be negative and at least -5 K`]);
    });

    it('rejects missing params', () => {
        expect(errorsOf(invalid(BOOST, {params: undefined}))).toEqual(['params must be an object for type "solar-hot-water-boost"']);
    });

    it('rejects a boost without a target temperature', () => {
        expect(errorsOf(invalid(BOOST, {params: {}}))).toEqual(['params.targetTemperatureC must be a finite number']);
    });

    it('rejects a pre-heat without target or heating onset', () => {
        expect(errorsOf(invalid(PRE_HEAT, {params: {target: 'dhw'}}))).toEqual([
            'params.target "dhw" is not a valid pre-heat target',
            'params.heatingOnsetIso must be an ISO 8601 timestamp',
        ]);
    });

    it('accepts every pre-heat target', () => {
        for (const target of Object.values(EnyoHeatpumpPreHeatTargetEnum)) {
            expect(errorsOf({...PRE_HEAT, params: {...PRE_HEAT.params, target}})).toEqual([]);
        }
    });

    it('rejects a pre-heat optional number that is not finite', () => {
        expect(errorsOf({...PRE_HEAT, params: {...PRE_HEAT.params, outdoorTemperatureC: Number.NaN}}))
            .toEqual(['params.outdoorTemperatureC must be a finite number']);
    });

    it('rejects a heating curve lowering without circuit or current offset', () => {
        expect(errorsOf(invalid(CURVE, {params: {heatingCircuitIndex: -1, offsetK: -2}}))).toEqual([
            'params.heatingCircuitIndex must be a non-negative integer',
            'params.currentOffsetK must be a finite number',
        ]);
    });

    it('rejects an invalid window in the timeline', () => {
        expect(errorsOf({...BOOST, timeline: {proposed: [{startIso: WINDOW.endIso, endIso: WINDOW.startIso}]}}))
            .toEqual([expect.stringContaining('timeline.proposed[0]: startIso')]);
        expect(errorsOf({...BOOST, timeline: {solar: {startIso: 'x', endIso: 'y'}, proposed: []}}))
            .toEqual(['timeline.solar: startIso and endIso must be ISO 8601 timestamps']);
        expect(errorsOf(invalid(BOOST, {timeline: {baseline: []}}))).toEqual(['timeline.proposed must be an array']);
    });

    it('rejects a floor temperature that is not finite', () => {
        expect(errorsOf({...BOOST, floorTemperatureC: Number.NaN})).toEqual(['floorTemperatureC must be a finite number']);
    });
});

describe('validateHeatpumpRecommendationsMessage', () => {
    /** A `HeatpumpRecommendationsV1` carrying the given recommendations. */
    function message(recommendations: EnyoHeatpumpRecommendation[], evaluatedAtIso = '2026-11-25T06:00:00.000Z'): EnyoDataBusHeatpumpRecommendationsV1 {
        return {
            id: 'msg-1',
            type: 'message',
            message: EnyoDataBusMessageEnum.HeatpumpRecommendationsV1,
            source: EnyoSourceEnum.Device,
            applianceId: 'hp-1',
            timestampIso: evaluatedAtIso,
            data: {evaluatedAtIso, recommendations},
        };
    }

    it('accepts an empty list and a list of valid recommendations', () => {
        expect(validateHeatpumpRecommendationsMessage(message([]))).toEqual({ok: true, errors: []});
        expect(validateHeatpumpRecommendationsMessage(message([BOOST, PRE_HEAT, CURVE]))).toEqual({ok: true, errors: []});
    });

    it('rejects duplicate ids', () => {
        expect(validateHeatpumpRecommendationsMessage(message([BOOST, {...CURVE, id: BOOST.id}])).errors)
            .toEqual([`recommendations contain duplicate id "${BOOST.id}"`]);
    });

    it('rejects an invalid recommendation, naming its position and id', () => {
        expect(validateHeatpumpRecommendationsMessage(message([BOOST, {...PRE_HEAT, validUntilIso: 'soon'}])).errors)
            .toEqual([`recommendations[1] (id=${PRE_HEAT.id}): validUntilIso must be an ISO 8601 timestamp`]);
    });

    it('rejects an invalid evaluatedAtIso', () => {
        expect(validateHeatpumpRecommendationsMessage(message([], 'now')).errors)
            .toEqual(['evaluatedAtIso must be an ISO 8601 timestamp']);
    });

    it('rejects a missing list', () => {
        const withoutList = message([]);
        (withoutList.data as {recommendations?: unknown}).recommendations = undefined;
        expect(validateHeatpumpRecommendationsMessage(withoutList)).toEqual({ok: false, errors: ['recommendations must be an array']});
    });
});

describe('validateHeatpumpRecommendationStatusMessage', () => {
    function status(data: Partial<EnyoDataBusHeatpumpRecommendationStatusV1['data']>): EnyoDataBusHeatpumpRecommendationStatusV1 {
        return {
            id: 'msg-2',
            type: 'message',
            message: EnyoDataBusMessageEnum.HeatpumpRecommendationStatusV1,
            source: EnyoSourceEnum.Device,
            applianceId: 'hp-1',
            timestampIso: '2026-11-25T11:00:00.000Z',
            data: {recommendationId: BOOST.id, state: State.Accepted, ...data},
        };
    }

    it('accepts every state with what it may carry', () => {
        expect(validateHeatpumpRecommendationStatusMessage(status({state: State.Accepted})).ok).toBe(true);
        expect(validateHeatpumpRecommendationStatusMessage(status({state: State.Active, activeUntilIso: WINDOW.endIso})).ok).toBe(true);
        expect(validateHeatpumpRecommendationStatusMessage(status({state: State.Active})).ok).toBe(true);
        expect(validateHeatpumpRecommendationStatusMessage(status({state: State.Completed})).ok).toBe(true);
        expect(validateHeatpumpRecommendationStatusMessage(status({state: State.Reset})).ok).toBe(true);
        expect(validateHeatpumpRecommendationStatusMessage(status({state: State.Rejected, stopReason: StopReason.Expired})).ok).toBe(true);
        expect(validateHeatpumpRecommendationStatusMessage(status({state: State.Aborted, stopReason: StopReason.ControlNotPossible})).ok)
            .toBe(true);
    });

    it('requires a stop reason exactly for rejected and aborted', () => {
        expect(validateHeatpumpRecommendationStatusMessage(status({state: State.Rejected})).errors)
            .toEqual(['stopReason is required when state is rejected']);
        expect(validateHeatpumpRecommendationStatusMessage(status({state: State.Completed, stopReason: StopReason.Expired})).errors)
            .toEqual(['stopReason is only allowed when state is rejected or aborted, got state completed']);
    });

    it('allows activeUntilIso only while active, and only as a timestamp', () => {
        expect(validateHeatpumpRecommendationStatusMessage(status({state: State.Accepted, activeUntilIso: WINDOW.endIso})).ok).toBe(false);
        expect(validateHeatpumpRecommendationStatusMessage(status({state: State.Active, activeUntilIso: 'tomorrow'})).errors)
            .toEqual(['activeUntilIso must be an ISO 8601 timestamp']);
    });

    it('rejects unknown states and reasons and a missing id', () => {
        expect(validateHeatpumpRecommendationStatusMessage(status({state: 'done' as State})).ok).toBe(false);
        expect(validateHeatpumpRecommendationStatusMessage(status({state: State.Aborted, stopReason: 'oops' as StopReason})).ok).toBe(false);
        expect(validateHeatpumpRecommendationStatusMessage(status({recommendationId: ''})).errors)
            .toEqual(['recommendationId must be a non-empty string']);
    });
});

describe('validateHeatpumpRecommendationRequestMessage', () => {
    const accept = (applianceId: string, recommendationId: string): EnyoDataBusAcceptHeatpumpRecommendationV1 => ({
        id: 'msg-3',
        type: 'message',
        message: EnyoDataBusMessageEnum.AcceptHeatpumpRecommendationV1,
        source: EnyoSourceEnum.Device,
        applianceId,
        timestampIso: '2026-11-25T07:00:00.000Z',
        data: {recommendationId},
    });

    it('accepts a request naming the heat pump and the recommendation', () => {
        expect(validateHeatpumpRecommendationRequestMessage(accept('hp-1', BOOST.id))).toEqual({ok: true, errors: []});
    });

    it('rejects a request without heat pump or recommendation id', () => {
        expect(validateHeatpumpRecommendationRequestMessage(accept('', ''))).toEqual({
            ok: false,
            errors: ['applianceId must be a non-empty string', 'recommendationId must be a non-empty string'],
        });
    });
});
