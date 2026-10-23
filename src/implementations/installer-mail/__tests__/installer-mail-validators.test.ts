import {describe, expect, it} from 'vitest';
import {
    type EnergyAppPackageInstallerMail,
    type EnergyAppPackagePublicFile,
    EnyoInstallerMailPlaceholder as P,
} from '../../../energy-app-package-definition.js';
import type {EnyoOnboardingV2Guide} from '../../../types/enyo-onboarding-v2.js';
import {defineInstallerMail, installerMailPlaceholder as p, renderInstallerMail} from '../define-installer-mail.js';
import {
    assertValidPackageInstallerMail,
    extractInstallerMailPlaceholders,
    PackageInstallerMailValidationError,
    validatePackageInstallerMail,
} from '../installer-mail-validators.js';

/** Only its presence matters to the mail validator. */
const guide = {} as EnyoOnboardingV2Guide;

const files: EnergyAppPackagePublicFile[] = [{name: 'datasheet', path: './assets/datasheet.pdf'}];

/** A valid mail, overridable field by field for the failure cases. */
const mail = (over: Partial<EnergyAppPackageInstallerMail> = {}): EnergyAppPackageInstallerMail =>
    defineInstallerMail({
        subject: [
            {language: 'de', value: `Einrichtung für ${p(P.CustomerName)}`},
            {language: 'en', value: `Setup for ${p(P.CustomerName)}`},
        ],
        body: [
            {language: 'de', value: `**Seriennummer:** ${p(P.SerialNumber)}\n\n[Anleitung](${p(P.OnboardingGuideUrl)})`},
            {language: 'en', value: `**Serial number:** ${p(P.SerialNumber)}\n\n[Guide](${p(P.OnboardingGuideUrl)})`},
        ],
        attachments: ['datasheet'],
        ...over,
    });

const validate = (m: EnergyAppPackageInstallerMail, withGuide = true) =>
    validatePackageInstallerMail({onboardingFlowInstallerMail: m, onboardingGuide: withGuide ? guide : undefined, files});

describe('validatePackageInstallerMail', () => {
    it('accepts a package without a mail', () => {
        expect(validatePackageInstallerMail({})).toEqual({ok: true, errors: [], warnings: []});
    });

    it('accepts a well-formed mail', () => {
        expect(validate(mail())).toEqual({ok: true, errors: [], warnings: []});
    });

    it('requires de and en and rejects duplicates and empty values', () => {
        const result = validate(mail({
            subject: [{language: 'de', value: 'A'}, {language: 'de', value: 'B'}],
            body: [{language: 'de', value: ' '}, {language: 'en', value: 'Body'}],
        }));
        expect(result.errors).toEqual(expect.arrayContaining([
            'subject[1] (de): duplicate language "de".',
            'subject: a "en" translation is required.',
            'body[0] (de): value must be a non-empty string.',
        ]));
    });

    it('rejects a multi-line subject and warns about a long one', () => {
        const result = validate(mail({
            subject: [{language: 'de', value: 'A\nB'}, {language: 'en', value: 'x'.repeat(130)}],
        }));
        expect(result.errors).toContain('subject (de): must be a single line.');
        expect(result.warnings.some((w) => w.startsWith('subject (en): 130 characters'))).toBe(true);
    });

    it('rejects unknown placeholders', () => {
        const result = validate(mail({
            subject: [{language: 'de', value: 'Hallo {{kundenName}}'}, {language: 'en', value: 'Hi {{ customerName }}'}],
        }));
        expect(result.errors.some((e) => e.includes('unknown placeholder "{{kundenName}}"'))).toBe(true);
        expect(result.errors.filter((e) => e.startsWith('subject (en)'))).toEqual([]);
    });

    it('rejects unpaired braces', () => {
        const result = validate(mail({
            subject: [{language: 'de', value: 'Hallo {{customerName'}, {language: 'en', value: 'Hi'}],
        }));
        expect(result.errors.some((e) => e.includes('unpaired'))).toBe(true);
    });

    it('rejects the guide link and the PDF attachment without a guide', () => {
        const result = validate(mail({attachOnboardingGuide: true}), false);
        expect(result.errors.some((e) => e.includes('needs an `onboardingGuide`'))).toBe(true);
        expect(result.errors.some((e) => e.includes('`attachOnboardingGuide` is true'))).toBe(true);
    });

    it('rejects undeclared attachments and warns about repeated ones', () => {
        const result = validate(mail({attachments: ['datasheet', 'datasheet', 'wiring']}));
        expect(result.errors).toEqual(['attachments[2]: "wiring" is not declared in `files`.']);
        expect(result.warnings).toEqual(['attachments[1]: "datasheet" is attached twice.']);
    });

    it('warns about raw HTML and differing placeholders between languages', () => {
        const result = validate(mail({
            body: [
                {language: 'de', value: `<b>Kunde</b> ${p(P.CustomerName)}`},
                {language: 'en', value: `Customer ${p(P.CustomerNumber)}`},
            ],
        }));
        expect(result.ok).toBe(true);
        expect(result.warnings.some((w) => w.includes('contains HTML'))).toBe(true);
        expect(result.warnings.some((w) => w.includes('different placeholders'))).toBe(true);
    });

    it('does not mistake a comparison for HTML', () => {
        const result = validate(mail({
            body: [
                {language: 'de', value: 'Leistung < 10 kW und > 2 kW'},
                {language: 'en', value: 'Power < 10 kW and > 2 kW'},
            ],
        }));
        expect(result.warnings).toEqual([]);
    });
});

describe('assertValidPackageInstallerMail', () => {
    it('returns the mail when valid and throws when not', () => {
        const valid = mail();
        expect(assertValidPackageInstallerMail({onboardingFlowInstallerMail: valid, onboardingGuide: guide, files}))
            .toBe(valid);
        expect(() => assertValidPackageInstallerMail({onboardingFlowInstallerMail: mail(), files}))
            .toThrow(PackageInstallerMailValidationError);
    });
});

describe('installer mail helpers', () => {
    it('writes placeholders', () => {
        expect(p(P.SerialNumber)).toBe('{{serialNumber}}');
    });

    it('extracts placeholders once, in order', () => {
        expect(extractInstallerMailPlaceholders('{{a}} {{ b }} {{a}}')).toEqual(['a', 'b']);
    });

    it('renders a language with missing values left empty', () => {
        expect(renderInstallerMail(mail(), 'en', {[P.CustomerName]: 'Erika', [P.SerialNumber]: 'SN-1'})).toEqual({
            subject: 'Setup for Erika',
            body: '**Serial number:** SN-1\n\n[Guide]()',
        });
    });

    it('returns undefined for a missing language', () => {
        expect(renderInstallerMail(mail({subject: [{language: 'de', value: 'A'}]}), 'en', {})).toBeUndefined();
    });
});
