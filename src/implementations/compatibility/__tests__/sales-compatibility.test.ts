import {describe, expect, it} from 'vitest';
import {
    EnergyAppPackageCategory as Cat,
    EnergyAppPackageCompatibilityStatus,
    EnergyAppPackageConnectionTypeEnum as C,
    type EnergyAppPackageCompatibilityModel,
} from '../../../energy-app-package-definition.js';
import {
    EnergyAppModelFeatureEnum as F,
    EnergyAppModelFeatureSupportEnum as Support,
    EnergyAppModelGridOperatorControlInterfaceEnum,
    EnergyAppModelLimitationEnum as L,
    EnergyAppModelRequirementEnum,
    EnergyAppModelVerificationEnum as V,
} from '../../../energy-app-model-feature.enum.js';
import {getModelFeatureSupport} from '../feature-support.js';
import {
    EnergyAppModelOptimizationLevelEnum as O,
    getModelOptimizationLevel,
} from '../optimization-level.js';
import {
    ENERGY_APP_CONNECTION_TYPE_LABELS,
    ENERGY_APP_GRID_OPERATOR_CONTROL_INTERFACE_LABELS,
    ENERGY_APP_GRID_OPERATOR_CONTROL_SUMMARY_LABELS,
    ENERGY_APP_MODEL_FEATURE_LABELS,
    ENERGY_APP_MODEL_FEATURE_SUPPORT_LABELS,
    ENERGY_APP_MODEL_LIMITATION_LABELS,
    ENERGY_APP_MODEL_OPTIMIZATION_LEVEL_LABELS,
    ENERGY_APP_MODEL_REQUIREMENT_LABELS,
    ENERGY_APP_MODEL_VERIFICATION_LABELS,
    type EnergyAppCompatibilityLabel,
} from '../compatibility-labels.js';
import {EnergyAppGridOperatorControlSummaryEnum} from '../grid-operator-control.js';
import {validatePackageCompatibility} from '../compatibility-validators.js';
import {findCompatibleAppOptions} from '../compatible-app-options.js';

describe('getModelFeatureSupport', () => {
    const battery = {features: [F.BatteryHold], unsupportedFeatures: [F.BatteryChargingFromGrid]};

    it('answers supported, unsupported or unknown', () => {
        expect(getModelFeatureSupport(battery, F.BatteryHold)).toBe(Support.Supported);
        expect(getModelFeatureSupport(battery, F.BatteryChargingFromGrid)).toBe(Support.Unsupported);
        expect(getModelFeatureSupport(battery, F.BatteryGridDischarging)).toBe(Support.Unknown);
        expect(getModelFeatureSupport(undefined, F.BatteryHold)).toBe(Support.Unknown);
    });
});

describe('getModelOptimizationLevel', () => {
    const m = (category: Cat, features: F[], over: Partial<EnergyAppPackageCompatibilityModel> = {}) =>
        ({modelName: 'X', category, features, ...over});

    it('grades a wallbox by its charging schedule', () => {
        expect(getModelOptimizationLevel(m(Cat.Wallbox, [F.ChargingSchedule, F.ChargingStartStop]))).toBe(O.Full);
        expect(getModelOptimizationLevel(m(Cat.Wallbox, [F.ChargingStartStop]))).toBe(O.Partial);
        expect(getModelOptimizationLevel(m(Cat.Wallbox, [F.ChargingMidMeter]))).toBe(O.MonitoringOnly);
    });

    it('needs grid charging and holding for a fully optimisable battery', () => {
        expect(getModelOptimizationLevel(m(Cat.BatteryStorage, [F.BatteryChargingFromGrid, F.BatteryHold]))).toBe(O.Full);
        expect(getModelOptimizationLevel(m(Cat.BatteryStorage, [F.BatteryGridChargeFullPowerOnly]))).toBe(O.Partial);
        expect(getModelOptimizationLevel(m(Cat.BatteryStorage, [F.GridPowerReadout]))).toBe(O.MonitoringOnly);
    });

    it('downgrades full to partial when a limitation restricts a deciding feature', () => {
        const model = m(Cat.BatteryStorage, [F.BatteryChargingFromGrid, F.BatteryHold], {limitations: [L.BatteryChargeSetpointForced]});
        expect(getModelOptimizationLevel(model)).toBe(O.Partial);
        const general = m(Cat.BatteryStorage, [F.BatteryChargingFromGrid, F.BatteryHold], {limitations: [L.DelayedReadings]});
        expect(getModelOptimizationLevel(general)).toBe(O.Full);
    });

    it('requires the battery groups as well for a hybrid inverter with battery features', () => {
        expect(getModelOptimizationLevel(m(Cat.Inverter, [F.PvFeedInLimitation]))).toBe(O.Full);
        expect(getModelOptimizationLevel(m(Cat.Inverter, [F.PvFeedInLimitation, F.BatteryManualCharge]))).toBe(O.Partial);
        expect(getModelOptimizationLevel(m(Cat.Inverter, [F.PvFeedInLimitation, F.BatteryChargingFromGrid, F.BatteryHold]))).toBe(O.Full);
    });

    it('handles not compatible, unknown and non-steered categories', () => {
        expect(getModelOptimizationLevel(m(Cat.Wallbox, [], {status: EnergyAppPackageCompatibilityStatus.NotCompatible}))).toBe(O.NotCompatible);
        expect(getModelOptimizationLevel(undefined, {vendorStatus: EnergyAppPackageCompatibilityStatus.NotCompatible})).toBe(O.NotCompatible);
        expect(getModelOptimizationLevel(undefined)).toBe(O.Unknown);
        expect(getModelOptimizationLevel({features: [F.HeatpumpDhwBoost]})).toBe(O.Unknown);
        expect(getModelOptimizationLevel(m(Cat.Meter, [F.GridPowerReadout]))).toBe(O.NotApplicable);
    });

    it('takes the best level over the package categories when the model has none', () => {
        const model = {features: [F.BatteryChargingFromGrid, F.BatteryHold]};
        expect(getModelOptimizationLevel(model, {packageCategories: [Cat.Inverter, Cat.BatteryStorage]})).toBe(O.Full);
    });
});

describe('compatibility labels', () => {
    const maps: [string, Record<string, unknown>, Record<string, EnergyAppCompatibilityLabel>][] = [
        ['features', F, ENERGY_APP_MODEL_FEATURE_LABELS],
        ['requirements', EnergyAppModelRequirementEnum, ENERGY_APP_MODEL_REQUIREMENT_LABELS],
        ['limitations', L, ENERGY_APP_MODEL_LIMITATION_LABELS],
        ['connection types', C, ENERGY_APP_CONNECTION_TYPE_LABELS],
        ['§14a interfaces', EnergyAppModelGridOperatorControlInterfaceEnum, ENERGY_APP_GRID_OPERATOR_CONTROL_INTERFACE_LABELS],
        ['§14a summary', EnergyAppGridOperatorControlSummaryEnum, ENERGY_APP_GRID_OPERATOR_CONTROL_SUMMARY_LABELS],
        ['verification', V, ENERGY_APP_MODEL_VERIFICATION_LABELS],
        ['feature support', Support, ENERGY_APP_MODEL_FEATURE_SUPPORT_LABELS],
        ['optimisation level', O, ENERGY_APP_MODEL_OPTIMIZATION_LEVEL_LABELS],
    ];

    it.each(maps)('gives every %s value a German and English name and description', (_, values, labels) => {
        for (const value of Object.values(values) as string[]) {
            const entry = labels[value];
            expect(entry, value).toBeDefined();
            for (const text of [entry.name.de, entry.name.en, entry.description.de, entry.description.en]) {
                expect(text.trim().length, value).toBeGreaterThan(0);
            }
        }
    });
});

describe('validatePackageCompatibility — sales fields', () => {
    const run = (over: Partial<EnergyAppPackageCompatibilityModel>) =>
        validatePackageCompatibility({
            categories: [Cat.BatteryStorage],
            connectionTypes: [C.ModbusTcp],
            compatibility: [{vendorName: 'SENEC', models: [{modelName: 'Home V3', features: [], ...over}]}],
        });

    it('accepts well-formed sales fields', () => {
        expect(run({
            features: [F.BatteryGridChargeFullPowerOnly],
            unsupportedFeatures: [F.BatteryChargingFromGrid, F.BatteryHold],
            verification: V.Field,
            customerNote: [{language: 'de', value: 'Nur Volllast-Netzladen.'}, {language: 'en', value: 'Full-power grid charge only.'}],
        })).toEqual({ok: true, errors: [], warnings: []});
    });

    it('rejects a feature listed as supported and unsupported', () => {
        const result = run({features: [F.BatteryHold], unsupportedFeatures: [F.BatteryHold]});
        expect(result.errors.some((e) => e.includes('listed in both features and unsupportedFeatures'))).toBe(true);
    });

    it('checks unsupported feature values and categories', () => {
        const result = run({unsupportedFeatures: ['nope' as F, F.ChargingSchedule]});
        expect(result.errors.some((e) => e.includes('unknown unsupportedFeatures value "nope"'))).toBe(true);
        expect(result.warnings.some((w) => w.includes('unsupported feature charging-schedule does not fit'))).toBe(true);
    });

    it('rejects an unknown verification', () => {
        expect(run({verification: 'rumour' as V}).errors).toEqual([expect.stringContaining('unknown verification value "rumour"')]);
    });

    it('checks the customer note', () => {
        const bad = run({customerNote: [{language: 'fr' as 'de', value: 'x'}, {language: 'de', value: ' '}, {language: 'de', value: 'y'}]});
        expect(bad.errors.some((e) => e.includes('unknown language "fr"'))).toBe(true);
        expect(bad.errors.some((e) => e.includes('customerNote (de) must be a non-empty string'))).toBe(true);
        expect(bad.errors.some((e) => e.includes('lists language de twice'))).toBe(true);
        expect(bad.warnings.some((w) => w.includes('customerNote has no en text'))).toBe(true);
    });
});

describe('findCompatibleAppOptions — sales fields', () => {
    it('carries unsupported features, verification, note and optimisation level', () => {
        const note = [{language: 'de' as const, value: 'Hinweis'}];
        const [option] = findCompatibleAppOptions([{
            packageName: 'senec', categories: [Cat.BatteryStorage], connectionTypes: [C.Cloud],
            compatibility: [{vendorName: 'SENEC', models: [{
                modelName: 'Home V3', features: [F.BatteryGridChargeFullPowerOnly],
                unsupportedFeatures: [F.BatteryChargingFromGrid], verification: V.Lab, customerNote: note,
            }]}],
        }], {vendorName: 'SENEC', modelName: 'Home V3'});
        expect(option.unsupportedFeatures).toEqual([F.BatteryChargingFromGrid]);
        expect(option.verification).toBe(V.Lab);
        expect(option.customerNote).toEqual(note);
        expect(option.optimizationLevel).toBe(O.Partial);
    });
});
