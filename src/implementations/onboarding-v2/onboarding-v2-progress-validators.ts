/**
 * Client-side validator for the progress an energy app reports while an
 * additional-setup request runs
 * ({@link EnergyAppOnboardingV2.reportSetupProgress}).
 *
 * The host never fails a setup over a bad report — it drops what it cannot use
 * and keeps the last good state. That is right for the installer and wrong for
 * the developer, who sees a progress list that silently stops moving. Run this
 * while developing to see why.
 */

import type {
    EnyoOnboardingV2ProgressPhase,
    EnyoOnboardingV2SetupProgress,
} from '../../types/enyo-onboarding-v2-progress.js';

/** The outcome of validating one progress report. */
export interface OnboardingV2SetupProgressValidationResult {
    /** True when there are no blocking `errors` (warnings are still allowed). */
    ok: boolean;
    /** Problems that make the host drop the report or a field of it. */
    errors: string[];
    /** Advisory problems — the report is used, but probably not as meant. */
    warnings: string[];
}

/**
 * What a progress report is checked against.
 */
export interface OnboardingV2SetupProgressValidationContext {
    /**
     * The phase list in force before this report — the block's
     * {@link EnyoOnboardingV2AdditionalSetupBlock.progressPhases}, or the last
     * list the app sent. Omit when there is none yet.
     */
    phases?: EnyoOnboardingV2ProgressPhase[];
    /** The previous report for the same request, to check that progress only moves forward. */
    previous?: EnyoOnboardingV2SetupProgress;
}

/** A phase key — the same kebab-case slug shape used across the SDK. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Checks one progress report: `percent` is a number from 0 to 100 and not
 * lower than the previous one, a replacing `phases` list has at least two
 * unique kebab-case keys with labels, and `phaseKey` names a phase of the list
 * in force and does not move backwards.
 *
 * A report with nothing in it is allowed but warned about — it changes
 * nothing on screen.
 *
 * @param progress - The report to check.
 * @param context - The phase list in force and the previous report, if any.
 * @returns The {@link OnboardingV2SetupProgressValidationResult}.
 *
 * @example
 * ```typescript
 * const report = {phaseKey: 'backup', percent: 10};
 * const {ok, errors} = validateOnboardingV2SetupProgress(report, {phases: block.progressPhases});
 * if (!ok) console.warn('progress report dropped', errors);
 * await onboarding.reportSetupProgress(request.requestId, report);
 * ```
 */
export function validateOnboardingV2SetupProgress(
    progress: EnyoOnboardingV2SetupProgress,
    context: OnboardingV2SetupProgressValidationContext = {},
): OnboardingV2SetupProgressValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (
        progress.phases === undefined &&
        progress.phaseKey === undefined &&
        progress.percent === undefined &&
        progress.message === undefined
    ) {
        warnings.push('The report is empty and changes nothing on screen.');
    }

    // ── percent ─────────────────────────────────────────────────────────────
    if (progress.percent !== undefined) {
        const p = progress.percent;
        if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 100) {
            errors.push(`percent ${String(p)} must be a number from 0 to 100.`);
        } else {
            const before = context.previous?.percent;
            if (typeof before === 'number' && p < before) {
                errors.push(`percent ${p} is lower than the previous ${before} — progress only rises.`);
            }
        }
    }

    // ── phases ──────────────────────────────────────────────────────────────
    let phases = context.phases;
    if (progress.phases !== undefined) {
        if (!Array.isArray(progress.phases) || progress.phases.length < 2) {
            errors.push('phases must list at least 2 phases.');
        } else {
            const keys = new Set<string>();
            for (const [i, phase] of progress.phases.entries()) {
                const at = `phases[${i}] (${phase?.key || '?'})`;
                if (!phase?.key || !SLUG_RE.test(phase.key)) errors.push(`${at}: key must be a kebab-case slug.`);
                else if (keys.has(phase.key)) errors.push(`${at}: duplicate key "${phase.key}".`);
                else keys.add(phase.key);
                if (!phase?.label?.length) warnings.push(`${at}: has no label.`);
            }
            phases = progress.phases;
        }
    }

    // ── phaseKey ────────────────────────────────────────────────────────────
    if (progress.phaseKey !== undefined) {
        if (!phases?.length) {
            errors.push(
                `phaseKey "${progress.phaseKey}" names a phase, but no phase list is in force — ` +
                    'declare progressPhases on the block or send phases with this report.',
            );
        } else {
            const index = phases.findIndex((phase) => phase.key === progress.phaseKey);
            if (index === -1) {
                errors.push(`phaseKey "${progress.phaseKey}" is not one of the phases in force.`);
            } else {
                const beforeKey = context.previous?.phaseKey;
                const beforeIndex = beforeKey ? phases.findIndex((phase) => phase.key === beforeKey) : -1;
                if (beforeIndex > index) {
                    errors.push(
                        `phaseKey "${progress.phaseKey}" comes before the previous phase "${beforeKey}" — ` +
                            'phases only move forward.',
                    );
                }
            }
        }
    }

    return {ok: errors.length === 0, errors, warnings};
}
