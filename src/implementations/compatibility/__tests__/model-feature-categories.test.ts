import {describe, expect, it} from 'vitest';
import {EnergyAppPackageCategory} from '../../../energy-app-package-definition.js';
import {EnergyAppModelFeatureEnum as F, EnergyAppModelLimitationEnum} from '../../../energy-app-model-feature.enum.js';
import {
    ENERGY_APP_MODEL_FEATURE_CATEGORIES,
    ENERGY_APP_MODEL_LIMITATION_FEATURES,
    getModelFeaturesForCategory,
} from '../model-feature-categories.js';

describe('ENERGY_APP_MODEL_FEATURE_CATEGORIES', () => {
    it('gives every feature at least one category', () => {
        for (const feature of Object.values(F)) {
            expect(ENERGY_APP_MODEL_FEATURE_CATEGORIES[feature]?.length, feature).toBeGreaterThan(0);
        }
    });
});

describe('ENERGY_APP_MODEL_LIMITATION_FEATURES', () => {
    it('covers every limitation', () => {
        for (const limitation of Object.values(EnergyAppModelLimitationEnum)) {
            expect(ENERGY_APP_MODEL_LIMITATION_FEATURES[limitation], limitation).toBeDefined();
        }
    });
});

describe('getModelFeaturesForCategory', () => {
    it('lists the features of a category in enum order', () => {
        expect(getModelFeaturesForCategory(EnergyAppPackageCategory.HeatingRod)).toEqual([
            F.HeatingRodSwitching,
            F.HeatingRodPowerModulation,
            F.HeatingRodDhwSensor,
            F.EnergyConsumptionReadout,
            F.GridOperatorConsumptionLimitation,
        ]);
    });

    it('returns nothing for a category without model features', () => {
        expect(getModelFeaturesForCategory(EnergyAppPackageCategory.DynamicElectricityTariff)).toEqual([]);
    });
});
