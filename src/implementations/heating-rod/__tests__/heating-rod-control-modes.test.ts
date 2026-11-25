import {describe, expect, it} from 'vitest';
import {EnyoHeatpumpControlAreaEnum as Area, EnyoHeatpumpControlModeEnum as Mode} from '../../../types/enyo-heatpump-appliance.js';
import {
    EnyoHeatingRodApplianceAvailableFeaturesEnum as Feature,
    EnyoHeatingRodApplianceMetadata,
} from '../../../types/enyo-heating-rod-appliance.js';
import {EnyoLegionellaSlotAdjustableEnum} from '../../../types/enyo-legionella.js';
import {
    availableHeatingRodControlModes,
    heatingRodControlAreas,
    resolveHeatingRodControlModes,
} from '../heating-rod-control-modes.js';

const PLAIN: EnyoHeatingRodApplianceMetadata = {availableFeatures: [], targetTemperatureC: 60};
const RECOMMEND_ONLY: EnyoHeatingRodApplianceMetadata = {
    ...PLAIN,
    legionella: {ownerSlot: {dayOfWeek: 6, timeOfDay: '01:00'}},
};
const SCHEDULABLE: EnyoHeatingRodApplianceMetadata = {
    ...PLAIN,
    availableFeatures: [Feature.LegionellaSchedule],
    legionella: {ownerSlot: {dayOfWeek: 6, timeOfDay: '01:00'}, adjustable: EnyoLegionellaSlotAdjustableEnum.DayAndTime},
};

describe('heating rod control modes', () => {
    it('offers the legionella area only when the rod reports its program', () => {
        expect(heatingRodControlAreas(PLAIN)).toEqual([]);
        expect(heatingRodControlAreas(RECOMMEND_ONLY)).toEqual([Area.LegionellaProgram]);
        expect(availableHeatingRodControlModes(SCHEDULABLE, Area.HeatingCurve)).toEqual([]);
    });

    it('offers Auto only with the feature and adjustable', () => {
        expect(availableHeatingRodControlModes(RECOMMEND_ONLY, Area.LegionellaProgram)).toEqual([Mode.Off, Mode.Recommend]);
        expect(availableHeatingRodControlModes({...RECOMMEND_ONLY, availableFeatures: [Feature.LegionellaSchedule]}, Area.LegionellaProgram))
            .toEqual([Mode.Off, Mode.Recommend]);
        expect(availableHeatingRodControlModes(SCHEDULABLE, Area.LegionellaProgram)).toEqual([Mode.Off, Mode.Recommend, Mode.Auto]);
    });

    it('defaults to Recommend, keeps a stored mode and falls back when Auto is not offered', () => {
        expect(resolveHeatingRodControlModes(SCHEDULABLE)).toEqual({[Area.LegionellaProgram]: Mode.Recommend});
        expect(resolveHeatingRodControlModes({...SCHEDULABLE, controlModes: {[Area.LegionellaProgram]: Mode.Auto}}))
            .toEqual({[Area.LegionellaProgram]: Mode.Auto});
        expect(resolveHeatingRodControlModes({...RECOMMEND_ONLY, controlModes: {[Area.LegionellaProgram]: Mode.Auto}}))
            .toEqual({[Area.LegionellaProgram]: Mode.Recommend});
        expect(resolveHeatingRodControlModes(PLAIN)).toEqual({});
    });

    it('takes the integration default Off or Recommend, but never Auto', () => {
        expect(resolveHeatingRodControlModes({...SCHEDULABLE, controlModeDefaults: {[Area.LegionellaProgram]: Mode.Off}}))
            .toEqual({[Area.LegionellaProgram]: Mode.Off});
        const autoDefault = {[Area.LegionellaProgram]: Mode.Auto} as EnyoHeatingRodApplianceMetadata['controlModeDefaults'];
        expect(resolveHeatingRodControlModes({...SCHEDULABLE, controlModeDefaults: autoDefault}))
            .toEqual({[Area.LegionellaProgram]: Mode.Recommend});
        expect(resolveHeatingRodControlModes({
            ...SCHEDULABLE,
            controlModeDefaults: {[Area.LegionellaProgram]: Mode.Off},
            controlModes: {[Area.LegionellaProgram]: Mode.Auto},
        })).toEqual({[Area.LegionellaProgram]: Mode.Auto});
    });

    it('resolves a monitor-only rod to Off', () => {
        const monitorOnly = {...SCHEDULABLE, controlAllowed: false, controlModes: {[Area.LegionellaProgram]: Mode.Auto}};
        expect(availableHeatingRodControlModes(monitorOnly, Area.LegionellaProgram)).toEqual([Mode.Off]);
        expect(resolveHeatingRodControlModes(monitorOnly)).toEqual({[Area.LegionellaProgram]: Mode.Off});
    });
});
