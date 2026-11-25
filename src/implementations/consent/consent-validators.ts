/**
 * Client-side validator for the consents declared in a package definition
 * ({@link EnergyAppPackageDefinition.consents}).
 *
 * A consent's text is what a person agrees to and what enyo records as agreed,
 * so a missing translation, an empty section or a key a guide cannot reach
 * would surface on a customer's screen — or worse, in a record of an agreement
 * to a text that was never shown. Everything like that is a blocking `error`
 * caught here instead.
 *
 * Use {@link validatePackageConsents} for the non-throwing result, or
 * {@link assertValidPackageConsents} to throw on failure.
 */

import type {EnergyAppPackageDefinition, EnergyAppPackageLanguage} from '../../energy-app-package-definition.js';
import type {EnyoOnboardingTranslatedContent} from '../../types/enyo-onboarding.js';
import {EnyoConsentGrantorEnum} from '../../types/enyo-consent.js';

/**
 * Thrown by {@link assertValidPackageConsents} when a package's consents fail
 * validation. The message lists every blocking error.
 */
export class PackageConsentsValidationError extends Error {
    /** The individual blocking errors that caused the failure. */
    public readonly errors: string[];

    /**
     * @param errors - The blocking validation errors.
     */
    constructor(errors: string[]) {
        super(`Invalid consents:\n- ${errors.join('\n- ')}`);
        this.name = 'PackageConsentsValidationError';
        this.errors = errors;
    }
}

/** The outcome of validating a package's consents. */
export interface PackageConsentsValidationResult {
    /** True when there are no blocking `errors` (warnings are still allowed). */
    ok: boolean;
    /** Blocking problems — these must be fixed before releasing. */
    errors: string[];
    /** Advisory problems — allowed, but usually worth reviewing. */
    warnings: string[];
}

/** The part of a package definition the validator reads. */
export type PackageConsentsSource = Pick<EnergyAppPackageDefinition, 'consents'>;

/** A consent key — the same kebab-case slug shape used across the SDK. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Languages every consent text must be translated into. */
const REQUIRED_LANGUAGES: readonly EnergyAppPackageLanguage[] = ['de', 'en'];

/** Every {@link EnyoConsentGrantorEnum} value. */
const GRANTORS: ReadonlySet<string> = new Set(Object.values(EnyoConsentGrantorEnum));

/**
 * Checks that a translated text has a non-empty value in every required
 * language and no language twice.
 *
 * @param content - The translations to check.
 * @param at - Location prefix for messages.
 * @param errors - Collector for blocking errors.
 */
function validateTranslated(
    content: EnyoOnboardingTranslatedContent[] | undefined,
    at: string,
    errors: string[],
): void {
    if (!Array.isArray(content) || content.length === 0) {
        errors.push(`${at}: is required.`);
        return;
    }
    const languages = new Set<string>();
    for (const entry of content) {
        if (languages.has(entry.language)) errors.push(`${at}: duplicate language "${entry.language}".`);
        languages.add(entry.language);
        if (!entry.value?.trim()) errors.push(`${at}: the "${entry.language}" text is empty.`);
    }
    for (const language of REQUIRED_LANGUAGES) {
        if (!languages.has(language)) errors.push(`${at}: the "${language}" translation is missing.`);
    }
}

/**
 * Structural validation of a package's consents: keys are unique kebab-case
 * slugs, every consent has a version, says whether it is required and who may
 * give it, and carries a checkbox label, a dialog title and a legal text of at
 * least one section — each translated into German and English. Legal-text URLs
 * must be absolute `https` URLs, at most one per language.
 *
 * Warns when a required consent may only be given by the installer: a consent
 * that binds the customer is usually theirs to give.
 *
 * @param definition - The package definition, or just its `consents`. A
 *   package without consents is valid.
 * @returns The {@link PackageConsentsValidationResult}.
 *
 * @example
 * ```typescript
 * const {ok, errors} = validatePackageConsents(packageDef);
 * if (!ok) throw new Error(errors.join('\n'));
 * ```
 */
export function validatePackageConsents(definition: PackageConsentsSource): PackageConsentsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const consents = definition.consents;
    if (!consents?.length) return {ok: true, errors, warnings};

    const keys = new Set<string>();
    for (const [index, consent] of consents.entries()) {
        const at = `consents[${index}] (${consent.consentKey || '?'})`;

        if (!consent.consentKey || !SLUG_RE.test(consent.consentKey)) {
            errors.push(`${at}: consentKey must be a kebab-case slug.`);
        } else if (keys.has(consent.consentKey)) {
            errors.push(`${at}: duplicate consentKey "${consent.consentKey}".`);
        } else {
            keys.add(consent.consentKey);
        }

        if (typeof consent.version !== 'string' || !consent.version.trim()) {
            errors.push(`${at}: version is required — answers are recorded against it.`);
        }
        if (typeof consent.required !== 'boolean') {
            errors.push(`${at}: required must be true or false.`);
        }

        const grantors = consent.grantableBy;
        if (!Array.isArray(grantors) || grantors.length === 0) {
            errors.push(`${at}: grantableBy must name at least one role.`);
        } else {
            const seen = new Set<string>();
            for (const grantor of grantors) {
                if (!GRANTORS.has(grantor)) {
                    errors.push(`${at}: grantableBy has unknown role "${grantor}". Allowed: ${[...GRANTORS].join(', ')}.`);
                } else if (seen.has(grantor)) {
                    errors.push(`${at}: grantableBy lists "${grantor}" more than once.`);
                }
                seen.add(grantor);
            }
            if (
                consent.required === true &&
                seen.size === 1 &&
                seen.has(EnyoConsentGrantorEnum.Installer)
            ) {
                warnings.push(
                    `${at}: a required consent only the installer may give — check that it does not bind the customer.`,
                );
            }
        }

        validateTranslated(consent.label, `${at}.label`, errors);
        validateTranslated(consent.title, `${at}.title`, errors);
        if (consent.summary !== undefined) validateTranslated(consent.summary, `${at}.summary`, errors);

        const legal = consent.legalText;
        if (!legal) {
            errors.push(`${at}: legalText is required.`);
            continue;
        }
        if (!Array.isArray(legal.sections) || legal.sections.length === 0) {
            errors.push(`${at}: legalText needs at least one section — the text ships with the release.`);
        } else {
            for (const [i, section] of legal.sections.entries()) {
                validateTranslated(section.heading, `${at}.legalText.sections[${i}].heading`, errors);
                validateTranslated(section.content, `${at}.legalText.sections[${i}].content`, errors);
            }
        }
        if (legal.urls !== undefined) {
            const languages = new Set<string>();
            for (const [i, link] of legal.urls.entries()) {
                const linkAt = `${at}.legalText.urls[${i}]`;
                if (languages.has(link.language)) errors.push(`${linkAt}: duplicate language "${link.language}".`);
                languages.add(link.language);
                if (!isHttpsUrl(link.url)) errors.push(`${linkAt}: url must be an absolute https URL.`);
            }
        }
    }

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Like {@link validatePackageConsents}, but throws
 * {@link PackageConsentsValidationError} when there are blocking errors.
 *
 * @param definition - The package definition, or just its `consents`.
 * @throws {PackageConsentsValidationError} When validation produces any error.
 */
export function assertValidPackageConsents(definition: PackageConsentsSource): void {
    const {ok, errors} = validatePackageConsents(definition);
    if (!ok) throw new PackageConsentsValidationError(errors);
}

/**
 * Tests whether a string is an absolute `https` URL.
 *
 * @param value - The string to test.
 * @returns True for a parseable URL with the `https:` scheme.
 */
function isHttpsUrl(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    try {
        return new URL(value).protocol === 'https:';
    } catch {
        return false;
    }
}
