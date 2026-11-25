import {describe, expect, it} from 'vitest';
import {EnyoConsentGrantorEnum, type EnergyAppPackageConsent} from '../../../types/enyo-consent.js';
import {
    assertValidPackageConsents,
    PackageConsentsValidationError,
    validatePackageConsents,
} from '../consent-validators.js';

const t = (de: string, en: string) => [
    {language: 'de' as const, value: de},
    {language: 'en' as const, value: en},
];

const consent = (overrides: Partial<EnergyAppPackageConsent> = {}): EnergyAppPackageConsent => ({
    consentKey: 'hcu-backup',
    version: '1',
    required: true,
    grantableBy: [EnyoConsentGrantorEnum.Customer, EnyoConsentGrantorEnum.Installer],
    label: t('Ich erlaube das Backup.', 'I allow the backup.'),
    title: t('Backup', 'Backup'),
    legalText: {
        sections: [{heading: t('1. Backup', '1. Backup'), content: t('Text', 'Text')}],
        urls: [
            {language: 'de', url: 'https://example.com/de/terms'},
            {language: 'en', url: 'https://example.com/en/terms'},
        ],
    },
    ...overrides,
});

describe('validatePackageConsents', () => {
    it('accepts a package without consents', () => {
        expect(validatePackageConsents({})).toEqual({ok: true, errors: [], warnings: []});
    });

    it('accepts a complete consent', () => {
        expect(validatePackageConsents({consents: [consent()]})).toEqual({ok: true, errors: [], warnings: []});
    });

    it('accepts a consent without URLs', () => {
        const {ok} = validatePackageConsents({
            consents: [consent({legalText: {sections: consent().legalText.sections}})],
        });
        expect(ok).toBe(true);
    });

    it('rejects malformed and duplicate keys', () => {
        expect(validatePackageConsents({consents: [consent({consentKey: 'Not Slug'})]}).ok).toBe(false);
        const {errors} = validatePackageConsents({consents: [consent(), consent()]});
        expect(errors.some((e) => e.includes('duplicate consentKey'))).toBe(true);
    });

    it('requires a version and a boolean required flag', () => {
        expect(validatePackageConsents({consents: [consent({version: ' '})]}).ok).toBe(false);
        expect(validatePackageConsents({consents: [consent({required: undefined as never})]}).ok).toBe(false);
    });

    it('requires at least one known grantor role, each once', () => {
        expect(validatePackageConsents({consents: [consent({grantableBy: []})]}).ok).toBe(false);
        expect(validatePackageConsents({consents: [consent({grantableBy: ['owner' as never]})]}).ok).toBe(false);
        expect(
            validatePackageConsents({
                consents: [consent({grantableBy: [EnyoConsentGrantorEnum.Customer, EnyoConsentGrantorEnum.Customer]})],
            }).ok,
        ).toBe(false);
    });

    it('warns about a required consent only the installer may give', () => {
        const {ok, warnings} = validatePackageConsents({
            consents: [consent({grantableBy: [EnyoConsentGrantorEnum.Installer]})],
        });
        expect(ok).toBe(true);
        expect(warnings).toHaveLength(1);
    });

    it('requires German and English for label, title and every section', () => {
        const {errors} = validatePackageConsents({
            consents: [
                consent({
                    label: [{language: 'de', value: 'Nur deutsch'}],
                    legalText: {sections: [{heading: t('H', 'H'), content: [{language: 'en', value: ''}]}]},
                }),
            ],
        });
        expect(errors.some((e) => e.includes('label') && e.includes('"en"'))).toBe(true);
        expect(errors.some((e) => e.includes('content') && e.includes('"de"'))).toBe(true);
        expect(errors.some((e) => e.includes('content') && e.includes('empty'))).toBe(true);
    });

    it('requires at least one legal-text section, even with URLs', () => {
        const {errors} = validatePackageConsents({
            consents: [consent({legalText: {sections: [], urls: consent().legalText.urls}})],
        });
        expect(errors.some((e) => e.includes('at least one section'))).toBe(true);
    });

    it('requires https URLs, one per language', () => {
        const {errors} = validatePackageConsents({
            consents: [
                consent({
                    legalText: {
                        sections: consent().legalText.sections,
                        urls: [
                            {language: 'de', url: 'http://example.com/terms'},
                            {language: 'de', url: 'https://example.com/terms'},
                        ],
                    },
                }),
            ],
        });
        expect(errors.some((e) => e.includes('https'))).toBe(true);
        expect(errors.some((e) => e.includes('duplicate language'))).toBe(true);
    });

    it('throws from the assert variant', () => {
        expect(() => assertValidPackageConsents({consents: [consent({version: ''})]})).toThrow(
            PackageConsentsValidationError,
        );
        expect(() => assertValidPackageConsents({consents: [consent()]})).not.toThrow();
    });
});
