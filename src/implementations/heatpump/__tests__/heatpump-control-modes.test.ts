import {describe, expect, it} from 'vitest';
import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum as Feature,
    EnyoHeatpumpApplianceHeatingCurve,
    EnyoHeatpumpApplianceMetadata,
    EnyoHeatpumpControlAreaEnum as Area,
    EnyoHeatpumpControlModeEnum as Mode,
    EnyoHeatpumpProgramModeEnum,
} from '../../../types/enyo-heatpump-appliance.js';
import {
    availableHeatpumpControlModes,
    deriveHeatpumpCurveOptimizationEnabled,
    heatpumpControlAreas,
    isHeatpumpEcoModeActive,
    resolveHeatpumpControlModes,
} from '../heatpump-control-modes.js';
import {EnyoLegionellaSlotAdjustableEnum} from '../../../types/enyo-legionella.js';

const CURVE: EnyoHeatpumpApplianceHeatingCurve = {
    points: [{outdoorTemperatureC: -10, flowTemperatureC: 45}, {outdoorTemperatureC: 20, flowTemperatureC: 25}],
};

/** iDM-like: hot water, buffer, rooms, PV surplus, eco and a shiftable curve. */
const IDM: EnyoHeatpumpApplianceMetadata = {
    availableFeatures: [
        Feature.DomesticHotWaterOverheating,
        Feature.BufferTankOverheating,
        Feature.RoomOverheating,
        Feature.PvSurplusSignal,
        Feature.ProgramSwitch,
        Feature.HeatingCurve,
        Feature.HeatingCurveOffset,
    ],
    heatingCircuits: [{
        index: 0,
        heatingCurve: CURVE,
        supportedProgramModes: [EnyoHeatpumpProgramModeEnum.Comfort, EnyoHeatpumpProgramModeEnum.Eco],
    }],
};
/** {@link IDM} that also reports a legionella program it can move — every area offered. */
const IDM_WITH_LEGIONELLA: EnyoHeatpumpApplianceMetadata = {
    ...IDM,
    availableFeatures: [...IDM.availableFeatures, Feature.LegionellaSchedule],
    domesticHotWater: [{
        index: 0,
        targetTemperatureC: 50,
        legionella: {ownerSlot: {dayOfWeek: 6, timeOfDay: '01:00'}, adjustable: EnyoLegionellaSlotAdjustableEnum.TimeOnly},
    }],
};
/** LAMBDA-like: nothing but the available-power announcement. */
const AVAILABLE_POWER_ONLY: EnyoHeatpumpApplianceMetadata = {availableFeatures: [Feature.AvailablePowerAnnouncement]};
/** Eco on a heating circuit and nothing else. */
const ECO_ONLY: EnyoHeatpumpApplianceMetadata = {
    availableFeatures: [Feature.ProgramSwitch],
    heatingCircuits: [{index: 0, supportedProgramModes: [EnyoHeatpumpProgramModeEnum.Eco]}],
};
const NO_FEATURES: EnyoHeatpumpApplianceMetadata = {availableFeatures: []};

/** {@link IDM} with curve optimisation switched on or off on its circuit. */
const idmWithCurveOptimization = (enabled: boolean): EnyoHeatpumpApplianceMetadata => ({
    ...IDM,
    heatingCircuits: [{...IDM.heatingCircuits![0], curveOptimization: {enabled, roomIds: ['living-room']}}],
});

describe('heatpumpControlAreas', () => {
    it('offers all three areas, in order, on an iDM-like heat pump', () => {
        expect(heatpumpControlAreas(IDM)).toEqual([Area.SolarHotWater, Area.CostOptimizedHeating, Area.HeatingCurve]);
    });

    it('offers solar hot water and cost-optimised heating with only the available-power announcement', () => {
        expect(heatpumpControlAreas(AVAILABLE_POWER_ONLY)).toEqual([Area.SolarHotWater, Area.CostOptimizedHeating]);
    });

    it('offers only cost-optimised heating with eco alone', () => {
        expect(heatpumpControlAreas(ECO_ONLY)).toEqual([Area.CostOptimizedHeating]);
    });

    it('offers nothing without features', () => {
        expect(heatpumpControlAreas(NO_FEATURES)).toEqual([]);
    });

    it('does not count eco on a domestic-hot-water zone', () => {
        expect(heatpumpControlAreas({
            availableFeatures: [Feature.ProgramSwitch],
            domesticHotWater: [{index: 0, targetTemperatureC: 50, supportedProgramModes: [EnyoHeatpumpProgramModeEnum.Eco]}],
        })).toEqual([]);
    });

    it('does not count eco on a circuit without the ProgramSwitch feature', () => {
        expect(heatpumpControlAreas({...ECO_ONLY, availableFeatures: []})).toEqual([]);
    });

    it('offers the heating curve when a circuit reports one, without any feature', () => {
        expect(heatpumpControlAreas({availableFeatures: [], heatingCircuits: [{index: 0, heatingCurve: CURVE}]}))
            .toEqual([Area.HeatingCurve]);
    });

    it.each([Feature.HeatingCurve, Feature.HeatingCurveOffset])('offers the heating curve with %s alone', (feature) => {
        expect(heatpumpControlAreas({availableFeatures: [feature]})).toEqual([Area.HeatingCurve]);
    });

    it.each([Feature.DomesticHotWaterOverheating, Feature.PvSurplusSignal, Feature.AvailablePowerAnnouncement])(
        'offers solar hot water with %s', (feature) => {
            expect(heatpumpControlAreas({availableFeatures: [feature]})).toContain(Area.SolarHotWater);
        },
    );

    it.each([Feature.BufferTankOverheating, Feature.RoomOverheating, Feature.PvSurplusSignal, Feature.AvailablePowerAnnouncement])(
        'offers cost-optimised heating with %s (pre-heating)', (feature) => {
            expect(heatpumpControlAreas({availableFeatures: [feature]})).toContain(Area.CostOptimizedHeating);
        },
    );
});

describe('availableHeatpumpControlModes', () => {
    it('offers every mode in every area of an iDM-like heat pump', () => {
        for (const area of Object.values(Area)) {
            expect(availableHeatpumpControlModes(IDM_WITH_LEGIONELLA, area)).toEqual([Mode.Off, Mode.Recommend, Mode.Auto]);
        }
    });

    it('offers no Recommend for cost-optimised heating with eco alone', () => {
        expect(availableHeatpumpControlModes(ECO_ONLY, Area.CostOptimizedHeating)).toEqual([Mode.Off, Mode.Auto]);
    });

    it('offers no Auto for the heating curve without HeatingCurveOffset', () => {
        expect(availableHeatpumpControlModes({availableFeatures: [Feature.HeatingCurve]}, Area.HeatingCurve))
            .toEqual([Mode.Off, Mode.Recommend]);
    });

    it('offers nothing for an area the heat pump does not offer', () => {
        expect(availableHeatpumpControlModes(NO_FEATURES, Area.SolarHotWater)).toEqual([]);
        expect(availableHeatpumpControlModes(AVAILABLE_POWER_ONLY, Area.HeatingCurve)).toEqual([]);
    });

    it('offers only Off on a heat pump the integration marks monitor-only', () => {
        for (const area of Object.values(Area)) {
            expect(availableHeatpumpControlModes({...IDM_WITH_LEGIONELLA, controlAllowed: false}, area)).toEqual([Mode.Off]);
        }
        expect(availableHeatpumpControlModes({...NO_FEATURES, controlAllowed: false}, Area.SolarHotWater)).toEqual([]);
    });
});

describe('resolveHeatpumpControlModes', () => {
    const allAuto = {[Area.SolarHotWater]: Mode.Auto, [Area.CostOptimizedHeating]: Mode.Auto};

    it('defaults to Auto where the energy manager controls today', () => {
        expect(resolveHeatpumpControlModes(IDM, {heatpumpControl: true})).toEqual({
            ...allAuto,
            [Area.HeatingCurve]: Mode.Recommend,
        });
    });

    it.each([
        ['off', {heatpumpControl: false}],
        ['missing', {}],
    ])('defaults to Recommend when heatpumpControl is %s', (_label, settings) => {
        expect(resolveHeatpumpControlModes(IDM, settings)).toEqual({
            [Area.SolarHotWater]: Mode.Recommend,
            [Area.CostOptimizedHeating]: Mode.Recommend,
            [Area.HeatingCurve]: Mode.Recommend,
        });
    });

    it('resolves a monitor-only heat pump to Off everywhere', () => {
        expect(resolveHeatpumpControlModes({...IDM, controlAllowed: false}, {heatpumpControl: true})).toEqual({
            [Area.SolarHotWater]: Mode.Off,
            [Area.CostOptimizedHeating]: Mode.Off,
            [Area.HeatingCurve]: Mode.Off,
        });
    });

    it('keeps a monitor-only heat pump Off even when the customer stored Auto', () => {
        const metadata = {
            ...IDM,
            controlAllowed: false,
            controlModes: {[Area.SolarHotWater]: Mode.Auto, [Area.CostOptimizedHeating]: Mode.Auto, [Area.HeatingCurve]: Mode.Auto},
        };
        expect(resolveHeatpumpControlModes(metadata, {heatpumpControl: true})).toEqual({
            [Area.SolarHotWater]: Mode.Off,
            [Area.CostOptimizedHeating]: Mode.Off,
            [Area.HeatingCurve]: Mode.Off,
        });
    });

    it('defaults the heating curve to Auto when controlled and the curve optimisation is on', () => {
        expect(resolveHeatpumpControlModes(idmWithCurveOptimization(true), {heatpumpControl: true}))
            .toEqual({...allAuto, [Area.HeatingCurve]: Mode.Auto});
    });

    it('defaults the heating curve to Recommend when the curve optimisation is off', () => {
        expect(resolveHeatpumpControlModes(idmWithCurveOptimization(false), {heatpumpControl: true})[Area.HeatingCurve])
            .toBe(Mode.Recommend);
    });

    it('defaults the heating curve to Recommend when the optimisation is on but not controlled', () => {
        expect(resolveHeatpumpControlModes(idmWithCurveOptimization(true), {heatpumpControl: false})[Area.HeatingCurve])
            .toBe(Mode.Recommend);
    });

    it('defaults the heating curve to Recommend when the optimisation is on but Auto is not offered', () => {
        const shadowOnly: EnyoHeatpumpApplianceMetadata = {
            availableFeatures: [Feature.HeatingCurve],
            heatingCircuits: [{index: 0, heatingCurve: CURVE, curveOptimization: {enabled: true}}],
        };
        expect(resolveHeatpumpControlModes(shadowOnly, {heatpumpControl: true})).toEqual({[Area.HeatingCurve]: Mode.Recommend});
    });

    it('defaults eco-only cost-optimised heating to Auto when controlled and to Off otherwise', () => {
        expect(resolveHeatpumpControlModes(ECO_ONLY, {heatpumpControl: true})).toEqual({[Area.CostOptimizedHeating]: Mode.Auto});
        expect(resolveHeatpumpControlModes(ECO_ONLY, {heatpumpControl: false})).toEqual({[Area.CostOptimizedHeating]: Mode.Off});
    });

    it('keeps a stored mode the area offers, over the default', () => {
        const metadata = {...IDM, controlModes: {[Area.SolarHotWater]: Mode.Off, [Area.HeatingCurve]: Mode.Auto}};
        expect(resolveHeatpumpControlModes(metadata, {heatpumpControl: true})).toEqual({
            [Area.SolarHotWater]: Mode.Off,
            [Area.CostOptimizedHeating]: Mode.Auto,
            [Area.HeatingCurve]: Mode.Auto,
        });
        expect(resolveHeatpumpControlModes(metadata, {heatpumpControl: false})[Area.HeatingCurve]).toBe(Mode.Auto);
    });

    it('falls back to Recommend for a stored mode the area does not offer', () => {
        const metadata: EnyoHeatpumpApplianceMetadata = {
            availableFeatures: [Feature.HeatingCurve],
            controlModes: {[Area.HeatingCurve]: Mode.Auto},
        };
        expect(resolveHeatpumpControlModes(metadata, {heatpumpControl: true})).toEqual({[Area.HeatingCurve]: Mode.Recommend});
    });

    it('falls back to Off when Recommend is not offered either', () => {
        const metadata = {...ECO_ONLY, controlModes: {[Area.CostOptimizedHeating]: Mode.Recommend}};
        expect(resolveHeatpumpControlModes(metadata, {heatpumpControl: true})).toEqual({[Area.CostOptimizedHeating]: Mode.Off});
    });

    it('falls back for a stored value that is no mode at all', () => {
        const metadata = {...IDM, controlModes: {[Area.SolarHotWater]: 'always' as Mode}};
        expect(resolveHeatpumpControlModes(metadata, {heatpumpControl: true})[Area.SolarHotWater]).toBe(Mode.Recommend);
    });

    it('has no entry for an area the heat pump does not offer, even when stored', () => {
        const metadata = {...AVAILABLE_POWER_ONLY, controlModes: {[Area.HeatingCurve]: Mode.Auto}};
        expect(resolveHeatpumpControlModes(metadata, {heatpumpControl: true})).toEqual(allAuto);
        expect(resolveHeatpumpControlModes(NO_FEATURES, {heatpumpControl: true})).toEqual({});
    });
});

describe('isHeatpumpEcoModeActive', () => {
    const autoCost = (metadata: EnyoHeatpumpApplianceMetadata): EnyoHeatpumpApplianceMetadata =>
        ({...metadata, controlModes: {[Area.CostOptimizedHeating]: Mode.Auto}});

    it('is active when the setting is on and cost-optimised heating is Auto — without heatpumpControl', () => {
        expect(isHeatpumpEcoModeActive(autoCost(IDM), {heatpumpEcoModeInExpensiveTimes: true})).toBe(true);
    });

    it('is inactive when the setting is off or unset', () => {
        expect(isHeatpumpEcoModeActive(autoCost(IDM), {heatpumpEcoModeInExpensiveTimes: false})).toBe(false);
        expect(isHeatpumpEcoModeActive(autoCost(IDM), {})).toBe(false);
    });

    it('is inactive while cost-optimised heating is Recommend or Off', () => {
        for (const mode of [Mode.Recommend, Mode.Off]) {
            const metadata = {...IDM, controlModes: {[Area.CostOptimizedHeating]: mode}};
            expect(isHeatpumpEcoModeActive(metadata, {heatpumpEcoModeInExpensiveTimes: true, heatpumpControl: true})).toBe(false);
        }
    });

    it('is inactive on a heat pump that cannot switch to eco, or is monitor-only', () => {
        expect(isHeatpumpEcoModeActive(autoCost(AVAILABLE_POWER_ONLY), {heatpumpEcoModeInExpensiveTimes: true})).toBe(false);
        expect(isHeatpumpEcoModeActive({...autoCost(IDM), controlAllowed: false}, {heatpumpEcoModeInExpensiveTimes: true}))
            .toBe(false);
    });
});

describe('deriveHeatpumpCurveOptimizationEnabled', () => {
    it('is true only when the heating curve is Auto', () => {
        expect(deriveHeatpumpCurveOptimizationEnabled({[Area.HeatingCurve]: Mode.Auto})).toBe(true);
        expect(deriveHeatpumpCurveOptimizationEnabled({[Area.HeatingCurve]: Mode.Recommend, [Area.SolarHotWater]: Mode.Auto}))
            .toBe(false);
        expect(deriveHeatpumpCurveOptimizationEnabled({[Area.HeatingCurve]: Mode.Off})).toBe(false);
        expect(deriveHeatpumpCurveOptimizationEnabled({})).toBe(false);
    });
});

describe('LegionellaProgram area', () => {
    const recommendOnly: EnyoHeatpumpApplianceMetadata = {
        availableFeatures: [],
        domesticHotWater: [{index: 0, targetTemperatureC: 50, legionella: {ownerSlot: {dayOfWeek: 6, timeOfDay: '01:00'}}}],
    };

    it('is offered after the heating curve when a hot water zone reports its program', () => {
        expect(heatpumpControlAreas(IDM_WITH_LEGIONELLA)).toEqual([
            Area.SolarHotWater, Area.CostOptimizedHeating, Area.HeatingCurve, Area.LegionellaProgram,
        ]);
        expect(heatpumpControlAreas(IDM)).not.toContain(Area.LegionellaProgram);
    });

    it('offers no Auto without LegionellaSchedule or without adjustable', () => {
        expect(availableHeatpumpControlModes(recommendOnly, Area.LegionellaProgram)).toEqual([Mode.Off, Mode.Recommend]);
        const featureWithoutAdjustable = {...recommendOnly, availableFeatures: [Feature.LegionellaSchedule]};
        expect(availableHeatpumpControlModes(featureWithoutAdjustable, Area.LegionellaProgram)).toEqual([Mode.Off, Mode.Recommend]);
    });

    it('defaults to Recommend even where the energy manager controls today', () => {
        expect(resolveHeatpumpControlModes(IDM_WITH_LEGIONELLA, {heatpumpControl: true})[Area.LegionellaProgram]).toBe(Mode.Recommend);
    });

    it('keeps a stored Auto when offered and falls back to Recommend when not', () => {
        const stored = {[Area.LegionellaProgram]: Mode.Auto};
        expect(resolveHeatpumpControlModes({...IDM_WITH_LEGIONELLA, controlModes: stored}, {})[Area.LegionellaProgram]).toBe(Mode.Auto);
        expect(resolveHeatpumpControlModes({...recommendOnly, controlModes: stored}, {})[Area.LegionellaProgram]).toBe(Mode.Recommend);
    });
});

describe('controlModeDefaults (integration-owned)', () => {
    const offDefault = {[Area.LegionellaProgram]: Mode.Off} as const;

    it('replaces the Recommend default of an area', () => {
        const metadata = {...IDM_WITH_LEGIONELLA, controlModeDefaults: offDefault};
        expect(resolveHeatpumpControlModes(metadata, {})[Area.LegionellaProgram]).toBe(Mode.Off);
        expect(resolveHeatpumpControlModes(metadata, {})[Area.SolarHotWater]).toBe(Mode.Recommend);
    });

    it('loses against a mode the customer stored', () => {
        const metadata = {
            ...IDM_WITH_LEGIONELLA,
            controlModeDefaults: offDefault,
            controlModes: {[Area.LegionellaProgram]: Mode.Auto},
        };
        expect(resolveHeatpumpControlModes(metadata, {})[Area.LegionellaProgram]).toBe(Mode.Auto);
    });

    it('loses against Auto derived from the customer\'s earlier switches', () => {
        const metadata = {
            ...idmWithCurveOptimization(true),
            controlModeDefaults: {[Area.SolarHotWater]: Mode.Off, [Area.HeatingCurve]: Mode.Off} as const,
        };
        expect(resolveHeatpumpControlModes(metadata, {heatpumpControl: true})).toMatchObject({
            [Area.SolarHotWater]: Mode.Auto,
            [Area.HeatingCurve]: Mode.Auto,
        });
        expect(resolveHeatpumpControlModes(metadata, {heatpumpControl: false})).toMatchObject({
            [Area.SolarHotWater]: Mode.Off,
            [Area.HeatingCurve]: Mode.Off,
        });
    });

    it('ignores Auto or an unknown value as a default', () => {
        for (const bad of [Mode.Auto, 'manual']) {
            const metadata = {
                ...IDM_WITH_LEGIONELLA,
                controlModeDefaults: {[Area.LegionellaProgram]: bad} as EnyoHeatpumpApplianceMetadata['controlModeDefaults'],
            };
            expect(resolveHeatpumpControlModes(metadata, {})[Area.LegionellaProgram]).toBe(Mode.Recommend);
        }
    });

    it('falls back to Off for a Recommend default where Recommend is not offered', () => {
        const metadata = {...ECO_ONLY, controlModeDefaults: {[Area.CostOptimizedHeating]: Mode.Recommend} as const};
        expect(resolveHeatpumpControlModes(metadata, {})).toEqual({[Area.CostOptimizedHeating]: Mode.Off});
    });

    it('keeps a monitor-only heat pump Off', () => {
        const metadata = {
            ...IDM_WITH_LEGIONELLA,
            controlAllowed: false,
            controlModeDefaults: {[Area.LegionellaProgram]: Mode.Recommend} as const,
        };
        expect(resolveHeatpumpControlModes(metadata, {})[Area.LegionellaProgram]).toBe(Mode.Off);
    });
});
