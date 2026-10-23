import {describe, expect, it} from 'vitest';
import {
    EnergyAppPackageCategory,
    type EnergyAppPackageCompatibilityModel,
    type EnergyAppPackageCompatibilityVendor,
} from '../../../energy-app-package-definition.js';
import {
    assertValidPackageCompatibility,
    isYearInCompatibilityRange,
    PackageCompatibilityValidationError,
    validatePackageCompatibility,
} from '../compatibility-validators.js';

const now = new Date('2026-10-23T00:00:00Z');

/** A valid model, overridable field by field for the failure cases. */
const model = (over: Partial<EnergyAppPackageCompatibilityModel> = {}): EnergyAppPackageCompatibilityModel => ({
    modelName: 'ID.3',
    features: [],
    ...over,
});

/** A valid vendor, overridable field by field for the failure cases. */
const vendor = (over: Partial<EnergyAppPackageCompatibilityVendor> = {}): EnergyAppPackageCompatibilityVendor => ({
    vendorName: 'Volkswagen',
    models: [model({modelYears: {from: 2020, to: 2023}})],
    ...over,
});

const validate = (compatibility: EnergyAppPackageCompatibilityVendor[], categories?: EnergyAppPackageCategory[]) =>
    validatePackageCompatibility({compatibility, categories}, {now});

describe('validatePackageCompatibility', () => {
    it('accepts an empty list and a well-formed declaration', () => {
        expect(validate([]).ok).toBe(true);
        const result = validate([vendor(), vendor({vendorName: 'BMW', models: []})]);
        expect(result).toEqual({ok: true, errors: [], warnings: []});
    });

    it('flags a non-array compatibility', () => {
        const result = validatePackageCompatibility({compatibility: undefined as never});
        expect(result.errors).toEqual(['`compatibility` must be an array of vendors.']);
    });

    it('flags a duplicate vendor, ignoring case and spacing', () => {
        const result = validate([vendor(), vendor({vendorName: ' volkswagen '})]);
        expect(result.errors.some((e) => e.includes('duplicate vendor'))).toBe(true);
    });

    it('flags empty vendor and model names', () => {
        const result = validate([vendor({vendorName: '', models: [model({modelName: ' '})]})]);
        expect(result.errors.some((e) => e.includes('vendorName must be a non-empty string'))).toBe(true);
        expect(result.errors.some((e) => e.includes('modelName must be a non-empty string'))).toBe(true);
    });

    it('flags missing models', () => {
        const result = validate([vendor({models: undefined as never})]);
        expect(result.errors.some((e) => e.includes('models must be an array'))).toBe(true);
    });

    it('allows the same model name for non-overlapping generations', () => {
        const result = validate([vendor({
            models: [model({modelYears: {from: 2020, to: 2023}}), model({modelYears: {from: 2024}})],
        })]);
        expect(result.ok).toBe(true);
    });

    it.each([
        [{from: 2020, to: 2023}, {from: 2023}],
        [{from: 2020}, {to: 2021}],
        [undefined, {from: 2024}],
    ])('flags the same model name for overlapping years: %o / %o', (a, b) => {
        const result = validate([vendor({
            models: [model({modelYears: a}), model({modelName: 'id.3', modelYears: b})],
        })]);
        expect(result.errors.some((e) => e.includes('duplicate model'))).toBe(true);
    });

    it('flags an inverted range', () => {
        const result = validate([vendor({models: [model({modelYears: {from: 2024, to: 2020}})]})]);
        expect(result.errors.some((e) => e.includes('is after modelYears.to'))).toBe(true);
    });

    it.each([
        [{from: 2020.5}, 'must be a whole year'],
        [{from: 1985}, 'outside 1990–2028'],
        [{to: 2029}, 'outside 1990–2028'],
    ])('flags an implausible year: %o', (modelYears, message) => {
        const result = validate([vendor({models: [model({modelYears})]})]);
        expect(result.errors.some((e) => e.includes(message))).toBe(true);
    });

    it('accepts a year up to two years ahead', () => {
        expect(validate([vendor({models: [model({modelYears: {from: 2028}})]})]).ok).toBe(true);
    });

    it('warns about an empty range', () => {
        const result = validate([vendor({models: [model({modelYears: {}})]})]);
        expect(result.ok).toBe(true);
        expect(result.warnings.some((w) => w.includes('modelYears is empty'))).toBe(true);
    });

    it('warns about vehicle models without years', () => {
        const fromPackage = validate([vendor({models: [model()]})], [EnergyAppPackageCategory.Vehicle]);
        expect(fromPackage.warnings.some((w) => w.includes('no modelYears'))).toBe(true);

        const fromModel = validate([vendor({models: [model({category: EnergyAppPackageCategory.Vehicle})]})]);
        expect(fromModel.warnings.some((w) => w.includes('no modelYears'))).toBe(true);

        expect(validate([vendor({models: [model()]})], [EnergyAppPackageCategory.Inverter]).warnings).toEqual([]);
    });
});

describe('assertValidPackageCompatibility', () => {
    it('returns the list when valid', () => {
        const compatibility = [vendor()];
        expect(assertValidPackageCompatibility({compatibility}, {now})).toBe(compatibility);
    });

    it('throws with every error when invalid', () => {
        expect(() => assertValidPackageCompatibility({compatibility: [vendor(), vendor()]}, {now}))
            .toThrow(PackageCompatibilityValidationError);
    });
});

describe('isYearInCompatibilityRange', () => {
    it('matches inclusive and open-ended ranges', () => {
        expect(isYearInCompatibilityRange(undefined, 2000)).toBe(true);
        expect(isYearInCompatibilityRange({from: 2020, to: 2023}, 2020)).toBe(true);
        expect(isYearInCompatibilityRange({from: 2020, to: 2023}, 2023)).toBe(true);
        expect(isYearInCompatibilityRange({from: 2020, to: 2023}, 2024)).toBe(false);
        expect(isYearInCompatibilityRange({from: 2024}, 2022)).toBe(false);
        expect(isYearInCompatibilityRange({to: 2021}, 2015)).toBe(true);
    });
});
