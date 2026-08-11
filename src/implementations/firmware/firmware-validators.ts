/**
 * Client-side validator for the firmware update registry declared in a package
 * definition ({@link EnergyAppPackageDefinition.firmware}).
 *
 * Firmware versions are opaque vendor strings, so the upgrade order is declared
 * rather than computed: declaration order under `firmwareMode: 'latest'`, or an
 * explicit graph under `'dependent'`. A declared graph is easy to author into an
 * ambiguous or looping state, which has no correct resolution at runtime — so
 * those cases are blocking `errors` here and are rejected at release time rather
 * than silently resolved.
 *
 * Graph checks only run under `'dependent'`. Under `'latest'` the graph fields
 * carry no meaning, so declaring them produces warnings instead.
 *
 * `warnings` are advisory: a source version with no matching node, for instance,
 * is exactly how you legitimately attach a chain to firmware that shipped before
 * the registry existed.
 *
 * Use {@link validateFirmwareRegistry} for the non-throwing result, or
 * {@link assertValidFirmwareRegistry} to throw on failure.
 */

import type {
    EnergyAppPackageDefinition,
    EnergyAppPackageFirmwareFile,
    EnergyAppPackageFirmwareMode,
} from '../../energy-app-package-definition.js';
import {EnergyAppPermissionTypeEnum} from '../../energy-app-permission.type.js';
import {resolveNextFirmware} from './define-firmware-file.js';

/**
 * Thrown by {@link assertValidFirmwareRegistry} when a package's firmware
 * declaration fails validation. The message lists every blocking error so
 * callers can surface them directly.
 */
export class FirmwareRegistryValidationError extends Error {
    /** The individual blocking errors that caused the failure. */
    public readonly errors: string[];

    /**
     * @param errors - The blocking validation errors.
     */
    constructor(errors: string[]) {
        super(`Invalid firmware registry:\n- ${errors.join('\n- ')}`);
        this.name = 'FirmwareRegistryValidationError';
        this.errors = errors;
    }
}

/** The outcome of validating a package's firmware declaration. */
export interface FirmwareRegistryValidationResult {
    /** True when there are no blocking `errors` (warnings are still allowed). */
    ok: boolean;
    /** Blocking problems — these must be fixed before releasing. */
    errors: string[];
    /** Advisory problems — allowed, but usually worth reviewing. */
    warnings: string[];
}

/**
 * Upper bound on how many hops the cycle walk follows before declaring a graph
 * cyclic. Kept well above any realistic chain length.
 */
const MAX_CHAIN_LENGTH = 100;

/**
 * Tests whether two firmware entries can ever apply to the same device.
 *
 * An entry without `modelNames` applies to every model, so it overlaps with
 * everything; two entries that both name models overlap when those sets
 * intersect. Two entries that cannot overlap may safely declare the same
 * version or the same source edge.
 *
 * @param a - First firmware entry.
 * @param b - Second firmware entry.
 * @returns True when both entries can apply to the same device.
 */
function scopesOverlap(
    a: EnergyAppPackageFirmwareFile,
    b: EnergyAppPackageFirmwareFile,
): boolean {
    if (!a.modelNames?.length || !b.modelNames?.length) return true;
    return a.modelNames.some(model => b.modelNames!.includes(model));
}

/**
 * Describes a firmware entry for use in validation messages.
 *
 * @param file - The entry to describe.
 * @param index - Its position in the `firmware` array.
 * @returns A human-readable location string.
 */
function describe(file: EnergyAppPackageFirmwareFile, index: number): string {
    return `firmware[${index}] (${file.fileId || '?'})`;
}

/**
 * Reports every pair of entries that overlap in scope and share a key produced
 * by `keysOf` — the shape behind the ambiguity, duplicate-version and
 * multiple-fallback checks.
 *
 * @param files - All declared firmware entries.
 * @param keysOf - Extracts the keys an entry claims (e.g. its source versions).
 * @param message - Builds the error text from the shared key and both entries.
 * @returns One error string per conflicting pair.
 */
function findScopeConflicts(
    files: EnergyAppPackageFirmwareFile[],
    keysOf: (file: EnergyAppPackageFirmwareFile) => string[],
    message: (key: string, a: string, b: string) => string,
): string[] {
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
        for (let j = i + 1; j < files.length; j++) {
            if (!scopesOverlap(files[i], files[j])) continue;

            const shared = keysOf(files[i]).filter(key => keysOf(files[j]).includes(key));
            for (const key of shared) {
                errors.push(message(key, describe(files[i], i), describe(files[j], j)));
            }
        }
    }

    return errors;
}

/**
 * Validates the firmware update registry declared in a package definition.
 *
 * Blocking errors in every mode:
 * - a missing or duplicate `fileId`, `path` or `firmwareVersion`;
 * - **duplicate versions** — two entries that can apply to the same device
 *   installing the same `firmwareVersion`;
 * - declaring firmware without the `FirmwareRegistry` permission.
 *
 * Additional blocking errors under `firmwareMode: 'dependent'`:
 * - **ambiguity** — two entries that can apply to the same device both offering
 *   an update for the same current version, which leaves the host no correct
 *   choice;
 * - **cycles** — a chain that returns to a version it already visited, which
 *   would make the update path never terminate;
 * - **self-reference** — an entry listing its own version in
 *   `installForFirmwareVersion`;
 * - **multiple fallbacks** for overlapping scopes.
 *
 * Warnings:
 * - under `'latest'`, entries declaring `installForFirmwareVersion` or
 *   `fallbackForUnknownVersion` — both are ignored in that mode, so declaring
 *   them usually means `firmwareMode: 'dependent'` was intended;
 * - under `'dependent'`, a source version matching no declared node (expected
 *   when attaching to pre-existing firmware), and entries that are neither
 *   reachable via `installForFirmwareVersion` nor a fallback, and so are never
 *   returned by `getNextFirmware()`;
 * - a model or vendor not present in the package's `compatibility` declaration.
 *
 * @param definition - The package definition to validate. Packages declaring no
 *   firmware always pass. `firmwareMode` defaults to `'latest'`.
 * @returns The {@link FirmwareRegistryValidationResult}.
 *
 * @example
 * ```typescript
 * const result = validateFirmwareRegistry(packageDefinition);
 * if (!result.ok) console.error(result.errors);
 * ```
 */
export function validateFirmwareRegistry(
    definition: Pick<
        EnergyAppPackageDefinition,
        'firmware' | 'firmwareMode' | 'permissions' | 'compatibility'
    >,
): FirmwareRegistryValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const files = definition.firmware ?? [];
    const firmwareMode: EnergyAppPackageFirmwareMode = definition.firmwareMode ?? 'latest';

    if (!files.length) return {ok: true, errors, warnings};

    const grantedPermissions = (definition.permissions ?? []).map(
        permission => typeof permission === 'string' ? permission : permission.permission,
    );
    if (!grantedPermissions.includes(EnergyAppPermissionTypeEnum.FirmwareRegistry)) {
        errors.push(
            'firmware is declared but the `FirmwareRegistry` permission is not requested; ' +
            'add it to `permissions` or the app cannot read its own firmware registry.',
        );
    }

    const fileIds = new Set<string>();
    for (const [index, file] of files.entries()) {
        const at = describe(file, index);

        if (!file.fileId) errors.push(`${at}: fileId is required.`);
        else if (fileIds.has(file.fileId)) errors.push(`${at}: duplicate fileId "${file.fileId}".`);
        else fileIds.add(file.fileId);

        if (!file.path) errors.push(`${at}: path is required.`);
        if (!file.firmwareVersion) errors.push(`${at}: firmwareVersion is required.`);

        if (firmwareMode === 'latest') {
            if (file.installForFirmwareVersion?.length) {
                warnings.push(
                    `${at}: declares installForFirmwareVersion, which is ignored under ` +
                    "firmwareMode 'latest' — set firmwareMode to 'dependent' to make the " +
                    'declared order take effect.',
                );
            }
            if (file.fallbackForUnknownVersion) {
                warnings.push(
                    `${at}: fallbackForUnknownVersion is ignored under firmwareMode 'latest', ` +
                    'where every device is already offered the last declared entry.',
                );
            }
            continue;
        }

        if (file.firmwareVersion && file.installForFirmwareVersion?.includes(file.firmwareVersion)) {
            errors.push(
                `${at}: installForFirmwareVersion contains its own firmwareVersion ` +
                `"${file.firmwareVersion}".`,
            );
        }

        if (!file.installForFirmwareVersion?.length && !file.fallbackForUnknownVersion) {
            warnings.push(
                `${at}: declares no installForFirmwareVersion and is not ` +
                'fallbackForUnknownVersion, so it is never returned by getNextFirmware().',
            );
        }
    }

    errors.push(...findScopeConflicts(
        files,
        file => file.firmwareVersion ? [file.firmwareVersion] : [],
        (version, a, b) =>
            `${a} and ${b} both install firmwareVersion "${version}" for overlapping models; ` +
            'versions must be unique per model.',
    ));

    if (firmwareMode === 'dependent') {
        errors.push(...findScopeConflicts(
            files,
            file => file.installForFirmwareVersion ?? [],
            (version, a, b) =>
                `${a} and ${b} both install for current version "${version}" on overlapping ` +
                'models; the next step would be ambiguous.',
        ));

        errors.push(...findScopeConflicts(
            files,
            file => file.fallbackForUnknownVersion ? ['fallback'] : [],
            (_key, a, b) =>
                `${a} and ${b} are both marked fallbackForUnknownVersion for overlapping ` +
                'models; at most one fallback per model is allowed.',
        ));

        errors.push(...findCycles(files));
        warnings.push(...findDanglingSources(files));
    }

    warnings.push(...findUnknownCompatibility(files, definition.compatibility ?? []));

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Walks the chain forward from every declared version and reports the ones that
 * revisit a version they already passed through. Only meaningful under
 * `firmwareMode: 'dependent'`, the only mode with a chain to walk.
 *
 * The walk runs once per model an entry declares, because resolution is
 * model-scoped: a cycle can exist for one model while the same entries form a
 * valid chain for another.
 *
 * @param files - All declared firmware entries.
 * @returns One error per cyclic starting point.
 */
function findCycles(files: EnergyAppPackageFirmwareFile[]): string[] {
    const errors: string[] = [];
    const models = new Set<string | undefined>([undefined]);
    for (const file of files) {
        for (const model of file.modelNames ?? []) models.add(model);
    }

    for (const model of models) {
        for (const file of files) {
            if (!file.firmwareVersion) continue;

            const seen = new Set<string>([file.firmwareVersion]);
            let version = file.firmwareVersion;

            for (let hop = 0; hop < MAX_CHAIN_LENGTH; hop++) {
                const next = resolveNextFirmware(files, version, {
                    modelName: model,
                    firmwareMode: 'dependent',
                });
                if (!next) break;

                if (seen.has(next.firmwareVersion)) {
                    const scope = model ? ` for model "${model}"` : '';
                    errors.push(
                        `firmware graph has a cycle${scope}: "${version}" updates to ` +
                        `"${next.firmwareVersion}", which was already visited on the chain ` +
                        `starting at "${file.firmwareVersion}".`,
                    );
                    break;
                }

                seen.add(next.firmwareVersion);
                version = next.firmwareVersion;
            }
        }
    }

    return [...new Set(errors)];
}

/**
 * Reports source versions that match no declared node.
 *
 * Advisory only: this is the intended way to attach a chain to firmware that
 * shipped before the registry existed.
 *
 * @param files - All declared firmware entries.
 * @returns One warning per dangling source version.
 */
function findDanglingSources(files: EnergyAppPackageFirmwareFile[]): string[] {
    const declaredVersions = new Set(files.map(file => file.firmwareVersion));
    const warnings: string[] = [];

    for (const [index, file] of files.entries()) {
        for (const source of file.installForFirmwareVersion ?? []) {
            if (!declaredVersions.has(source)) {
                warnings.push(
                    `${describe(file, index)}: installForFirmwareVersion "${source}" matches no ` +
                    'declared firmwareVersion — fine when attaching to firmware that shipped ' +
                    'before this registry, otherwise likely a typo.',
                );
            }
        }
    }

    return warnings;
}

/**
 * Reports vendors and models referenced by firmware entries that the package
 * does not declare in its `compatibility` list.
 *
 * @param files - All declared firmware entries.
 * @param compatibility - The package's declared vendors and models.
 * @returns One warning per unknown vendor or model.
 */
function findUnknownCompatibility(
    files: EnergyAppPackageFirmwareFile[],
    compatibility: EnergyAppPackageDefinition['compatibility'],
): string[] {
    const warnings: string[] = [];
    if (!compatibility.length) return warnings;

    const vendors = new Set(compatibility.map(vendor => vendor.vendorName));
    const models = new Set(
        compatibility.flatMap(vendor => vendor.models.map(model => model.modelName)),
    );

    for (const [index, file] of files.entries()) {
        const at = describe(file, index);

        if (file.vendorName && !vendors.has(file.vendorName)) {
            warnings.push(`${at}: vendorName "${file.vendorName}" is not listed in compatibility.`);
        }

        for (const model of file.modelNames ?? []) {
            if (!models.has(model)) {
                warnings.push(`${at}: modelName "${model}" is not listed in compatibility.`);
            }
        }
    }

    return warnings;
}

/**
 * Validates a package's firmware declaration and throws when it has blocking
 * errors. Warnings are ignored.
 *
 * @param definition - The package definition to validate.
 * @throws {FirmwareRegistryValidationError} If the declaration has blocking
 *   errors.
 *
 * @example
 * ```typescript
 * assertValidFirmwareRegistry(packageDefinition); // throws before you release a broken graph
 * ```
 */
export function assertValidFirmwareRegistry(
    definition: Pick<
        EnergyAppPackageDefinition,
        'firmware' | 'firmwareMode' | 'permissions' | 'compatibility'
    >,
): void {
    const result = validateFirmwareRegistry(definition);
    if (!result.ok) throw new FirmwareRegistryValidationError(result.errors);
}
