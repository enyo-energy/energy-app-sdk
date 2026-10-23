/**
 * Ergonomic authoring helpers for a package's installer mail
 * ({@link EnergyAppPackageDefinition.onboardingFlowInstallerMail}).
 *
 * `defineInstallerMail()` is an identity helper that type-checks the mail where
 * it is written — mirroring `defineEnergyAppPackage()`. `installerMailPlaceholder()`
 * writes a placeholder without typos, and `renderInstallerMail()` fills them
 * in the way enyo does, so an app can preview or unit-test its mail.
 *
 * Pair with `validatePackageInstallerMail()` (`./installer-mail-validators.ts`)
 * to fail fast before publishing.
 */

import type {
    EnergyAppPackageInstallerMail,
    EnergyAppPackageLanguage,
    EnyoInstallerMailPlaceholder,
} from '../../energy-app-package-definition.js';

/**
 * Matches one `{{placeholder}}` occurrence, tolerating whitespace inside the
 * braces. Group 1 is the placeholder name.
 */
export const INSTALLER_MAIL_PLACEHOLDER_RE = /\{\{\s*([^{}]*?)\s*\}\}/g;

/**
 * Identity helper that type-checks an installer mail at definition time
 * (mirrors `defineEnergyAppPackage`). Prefer this over a bare object literal so
 * mistakes surface where the mail is written.
 *
 * @param mail - The installer mail to declare.
 * @returns The same mail, typed as {@link EnergyAppPackageInstallerMail}.
 *
 * @example
 * ```typescript
 * onboardingFlowInstallerMail: defineInstallerMail({
 *     subject: [{language: 'de', value: '...'}, {language: 'en', value: '...'}],
 *     body: [{language: 'de', value: '...'}, {language: 'en', value: '...'}],
 * })
 * ```
 */
export function defineInstallerMail(mail: EnergyAppPackageInstallerMail): EnergyAppPackageInstallerMail {
    return mail;
}

/**
 * Writes a placeholder in the `{{name}}` syntax enyo replaces when it sends an
 * installer mail. Using it inside template literals keeps placeholder names
 * checked by the compiler.
 *
 * @param placeholder - The value to insert.
 * @returns The placeholder text, e.g. `'{{customerName}}'`.
 *
 * @example
 * ```typescript
 * `Seriennummer: ${installerMailPlaceholder(EnyoInstallerMailPlaceholder.SerialNumber)}`
 * // → 'Seriennummer: {{serialNumber}}'
 * ```
 */
export function installerMailPlaceholder(placeholder: EnyoInstallerMailPlaceholder): string {
    return `{{${placeholder}}}`;
}

/** An installer mail with its placeholders filled in, in one language. */
export interface RenderedInstallerMail {
    /** The subject line with placeholders replaced. */
    subject: string;
    /** The Markdown body with placeholders replaced. */
    body: string;
}

/**
 * Fills in the placeholders of an installer mail for one language — a preview
 * of what the installer receives, before enyo turns the Markdown into HTML.
 *
 * Like enyo, it replaces a placeholder without a value with an empty string.
 * Unlike enyo, it inserts values verbatim instead of escaping them for
 * Markdown, so pass plain test values.
 *
 * @param mail - The declared installer mail.
 * @param language - The language to render.
 * @param values - The values to insert, by placeholder.
 * @returns The rendered subject and body, or `undefined` when the mail has no
 *   subject or body in `language`.
 *
 * @example
 * ```typescript
 * const preview = renderInstallerMail(mail, 'de', {
 *     [EnyoInstallerMailPlaceholder.CustomerName]: 'Erika Mustermann',
 *     [EnyoInstallerMailPlaceholder.SerialNumber]: 'SN-123',
 * });
 * ```
 */
export function renderInstallerMail(
    mail: EnergyAppPackageInstallerMail,
    language: EnergyAppPackageLanguage,
    values: Partial<Record<EnyoInstallerMailPlaceholder, string>>,
): RenderedInstallerMail | undefined {
    const subject = mail.subject.find(entry => entry.language === language)?.value;
    const body = mail.body.find(entry => entry.language === language)?.value;
    if (subject === undefined || body === undefined) return undefined;

    const fill = (text: string): string =>
        text.replace(INSTALLER_MAIL_PLACEHOLDER_RE, (_, name: string) =>
            values[name as EnyoInstallerMailPlaceholder] ?? '');

    return {subject: fill(subject), body: fill(body)};
}
