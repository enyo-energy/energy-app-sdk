/**
 * Client-side validator for the public files declared in a package definition
 * ({@link EnergyAppPackageDefinition.files}).
 *
 * The declarations are resolved twice after they leave the app repository: the
 * enyo CLI reads each `path` from the package at release time, and enyo resolves
 * each `name` when something references the upload. Both steps happen far from
 * the author, so anything that makes them fail — a duplicate name, a path
 * pointing outside the package — is a blocking `error` caught here instead.
 *
 * `warnings` are advisory: a file nothing references still uploads fine, it is
 * just dead weight in the release.
 *
 * Use {@link validatePackageFiles} for the non-throwing result, or
 * {@link assertValidPackageFiles} to throw on failure.
 */

import type {EnergyAppPackagePublicFile} from '../../energy-app-package-definition.js';

/**
 * Thrown by {@link assertValidPackageFiles} when a package's public file
 * declarations fail validation. The message lists every blocking error so
 * callers can surface them directly.
 */
export class PackageFilesValidationError extends Error {
    /** The individual blocking errors that caused the failure. */
    public readonly errors: string[];

    /**
     * @param errors - The blocking validation errors.
     */
    constructor(errors: string[]) {
        super(`Invalid package files:\n- ${errors.join('\n- ')}`);
        this.name = 'PackageFilesValidationError';
        this.errors = errors;
    }
}

/** The outcome of validating a package's public file declarations. */
export interface PackageFilesValidationResult {
    /** True when there are no blocking `errors` (warnings are still allowed). */
    ok: boolean;
    /** Blocking problems — these must be fixed before releasing. */
    errors: string[];
    /** Advisory problems — allowed, but usually worth reviewing. */
    warnings: string[];
}

/** A public file `name` — the same kebab-case slug shape used for step names. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A path escaping the package: absolute (`/x`, `C:\x`), URL-like (`https://x`,
 * `data:...`), or climbing out via `..`. The CLI resolves `path` against the
 * package root, so any of these either breaks the release or pulls in a file
 * that was never reviewed with the package.
 */
const ESCAPING_PATH_RE = /^(?:[/\\]|[a-zA-Z][a-zA-Z\d+.-]*:)|(?:^|[/\\])\.\.(?:[/\\]|$)/;

/**
 * File extensions enyo serves as images. A reference from an image block must
 * name one of these; other extensions upload fine and are simply never usable
 * as an image.
 */
const IMAGE_EXTENSIONS: readonly string[] = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];

/**
 * Extracts the lower-cased extension of a path, including the leading dot.
 *
 * @param path - The declared file path.
 * @returns The extension (e.g. `'.png'`), or an empty string when the last
 *   segment carries none.
 */
function extensionOf(path: string): string {
    const segment = path.split(/[/\\]/).pop() ?? '';
    const dot = segment.lastIndexOf('.');
    return dot > 0 ? segment.slice(dot).toLowerCase() : '';
}

/**
 * Tests whether a declared file can be served as an image, i.e. whether an
 * onboarding image block may reference it.
 *
 * Judged by the declared {@link EnergyAppPackagePublicFile.mimeType} when one is
 * set, and by the path's extension otherwise — the same order the CLI uses when
 * it picks the upload's content type.
 *
 * @param file - The declared public file.
 * @returns True when the file is an image.
 */
export function isImagePublicFile(file: EnergyAppPackagePublicFile): boolean {
    if (file.mimeType) return file.mimeType.toLowerCase().startsWith('image/');
    return IMAGE_EXTENSIONS.includes(extensionOf(file.path));
}

/**
 * Structural validation of a package's public file declarations: names are
 * unique kebab-case slugs, paths stay inside the package and look like files,
 * and any declared MIME type is well formed.
 *
 * @param files - The declared public files, or `undefined` when the package
 *   declares none (trivially valid).
 * @returns The {@link PackageFilesValidationResult}.
 *
 * @example
 * ```typescript
 * const {ok, errors} = validatePackageFiles(packageDef.files);
 * if (!ok) throw new Error(errors.join('\n'));
 * ```
 */
export function validatePackageFiles(
    files: EnergyAppPackagePublicFile[] | undefined,
): PackageFilesValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!files?.length) return {ok: true, errors, warnings};

    const names = new Set<string>();
    const paths = new Map<string, string>();

    for (const [index, file] of files.entries()) {
        const at = `files[${index}] (${file.name || '?'})`;

        if (!file.name?.trim()) {
            errors.push(`${at}: name is required.`);
        } else if (!SLUG_RE.test(file.name)) {
            errors.push(`${at}: name must be a kebab-case slug, e.g. "dip-switches".`);
        } else if (names.has(file.name)) {
            errors.push(`${at}: duplicate name "${file.name}" — names must be unique within the package.`);
        } else {
            names.add(file.name);
        }

        const path = file.path?.trim();
        if (!path) {
            errors.push(`${at}: path is required.`);
        } else if (ESCAPING_PATH_RE.test(path)) {
            errors.push(
                `${at}: path "${path}" must be relative to the package root — no absolute paths, "..", or URLs.`,
            );
        } else if (!extensionOf(path)) {
            errors.push(`${at}: path "${path}" has no file extension.`);
        } else {
            // The same bytes under two names upload twice and drift apart when
            // only one reference is updated later.
            const previous = paths.get(path);
            if (previous) {
                warnings.push(`${at}: path "${path}" is already declared as "${previous}".`);
            } else if (file.name) {
                paths.set(path, file.name);
            }
        }

        if (file.mimeType !== undefined && !/^[\w.+-]+\/[\w.+-]+$/.test(file.mimeType)) {
            errors.push(`${at}: mimeType "${file.mimeType}" is not a valid MIME type.`);
        }
    }

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Like {@link validatePackageFiles}, but throws
 * {@link PackageFilesValidationError} when there are blocking errors. Warnings
 * never throw; the validated declarations are returned on success for chaining.
 *
 * @param files - The declared public files.
 * @returns The same declarations when they have no blocking errors.
 * @throws {PackageFilesValidationError} When validation produces any error.
 */
export function assertValidPackageFiles(
    files: EnergyAppPackagePublicFile[] | undefined,
): EnergyAppPackagePublicFile[] | undefined {
    const {ok, errors} = validatePackageFiles(files);
    if (!ok) throw new PackageFilesValidationError(errors);
    return files;
}
