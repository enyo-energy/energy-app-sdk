/**
 * Client-side validator for the vendors and models a package declares in
 * {@link EnergyAppPackageDefinition.compatibility}.
 *
 * enyo publishes this list to customers — in the enyo Store, the onboarding
 * flows and the customer portal — as the answer to "does this app work with my
 * device?". A duplicate vendor, an inverted year range or a model that appears
 * twice for the same years makes that answer ambiguous, so those are blocking
 * `errors`. `warnings` point at entries that are valid but probably less
 * precise than intended, such as a car model declared without its model years.
 *
 * Use {@link validatePackageCompatibility} for the non-throwing result, or
 * {@link assertValidPackageCompatibility} to throw on failure.
 */

import {EnergyAppPackageCategory} from '../../energy-app-package-definition.js';
import type {
    EnergyAppPackageCompatibilityModel,
    EnergyAppPackageCompatibilityVendor,
    EnergyAppPackageCompatibilityYearRange,
    EnergyAppPackageDefinition,
} from '../../energy-app-package-definition.js';

/**
 * Earliest year accepted in a {@link EnergyAppPackageCompatibilityYearRange}.
 * Nothing older can be integrated, so an earlier year is almost certainly a
 * typo.
 */
export const COMPATIBILITY_MIN_YEAR = 1990;

/**
 * How many years past the current one a range may reach. Vehicle model years
 * run ahead of the calendar, and announced models are declared before release.
 */
export const COMPATIBILITY_MAX_YEARS_AHEAD = 2;

/**
 * Thrown by {@link assertValidPackageCompatibility} when a package's
 * compatibility declaration fails validation. The message lists every blocking
 * error so callers can surface them directly.
 */
export class PackageCompatibilityValidationError extends Error {
    /** The individual blocking errors that caused the failure. */
    public readonly errors: string[];

    /**
     * @param errors - The blocking validation errors.
     */
    constructor(errors: string[]) {
        super(`Invalid package compatibility:\n- ${errors.join('\n- ')}`);
        this.name = 'PackageCompatibilityValidationError';
        this.errors = errors;
    }
}

/** The outcome of validating a package's compatibility declaration. */
export interface PackageCompatibilityValidationResult {
    /** True when there are no blocking `errors` (warnings are still allowed). */
    ok: boolean;
    /** Blocking problems — these must be fixed before releasing. */
    errors: string[];
    /** Advisory problems — allowed, but usually worth reviewing. */
    warnings: string[];
}

/** The parts of a package definition the compatibility list is validated against. */
export type PackageCompatibilitySource = Pick<EnergyAppPackageDefinition, 'compatibility'> &
    Partial<Pick<EnergyAppPackageDefinition, 'categories'>>;

/** Options for {@link validatePackageCompatibility}. */
export interface PackageCompatibilityValidationOptions {
    /**
     * The point in time the latest allowed year is derived from
     * (its year + {@link COMPATIBILITY_MAX_YEARS_AHEAD}). Defaults to now;
     * pass a fixed date in tests.
     */
    now?: Date;
}

/**
 * Validates a package's declared vendors and models: names present and unique,
 * year ranges well-formed and plausible, and no model declared twice for
 * overlapping years.
 *
 * Model names are compared case-insensitively, since a customer cannot tell
 * "ID.3" from "id.3" apart. The same model name may appear more than once for
 * a vendor — one entry per generation — as long as the
 * {@link EnergyAppPackageCompatibilityModel.modelYears} ranges do not overlap.
 *
 * @param definition - The package definition, or just its `compatibility` and
 *   (optionally) `categories`.
 * @param options - See {@link PackageCompatibilityValidationOptions}.
 * @returns The {@link PackageCompatibilityValidationResult}.
 *
 * @example
 * ```typescript
 * const {ok, errors, warnings} = validatePackageCompatibility(packageDef);
 * if (!ok) throw new Error(errors.join('\n'));
 * ```
 */
export function validatePackageCompatibility(
    definition: PackageCompatibilitySource,
    options: PackageCompatibilityValidationOptions = {},
): PackageCompatibilityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const compatibility = definition.compatibility;

    if (!Array.isArray(compatibility)) {
        errors.push('`compatibility` must be an array of vendors.');
        return {ok: false, errors, warnings};
    }

    const maxYear = (options.now ?? new Date()).getFullYear() + COMPATIBILITY_MAX_YEARS_AHEAD;
    const isVehiclePackage = definition.categories?.includes(EnergyAppPackageCategory.Vehicle) ?? false;
    const vendorNames = new Map<string, number>();

    compatibility.forEach((vendor, vendorIndex) => {
        const at = `compatibility[${vendorIndex}] (${vendor?.vendorName || '?'})`;

        if (typeof vendor?.vendorName !== 'string' || vendor.vendorName.trim() === '') {
            errors.push(`${at}: vendorName must be a non-empty string.`);
        } else {
            const key = normalizeName(vendor.vendorName);
            const first = vendorNames.get(key);
            if (first !== undefined) {
                errors.push(`${at}: duplicate vendor — already declared at compatibility[${first}]. Merge the model lists.`);
            } else {
                vendorNames.set(key, vendorIndex);
            }
        }

        if (!Array.isArray(vendor?.models)) {
            errors.push(`${at}: models must be an array (empty for brand-wide support).`);
            return;
        }

        validateModels(vendor, at, isVehiclePackage, maxYear, errors, warnings);
    });

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Like {@link validatePackageCompatibility}, but throws
 * {@link PackageCompatibilityValidationError} when there are blocking errors.
 * Warnings never throw.
 *
 * @param definition - The package definition, or just its `compatibility` and
 *   (optionally) `categories`.
 * @param options - See {@link PackageCompatibilityValidationOptions}.
 * @returns The declared compatibility list.
 * @throws {PackageCompatibilityValidationError} When validation produces any error.
 */
export function assertValidPackageCompatibility(
    definition: PackageCompatibilitySource,
    options: PackageCompatibilityValidationOptions = {},
): EnergyAppPackageCompatibilityVendor[] {
    const {ok, errors} = validatePackageCompatibility(definition, options);
    if (!ok) throw new PackageCompatibilityValidationError(errors);
    return definition.compatibility;
}

/**
 * Checks whether a year falls within a declared range. An open end matches
 * every year on that side, and a missing range matches every year.
 *
 * This is the matching rule enyo applies when a customer picks a model year,
 * exposed so an app can test its own declarations against real devices.
 *
 * @param range - The model's declared range, or `undefined` for "all years".
 * @param year - The year to check.
 * @returns `true` when `year` lies within `range`.
 *
 * @example
 * ```typescript
 * isYearInCompatibilityRange({from: 2020, to: 2023}, 2022); // true
 * isYearInCompatibilityRange({from: 2024}, 2022);           // false
 * ```
 */
export function isYearInCompatibilityRange(
    range: EnergyAppPackageCompatibilityYearRange | undefined,
    year: number,
): boolean {
    if (!range) return true;
    if (range.from !== undefined && year < range.from) return false;
    if (range.to !== undefined && year > range.to) return false;
    return true;
}

/**
 * Validates the models of one vendor: names, year ranges, and overlapping
 * duplicates.
 *
 * @param vendor - The vendor whose models are checked.
 * @param vendorAt - Human-readable location of the vendor, used in messages.
 * @param isVehiclePackage - Whether the package is a vehicle integration.
 * @param maxYear - The latest year a range may reach.
 * @param errors - Collector for blocking problems.
 * @param warnings - Collector for advisory problems.
 */
function validateModels(
    vendor: EnergyAppPackageCompatibilityVendor,
    vendorAt: string,
    isVehiclePackage: boolean,
    maxYear: number,
    errors: string[],
    warnings: string[],
): void {
    const seen = new Map<string, {index: number; range?: EnergyAppPackageCompatibilityYearRange}[]>();

    vendor.models.forEach((model, modelIndex) => {
        const at = `${vendorAt}.models[${modelIndex}] (${model?.modelName || '?'})`;

        if (typeof model?.modelName !== 'string' || model.modelName.trim() === '') {
            errors.push(`${at}: modelName must be a non-empty string.`);
            return;
        }

        const rangeOk = validateYearRange(model.modelYears, at, maxYear, errors, warnings);

        const isVehicleModel = model.category === EnergyAppPackageCategory.Vehicle ||
            (model.category === undefined && isVehiclePackage);
        if (isVehicleModel && model.modelYears === undefined) {
            warnings.push(
                `${at}: no modelYears — a car model name usually spans several generations; declare which years are supported.`,
            );
        }

        const key = normalizeName(model.modelName);
        const earlier = seen.get(key) ?? [];
        if (rangeOk) {
            for (const other of earlier) {
                if (rangesOverlap(other.range, model.modelYears)) {
                    errors.push(
                        `${at}: duplicate model — ${vendorAt}.models[${other.index}] has the same name for ` +
                            'overlapping years. Give each generation its own, non-overlapping modelYears.',
                    );
                    break;
                }
            }
            earlier.push({index: modelIndex, range: model.modelYears});
            seen.set(key, earlier);
        }
    });
}

/**
 * Validates one {@link EnergyAppPackageCompatibilityYearRange}.
 *
 * @param range - The declared range, possibly `undefined`.
 * @param at - Human-readable location of the model, used in messages.
 * @param maxYear - The latest year a range may reach.
 * @param errors - Collector for blocking problems.
 * @param warnings - Collector for advisory problems.
 * @returns `true` when the range is absent or well-formed, so it can be
 *   compared against other ranges.
 */
function validateYearRange(
    range: EnergyAppPackageCompatibilityYearRange | undefined,
    at: string,
    maxYear: number,
    errors: string[],
    warnings: string[],
): boolean {
    if (range === undefined) return true;
    if (range === null || typeof range !== 'object' || Array.isArray(range)) {
        errors.push(`${at}: modelYears must be an object like {from: 2020, to: 2023}.`);
        return false;
    }

    let ok = true;
    for (const end of ['from', 'to'] as const) {
        const year = range[end];
        if (year === undefined) continue;
        if (!Number.isInteger(year)) {
            errors.push(`${at}: modelYears.${end} must be a whole year, got ${String(year)}.`);
            ok = false;
        } else if (year < COMPATIBILITY_MIN_YEAR || year > maxYear) {
            errors.push(`${at}: modelYears.${end} ${year} is outside ${COMPATIBILITY_MIN_YEAR}–${maxYear}.`);
            ok = false;
        }
    }

    if (ok && range.from !== undefined && range.to !== undefined && range.from > range.to) {
        errors.push(`${at}: modelYears.from (${range.from}) is after modelYears.to (${range.to}).`);
        ok = false;
    }
    if (ok && range.from === undefined && range.to === undefined) {
        warnings.push(`${at}: modelYears is empty — omit it when the entry covers every year.`);
    }
    return ok;
}

/**
 * Whether two year ranges share at least one year. A missing range or a
 * missing end is unbounded on that side.
 *
 * @param a - The first range.
 * @param b - The second range.
 * @returns `true` when the ranges overlap.
 */
function rangesOverlap(
    a: EnergyAppPackageCompatibilityYearRange | undefined,
    b: EnergyAppPackageCompatibilityYearRange | undefined,
): boolean {
    const aFrom = a?.from ?? -Infinity;
    const aTo = a?.to ?? Infinity;
    const bFrom = b?.from ?? -Infinity;
    const bTo = b?.to ?? Infinity;
    return aFrom <= bTo && bFrom <= aTo;
}

/**
 * Normalizes a vendor or model name for duplicate detection.
 *
 * @param name - The declared name.
 * @returns The trimmed, lower-cased name with inner whitespace collapsed.
 */
function normalizeName(name: string): string {
    return name.trim().replace(/\s+/g, ' ').toLowerCase();
}
