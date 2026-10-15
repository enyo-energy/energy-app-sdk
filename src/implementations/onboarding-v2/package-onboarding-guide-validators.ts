/**
 * Client-side validator for the static manual setup guide declared in a
 * package definition ({@link EnergyAppPackageDefinition.onboardingGuide}).
 *
 * The guide leaves the app repository as data: the enyo CLI reads it at release
 * time and enyo renders it as a printable PDF. Nothing on paper can scan the
 * network or ask the app for a value, so on top of the regular graph checks of
 * {@link validateOnboardingGuideV2} this rejects everything that only works in
 * an interactive run — scans, device pickers, device tests, dynamic values —
 * and everything the CLI cannot serialize.
 *
 * Use {@link validatePackageOnboardingGuide} for the non-throwing result, or
 * {@link assertValidPackageOnboardingGuide} to throw on failure.
 */

import type {EnergyAppPackageDefinition} from '../../energy-app-package-definition.js';
import {
    EnyoOnboardingV2ActionKind,
    EnyoOnboardingV2BlockType,
    EnyoOnboardingV2StartVariant,
    EnyoOnboardingV2TargetType,
} from '../../types/enyo-onboarding-v2.js';
import type {EnyoOnboardingV2Guide} from '../../types/enyo-onboarding-v2.js';
import {validateOnboardingGuideV2} from './onboarding-v2-validators.js';

/**
 * The only start variant a package's static guide may use. The guide documents
 * a setup the installer performs by hand.
 */
export const PACKAGE_ONBOARDING_GUIDE_START_VARIANT = EnyoOnboardingV2StartVariant.ManualSetup;

/**
 * Thrown by {@link assertValidPackageOnboardingGuide} when a package's static
 * onboarding guide fails validation. The message lists every blocking error so
 * callers can surface them directly.
 */
export class PackageOnboardingGuideValidationError extends Error {
    /** The individual blocking errors that caused the failure. */
    public readonly errors: string[];

    /**
     * @param errors - The blocking validation errors.
     */
    constructor(errors: string[]) {
        super(`Invalid package onboarding guide:\n- ${errors.join('\n- ')}`);
        this.name = 'PackageOnboardingGuideValidationError';
        this.errors = errors;
    }
}

/** The outcome of validating a package's static onboarding guide. */
export interface PackageOnboardingGuideValidationResult {
    /** True when there are no blocking `errors` (warnings are still allowed). */
    ok: boolean;
    /** Blocking problems — these must be fixed before releasing. */
    errors: string[];
    /** Advisory problems — allowed, but usually worth reviewing. */
    warnings: string[];
}

/** The parts of a package definition the static guide is validated against. */
export type PackageOnboardingGuideSource = Pick<EnergyAppPackageDefinition, 'onboardingGuide' | 'files'>;

/** Action kinds that act on scanned devices and therefore cannot be printed. */
const FORBIDDEN_ACTIONS: ReadonlySet<string> = new Set([
    EnyoOnboardingV2ActionKind.NetworkScan,
    EnyoOnboardingV2ActionKind.DeviceTest,
]);

/**
 * Block types that only exist in an interactive run, with the reason shown to
 * the author.
 */
const FORBIDDEN_BLOCKS: ReadonlyMap<string, string> = new Map([
    [EnyoOnboardingV2BlockType.DeviceSelect, 'it picks from devices the host discovered'],
    [EnyoOnboardingV2BlockType.EebusDeviceSelect, 'it picks from devices the host discovered'],
    [EnyoOnboardingV2BlockType.Dynamic, 'its value is resolved by the app at runtime and does not exist when the PDF is rendered'],
]);

/**
 * Validates the static manual setup guide of a package: the regular v2 graph
 * checks (with image references resolved against the package's `files`), the
 * manual-setup-only rules, and that the guide is plain JSON the CLI can ship.
 *
 * A package without an `onboardingGuide` is trivially valid.
 *
 * @param definition - The package definition, or just its `onboardingGuide`
 *   and `files`.
 * @returns The {@link PackageOnboardingGuideValidationResult}.
 *
 * @example
 * ```typescript
 * const {ok, errors} = validatePackageOnboardingGuide(packageDef);
 * if (!ok) throw new Error(errors.join('\n'));
 * ```
 */
export function validatePackageOnboardingGuide(
    definition: PackageOnboardingGuideSource,
): PackageOnboardingGuideValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const guide = definition.onboardingGuide;

    if (guide === undefined) return {ok: true, errors, warnings};

    if (guide === null || typeof guide !== 'object' || Array.isArray(guide)) {
        errors.push('`onboardingGuide` must be a single guide object — a package declares at most one.');
        return {ok: false, errors, warnings};
    }

    // Not plain data means not a guide shape the graph checks can walk safely.
    collectNonJsonValues(guide, 'onboardingGuide', errors);
    if (errors.length > 0) return {ok: false, errors, warnings};

    const base = validateOnboardingGuideV2(guide, {files: definition.files});
    errors.push(...base.errors);
    warnings.push(...base.warnings);

    validateManualSetupOnly(guide, errors);

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Like {@link validatePackageOnboardingGuide}, but throws
 * {@link PackageOnboardingGuideValidationError} when there are blocking errors.
 * Warnings never throw.
 *
 * @param definition - The package definition, or just its `onboardingGuide`
 *   and `files`.
 * @returns The declared guide, or `undefined` when the package declares none.
 * @throws {PackageOnboardingGuideValidationError} When validation produces any error.
 */
export function assertValidPackageOnboardingGuide(
    definition: PackageOnboardingGuideSource,
): EnyoOnboardingV2Guide | undefined {
    const {ok, errors} = validatePackageOnboardingGuide(definition);
    if (!ok) throw new PackageOnboardingGuideValidationError(errors);
    return definition.onboardingGuide;
}

/**
 * Applies the rules that make a guide printable: manual setup variant, no
 * scan, nothing that depends on discovered devices or runtime values, no link
 * into another guide, and no appliance or catalog binding.
 *
 * @param guide - The guide being validated.
 * @param errors - Collector for blocking problems.
 */
function validateManualSetupOnly(guide: EnyoOnboardingV2Guide, errors: string[]): void {
    if (guide.startVariant !== PACKAGE_ONBOARDING_GUIDE_START_VARIANT) {
        errors.push(
            `\`startVariant\` must be "${PACKAGE_ONBOARDING_GUIDE_START_VARIANT}" — the package guide ` +
                `documents a manual setup, got "${guide.startVariant}".`,
        );
    }
    if (guide.requiresNetworkScan !== false) {
        errors.push(
            '`requiresNetworkScan` must be set to `false` — it defaults to `true`, and a printed ' +
                'manual has no scan to rely on.',
        );
    }
    if (guide.applianceId !== undefined) {
        errors.push('`applianceId` must not be set — a printed manual is not bound to an appliance.');
    }
    if (guide.vendorId !== undefined || guide.modelIds !== undefined) {
        errors.push(
            '`vendorId` / `modelIds` must not be set — enyo derives them from the package and its ' +
                '`compatibility` list.',
        );
    }

    for (const [i, step] of (guide.steps ?? []).entries()) {
        const at = `steps[${i}] (${step.name || '?'})`;

        for (const block of step.blocks ?? []) {
            const reason = FORBIDDEN_BLOCKS.get(block.type);
            if (reason) {
                errors.push(`${at}: ${block.type} block "${block.id}" is not allowed in the package guide — ${reason}.`);
            } else if (block.type === EnyoOnboardingV2BlockType.Action && FORBIDDEN_ACTIONS.has(block.action)) {
                errors.push(
                    `${at}: ${block.action} action "${block.id}" is not allowed in the package guide — ` +
                        'it acts on devices found by a scan.',
                );
            }
        }

        for (const transition of step.transitions ?? []) {
            if (transition.target?.type === EnyoOnboardingV2TargetType.StartVariant) {
                errors.push(
                    `${at}: transition "${transition.id}" leads to start variant "${transition.target.variant}" — ` +
                        'the package guide cannot hand over to another guide.',
                );
            }
        }
    }
}

/**
 * Walks a value and reports everything that does not survive a JSON round trip
 * unchanged: functions, symbols, bigints, non-finite numbers, `undefined` array
 * entries, and objects that are not plain objects (class instances, `Date`,
 * `Map`, …). `undefined` object properties are fine — they are simply dropped.
 *
 * @param value - The value to inspect.
 * @param path - Human-readable location of `value`, used in messages.
 * @param errors - Collector for blocking problems.
 * @param seen - Objects already on the current path, to report cycles.
 */
function collectNonJsonValues(value: unknown, path: string, errors: string[], seen: Set<object> = new Set()): void {
    switch (typeof value) {
        case 'string':
        case 'boolean':
            return;
        case 'number':
            if (!Number.isFinite(value)) errors.push(`${path}: ${value} is not representable in JSON.`);
            return;
        case 'undefined':
            return;
        case 'function':
        case 'symbol':
        case 'bigint':
            errors.push(`${path}: a ${typeof value} cannot be serialized into the release — use plain data only.`);
            return;
    }

    if (value === null) return;
    const obj = value as object;

    if (seen.has(obj)) {
        errors.push(`${path}: circular reference — the guide must be a tree of plain data.`);
        return;
    }

    if (Array.isArray(obj)) {
        seen.add(obj);
        obj.forEach((entry, i) => {
            if (entry === undefined) errors.push(`${path}[${i}]: undefined array entries become null in JSON.`);
            else collectNonJsonValues(entry, `${path}[${i}]`, errors, seen);
        });
        seen.delete(obj);
        return;
    }

    const proto = Object.getPrototypeOf(obj);
    if (proto !== Object.prototype && proto !== null) {
        const kind = (obj as {constructor?: {name?: string}}).constructor?.name ?? 'non-plain object';
        errors.push(`${path}: ${kind} is not plain data — use object literals, strings, numbers and booleans.`);
        return;
    }

    seen.add(obj);
    for (const [key, entry] of Object.entries(obj)) {
        collectNonJsonValues(entry, `${path}.${key}`, errors, seen);
    }
    seen.delete(obj);
}
