/**
 * Onboarding guide **v2 input validation** — the host asking an energy app
 * whether a typed value is acceptable, before the run moves on.
 *
 * An {@link EnyoOnboardingV2InputBlock} of type
 * {@link EnyoOnboardingV2InputValueType.IpAddress} already gets the app's own
 * verdict: the host runs the registered {@link EnyoDeviceTestHandler} and routes
 * on the outcome. `Text`, `Number` and `Password` have no such check — the value
 * is recorded and the flow takes the positive outcome, whatever was typed. A
 * mistyped serial number or a wrong API token is therefore accepted at the step
 * that asked for it and only fails later, somewhere with no installer standing
 * in front of it.
 *
 * This model closes that gap. An input block that opts in
 * ({@link EnyoOnboardingV2InputBlock.validated}) has its value handed to the
 * app, which answers valid or invalid — with a translated message the installer
 * reads on the spot.
 *
 * **Validation is not a branch.** A rejected value keeps the installer on the
 * step with the message shown; it produces no outcome and needs no transition,
 * so adding `validated` to a block never changes a guide's graph. Use an
 * outcome when the flow should go somewhere different, and validation when the
 * answer is simply wrong.
 *
 * Pure type declarations (no runtime logic). Register the handler through
 * {@link EnergyAppOnboardingV2} (`../packages/energy-app-onboarding-v2.ts`).
 */

import type {EnyoOnboardingTranslatedContent} from './enyo-onboarding.js';
import type {EnyoOnboardingV2InputValueType} from './enyo-onboarding-v2.js';

/**
 * One "is this value acceptable?" request from the host.
 *
 * Raised when the installer submits an input block that opted into validation,
 * so it is on the critical path of a screen someone is waiting on.
 */
export interface EnyoOnboardingV2ValidationRequest {
    /** Correlates this request with its result. Unique per request. */
    requestId: string;
    /** The {@link EnyoOnboardingV2InputBlock.id} whose value this is. */
    blockId: string;
    /**
     * The {@link EnyoOnboardingV2Step.name} the block sits on. Present so an app
     * can tell two inputs apart when a guide asks for several values, and so a
     * log line says where a rejection came from.
     */
    stepName: string;
    /** What the block asked for, so one handler can serve every input it owns. */
    valueType: EnyoOnboardingV2InputValueType;
    /**
     * Exactly what the installer typed, untrimmed and unmodified.
     *
     * May be a secret when {@link valueType} is
     * {@link EnyoOnboardingV2InputValueType.Password} — do not log it, and do
     * not echo it back in {@link EnyoOnboardingV2ValidationResult.errorMessage},
     * which is shown on screen.
     */
    value: string;
    /** The network device the run is bound to, when there is one. */
    networkDeviceId?: string;
    /** The appliance the run is bound to, when one exists already. */
    applianceId?: string;
    /**
     * The budget for this request, in milliseconds.
     *
     * The host owns the clock: once it is spent the host stops waiting and
     * **accepts** the value, because stranding an installer on a step because a
     * handler hung is worse than letting a bad value through to a later check.
     * The handler is not notified when that happens.
     */
    timeoutMs: number;
}

/**
 * An app's answer to one {@link EnyoOnboardingV2ValidationRequest}.
 */
export interface EnyoOnboardingV2ValidationResult {
    /** The {@link EnyoOnboardingV2ValidationRequest.requestId} this answers. */
    requestId: string;
    /** Whether the value is acceptable. `false` keeps the installer on the step. */
    valid: boolean;
    /**
     * Translated text shown under the field when {@link valid} is `false` (de/en).
     *
     * Say what is wrong and what to do instead — "Seriennummer beginnt mit
     * SN-" beats "Ungültige Eingabe". Ignored when `valid` is `true`, and
     * required when it is `false`: a rejection with no message leaves the
     * installer retyping the same value.
     *
     * Never include the submitted value itself; it may be a secret and this text
     * is rendered on screen.
     */
    errorMessage?: EnyoOnboardingTranslatedContent[];
}

/**
 * Handles the host's "is this value acceptable?" requests.
 *
 * One handler serves every validated input block the app's guides declare —
 * switch on {@link EnyoOnboardingV2ValidationRequest.blockId} (and `stepName`
 * where a block id repeats across guides).
 *
 * Answer from state the app already holds where possible. A vendor-cloud round
 * trip inside this handler runs while an installer watches a spinner, and a
 * handler that exceeds
 * {@link EnyoOnboardingV2ValidationRequest.timeoutMs} is treated as acceptance.
 *
 * Throwing is also treated as acceptance: validation is a convenience for the
 * installer, never a gate the run depends on.
 */
export type EnyoOnboardingV2ValidationHandler = (
    request: EnyoOnboardingV2ValidationRequest,
) => Promise<EnyoOnboardingV2ValidationResult>;
