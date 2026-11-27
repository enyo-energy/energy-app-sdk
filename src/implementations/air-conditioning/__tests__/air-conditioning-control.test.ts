import {describe, expect, it} from 'vitest';
import {
    EnyoAirConditioningApplianceAvailableFeaturesEnum as Feature,
    type EnyoAirConditioningApplianceMetadata,
} from '../../../types/enyo-air-conditioning-appliance.js';
import {
    EnergyManagerAirConditioningModeEnum as Mode,
    EnergyManagerSettingEnum,
    type EnergyManagerSettingValues,
} from '../../../types/enyo-energy-manager-settings.js';
import {isAirConditioningControlled, resolveAirConditioningModes} from '../air-conditioning-control.js';
import {validateEnergyManagerSettingsState} from '../../energy-manager-settings/energy-manager-settings-validators.js';
import {isEnergyManagerSettingActive} from '../../energy-manager-settings/energy-manager-settings-utils.js';
import {getModelOptimizationLevel, EnergyAppModelOptimizationLevelEnum as O} from '../../compatibility/optimization-level.js';
import {EnergyAppPackageCategory} from '../../../energy-app-package-definition.js';
import {EnergyAppModelFeatureEnum as F} from '../../../energy-app-model-feature.enum.js';

const unit = (over: Partial<EnyoAirConditioningApplianceMetadata> = {}): EnyoAirConditioningApplianceMetadata => ({
    availableFeatures: [Feature.Heating, Feature.Cooling, Feature.TemperatureControllable],
    controlAllowed: true,
    ...over,
});

const settings: EnergyManagerSettingValues = {
    airConditioningControl: true,
    airConditioningHeatingMode: Mode.Auto,
    airConditioningCoolingMode: Mode.Boost,
};

describe('isAirConditioningControlled', () => {
    it('needs the unit to allow control and the house-wide switch', () => {
        expect(isAirConditioningControlled(unit(), settings)).toBe(true);
        expect(isAirConditioningControlled(unit({controlAllowed: undefined}), settings)).toBe(true);
        expect(isAirConditioningControlled(unit({controlAllowed: false}), settings)).toBe(false);
        expect(isAirConditioningControlled(unit(), {...settings, airConditioningControl: undefined})).toBe(false);
        expect(isAirConditioningControlled(undefined, settings)).toBe(false);
    });
});

describe('resolveAirConditioningModes', () => {
    it('returns the configured mode per direction for a steered unit', () => {
        expect(resolveAirConditioningModes(unit(), settings)).toEqual({heating: Mode.Auto, cooling: Mode.Boost});
    });

    it('turns a direction off when the unit lacks it', () => {
        expect(resolveAirConditioningModes(unit({availableFeatures: [Feature.Heating]}), settings))
            .toEqual({heating: Mode.Auto, cooling: Mode.Off});
    });

    it('turns everything off for a unit that is not steered', () => {
        expect(resolveAirConditioningModes(unit({controlAllowed: false}), settings))
            .toEqual({heating: Mode.Off, cooling: Mode.Off});
    });

    it('treats an absent or unknown mode as off', () => {
        expect(resolveAirConditioningModes(unit(), {airConditioningControl: true}))
            .toEqual({heating: Mode.Off, cooling: Mode.Off});
        expect(resolveAirConditioningModes(unit(), {airConditioningControl: true, airConditioningHeatingMode: 'turbo' as Mode}).heating)
            .toBe(Mode.Off);
    });
});

describe('air conditioning settings', () => {
    it('validates the modes and gates them on airConditioningControl', () => {
        const all = Object.values(EnergyManagerSettingEnum);
        expect(validateEnergyManagerSettingsState({supported: all, values: settings}).errors).toEqual([]);

        const bad = validateEnergyManagerSettingsState({
            supported: all,
            values: {airConditioningControl: 'yes' as unknown as boolean, airConditioningCoolingMode: 'turbo' as Mode},
        });
        expect(bad.errors.some((e) => e.includes('`airConditioningControl` must be a boolean'))).toBe(true);
        expect(bad.errors.some((e) => e.includes('`airConditioningCoolingMode` "turbo"'))).toBe(true);

        expect(isEnergyManagerSettingActive(EnergyManagerSettingEnum.AirConditioningHeatingMode, settings)).toBe(true);
        expect(isEnergyManagerSettingActive(EnergyManagerSettingEnum.AirConditioningHeatingMode,
            {...settings, airConditioningControl: false})).toBe(false);
    });
});

describe('optimisation level of air conditioning models', () => {
    const level = (features: F[]) =>
        getModelOptimizationLevel({features, category: EnergyAppPackageCategory.AirConditioning});

    it('accepts heating instead of cooling', () => {
        expect(level([F.ClimateHeating, F.ClimateModeControl, F.ClimateTemperatureSetpoint])).toBe(O.Full);
        expect(level([F.ClimateCooling, F.ClimateModeControl, F.ClimatePowerControl])).toBe(O.Full);
        expect(level([F.ClimateHeating, F.ClimateModeControl])).toBe(O.Partial);
        expect(level([F.ClimateHeating])).toBe(O.MonitoringOnly);
    });
});
