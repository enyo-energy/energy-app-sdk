/**
 * Finds every way a device can be connected across several packages, so the
 * user can choose between them.
 *
 * A package only knows its own compatibility list. The enyo Store and
 * onboarding see all packages, and when two of them support the same model —
 * a cloud app and a local Modbus app, say — they present one option per
 * package and connection type. {@link findCompatibleAppOptions} is that logic,
 * exported so every consumer matches and orders the options the same way.
 */

import {
    EnergyAppPackageCompatibilityStatus,
    EnergyAppPackageConnectionTypeEnum,
} from '../../energy-app-package-definition.js';
import type {
    EnergyAppPackageCompatibilityModel,
    EnergyAppPackageCompatibilityVendor,
    EnergyAppPackageDefinition,
} from '../../energy-app-package-definition.js';
import type {
    EnergyAppModelFeatureEnum,
    EnergyAppModelLimitationEnum,
    EnergyAppModelRequirementEnum,
} from '../../energy-app-model-feature.enum.js';
import {isYearInCompatibilityRange} from './compatibility-validators.js';
import {normalizeCompatibilityName} from './compatibility-names.js';
import {
    ENERGY_APP_CONNECTION_TYPE_SCOPES,
    EnergyAppConnectionScopeEnum,
    getEffectiveConnectionTypes,
} from './connection-types.js';

/** The parts of a package definition {@link findCompatibleAppOptions} reads. */
export type CompatibleAppSource = Pick<EnergyAppPackageDefinition, 'packageName' | 'compatibility'> &
    Partial<Pick<EnergyAppPackageDefinition, 'connectionTypes'>>;

/** The device the user wants to connect. */
export interface CompatibleAppQuery {
    /** The vendor, matched case-insensitively against `vendorName`. */
    vendorName: string;
    /**
     * The model, matched case-insensitively against `modelName`. Omit when the
     * user only knows the vendor: every package declaring the vendor is then
     * offered once per connection type, without model details.
     */
    modelName?: string;
    /**
     * The model year, matched against `modelYears` with
     * `isYearInCompatibilityRange()`. Omit to match every generation.
     */
    year?: number;
}

/** One way to connect the queried device: a package with one connection type. */
export interface CompatibleAppOption<T extends CompatibleAppSource = CompatibleAppSource> {
    /** The package's `packageName`. */
    packageName: string;
    /** The package definition the option comes from, as passed in. */
    definition: T;
    /**
     * The connection type of this option. Absent when the package declares no
     * connection type for the device; it then yields a single option.
     */
    connectionType?: EnergyAppPackageConnectionTypeEnum;
    /** Local or cloud, from `ENERGY_APP_CONNECTION_TYPE_SCOPES`; absent with {@link connectionType}. */
    scope?: EnergyAppConnectionScopeEnum;
    /** The matching vendor entry. */
    vendor: EnergyAppPackageCompatibilityVendor;
    /**
     * The matching model entry. Absent when the query names no model, or when
     * the vendor is declared brand-wide (an empty `models` list).
     */
    model?: EnergyAppPackageCompatibilityModel;
    /** The effective status: the model's, else the vendor's, else compatible. */
    status: EnergyAppPackageCompatibilityStatus;
    /** The model's features; empty without a model. */
    features: EnergyAppModelFeatureEnum[];
    /** The model's requirements; empty without a model. */
    requirements: EnergyAppModelRequirementEnum[];
    /** The model's limitations; empty without a model. */
    limitations: EnergyAppModelLimitationEnum[];
    /** Whether the package is the vendor's `defaultEnergyApp`. */
    defaultEnergyApp: boolean;
}

/**
 * Lists every package and connection type that can connect the queried
 * device, best option first.
 *
 * Matching: the vendor by name; with a `modelName`, every model entry of that
 * name whose `modelYears` contain `year` (all generations without a year). A
 * vendor with an empty `models` list is brand-wide and matches every model. A
 * package that declares the vendor but not the model yields nothing for it.
 *
 * Each match yields one option per effective connection type (see
 * `getEffectiveConnectionTypes()`), or one option without a connection type
 * when none is declared.
 *
 * Order:
 * 1. compatible before not compatible;
 * 2. without a `modelName`: the vendor's `defaultEnergyApp` first;
 * 3. more declared features first;
 * 4. local before cloud, then options without a connection type;
 * 5. the vendor's `defaultEnergyApp` first (when a model was queried);
 * 6. by package name and connection type, so the order is stable.
 *
 * @param definitions - All candidate packages.
 * @param query - The device to connect; see {@link CompatibleAppQuery}.
 * @returns The options, best first; empty when no package declares the device.
 *
 * @example
 * ```typescript
 * const options = findCompatibleAppOptions(allPackages, {vendorName: 'Daikin', modelName: 'Altherma 3 H'});
 * // [{packageName: 'daikin-modbus', connectionType: 'modbus-tcp', scope: 'local', ...},
 * //  {packageName: 'daikin-cloud', connectionType: 'cloud', scope: 'cloud', ...}]
 * ```
 */
export function findCompatibleAppOptions<T extends CompatibleAppSource>(
    definitions: readonly T[],
    query: CompatibleAppQuery,
): CompatibleAppOption<T>[] {
    const vendorKey = normalizeCompatibilityName(query.vendorName);
    const modelKey = query.modelName !== undefined ? normalizeCompatibilityName(query.modelName) : undefined;
    const options: CompatibleAppOption<T>[] = [];

    for (const definition of definitions) {
        for (const vendor of definition.compatibility ?? []) {
            if (typeof vendor?.vendorName !== 'string' || normalizeCompatibilityName(vendor.vendorName) !== vendorKey) {
                continue;
            }
            for (const model of matchModels(vendor, modelKey, query.year)) {
                options.push(...toOptions(definition, vendor, model));
            }
        }
    }

    return options.sort((a, b) => compareOptions(a, b, modelKey !== undefined));
}

/**
 * The model entries of a vendor that match the query.
 *
 * @param vendor - The vendor entry.
 * @param modelKey - The normalized model name, or `undefined` for a vendor-only query.
 * @param year - The queried year, if any.
 * @returns The matching models; `[undefined]` for a vendor-level match without a model.
 */
function matchModels(
    vendor: EnergyAppPackageCompatibilityVendor,
    modelKey: string | undefined,
    year: number | undefined,
): (EnergyAppPackageCompatibilityModel | undefined)[] {
    const models = Array.isArray(vendor.models) ? vendor.models : [];
    if (modelKey === undefined || models.length === 0) return [undefined];
    return models.filter((model) =>
        typeof model?.modelName === 'string' &&
        normalizeCompatibilityName(model.modelName) === modelKey &&
        (year === undefined || isYearInCompatibilityRange(model.modelYears, year)),
    );
}

/**
 * Builds the options of one matched vendor / model: one per connection type.
 *
 * @param definition - The package.
 * @param vendor - The matched vendor entry.
 * @param model - The matched model entry, if any.
 * @returns The options.
 */
function toOptions<T extends CompatibleAppSource>(
    definition: T,
    vendor: EnergyAppPackageCompatibilityVendor,
    model: EnergyAppPackageCompatibilityModel | undefined,
): CompatibleAppOption<T>[] {
    const base = {
        packageName: definition.packageName,
        definition,
        vendor,
        model,
        status: model?.status ?? vendor.status ?? EnergyAppPackageCompatibilityStatus.Compatible,
        features: [...(model?.features ?? [])],
        requirements: [...(model?.requirements ?? [])],
        limitations: [...(model?.limitations ?? [])],
        defaultEnergyApp: vendor.defaultEnergyApp === true,
    };
    const types = getEffectiveConnectionTypes(definition, vendor, model);
    if (types.length === 0) return [base];
    return types.map((connectionType) => ({
        ...base,
        connectionType,
        scope: ENERGY_APP_CONNECTION_TYPE_SCOPES[connectionType],
    }));
}

/** Sort rank of a scope: local first, then cloud, then no connection type. */
const SCOPE_RANK: Record<EnergyAppConnectionScopeEnum, number> = {
    [EnergyAppConnectionScopeEnum.Local]: 0,
    [EnergyAppConnectionScopeEnum.Cloud]: 1,
};

/**
 * Compares two options for {@link findCompatibleAppOptions}'s order.
 *
 * @param a - The first option.
 * @param b - The second option.
 * @param modelQueried - Whether the query named a model.
 * @returns A negative number when `a` comes first, positive when `b` does.
 */
function compareOptions(a: CompatibleAppOption, b: CompatibleAppOption, modelQueried: boolean): number {
    const notCompatible = (o: CompatibleAppOption) => (o.status === EnergyAppPackageCompatibilityStatus.NotCompatible ? 1 : 0);
    const notDefault = (o: CompatibleAppOption) => (o.defaultEnergyApp ? 0 : 1);
    const scopeRank = (o: CompatibleAppOption) => (o.scope !== undefined ? SCOPE_RANK[o.scope] : 2);

    return notCompatible(a) - notCompatible(b)
        || (modelQueried ? 0 : notDefault(a) - notDefault(b))
        || b.features.length - a.features.length
        || scopeRank(a) - scopeRank(b)
        || notDefault(a) - notDefault(b)
        || a.packageName.localeCompare(b.packageName)
        || (a.connectionType ?? '').localeCompare(b.connectionType ?? '');
}
