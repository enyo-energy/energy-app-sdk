/**
 * Client-side validator for the vendors and models a package declares in
 * {@link EnergyAppPackageDefinition.compatibility}.
 *
 * enyo publishes this list to customers — in the enyo Store, the onboarding
 * flows and the customer portal — as the answer to "does this app work with my
 * device?". A duplicate vendor, an inverted year range or a model that appears
 * twice for the same years makes that answer ambiguous, so those are blocking
 * `errors`, and so are features, requirements or limitations that are unknown
 * or contradict each other. `warnings` point at entries that are valid but
 * probably less precise than intended, such as a car model declared without its
 * model years or a feature that does not fit the model's category.
 *
 * Use {@link validatePackageCompatibility} for the non-throwing result, or
 * {@link assertValidPackageCompatibility} to throw on failure.
 */

import {
    EnergyAppPackageCategory,
    EnergyAppPackageCompatibilityStatus,
    EnergyAppPackageConnectionTypeEnum,
} from '../../energy-app-package-definition.js';
import {
    EnergyAppModelFeatureEnum,
    EnergyAppModelGridOperatorControlInterfaceEnum,
    EnergyAppModelLimitationEnum,
    EnergyAppModelRequirementEnum,
    EnergyAppModelVerificationEnum,
} from '../../energy-app-model-feature.enum.js';
import {
    ENERGY_APP_MODEL_FEATURE_CATEGORIES,
    ENERGY_APP_MODEL_LIMITATION_FEATURES,
} from './model-feature-categories.js';
import {normalizeCompatibilityName} from './compatibility-names.js';
import {getEffectiveConnectionTypes} from './connection-types.js';
import type {
    EnergyAppPackageCompatibilityModel,
    EnergyAppPackageCompatibilityVendor,
    EnergyAppPackageCompatibilityYearRange,
    EnergyAppPackageDefinition,
    EnergyAppPackageLanguage,
    EnergyAppPackageOptionsDeviceDetection,
} from '../../energy-app-package-definition.js';

/**
 * Device detection methods and the connection type each one implies: a package
 * that detects devices over Modbus should declare it connects over Modbus TCP.
 */
const DETECTION_CONNECTION_TYPES: Readonly<Partial<Record<keyof EnergyAppPackageOptionsDeviceDetection, EnergyAppPackageConnectionTypeEnum>>> = {
    modbus: EnergyAppPackageConnectionTypeEnum.ModbusTcp,
    http: EnergyAppPackageConnectionTypeEnum.Http,
    ocpp: EnergyAppPackageConnectionTypeEnum.Ocpp,
    eebus: EnergyAppPackageConnectionTypeEnum.Eebus,
    mqtt: EnergyAppPackageConnectionTypeEnum.Mqtt,
};

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
 * Battery features that contradict
 * {@link EnergyAppModelFeatureEnum.BatteryGridChargeFullPowerOnly}: a battery
 * whose only control is a full-power grid charge has no setpoint, no hold and
 * no discharge control.
 */
const FULL_POWER_ONLY_CONFLICTS: readonly EnergyAppModelFeatureEnum[] = [
    EnergyAppModelFeatureEnum.BatteryChargingFromGrid,
    EnergyAppModelFeatureEnum.BatteryChargeLimitation,
    EnergyAppModelFeatureEnum.BatteryDischargeLimitation,
    EnergyAppModelFeatureEnum.BatteryGridDischarging,
    EnergyAppModelFeatureEnum.BatteryHold,
    EnergyAppModelFeatureEnum.BatteryManualCharge,
];

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
    Partial<Pick<EnergyAppPackageDefinition, 'categories' | 'connectionTypes' | 'options'>>;

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
 * year ranges well-formed and plausible, no model declared twice for
 * overlapping years, and features, requirements and limitations known,
 * consistent and fitting the model's category, and connection types known and
 * consistent with the requirements and device detection.
 *
 * Connection types ({@link EnergyAppPackageDefinition.connectionTypes}, and the
 * vendor and model overrides): an unknown value or an empty list is an error.
 * Warnings: no connection type declared anywhere; an override that repeats the
 * inherited list; `cloud` without the `VendorCloudAccount` requirement or that
 * requirement without `cloud`; a device detection method (Modbus, HTTP, OCPP,
 * EEBus, MQTT) whose connection type is declared nowhere; and the
 * `DryContact` category without the `dry-contact` connection type.
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
    const categories = definition.categories ?? [];
    const vendorNames = new Map<string, number>();
    const declaredTypes = new Set<EnergyAppPackageConnectionTypeEnum>(
        validateConnectionTypeList(definition.connectionTypes, 'connectionTypes', errors, warnings),
    );

    compatibility.forEach((vendor, vendorIndex) => {
        const at = `compatibility[${vendorIndex}] (${vendor?.vendorName || '?'})`;

        if (typeof vendor?.vendorName !== 'string' || vendor.vendorName.trim() === '') {
            errors.push(`${at}: vendorName must be a non-empty string.`);
        } else {
            const key = normalizeCompatibilityName(vendor.vendorName);
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

        validateModels(vendor, at, categories, maxYear, errors, warnings);
        validateVendorConnectionTypes(definition, vendor, at, declaredTypes, errors, warnings);
    });

    validatePackageConnectionTypes(definition, categories, declaredTypes, warnings);

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Validates the connection types of one vendor and its models, and checks each
 * model's effective types against its `VendorCloudAccount` requirement.
 *
 * @param definition - The package, for the inherited connection types.
 * @param vendor - The vendor entry.
 * @param vendorAt - Human-readable location of the vendor, used in messages.
 * @param declaredTypes - Collector for every connection type declared anywhere.
 * @param errors - Collector for blocking problems.
 * @param warnings - Collector for advisory problems.
 */
function validateVendorConnectionTypes(
    definition: PackageCompatibilitySource,
    vendor: EnergyAppPackageCompatibilityVendor,
    vendorAt: string,
    declaredTypes: Set<EnergyAppPackageConnectionTypeEnum>,
    errors: string[],
    warnings: string[],
): void {
    const vendorTypes = validateConnectionTypeList(vendor.connectionTypes, `${vendorAt}: connectionTypes`, errors, warnings);
    vendorTypes.forEach((type) => declaredTypes.add(type));
    if (vendor.connectionTypes !== undefined && sameTypes(vendor.connectionTypes, definition.connectionTypes)) {
        warnings.push(`${vendorAt}: connectionTypes repeats the package's list — omit it.`);
    }

    vendor.models.forEach((model, modelIndex) => {
        const at = `${vendorAt}.models[${modelIndex}] (${model?.modelName || '?'})`;
        validateConnectionTypeList(model?.connectionTypes, `${at}: connectionTypes`, errors, warnings)
            .forEach((type) => declaredTypes.add(type));
        if (model?.connectionTypes !== undefined &&
            sameTypes(model.connectionTypes, vendor.connectionTypes ?? definition.connectionTypes)) {
            warnings.push(`${at}: connectionTypes repeats the inherited list — omit it.`);
        }

        const effective = getEffectiveConnectionTypes(definition, vendor, model);
        if (effective.length === 0 || model?.status === EnergyAppPackageCompatibilityStatus.NotCompatible) return;
        const viaCloud = effective.includes(EnergyAppPackageConnectionTypeEnum.Cloud);
        const needsAccount = Array.isArray(model?.requirements) &&
            model.requirements.includes(EnergyAppModelRequirementEnum.VendorCloudAccount);
        if (viaCloud && !needsAccount) {
            warnings.push(
                `${at}: connects via ${EnergyAppPackageConnectionTypeEnum.Cloud} but does not list the ` +
                    `${EnergyAppModelRequirementEnum.VendorCloudAccount} requirement.`,
            );
        } else if (!viaCloud && needsAccount) {
            warnings.push(
                `${at}: requires ${EnergyAppModelRequirementEnum.VendorCloudAccount} but no connection type is ` +
                    `${EnergyAppPackageConnectionTypeEnum.Cloud}.`,
            );
        }
    });
}

/**
 * Package-wide connection type checks: anything declared at all, device
 * detection backed by a connection type, and the dry-contact category.
 *
 * @param definition - The package.
 * @param categories - The package's declared categories.
 * @param declaredTypes - Every connection type declared on the package, its vendors and models.
 * @param warnings - Collector for advisory problems.
 */
function validatePackageConnectionTypes(
    definition: PackageCompatibilitySource,
    categories: EnergyAppPackageCategory[],
    declaredTypes: Set<EnergyAppPackageConnectionTypeEnum>,
    warnings: string[],
): void {
    if (declaredTypes.size === 0) {
        if (definition.compatibility.length > 0) {
            warnings.push(
                'no connectionTypes declared — enyo cannot tell this package apart from other apps for the same device. ' +
                    'Declare `connectionTypes` on the package.',
            );
        }
        return;
    }

    const detection = definition.options?.deviceDetection ?? {};
    for (const [method, type] of Object.entries(DETECTION_CONNECTION_TYPES) as [string, EnergyAppPackageConnectionTypeEnum][]) {
        const entries = detection[method as keyof EnergyAppPackageOptionsDeviceDetection];
        if (Array.isArray(entries) && entries.length > 0 && !declaredTypes.has(type)) {
            warnings.push(`options.deviceDetection.${method} is set, but connection type ${type} is declared nowhere.`);
        }
    }

    if (categories.includes(EnergyAppPackageCategory.DryContact) &&
        !declaredTypes.has(EnergyAppPackageConnectionTypeEnum.DryContact)) {
        warnings.push(
            `category ${EnergyAppPackageCategory.DryContact} without connection type ` +
                `${EnergyAppPackageConnectionTypeEnum.DryContact}.`,
        );
    }
}

/**
 * Validates one optional connection type list: an array of known values,
 * not empty, each value once.
 *
 * @param list - The declared list, possibly `undefined`.
 * @param at - Location and field name, used in messages.
 * @param errors - Collector for blocking problems.
 * @param warnings - Collector for advisory problems.
 * @returns The known, de-duplicated values.
 */
function validateConnectionTypeList(
    list: readonly EnergyAppPackageConnectionTypeEnum[] | undefined,
    at: string,
    errors: string[],
    warnings: string[],
): EnergyAppPackageConnectionTypeEnum[] {
    if (list === undefined) return [];
    if (Array.isArray(list) && list.length === 0) {
        errors.push(`${at} must not be empty — omit it to inherit, or list at least one connection type.`);
        return [];
    }
    const known = new Set<string>(Object.values(EnergyAppPackageConnectionTypeEnum));
    if (!Array.isArray(list)) {
        errors.push(`${at} must be an array.`);
        return [];
    }
    const values: EnergyAppPackageConnectionTypeEnum[] = [];
    for (const value of list) {
        if (!known.has(value)) {
            errors.push(`${at}: unknown connection type ${JSON.stringify(value)}.`);
        } else if (values.includes(value)) {
            warnings.push(`${at} lists ${value} twice.`);
        } else {
            values.push(value);
        }
    }
    return values;
}

/**
 * Whether two connection type lists hold the same values, ignoring order.
 *
 * @param a - The first list.
 * @param b - The second list, possibly `undefined`.
 * @returns `true` when both are arrays with the same set of values.
 */
function sameTypes(
    a: readonly EnergyAppPackageConnectionTypeEnum[],
    b: readonly EnergyAppPackageConnectionTypeEnum[] | undefined,
): boolean {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    const setA = new Set(a);
    const setB = new Set(b);
    return setA.size === setB.size && [...setA].every((type) => setB.has(type));
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
 * Validates the models of one vendor: names, year ranges, overlapping
 * duplicates, and their features, requirements and limitations.
 *
 * @param vendor - The vendor whose models are checked.
 * @param vendorAt - Human-readable location of the vendor, used in messages.
 * @param packageCategories - The package's declared categories.
 * @param maxYear - The latest year a range may reach.
 * @param errors - Collector for blocking problems.
 * @param warnings - Collector for advisory problems.
 */
function validateModels(
    vendor: EnergyAppPackageCompatibilityVendor,
    vendorAt: string,
    packageCategories: EnergyAppPackageCategory[],
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
            (model.category === undefined && packageCategories.includes(EnergyAppPackageCategory.Vehicle));
        if (isVehicleModel && model.modelYears === undefined) {
            warnings.push(
                `${at}: no modelYears — a car model name usually spans several generations; declare which years are supported.`,
            );
        }

        validateModelCapabilities(model, model.status ?? vendor.status, at, packageCategories, errors, warnings);

        const key = normalizeCompatibilityName(model.modelName);
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
 * Validates what one model declares it can do: its features, requirements and
 * limitations.
 *
 * Errors: a list that is not an array, an unknown value, and the contradictions
 * of {@link EnergyAppModelFeatureEnum.BatteryGridChargeFullPowerOnly}.
 * Warnings: a duplicate value, a feature that fits neither the model's category
 * (or, without one, any of the package's categories), features on a model
 * declared not compatible, a limitation without any feature it qualifies, and
 * {@link EnergyAppModelFeatureEnum.BatteryHold} when neither direction can be
 * blocked.
 *
 * For `gridOperatorControlInterfaces` (§14a): an unknown value is an error, and
 * so is an empty list ("cannot be dimmed") on a model that declares a grid
 * operator limitation feature. Warnings: a duplicate value, such a feature
 * without the interfaces declared, and interfaces on a model whose category
 * cannot be dimmed.
 *
 * Also checked here: `unsupportedFeatures` (unknown value and a feature in both
 * lists are errors, a duplicate or a feature outside the category a warning),
 * `verification` (unknown value is an error) and `customerNote` (malformed
 * entries and a duplicate language are errors, a missing German or English
 * text a warning).
 *
 * @param model - The model whose declarations are checked.
 * @param status - The model's effective status: its own, else its vendor's.
 * @param at - Human-readable location of the model, used in messages.
 * @param packageCategories - The package's declared categories.
 * @param errors - Collector for blocking problems.
 * @param warnings - Collector for advisory problems.
 */
function validateModelCapabilities(
    model: EnergyAppPackageCompatibilityModel,
    status: EnergyAppPackageCompatibilityStatus | undefined,
    at: string,
    packageCategories: EnergyAppPackageCategory[],
    errors: string[],
    warnings: string[],
): void {
    const features = validateValueList(model.features, 'features', EnergyAppModelFeatureEnum, at, errors, warnings);
    validateValueList(model.requirements, 'requirements', EnergyAppModelRequirementEnum, at, errors, warnings);
    const limitations = validateValueList(
        model.limitations, 'limitations', EnergyAppModelLimitationEnum, at, errors, warnings,
    );

    const has = (feature: EnergyAppModelFeatureEnum) => features.includes(feature);
    if (has(EnergyAppModelFeatureEnum.BatteryGridChargeFullPowerOnly)) {
        const conflicts = FULL_POWER_ONLY_CONFLICTS.filter(has);
        if (conflicts.length > 0) {
            errors.push(
                `${at}: ${EnergyAppModelFeatureEnum.BatteryGridChargeFullPowerOnly} cannot be combined with ` +
                    `${conflicts.join(', ')} — a battery that only grid-charges at full power has no setpoint, hold or discharge control.`,
            );
        }
    } else if (has(EnergyAppModelFeatureEnum.BatteryGridChargeFullPowerStoppable)) {
        errors.push(
            `${at}: ${EnergyAppModelFeatureEnum.BatteryGridChargeFullPowerStoppable} requires ` +
                `${EnergyAppModelFeatureEnum.BatteryGridChargeFullPowerOnly}.`,
        );
    }

    const categories = model.category !== undefined ? [model.category] : packageCategories;
    if (categories.length > 0 && !categories.includes(EnergyAppPackageCategory.Other)) {
        for (const feature of features) {
            if (!ENERGY_APP_MODEL_FEATURE_CATEGORIES[feature].some((category) => categories.includes(category))) {
                warnings.push(`${at}: feature ${feature} does not fit category ${categories.join(' / ')}.`);
            }
        }
    }

    if (status === EnergyAppPackageCompatibilityStatus.NotCompatible && features.length > 0) {
        warnings.push(`${at}: declared not compatible but lists features — the features would be shown for a device that does not work.`);
    }

    if (has(EnergyAppModelFeatureEnum.BatteryHold) &&
        limitations.includes(EnergyAppModelLimitationEnum.BatteryChargeCannotBeBlocked) &&
        limitations.includes(EnergyAppModelLimitationEnum.BatteryDischargeCannotBeBlocked)) {
        warnings.push(`${at}: ${EnergyAppModelFeatureEnum.BatteryHold} is declared, but neither charging nor discharging can be blocked — drop it.`);
    }

    for (const limitation of limitations) {
        const qualified = ENERGY_APP_MODEL_LIMITATION_FEATURES[limitation];
        if (qualified.length > 0 && !qualified.some(has)) {
            warnings.push(`${at}: limitation ${limitation} restricts none of the declared features (expects one of ${qualified.join(', ')}).`);
        }
    }

    validateGridOperatorControl(model, features, categories, at, errors, warnings);
    validateUnsupportedFeatures(model, features, categories, at, errors, warnings);

    if (model.verification !== undefined &&
        !(Object.values(EnergyAppModelVerificationEnum) as string[]).includes(model.verification)) {
        errors.push(`${at}: unknown verification value ${JSON.stringify(model.verification)}.`);
    }
    validateCustomerNote(model.customerNote, at, errors, warnings);
}

/**
 * Validates a model's `unsupportedFeatures`: known values, none also listed in
 * `features`, and fitting the model's categories.
 *
 * @param model - The model whose declaration is checked.
 * @param features - The model's known, de-duplicated features.
 * @param categories - The model's category, else the package's categories.
 * @param at - Human-readable location of the model, used in messages.
 * @param errors - Collector for blocking problems.
 * @param warnings - Collector for advisory problems.
 */
function validateUnsupportedFeatures(
    model: EnergyAppPackageCompatibilityModel,
    features: EnergyAppModelFeatureEnum[],
    categories: EnergyAppPackageCategory[],
    at: string,
    errors: string[],
    warnings: string[],
): void {
    const unsupported = validateValueList(
        model.unsupportedFeatures, 'unsupportedFeatures', EnergyAppModelFeatureEnum, at, errors, warnings,
    );
    const both = unsupported.filter((feature) => features.includes(feature));
    if (both.length > 0) {
        errors.push(`${at}: ${both.join(', ')} is listed in both features and unsupportedFeatures.`);
    }
    if (categories.length > 0 && !categories.includes(EnergyAppPackageCategory.Other)) {
        for (const feature of unsupported) {
            if (!ENERGY_APP_MODEL_FEATURE_CATEGORIES[feature].some((category) => categories.includes(category))) {
                warnings.push(`${at}: unsupported feature ${feature} does not fit category ${categories.join(' / ')}.`);
            }
        }
    }
}

/** Languages a customer note should be given in. */
const CUSTOMER_NOTE_LANGUAGES: readonly EnergyAppPackageLanguage[] = ['de', 'en'];

/**
 * Validates a model's `customerNote`: an array of `{language, value}` entries
 * with a known language, a non-empty text and each language once.
 *
 * @param note - The declared note, possibly `undefined`.
 * @param at - Human-readable location of the model, used in messages.
 * @param errors - Collector for blocking problems.
 * @param warnings - Collector for advisory problems.
 */
function validateCustomerNote(
    note: EnergyAppPackageCompatibilityModel['customerNote'],
    at: string,
    errors: string[],
    warnings: string[],
): void {
    if (note === undefined) return;
    if (!Array.isArray(note)) {
        errors.push(`${at}: customerNote must be an array of {language, value} entries.`);
        return;
    }
    const seen = new Set<string>();
    for (const entry of note) {
        if (!CUSTOMER_NOTE_LANGUAGES.includes(entry?.language)) {
            errors.push(`${at}: customerNote has an unknown language ${JSON.stringify(entry?.language)}.`);
            continue;
        }
        if (typeof entry.value !== 'string' || entry.value.trim() === '') {
            errors.push(`${at}: customerNote (${entry.language}) must be a non-empty string.`);
        }
        if (seen.has(entry.language)) {
            errors.push(`${at}: customerNote lists language ${entry.language} twice.`);
        }
        seen.add(entry.language);
    }
    const missing = CUSTOMER_NOTE_LANGUAGES.filter((language) => !seen.has(language));
    if (missing.length > 0 && seen.size > 0) {
        warnings.push(`${at}: customerNote has no ${missing.join(' / ')} text.`);
    }
}

/** The features that pass a grid operator's §14a limit on to a device. */
const GRID_OPERATOR_LIMIT_FEATURES: readonly EnergyAppModelFeatureEnum[] = [
    EnergyAppModelFeatureEnum.GridOperatorConsumptionLimitation,
    EnergyAppModelFeatureEnum.GridOperatorProductionLimitation,
];

/**
 * Validates a model's `gridOperatorControlInterfaces` (§14a) against its
 * features and category. See {@link validateModelCapabilities} for the rules.
 *
 * @param model - The model whose declaration is checked.
 * @param features - The model's known, de-duplicated features.
 * @param categories - The model's category, else the package's categories.
 * @param at - Human-readable location of the model, used in messages.
 * @param errors - Collector for blocking problems.
 * @param warnings - Collector for advisory problems.
 */
function validateGridOperatorControl(
    model: EnergyAppPackageCompatibilityModel,
    features: EnergyAppModelFeatureEnum[],
    categories: EnergyAppPackageCategory[],
    at: string,
    errors: string[],
    warnings: string[],
): void {
    const declared = model.gridOperatorControlInterfaces;
    const interfaces = validateValueList(
        declared, 'gridOperatorControlInterfaces', EnergyAppModelGridOperatorControlInterfaceEnum, at, errors, warnings,
    );
    const limitFeatures = GRID_OPERATOR_LIMIT_FEATURES.filter((feature) => features.includes(feature));

    if (limitFeatures.length > 0) {
        if (declared === undefined) {
            warnings.push(
                `${at}: ${limitFeatures.join(', ')} is declared, but gridOperatorControlInterfaces is not — ` +
                    'declare how the model is dimmed under §14a.',
            );
        } else if (Array.isArray(declared) && declared.length === 0) {
            errors.push(
                `${at}: gridOperatorControlInterfaces is empty (cannot be dimmed under §14a), ` +
                    `but ${limitFeatures.join(', ')} is declared.`,
            );
        }
    }

    const dimmable = GRID_OPERATOR_LIMIT_FEATURES.flatMap((feature) => ENERGY_APP_MODEL_FEATURE_CATEGORIES[feature]);
    if (interfaces.length > 0 && categories.length > 0 && !categories.includes(EnergyAppPackageCategory.Other) &&
        !categories.some((category) => dimmable.includes(category))) {
        warnings.push(`${at}: gridOperatorControlInterfaces does not fit category ${categories.join(' / ')} — such devices are not dimmed under §14a.`);
    }
}

/**
 * Validates one optional list of enum values on a model: it must be an array of
 * known values, and a value should appear only once.
 *
 * @param list - The declared list, possibly `undefined`.
 * @param field - The model field the list belongs to, used in messages.
 * @param allowed - The enum the values must come from.
 * @param at - Human-readable location of the model, used in messages.
 * @param errors - Collector for blocking problems.
 * @param warnings - Collector for advisory problems.
 * @returns The known, de-duplicated values, for further checks.
 */
function validateValueList<T extends string>(
    list: readonly T[] | undefined,
    field: string,
    allowed: Record<string, T>,
    at: string,
    errors: string[],
    warnings: string[],
): T[] {
    if (list === undefined) return [];
    if (!Array.isArray(list)) {
        errors.push(`${at}: ${field} must be an array.`);
        return [];
    }

    const known = new Set<string>(Object.values(allowed));
    const values: T[] = [];
    for (const value of list) {
        if (!known.has(value)) {
            errors.push(`${at}: unknown ${field} value ${JSON.stringify(value)}.`);
        } else if (values.includes(value)) {
            warnings.push(`${at}: ${field} lists ${value} twice.`);
        } else {
            values.push(value);
        }
    }
    return values;
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

