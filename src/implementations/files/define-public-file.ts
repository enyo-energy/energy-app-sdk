/**
 * Ergonomic authoring helpers for a package's public files
 * ({@link EnergyAppPackageDefinition.files}).
 *
 * `definePublicFile()` is an identity helper that type-checks a file entry
 * where it is written — mirroring the SDK's `defineEnergyAppPackage()` and
 * `defineFirmwareFile()` pattern. `resolvePublicFile()` performs the same
 * name lookup enyo does when it renders a reference, so an app can unit-test
 * that every name it uses actually resolves.
 *
 * Pair with `validatePackageFiles()` (`./public-file-validators.ts`) to fail
 * fast before publishing.
 */

import type {EnergyAppPackagePublicFile} from '../../energy-app-package-definition.js';

/**
 * Identity helper that type-checks a public file entry at definition time
 * (mirrors `defineEnergyAppPackage`). Prefer this over a bare object literal so
 * mistakes surface where the entry is written.
 *
 * @param file - The public file entry to declare.
 * @returns The same entry, typed as {@link EnergyAppPackagePublicFile}.
 *
 * @example
 * ```typescript
 * definePublicFile({
 *     name: 'dip-switches',
 *     path: './assets/onboarding/dip-switches.png'
 * })
 * ```
 */
export function definePublicFile(
    file: EnergyAppPackagePublicFile,
): EnergyAppPackagePublicFile {
    return file;
}

/**
 * Looks up a declared public file by its name.
 *
 * This is the resolution step enyo performs for a reference such as an
 * onboarding v2 image block's `file`. Exposed so an app can assert in its own
 * tests that the names its guides use are declared, rather than discovering a
 * typo as a missing image on an installer's screen.
 *
 * @param files - The package's declared public files, or `undefined` when the
 *   package declares none.
 * @param name - The file name to resolve.
 * @returns The matching entry, or `undefined` when no entry carries that name.
 *
 * @example
 * ```typescript
 * const file = resolvePublicFile(packageDef.files, 'dip-switches');
 * if (!file) throw new Error('image reference does not resolve');
 * ```
 */
export function resolvePublicFile(
    files: EnergyAppPackagePublicFile[] | undefined,
    name: string,
): EnergyAppPackagePublicFile | undefined {
    return files?.find(file => file.name === name);
}
