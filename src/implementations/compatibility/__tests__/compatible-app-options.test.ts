import {describe, expect, it} from 'vitest';
import {
    EnergyAppPackageCompatibilityStatus,
    EnergyAppPackageConnectionTypeEnum as C,
} from '../../../energy-app-package-definition.js';
import {
    EnergyAppModelFeatureEnum as F,
    EnergyAppModelRequirementEnum as R,
} from '../../../energy-app-model-feature.enum.js';
import {findCompatibleAppOptions, type CompatibleAppSource} from '../compatible-app-options.js';
import {
    ENERGY_APP_CONNECTION_TYPE_SCOPES,
    EnergyAppConnectionScopeEnum,
    getEffectiveConnectionTypes,
} from '../connection-types.js';

const cloudApp: CompatibleAppSource = {
    packageName: 'daikin-cloud',
    connectionTypes: [C.Cloud],
    compatibility: [{vendorName: 'Daikin', defaultEnergyApp: true, models: [
        {modelName: 'Altherma 3 H', features: [F.HeatpumpDhwBoost, F.HeatpumpTemperatureSetpoint], requirements: [R.VendorCloudAccount]},
    ]}],
};

const localApp: CompatibleAppSource = {
    packageName: 'daikin-local',
    connectionTypes: [C.ModbusTcp],
    compatibility: [{vendorName: 'Daikin', models: [
        {modelName: 'Altherma 3 H', features: [F.HeatpumpDhwBoost, F.HeatpumpTemperatureSetpoint]},
        {modelName: 'Altherma 4 H', features: [F.HeatpumpDhwBoost], connectionTypes: [C.Http, C.ModbusTcp]},
    ]}],
};

const relayApp: CompatibleAppSource = {
    packageName: 'shelly-sg-ready',
    connectionTypes: [C.DryContact],
    compatibility: [{vendorName: 'Shelly', models: [{modelName: 'Pro 2', features: [F.HeatpumpSgReady]}]}],
};

describe('getEffectiveConnectionTypes', () => {
    it('takes the model list, else the vendor list, else the package list', () => {
        const pkg = {connectionTypes: [C.ModbusTcp]};
        expect(getEffectiveConnectionTypes(pkg)).toEqual([C.ModbusTcp]);
        expect(getEffectiveConnectionTypes(pkg, {connectionTypes: [C.Http]})).toEqual([C.Http]);
        expect(getEffectiveConnectionTypes(pkg, {connectionTypes: [C.Http]}, {connectionTypes: [C.Eebus]})).toEqual([C.Eebus]);
        expect(getEffectiveConnectionTypes({})).toEqual([]);
    });
});

describe('ENERGY_APP_CONNECTION_TYPE_SCOPES', () => {
    it('gives every connection type a scope', () => {
        for (const type of Object.values(C)) {
            expect(ENERGY_APP_CONNECTION_TYPE_SCOPES[type], type).toBeDefined();
        }
        expect(ENERGY_APP_CONNECTION_TYPE_SCOPES[C.Cloud]).toBe(EnergyAppConnectionScopeEnum.Cloud);
    });
});

describe('findCompatibleAppOptions', () => {
    const apps = [cloudApp, localApp, relayApp];

    it('offers local before cloud for the same features, matching names case-insensitively', () => {
        const options = findCompatibleAppOptions(apps, {vendorName: ' daikin ', modelName: 'altherma 3 h'});
        expect(options.map((o) => [o.packageName, o.connectionType, o.scope])).toEqual([
            ['daikin-local', C.ModbusTcp, EnergyAppConnectionScopeEnum.Local],
            ['daikin-cloud', C.Cloud, EnergyAppConnectionScopeEnum.Cloud],
        ]);
        expect(options[1].requirements).toEqual([R.VendorCloudAccount]);
        expect(options[0].definition).toBe(localApp);
    });

    it('yields one option per connection type, using the model override', () => {
        const options = findCompatibleAppOptions(apps, {vendorName: 'Daikin', modelName: 'Altherma 4 H'});
        expect(options.map((o) => o.connectionType)).toEqual([C.Http, C.ModbusTcp]);
    });

    it('ranks more features first', () => {
        const richCloud: CompatibleAppSource = {
            ...cloudApp,
            compatibility: [{vendorName: 'Daikin', models: [
                {modelName: 'Altherma 3 H', features: [F.HeatpumpDhwBoost, F.HeatpumpTemperatureSetpoint, F.HeatpumpCooling]},
            ]}],
        };
        const options = findCompatibleAppOptions([localApp, richCloud], {vendorName: 'Daikin', modelName: 'Altherma 3 H'});
        expect(options[0].packageName).toBe('daikin-cloud');
    });

    it('puts the default app first when only the vendor is known', () => {
        const options = findCompatibleAppOptions(apps, {vendorName: 'Daikin'});
        expect(options[0].packageName).toBe('daikin-cloud');
        expect(options.every((o) => o.model === undefined)).toBe(true);
    });

    it('matches brand-wide vendors for any model, and skips undeclared models', () => {
        const brandWide: CompatibleAppSource = {packageName: 'daikin-any', compatibility: [{vendorName: 'Daikin', models: []}]};
        const options = findCompatibleAppOptions([localApp, brandWide], {vendorName: 'Daikin', modelName: 'Unknown X'});
        expect(options.map((o) => [o.packageName, o.connectionType])).toEqual([['daikin-any', undefined]]);
    });

    it('filters by model year and sorts not compatible entries last', () => {
        const years: CompatibleAppSource = {
            packageName: 'vw', connectionTypes: [C.Cloud],
            compatibility: [{vendorName: 'VW', models: [
                {modelName: 'ID.3', modelYears: {from: 2020, to: 2023}, features: [], status: EnergyAppPackageCompatibilityStatus.NotCompatible},
                {modelName: 'ID.3', modelYears: {from: 2024}, features: [F.VehicleSocReadout]},
            ]}],
        };
        expect(findCompatibleAppOptions([years], {vendorName: 'VW', modelName: 'ID.3', year: 2025})).toHaveLength(1);
        const all = findCompatibleAppOptions([years], {vendorName: 'VW', modelName: 'ID.3'});
        expect(all.map((o) => o.status)).toEqual([
            EnergyAppPackageCompatibilityStatus.Compatible,
            EnergyAppPackageCompatibilityStatus.NotCompatible,
        ]);
    });

    it('returns nothing for an unknown vendor', () => {
        expect(findCompatibleAppOptions(apps, {vendorName: 'Viessmann'})).toEqual([]);
    });
});
