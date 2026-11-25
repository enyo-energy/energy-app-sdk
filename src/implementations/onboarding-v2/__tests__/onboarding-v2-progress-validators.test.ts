import {describe, expect, it} from 'vitest';
import {validateOnboardingV2SetupProgress} from '../onboarding-v2-progress-validators.js';

const t = (de: string, en: string) => [
    {language: 'de' as const, value: de},
    {language: 'en' as const, value: en},
];

const PHASES = [
    {key: 'backup', label: t('Backup', 'Backup')},
    {key: 'developer-mode', label: t('Entwicklermodus', 'Developer mode')},
    {key: 'verify', label: t('Prüfen', 'Verify')},
];

describe('validateOnboardingV2SetupProgress', () => {
    it('accepts a phase of the declared list with a percent', () => {
        expect(validateOnboardingV2SetupProgress({phaseKey: 'backup', percent: 10}, {phases: PHASES})).toEqual({
            ok: true,
            errors: [],
            warnings: [],
        });
    });

    it('accepts a percent-only report without any phases', () => {
        expect(validateOnboardingV2SetupProgress({percent: 50}).ok).toBe(true);
    });

    it('warns about an empty report', () => {
        const {ok, warnings} = validateOnboardingV2SetupProgress({});
        expect(ok).toBe(true);
        expect(warnings).toHaveLength(1);
    });

    it('rejects a percent outside 0–100', () => {
        expect(validateOnboardingV2SetupProgress({percent: -1}).ok).toBe(false);
        expect(validateOnboardingV2SetupProgress({percent: 101}).ok).toBe(false);
        expect(validateOnboardingV2SetupProgress({percent: Number.NaN}).ok).toBe(false);
    });

    it('rejects a falling percent', () => {
        const {errors} = validateOnboardingV2SetupProgress({percent: 20}, {previous: {percent: 30}});
        expect(errors.some((e) => e.includes('only rises'))).toBe(true);
    });

    it('rejects a phase key without a phase list', () => {
        expect(validateOnboardingV2SetupProgress({phaseKey: 'backup'}).ok).toBe(false);
    });

    it('rejects an unknown phase key', () => {
        expect(validateOnboardingV2SetupProgress({phaseKey: 'nope'}, {phases: PHASES}).ok).toBe(false);
    });

    it('rejects moving back to an earlier phase', () => {
        const {errors} = validateOnboardingV2SetupProgress(
            {phaseKey: 'backup'},
            {phases: PHASES, previous: {phaseKey: 'verify'}},
        );
        expect(errors.some((e) => e.includes('only move forward'))).toBe(true);
    });

    it('accepts phases sent at runtime and resolves the key against them', () => {
        const {ok} = validateOnboardingV2SetupProgress({
            phases: [
                {key: 'device-1', label: t('Gerät 1', 'Device 1')},
                {key: 'device-2', label: t('Gerät 2', 'Device 2')},
            ],
            phaseKey: 'device-2',
        });
        expect(ok).toBe(true);
    });

    it('rejects a runtime phase list that is too short or has duplicate keys', () => {
        expect(validateOnboardingV2SetupProgress({phases: [PHASES[0]!]}).ok).toBe(false);
        expect(validateOnboardingV2SetupProgress({phases: [PHASES[0]!, PHASES[0]!]}).ok).toBe(false);
    });
});
