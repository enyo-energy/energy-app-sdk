/**
 * Consents — declarations a package asks a person to agree to, and the record
 * of who agreed to which version and when.
 *
 * A consent is **declared once** in the package definition
 * ({@link EnergyAppPackageDefinition.consents}) and **asked for** wherever it is
 * needed: an onboarding guide's `consent` block, or the `consentKeys` of an
 * additional-setup block that does something the customer must allow first
 * (back up a gateway, switch on its developer mode). Declaring it in one place
 * keeps the legal text out of every guide that needs it, and gives enyo one
 * place to show it again when the customer wants to read or withdraw it.
 *
 * **enyo records the answer, not the app.** The host stores who agreed, in
 * which role, to which version and when, and hands the app the result through
 * {@link EnergyAppConsent}. An app never asserts a consent itself — a record the
 * app could write is not evidence of anything.
 *
 * Pure type declarations (no runtime logic). Check the declarations with
 * `validatePackageConsents()`
 * (`../implementations/consent/consent-validators.ts`) before publishing.
 */

import type {EnergyAppPackageLanguage} from '../energy-app-package-definition.js';
import type {EnyoOnboardingTranslatedContent} from './enyo-onboarding.js';

/**
 * Who may give a consent — and, on a record, who gave it.
 *
 * Both roles walk onboarding guides: the installer on site, the customer in
 * their own app. Many consents are the customer's alone to give (anything that
 * touches their data or their contract), while some confirm something the
 * installer is responsible for. The host enforces the declaration: a person in
 * a role the consent does not allow sees the text but cannot agree, and the run
 * waits on that step until someone who may agree has done so.
 */
export enum EnyoConsentGrantorEnum {
    /** The installer setting the system up. */
    Installer = 'installer',
    /** The end customer who owns the system. */
    Customer = 'customer',
}

/**
 * One titled section of a consent's legal text, rendered in order in the dialog
 * that opens from the consent's checkbox.
 */
export interface EnyoConsentLegalTextSection {
    /** Translated section heading (de/en), e.g. "1. Datensicherung". */
    heading: EnyoOnboardingTranslatedContent[];
    /**
     * Translated section body (de/en). Plain text; blank lines separate
     * paragraphs.
     */
    content: EnyoOnboardingTranslatedContent[];
}

/** A link to the full legal text in one language. */
export interface EnyoConsentLegalTextUrl {
    /** Language of the document behind the link. */
    language: EnergyAppPackageLanguage;
    /** Absolute `https` URL of the document. */
    url: string;
}

/**
 * The full text a consent refers to — what a person reads before agreeing.
 *
 * The sections are the text itself and are always required: they ship with the
 * package release, so the words a person agreed to are exactly the words of the
 * {@link EnergyAppPackageConsent.version} recorded with their answer. The URLs
 * are an optional addition (e.g. the vendor's terms as a web page), shown as
 * links below the sections. A web page can change without the version changing,
 * so it is never the only place the text lives.
 */
export interface EnyoConsentLegalText {
    /** The text, in display order. At least one section. */
    sections: EnyoConsentLegalTextSection[];
    /** Optional links to the full text, at most one per language. */
    urls?: EnyoConsentLegalTextUrl[];
}

/**
 * A consent a package declares in {@link EnergyAppPackageDefinition.consents}.
 *
 * @example
 * ```typescript
 * const backupConsent: EnergyAppPackageConsent = {
 *     consentKey: 'hcu-backup-and-developer-mode',
 *     version: '1',
 *     required: true,
 *     grantableBy: [EnyoConsentGrantorEnum.Customer, EnyoConsentGrantorEnum.Installer],
 *     label: t(
 *         'Ich erlaube enyo, ein Backup der HCU zu erstellen und den Entwicklermodus einzuschalten.',
 *         'I allow enyo to back up the HCU and switch on its developer mode.',
 *     ),
 *     title: t('Backup und Entwicklermodus', 'Backup and developer mode'),
 *     legalText: {
 *         sections: [
 *             {heading: t('Backup', 'Backup'), content: t('…', '…')},
 *             {heading: t('Entwicklermodus', 'Developer mode'), content: t('…', '…')},
 *         ],
 *     },
 * };
 * ```
 */
export interface EnergyAppPackageConsent {
    /**
     * Stable kebab-case key, unique within the package. Guides reference the
     * consent by it, and the app reads the answer by it.
     *
     * Keep it once shipped: a renamed key is a new consent nobody has agreed to.
     */
    consentKey: string;
    /**
     * Version of the text. Change it whenever the meaning of {@link label} or
     * {@link legalText} changes: an answer recorded for another version no
     * longer counts, and the person is asked again the next time a guide asks
     * for the consent. A typo fix that changes nothing may keep the version.
     */
    version: string;
    /**
     * Whether the flow may go on without this consent.
     *
     * `true`: a guide step asking for it cannot be passed until it is given.
     * `false`: voluntary — the checkbox starts unticked, and the flow goes on
     * either way. The app reads the answer and enables what depends on it.
     */
    required: boolean;
    /**
     * Who may give it. At least one role.
     *
     * A role missing here sees the text but cannot agree; the host keeps the run
     * on the asking step until someone in an allowed role agrees.
     */
    grantableBy: EnyoConsentGrantorEnum[];
    /**
     * Translated checkbox line (de/en) — the sentence a person agrees to, e.g.
     * "Ich stimme den Nutzungsbedingungen zu".
     */
    label: EnyoOnboardingTranslatedContent[];
    /** Optional translated one- or two-sentence summary below the checkbox (de/en). */
    summary?: EnyoOnboardingTranslatedContent[];
    /** Translated title of the dialog that shows {@link legalText} (de/en). */
    title: EnyoOnboardingTranslatedContent[];
    /** The full text, opened in a dialog from the checkbox. */
    legalText: EnyoConsentLegalText;
}

/**
 * The recorded answer for one consent of this package on this device, as the
 * app reads it through {@link EnergyAppConsent}.
 */
export interface EnyoConsentState {
    /** The {@link EnergyAppPackageConsent.consentKey} this answer is for. */
    consentKey: string;
    /**
     * The {@link EnergyAppPackageConsent.version} the answer was given for.
     * Absent when the consent was never answered.
     */
    version?: string;
    /**
     * Whether the consent is in force: given, for the version the package
     * declares now, and not withdrawn since.
     *
     * This is the field to act on. An answer for an older version is reported
     * with `granted: false` — the person agreed to a text that is no longer the
     * one the app ships.
     */
    granted: boolean;
    /** The role of the person who gave the consent. Absent when it was never given. */
    grantedBy?: EnyoConsentGrantorEnum;
    /** ISO 8601 timestamp of when the consent was given. */
    grantedAtIso?: string;
    /**
     * ISO 8601 timestamp of when the consent was withdrawn, if it was. A
     * withdrawn consent reports `granted: false`.
     */
    revokedAtIso?: string;
}
