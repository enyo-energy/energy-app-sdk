/**
 * Onboarding guide **v2 setup progress** — what an energy app reports while an
 * {@link EnyoOnboardingV2AdditionalSetupBlock} is running, so the installer
 * sees a progress bar and the phase that is under way instead of a spinner.
 *
 * Most setups answer in seconds and need none of this. It is for the ones that
 * take minutes and go through several stages the installer should be able to
 * follow — e.g. connecting a smart-home gateway: back it up, switch on its
 * developer mode, install the plugin, restart it, verify the connection.
 *
 * The protocol stays the one of the setup handler: the host calls the handler,
 * and **the promise resolving is the end** — the host marks every phase done,
 * routes on the returned `outcome`, and the guide moves on to the next step.
 * Progress is only what the installer sees in between. Report it with
 * {@link EnergyAppOnboardingV2.reportSetupProgress}.
 *
 * Pure type declarations (no runtime logic). Check a report before sending it
 * with `validateOnboardingV2SetupProgress()`
 * (`../implementations/onboarding-v2/onboarding-v2-progress-validators.ts`).
 */

import type {EnyoOnboardingTranslatedContent} from './enyo-onboarding.js';

/**
 * Default budget of a setup handler that declares no
 * {@link EnyoOnboardingV2AdditionalSetupBlock.maxDurationMs}: 60 seconds.
 *
 * The host may answer with a shorter
 * {@link EnyoOnboardingV2AdditionalSetupRequest.timeoutMs}; the request is
 * always what counts.
 */
export const ENYO_ONBOARDING_V2_SETUP_DEFAULT_DURATION_MS = 60_000;

/**
 * Largest {@link EnyoOnboardingV2AdditionalSetupBlock.maxDurationMs} a guide may
 * declare: 15 minutes. An installer is waiting in front of the screen; a setup
 * that needs longer belongs in a background job the guide does not wait for.
 */
export const ENYO_ONBOARDING_V2_SETUP_MAX_DURATION_MS = 15 * 60_000;

/**
 * One phase of a long-running setup, shown as a line of the progress list —
 * done, running or still to come.
 */
export interface EnyoOnboardingV2ProgressPhase {
    /**
     * Stable kebab-case key, unique within the setup. The app names the running
     * phase by it in {@link EnyoOnboardingV2SetupProgress.phaseKey}.
     */
    key: string;
    /** Translated line shown in the list (de/en), e.g. "Backup wird erstellt". */
    label: EnyoOnboardingTranslatedContent[];
}

/**
 * One progress report for a running setup request.
 *
 * Every field is optional, and each report says only what changed: the host
 * keeps the last value of a field that a report leaves out.
 *
 * - **Phases.** The phase named by {@link phaseKey} is running; every phase
 *   before it in the list counts as done, every phase after it as still to
 *   come. Phases only move forward — a report that names an earlier phase is
 *   ignored.
 * - **Percent.** Overall progress of the whole setup, not of the current
 *   phase. It only rises. Omit it when the app cannot honestly estimate it:
 *   the host then shows an indeterminate bar, which is better than one that
 *   sits at 10 % for three minutes and jumps to 100 %.
 * - **The end** is not a report. Resolve the handler; the host marks every
 *   phase done and routes on the outcome. A failure is an outcome too — there
 *   is no "failed" progress state.
 *
 * @example
 * ```typescript
 * await onboarding.reportSetupProgress(request.requestId, {
 *     phaseKey: 'developer-mode',
 *     percent: 30,
 * });
 * ```
 */
export interface EnyoOnboardingV2SetupProgress {
    /**
     * The complete phase list, replacing the one the block declared in
     * {@link EnyoOnboardingV2AdditionalSetupBlock.progressPhases}.
     *
     * For a setup whose phases are only known once it runs — the number of
     * devices to migrate, whether a firmware update is needed first. Send it on
     * the first report and again only when it changes. Phases already done must
     * keep their place in a replaced list.
     */
    phases?: EnyoOnboardingV2ProgressPhase[];
    /**
     * Key of the phase that is running now. Must be one of the current phase
     * list — from {@link phases}, or the block's declaration.
     */
    phaseKey?: string;
    /** Overall progress, 0–100. Only rises. Omit it rather than guess. */
    percent?: number;
    /**
     * Optional translated detail line under the bar (de/en), e.g. "Gerät 2 von
     * 5". Rendered on screen: never put a credential in it.
     */
    message?: EnyoOnboardingTranslatedContent[];
}
