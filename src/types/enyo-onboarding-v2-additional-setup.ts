/**
 * Onboarding guide **v2 additional setup** — the host handing an energy app the
 * values an {@link EnyoOnboardingV2AdditionalSetupBlock} collected, and asking
 * for a verdict.
 *
 * This is the one interactive block the **app** judges. A host can check an IP
 * address and a server can gate an OAuth session, but neither can say whether a
 * vendor API token is the right token — only the app that will use it can. So
 * the guide collects, the host forwards, and the app answers.
 *
 * It also restores something v1 had and v2 lost. v1 could collect a password
 * (`EnyoOnboardingSectionType.PasswordInput`) and route the submission to the
 * package (`listenForStepSubmission`), which decided success or error. v2's
 * blocks cover neither: its `input` block takes a single value and, for `Text`,
 * runs no check at all.
 *
 * **These payloads carry credentials.** Everything here is written on that
 * assumption — see {@link EnyoOnboardingV2AdditionalSetupHandler} for the rules
 * that follow from it.
 *
 * Pure type declarations (no runtime logic). Register the handler through
 * {@link EnergyAppOnboardingV2} (`../packages/energy-app-onboarding-v2.ts`) and
 * check an answer before returning it with
 * `validateOnboardingV2AdditionalSetupResult()`
 * (`../implementations/onboarding-v2/onboarding-v2-additional-setup-validators.ts`).
 */

import type {EnyoOnboardingTranslatedContent} from './enyo-onboarding.js';

/**
 * The reserved outcome value every
 * {@link EnyoOnboardingV2AdditionalSetupBlock} must declare, and the one the
 * host falls back to whenever no verdict was produced.
 *
 * Exported so a guide and a handler can reference the same constant instead of
 * writing the literal twice — the two sides are linked only by these strings.
 */
export const ENYO_ONBOARDING_V2_SETUP_FAILED_OUTCOME = 'failed';

/** One value the installer supplied, keyed by the field that collected it. */
export interface EnyoOnboardingV2SetupFieldValue {
    /** The {@link EnyoOnboardingV2SetupField.name} this value came from. */
    name: string;
    /**
     * The value exactly as entered, uninterpreted.
     *
     * May be a secret. Never log it, never echo it back in
     * {@link EnyoOnboardingV2AdditionalSetupResult.detail} or `message`, and
     * prefer {@link EnergyAppSecretManager} over an app's own storage when
     * persisting it.
     */
    value: string;
}

/**
 * One "run this setup" request from the host.
 *
 * Raised when the installer presses the block's CTA, so an installer is watching
 * the screen this resolves.
 */
export interface EnyoOnboardingV2AdditionalSetupRequest {
    /** Correlates this request with its result. Unique per request. */
    requestId: string;
    /**
     * The block's {@link EnyoOnboardingV2AdditionalSetupBlock.setupKey}.
     *
     * One handler serves every setup block in every guide, so switch on this.
     * It is stable across guides, unlike {@link blockId}.
     */
    setupKey: string;
    /** The {@link EnyoOnboardingV2AdditionalSetupBlock.id} that was run. */
    blockId: string;
    /** The {@link EnyoOnboardingV2Step.name} the block sits on. */
    stepName: string;
    /**
     * The collected values, one per filled field, in the block's field order.
     * Empty when the block declares no fields — a pure "do it now" action.
     *
     * A field marked `required: false` and left blank is absent rather than
     * present-and-empty.
     */
    values: EnyoOnboardingV2SetupFieldValue[];
    /** The network device the run is bound to, when there is one. */
    networkDeviceId?: string;
    /** The appliance the run is bound to, when one exists already. */
    applianceId?: string;
    /**
     * The budget for this request, in milliseconds.
     *
     * The host owns the clock: once it is spent the run is routed to the
     * block's `failed` outcome and the handler is not told. Bound the work to
     * fit — cap the vendor call's own timeout below this — and do not leave a
     * connection open past the point where an answer could still matter.
     */
    timeoutMs: number;
}

/**
 * The app's verdict on one {@link EnyoOnboardingV2AdditionalSetupRequest}.
 */
export interface EnyoOnboardingV2AdditionalSetupResult {
    /** The {@link EnyoOnboardingV2AdditionalSetupRequest.requestId} this answers. */
    requestId: string;
    /**
     * The outcome `value` to route on. Must match one declared by the block that
     * raised the request.
     *
     * A value matching nothing is routed to
     * {@link ENYO_ONBOARDING_V2_SETUP_FAILED_OUTCOME} rather than erroring — the
     * installer gets a branch either way — but it is a bug, and
     * `validateOnboardingV2AdditionalSetupResult()` catches it when the block's
     * declared outcomes are passed in.
     */
    outcome: string;
    /**
     * Translated line shown to the installer alongside the outcome (de/en).
     *
     * Most valuable on a failure, where the difference between "token rejected"
     * and "portal unreachable" is the difference between retyping and waiting.
     * Rendered on screen: never put a credential in it.
     */
    message?: EnyoOnboardingTranslatedContent[];
    /**
     * Untranslated technical detail for support, e.g. an HTTP status. Not shown
     * to the installer — and never a credential, not even a truncated one.
     */
    detail?: string;
}
