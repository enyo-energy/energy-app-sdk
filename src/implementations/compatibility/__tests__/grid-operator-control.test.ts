import {describe, expect, it} from 'vitest';
import {
    EnergyAppPackageCategory,
    EnergyAppPackageConnectionTypeEnum as C,
    type EnergyAppPackageCompatibilityModel,
} from '../../../energy-app-package-definition.js';
import {
    EnergyAppModelFeatureEnum as F,
    EnergyAppModelGridOperatorControlInterfaceEnum as I,
} from '../../../energy-app-model-feature.enum.js';
import {
    EnergyAppGridOperatorControlSummaryEnum as S,
    getGridOperatorControlSummary,
} from '../grid-operator-control.js';
import {validatePackageCompatibility} from '../compatibility-validators.js';
import {findCompatibleAppOptions} from '../compatible-app-options.js';

describe('getGridOperatorControlSummary', () => {
    it('condenses the interfaces into one value', () => {
        expect(getGridOperatorControlSummary(undefined)).toBe(S.Unknown);
        expect(getGridOperatorControlSummary({})).toBe(S.Unknown);
        expect(getGridOperatorControlSummary({gridOperatorControlInterfaces: []})).toBe(S.None);
        expect(getGridOperatorControlSummary({gridOperatorControlInterfaces: [I.Eebus]})).toBe(S.Digital);
        expect(getGridOperatorControlSummary({gridOperatorControlInterfaces: [I.Modbus, I.OtherDigital]})).toBe(S.Digital);
        expect(getGridOperatorControlSummary({gridOperatorControlInterfaces: [I.SwitchingContact]})).toBe(S.SwitchingContact);
        expect(getGridOperatorControlSummary({gridOperatorControlInterfaces: [I.Eebus, I.SwitchingContact]}))
            .toBe(S.DigitalAndSwitchingContact);
    });
});

describe('validatePackageCompatibility — gridOperatorControlInterfaces', () => {
    const run = (model: Partial<EnergyAppPackageCompatibilityModel>, category = EnergyAppPackageCategory.HeatPump) =>
        validatePackageCompatibility({
            categories: [category],
            connectionTypes: [C.ModbusTcp],
            compatibility: [{vendorName: 'Vaillant', models: [{modelName: 'aroTHERM plus', features: [], ...model}]}],
        });

    it('accepts declared interfaces and an empty list', () => {
        expect(run({features: [F.GridOperatorConsumptionLimitation], gridOperatorControlInterfaces: [I.Eebus, I.SwitchingContact]}))
            .toEqual({ok: true, errors: [], warnings: []});
        expect(run({gridOperatorControlInterfaces: []})).toEqual({ok: true, errors: [], warnings: []});
    });

    it('rejects unknown values and warns on duplicates', () => {
        const result = run({gridOperatorControlInterfaces: ['ebus' as I, I.Modbus, I.Modbus]});
        expect(result.errors.some((e) => e.includes('unknown gridOperatorControlInterfaces value "ebus"'))).toBe(true);
        expect(result.warnings.some((w) => w.includes('lists modbus twice'))).toBe(true);
    });

    it('rejects "not dimmable" together with a grid operator limitation feature', () => {
        const result = run({features: [F.GridOperatorConsumptionLimitation], gridOperatorControlInterfaces: []});
        expect(result.errors.some((e) => e.includes('gridOperatorControlInterfaces is empty'))).toBe(true);
    });

    it('warns when a grid operator limitation feature has no interfaces declared', () => {
        const result = run({features: [F.GridOperatorConsumptionLimitation]});
        expect(result.ok).toBe(true);
        expect(result.warnings.some((w) => w.includes('declare how the model is dimmed under §14a'))).toBe(true);
    });

    it('warns about interfaces on a category that is not dimmed', () => {
        const result = run({gridOperatorControlInterfaces: [I.Eebus]}, EnergyAppPackageCategory.Meter);
        expect(result.warnings.some((w) => w.includes('does not fit category meter'))).toBe(true);
    });
});

describe('findCompatibleAppOptions — §14a', () => {
    it('carries the interfaces and their summary', () => {
        const [option] = findCompatibleAppOptions([{
            packageName: 'vaillant-local',
            connectionTypes: [C.Eebus],
            compatibility: [{vendorName: 'Vaillant', models: [
                {modelName: 'aroTHERM plus', features: [], gridOperatorControlInterfaces: [I.Eebus, I.SwitchingContact]},
            ]}],
        }], {vendorName: 'Vaillant', modelName: 'aroTHERM plus'});
        expect(option.gridOperatorControlInterfaces).toEqual([I.Eebus, I.SwitchingContact]);
        expect(option.gridOperatorControl).toBe(S.DigitalAndSwitchingContact);

        const [vendorOnly] = findCompatibleAppOptions([{
            packageName: 'vaillant-local', connectionTypes: [C.Eebus],
            compatibility: [{vendorName: 'Vaillant', models: []}],
        }], {vendorName: 'Vaillant'});
        expect(vendorOnly.gridOperatorControlInterfaces).toBeUndefined();
        expect(vendorOnly.gridOperatorControl).toBe(S.Unknown);
    });
});
