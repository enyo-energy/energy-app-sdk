/**
 * Client-side validator for the installer mail declared in a package
 * definition ({@link EnergyAppPackageDefinition.onboardingFlowInstallerMail}).
 *
 * The mail leaves the app repository as data: the enyo CLI reads it at release
 * time, and enyo sends it from the customer portal long after, with nobody from
 * the app around to notice a broken placeholder or a missing translation. So
 * everything that would make the sent mail wrong — an unknown placeholder, an
 * unclosed `{{`, a missing language, an attachment that does not exist — is a
 * blocking `error` here. `warnings` flag things that send fine but are probably
 * unintended, like raw HTML in the Markdown body.
 *
 * Use {@link validatePackageInstallerMail} for the non-throwing result, or
 * {@link assertValidPackageInstallerMail} to throw on failure.
 */

import {EnyoInstallerMailPlaceholder} from '../../energy-app-package-definition.js';
import type {
    EnergyAppPackageDefinition,
    EnergyAppPackageInstallerMail,
    EnergyAppPackageLanguage,
} from '../../energy-app-package-definition.js';
import type {EnyoOnboardingTranslatedContent} from '../../types/enyo-onboarding.js';
import {INSTALLER_MAIL_PLACEHOLDER_RE} from './define-installer-mail.js';

/**
 * Longest subject line accepted without a warning. Mail clients cut longer
 * subjects off, and placeholders such as the customer name add to the length.
 */
export const INSTALLER_MAIL_SUBJECT_MAX_LENGTH = 120;

/**
 * Thrown by {@link assertValidPackageInstallerMail} when a package's installer
 * mail fails validation. The message lists every blocking error so callers can
 * surface them directly.
 */
export class PackageInstallerMailValidationError extends Error {
    /** The individual blocking errors that caused the failure. */
    public readonly errors: string[];

    /**
     * @param errors - The blocking validation errors.
     */
    constructor(errors: string[]) {
        super(`Invalid package installer mail:\n- ${errors.join('\n- ')}`);
        this.name = 'PackageInstallerMailValidationError';
        this.errors = errors;
    }
}

/** The outcome of validating a package's installer mail. */
export interface PackageInstallerMailValidationResult {
    /** True when there are no blocking `errors` (warnings are still allowed). */
    ok: boolean;
    /** Blocking problems — these must be fixed before releasing. */
    errors: string[];
    /** Advisory problems — allowed, but usually worth reviewing. */
    warnings: string[];
}

/** The parts of a package definition the installer mail is validated against. */
export type PackageInstallerMailSource = Pick<
    EnergyAppPackageDefinition,
    'onboardingFlowInstallerMail' | 'onboardingGuide' | 'files'
>;

/** Languages every installer mail must provide. */
const REQUIRED_LANGUAGES: readonly EnergyAppPackageLanguage[] = ['de', 'en'];

/** Every placeholder name enyo knows how to fill. */
const KNOWN_PLACEHOLDERS: ReadonlySet<string> = new Set(Object.values(EnyoInstallerMailPlaceholder));

/** An opening or closing HTML tag, e.g. `<b>` or `</div>`. */
const HTML_TAG_RE = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>/;

/**
 * Validates a package's installer mail: required translations, a one-line
 * subject, known and well-formed placeholders, and attachments that resolve.
 *
 * A package without an `onboardingFlowInstallerMail` is trivially valid.
 *
 * @param definition - The package definition, or just its
 *   `onboardingFlowInstallerMail`, `onboardingGuide` and `files`.
 * @returns The {@link PackageInstallerMailValidationResult}.
 *
 * @example
 * ```typescript
 * const {ok, errors} = validatePackageInstallerMail(packageDef);
 * if (!ok) throw new Error(errors.join('\n'));
 * ```
 */
export function validatePackageInstallerMail(
    definition: PackageInstallerMailSource,
): PackageInstallerMailValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const mail = definition.onboardingFlowInstallerMail;

    if (mail === undefined) return {ok: true, errors, warnings};

    if (mail === null || typeof mail !== 'object' || Array.isArray(mail)) {
        errors.push('`onboardingFlowInstallerMail` must be a single mail object.');
        return {ok: false, errors, warnings};
    }

    const hasGuide = definition.onboardingGuide !== undefined;
    const subjects = validateTranslations(mail.subject, 'subject', errors);
    const bodies = validateTranslations(mail.body, 'body', errors);

    for (const entry of subjects) {
        const at = `subject (${entry.language})`;
        if (/[\r\n]/.test(entry.value)) {
            errors.push(`${at}: must be a single line.`);
        }
        if (entry.value.length > INSTALLER_MAIL_SUBJECT_MAX_LENGTH) {
            warnings.push(
                `${at}: ${entry.value.length} characters — mail clients cut subjects longer than about ` +
                    `${INSTALLER_MAIL_SUBJECT_MAX_LENGTH} off.`,
            );
        }
        validatePlaceholders(entry.value, at, hasGuide, errors);
    }

    for (const entry of bodies) {
        const at = `body (${entry.language})`;
        validatePlaceholders(entry.value, at, hasGuide, errors);
        if (HTML_TAG_RE.test(entry.value)) {
            warnings.push(`${at}: contains HTML — the body is Markdown and raw HTML is not rendered.`);
        }
    }

    warnOnPlaceholderMismatch(bodies, warnings);
    validateAttachments(mail, definition, errors, warnings);

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Like {@link validatePackageInstallerMail}, but throws
 * {@link PackageInstallerMailValidationError} when there are blocking errors.
 * Warnings never throw.
 *
 * @param definition - The package definition, or just its
 *   `onboardingFlowInstallerMail`, `onboardingGuide` and `files`.
 * @returns The declared mail, or `undefined` when the package declares none.
 * @throws {PackageInstallerMailValidationError} When validation produces any error.
 */
export function assertValidPackageInstallerMail(
    definition: PackageInstallerMailSource,
): EnergyAppPackageInstallerMail | undefined {
    const {ok, errors} = validatePackageInstallerMail(definition);
    if (!ok) throw new PackageInstallerMailValidationError(errors);
    return definition.onboardingFlowInstallerMail;
}

/**
 * Lists the placeholder names used in a text, in order of first appearance and
 * without duplicates. Unknown names are included, so this also serves to find
 * typos.
 *
 * @param text - A subject or body.
 * @returns The placeholder names, e.g. `['customerName', 'serialNumber']`.
 *
 * @example
 * ```typescript
 * extractInstallerMailPlaceholders('Hi {{customerName}}, SN {{serialNumber}}');
 * // → ['customerName', 'serialNumber']
 * ```
 */
export function extractInstallerMailPlaceholders(text: string): string[] {
    const names = new Set<string>();
    for (const match of text.matchAll(INSTALLER_MAIL_PLACEHOLDER_RE)) names.add(match[1]);
    return [...names];
}

/**
 * Checks a translated field: an array, one non-empty string per language, no
 * duplicate languages, and every required language present.
 *
 * @param entries - The declared translations.
 * @param field - The field name, used in messages.
 * @param errors - Collector for blocking problems.
 * @returns The well-formed entries, for the content checks.
 */
function validateTranslations(
    entries: EnyoOnboardingTranslatedContent[] | undefined,
    field: 'subject' | 'body',
    errors: string[],
): EnyoOnboardingTranslatedContent[] {
    if (!Array.isArray(entries)) {
        errors.push(`${field}: must be an array of translations.`);
        return [];
    }

    const valid: EnyoOnboardingTranslatedContent[] = [];
    const languages = new Set<string>();
    entries.forEach((entry, index) => {
        const at = `${field}[${index}] (${entry?.language || '?'})`;
        if (languages.has(entry?.language)) {
            errors.push(`${at}: duplicate language "${entry.language}".`);
            return;
        }
        languages.add(entry?.language);
        if (typeof entry?.value !== 'string' || entry.value.trim() === '') {
            errors.push(`${at}: value must be a non-empty string.`);
            return;
        }
        valid.push(entry);
    });

    for (const language of REQUIRED_LANGUAGES) {
        if (!languages.has(language)) errors.push(`${field}: a "${language}" translation is required.`);
    }
    return valid;
}

/**
 * Checks that every placeholder in a text is known, that `onboardingGuideUrl`
 * has a guide to link to, and that no `{{` or `}}` is left unpaired.
 *
 * @param text - A subject or body.
 * @param at - Human-readable location, used in messages.
 * @param hasGuide - Whether the package declares an `onboardingGuide`.
 * @param errors - Collector for blocking problems.
 */
function validatePlaceholders(text: string, at: string, hasGuide: boolean, errors: string[]): void {
    for (const name of extractInstallerMailPlaceholders(text)) {
        if (!KNOWN_PLACEHOLDERS.has(name)) {
            errors.push(
                `${at}: unknown placeholder "{{${name}}}" — use one of ${[...KNOWN_PLACEHOLDERS].join(', ')}.`,
            );
        } else if (name === EnyoInstallerMailPlaceholder.OnboardingGuideUrl && !hasGuide) {
            errors.push(`${at}: "{{${name}}}" needs an \`onboardingGuide\` in the package to link to.`);
        }
    }

    const rest = text.replace(INSTALLER_MAIL_PLACEHOLDER_RE, '');
    if (rest.includes('{{') || rest.includes('}}')) {
        errors.push(`${at}: unpaired "{{" or "}}" — write placeholders as {{name}}.`);
    }
}

/**
 * Warns when the body translations use different placeholders — usually a
 * detail added to one language and forgotten in the other.
 *
 * @param bodies - The well-formed body translations.
 * @param warnings - Collector for advisory problems.
 */
function warnOnPlaceholderMismatch(bodies: EnyoOnboardingTranslatedContent[], warnings: string[]): void {
    if (bodies.length < 2) return;
    const [first, ...others] = bodies;
    const expected = new Set(extractInstallerMailPlaceholders(first.value));
    for (const other of others) {
        const actual = new Set(extractInstallerMailPlaceholders(other.value));
        const differs = actual.size !== expected.size || [...actual].some(name => !expected.has(name));
        if (differs) {
            warnings.push(
                `body (${other.language}): uses different placeholders than body (${first.language}) — ` +
                    'check that both languages carry the same details.',
            );
        }
    }
}

/**
 * Checks the PDF attachment flag and that every named attachment is a declared
 * public file.
 *
 * @param mail - The declared mail.
 * @param definition - The package parts the attachments resolve against.
 * @param errors - Collector for blocking problems.
 * @param warnings - Collector for advisory problems.
 */
function validateAttachments(
    mail: EnergyAppPackageInstallerMail,
    definition: PackageInstallerMailSource,
    errors: string[],
    warnings: string[],
): void {
    if (mail.attachOnboardingGuide === true && definition.onboardingGuide === undefined) {
        errors.push('`attachOnboardingGuide` is true, but the package declares no `onboardingGuide` to attach.');
    }

    if (mail.attachments === undefined) return;
    if (!Array.isArray(mail.attachments)) {
        errors.push('`attachments` must be an array of file names.');
        return;
    }

    const declared = new Set((definition.files ?? []).map(file => file.name));
    const seen = new Set<string>();
    mail.attachments.forEach((name, index) => {
        const at = `attachments[${index}]`;
        if (seen.has(name)) {
            warnings.push(`${at}: "${name}" is attached twice.`);
            return;
        }
        seen.add(name);
        if (!declared.has(name)) {
            errors.push(`${at}: "${name}" is not declared in \`files\`.`);
        }
    });
}
