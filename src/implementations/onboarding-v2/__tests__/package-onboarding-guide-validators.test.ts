import {describe, expect, it} from 'vitest';
import type {EnyoOnboardingTranslatedContent} from '../../../types/enyo-onboarding.js';
import {
    EnyoOnboardingV2ActionKind,
    EnyoOnboardingV2DeviceSelection,
    EnyoOnboardingV2InputValueType,
    EnyoOnboardingV2StartVariant,
    type EnyoOnboardingV2Guide,
} from '../../../types/enyo-onboarding-v2.js';
import {EnyoDeviceTestOutcomeEnum} from '../../../types/enyo-device-test.js';
import {definePublicFile} from '../../files/define-public-file.js';
import {
    defineOnboardingGuideV2,
    onboardingV2Block,
    onboardingV2Target,
    onContinueV2,
    onOutcomeV2,
} from '../define-onboarding-guide-v2.js';
import {
    assertValidPackageOnboardingGuide,
    PackageOnboardingGuideValidationError,
    validatePackageOnboardingGuide,
} from '../package-onboarding-guide-validators.js';

/** Short de/en translated-content helper for terse fixtures. */
const t = (de: string, en: string): EnyoOnboardingTranslatedContent[] => [
    {language: 'de', value: de},
    {language: 'en', value: en},
];

/** The image file the fixture guide references. */
const files = [definePublicFile({name: 'modbus-menu', path: './assets/modbus-menu.png'})];

/**
 * A valid printable manual setup guide: an instruction step with an image, then
 * an ip-address input branching to success or back to the instructions.
 */
function manualGuide(): EnyoOnboardingV2Guide {
    return defineOnboardingGuideV2({
        title: t('Manuell einrichten', 'Set up manually'),
        startVariant: EnyoOnboardingV2StartVariant.ManualSetup,
        requiresNetworkScan: false,
        startStepId: 'prepare',
        steps: [
            {
                id: 'prepare',
                name: 'modbus-aktivieren',
                title: t('Modbus aktivieren', 'Enable Modbus'),
                blocks: [
                    onboardingV2Block.text('intro', t('Modbus aktivieren.', 'Enable Modbus.')),
                    onboardingV2Block.imageFile('menu', 'modbus-menu', t('Menü', 'Menu')),
                ],
                transitions: [onContinueV2(onboardingV2Target.step('ip'))],
            },
            {
                id: 'ip',
                name: 'ip-eingeben',
                title: t('IP eingeben', 'Enter IP'),
                blocks: [
                    onboardingV2Block.input(
                        'device-ip',
                        EnyoOnboardingV2InputValueType.IpAddress,
                        t('IP-Adresse', 'IP address'),
                        t('Prüfen', 'Check'),
                        [
                            {id: 'ok', value: EnyoDeviceTestOutcomeEnum.AppliancesCreated, label: t('Ok', 'Ok')},
                            {id: 'down', value: EnyoDeviceTestOutcomeEnum.Unreachable, label: t('Weg', 'Down')},
                        ],
                    ),
                ],
                transitions: [
                    onOutcomeV2('device-ip', 'ok', onboardingV2Target.success()),
                    onOutcomeV2('device-ip', 'down', onboardingV2Target.step('prepare')),
                ],
            },
        ],
    });
}

/** Validates `guide` against the fixture files and returns the errors. */
function errorsOf(guide: unknown): string[] {
    return validatePackageOnboardingGuide({onboardingGuide: guide as EnyoOnboardingV2Guide, files}).errors;
}

describe('validatePackageOnboardingGuide', () => {
    it('accepts a package without a guide', () => {
        expect(validatePackageOnboardingGuide({})).toEqual({ok: true, errors: [], warnings: []});
    });

    it('accepts a printable manual setup guide without a name', () => {
        const result = validatePackageOnboardingGuide({onboardingGuide: manualGuide(), files});
        expect(result.errors).toEqual([]);
        expect(result.ok).toBe(true);
    });

    it('rejects an array of guides', () => {
        expect(errorsOf([manualGuide()])[0]).toContain('single guide object');
    });

    it('rejects any start variant other than manual setup', () => {
        const guide = {...manualGuide(), startVariant: EnyoOnboardingV2StartVariant.DeviceNotFound};
        expect(errorsOf(guide).some((e) => e.includes('`startVariant` must be "manual-setup"'))).toBe(true);
    });

    it('requires requiresNetworkScan to be false explicitly', () => {
        const guide = manualGuide();
        delete guide.requiresNetworkScan;
        expect(errorsOf(guide).some((e) => e.includes('`requiresNetworkScan` must be set to `false`'))).toBe(true);
    });

    it('rejects appliance and catalog bindings', () => {
        const guide = {...manualGuide(), applianceId: 'a-1', vendorId: 'v-1'};
        const errors = errorsOf(guide);
        expect(errors.some((e) => e.includes('`applianceId` must not be set'))).toBe(true);
        expect(errors.some((e) => e.includes('`vendorId` / `modelIds` must not be set'))).toBe(true);
    });

    it('rejects a network-scan action', () => {
        const guide = manualGuide();
        guide.steps[0].blocks.push(
            onboardingV2Block.action('scan', EnyoOnboardingV2ActionKind.NetworkScan, t('Scan', 'Scan'), []),
        );
        expect(errorsOf(guide).some((e) => e.includes('network-scan action "scan" is not allowed'))).toBe(true);
    });

    it('rejects a device-test action', () => {
        const guide = manualGuide();
        guide.steps[0].blocks.push(
            onboardingV2Block.deviceTest('test', t('Test', 'Test'), [], EnyoOnboardingV2DeviceSelection.Current),
        );
        expect(errorsOf(guide).some((e) => e.includes('device-test action "test" is not allowed'))).toBe(true);
    });

    it('rejects a dynamic block', () => {
        const guide = manualGuide();
        guide.steps[0].blocks.push({id: 'dyn', type: 'dynamic', kind: 'ocpp-url'} as never);
        expect(errorsOf(guide).some((e) => e.includes('dynamic block "dyn" is not allowed'))).toBe(true);
    });

    it('rejects device pickers', () => {
        const guide = manualGuide();
        guide.steps[0].blocks.push({id: 'pick', type: 'device-select'} as never);
        guide.steps[0].blocks.push({id: 'eebus', type: 'eebus-device-select'} as never);
        const errors = errorsOf(guide);
        expect(errors.some((e) => e.includes('device-select block "pick" is not allowed'))).toBe(true);
        expect(errors.some((e) => e.includes('eebus-device-select block "eebus" is not allowed'))).toBe(true);
    });

    it('rejects a transition into another start variant', () => {
        const guide = manualGuide();
        guide.steps[1].transitions[1] = onOutcomeV2(
            'device-ip',
            'down',
            onboardingV2Target.variant(EnyoOnboardingV2StartVariant.DeviceNotFound),
        );
        expect(errorsOf(guide).some((e) => e.includes('leads to start variant "device-not-found"'))).toBe(true);
    });

    it('rejects an image that is not declared in files', () => {
        const guide = manualGuide();
        const result = validatePackageOnboardingGuide({onboardingGuide: guide, files: []});
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.includes('modbus-menu'))).toBe(true);
    });

    it('rejects values that are not plain JSON', () => {
        const guide = manualGuide() as unknown as Record<string, unknown>;
        guide.createdAt = new Date();
        guide.render = () => 'x';
        (guide.steps as unknown[]).push(undefined);
        const errors = errorsOf(guide);
        expect(errors.some((e) => e.includes('onboardingGuide.createdAt: Date is not plain data'))).toBe(true);
        expect(errors.some((e) => e.includes('onboardingGuide.render: a function cannot be serialized'))).toBe(true);
        expect(errors.some((e) => e.includes('onboardingGuide.steps[2]: undefined array entries'))).toBe(true);
    });

    it('ignores undefined object properties, which JSON simply drops', () => {
        const guide = {...manualGuide(), summary: undefined};
        expect(errorsOf(guide)).toEqual([]);
    });
});

describe('assertValidPackageOnboardingGuide', () => {
    it('returns the guide when valid', () => {
        const guide = manualGuide();
        expect(assertValidPackageOnboardingGuide({onboardingGuide: guide, files})).toBe(guide);
    });

    it('throws with every error listed when invalid', () => {
        const guide = {...manualGuide(), requiresNetworkScan: true};
        expect(() => assertValidPackageOnboardingGuide({onboardingGuide: guide, files})).toThrow(
            PackageOnboardingGuideValidationError,
        );
    });
});
