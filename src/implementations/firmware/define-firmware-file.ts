/**
 * Ergonomic authoring helpers for the firmware update registry
 * ({@link EnergyAppPackageDefinition.firmware}).
 *
 * `defineFirmwareFile()` is an identity helper that type-checks a firmware entry
 * where it is written — mirroring the SDK's `defineEnergyAppPackage()` pattern.
 * `resolveNextFirmware()` and `resolveFirmwareUpdatePath()` implement the same
 * graph resolution the host performs at runtime, so an app can unit-test its
 * declared upgrade paths without a hub.
 *
 * Pair with `validateFirmwareRegistry()` (`./firmware-validators.ts`) to fail
 * fast before publishing.
 */

import type {
    EnergyAppPackageFirmwareFile,
    EnergyAppPackageFirmwareMode,
} from '../../energy-app-package-definition.js';

/**
 * Options shared by {@link resolveNextFirmware} and
 * {@link resolveFirmwareUpdatePath}.
 */
export interface ResolveFirmwareOptions {
    /**
     * Restrict resolution to entries applying to this model. Entries that
     * declare no `modelNames` apply to every model and are always in scope.
     */
    modelName?: string;
    /**
     * The package's resolution mode. Defaults to `'latest'`, matching the
     * default of {@link EnergyAppPackageDefinition.firmwareMode}.
     */
    firmwareMode?: EnergyAppPackageFirmwareMode;
}

/**
 * Upper bound on how many hops {@link resolveFirmwareUpdatePath} follows before
 * giving up. A validated graph is acyclic and far shorter than this; the cap
 * exists only so an unvalidated, cyclic declaration cannot hang the caller.
 */
const MAX_UPDATE_PATH_LENGTH = 100;

/**
 * Identity helper that type-checks a firmware entry at definition time (mirrors
 * `defineEnergyAppPackage`). Prefer this over a bare object literal so mistakes
 * surface where the entry is written.
 *
 * @param file - The firmware entry to declare.
 * @returns The same entry, typed as {@link EnergyAppPackageFirmwareFile}.
 *
 * @example
 * ```typescript
 * defineFirmwareFile({
 *     fileId: 'ac22-hotfix-a',
 *     path: './firmware/ac22-hotfix-a.bin',
 *     firmwareVersion: 'hotfix-a',
 *     installForFirmwareVersion: ['2024-11-rc3'], // used when firmwareMode is 'dependent'
 *     modelNames: ['AC-22-Pro']
 * })
 * ```
 */
export function defineFirmwareFile(
    file: EnergyAppPackageFirmwareFile,
): EnergyAppPackageFirmwareFile {
    return file;
}

/**
 * Tests whether a firmware entry applies to a given model.
 *
 * An entry that declares no `modelNames` applies to every model; one that
 * declares them applies only to the listed models. Passing no `modelName`
 * considers every entry.
 *
 * @param file - The firmware entry to test.
 * @param modelName - The model to scope to, or `undefined` for no scoping.
 * @returns True when the entry is in scope.
 */
export function firmwareFileAppliesToModel(
    file: EnergyAppPackageFirmwareFile,
    modelName?: string,
): boolean {
    if (!modelName) return true;
    if (!file.modelNames?.length) return true;
    return file.modelNames.includes(modelName);
}

/**
 * Resolves the single next firmware step for a device — the same resolution the
 * host performs for `getNextFirmware()`.
 *
 * Under `firmwareMode: 'latest'` (the default) the **last declared** entry in
 * scope is returned, whatever version the device runs, and `undefined` once the
 * device already runs it. Declaration order is the only available order:
 * versions are opaque strings and cannot be compared.
 *
 * Under `'dependent'`, `currentFirmwareVersion` is matched by exact string
 * equality against the `installForFirmwareVersion` edges of every entry in
 * scope. When no edge matches, resolution falls back to the entry marked
 * `fallbackForUnknownVersion`, if any — but only when `currentFirmwareVersion`
 * is not itself a declared node, so a device sitting on a known terminal version
 * is reported as up to date rather than pushed back to the baseline image.
 *
 * @param files - The package's declared firmware entries, in declaration order.
 * @param currentFirmwareVersion - The version currently installed on the device.
 *   Matched verbatim; versions are opaque strings and are never ordered.
 * @param options - Model scoping and the package's {@link ResolveFirmwareOptions.firmwareMode}.
 * @returns The next firmware entry, or `undefined` when the device is up to
 *   date.
 *
 * @example
 * ```typescript
 * const next = resolveNextFirmware(definition.firmware ?? [], '2024-11-rc3', {
 *     modelName: 'AC-22-Pro',
 *     firmwareMode: definition.firmwareMode,
 * });
 * ```
 */
export function resolveNextFirmware(
    files: EnergyAppPackageFirmwareFile[],
    currentFirmwareVersion: string,
    options: ResolveFirmwareOptions = {},
): EnergyAppPackageFirmwareFile | undefined {
    const {modelName, firmwareMode = 'latest'} = options;
    const inScope = files.filter(file => firmwareFileAppliesToModel(file, modelName));

    if (firmwareMode === 'latest') {
        const latest = inScope[inScope.length - 1];
        if (!latest || latest.firmwareVersion === currentFirmwareVersion) return undefined;
        return latest;
    }

    const next = inScope.find(
        file => file.installForFirmwareVersion?.includes(currentFirmwareVersion),
    );
    if (next) return next;

    const isKnownVersion = inScope.some(file => file.firmwareVersion === currentFirmwareVersion);
    if (isKnownVersion) return undefined;

    return inScope.find(file => file.fallbackForUnknownVersion);
}

/**
 * Resolves the complete chain of firmware steps from `currentFirmwareVersion` to
 * its terminal node, in the order they must be applied — the same resolution the
 * host performs for `getFirmwareUpdatePath()`.
 *
 * Returns an empty array when the device is already up to date, and never more
 * than one entry under `firmwareMode: 'latest'`, where there is no chain to
 * walk. Stops after {@link MAX_UPDATE_PATH_LENGTH} hops, or as soon as a version
 * repeats, so an unvalidated cyclic graph cannot loop forever.
 *
 * @param files - The package's declared firmware entries, in declaration order.
 * @param currentFirmwareVersion - The version currently installed on the device.
 * @param options - Model scoping and the package's {@link ResolveFirmwareOptions.firmwareMode}.
 * @returns The ordered chain of firmware entries; empty when nothing is pending.
 */
export function resolveFirmwareUpdatePath(
    files: EnergyAppPackageFirmwareFile[],
    currentFirmwareVersion: string,
    options: ResolveFirmwareOptions = {},
): EnergyAppPackageFirmwareFile[] {
    const path: EnergyAppPackageFirmwareFile[] = [];
    const seen = new Set<string>([currentFirmwareVersion]);
    let version = currentFirmwareVersion;

    while (path.length < MAX_UPDATE_PATH_LENGTH) {
        const next = resolveNextFirmware(files, version, options);
        if (!next || seen.has(next.firmwareVersion)) break;

        path.push(next);
        seen.add(next.firmwareVersion);
        version = next.firmwareVersion;
    }

    return path;
}
