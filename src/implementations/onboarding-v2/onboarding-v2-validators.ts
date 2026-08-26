/**
 * Client-side validator for the onboarding-guide **v2** graph model
 * ({@link EnyoOnboardingV2Guide}). Mirrors the backend's strict check so an
 * energy app can fail fast locally before publishing.
 *
 * `errors` block publishing; `warnings` are advisory (e.g. unreachable step, no
 * path to a completing exit). Use {@link validateOnboardingGuideV2} for the
 * non-throwing result, or {@link assertValidOnboardingGuideV2} to throw on the
 * first failure.
 *
 * A run completes either through a `success` target **or** through the
 * "enyo übernimmt" hand-off (`pause` with reason
 * {@link EnyoOnboardingV2PauseReason.EnyoTodo}) — both count, so a guide that
 * legitimately ends in a hand-off is not nagged about a missing success path.
 */

import {
    EnyoOnboardingV2ActionKind,
    EnyoOnboardingV2EebusPairOutcome,
    EnyoOnboardingV2BlockType,
    EnyoOnboardingV2DeviceSelection,
    EnyoOnboardingV2InputValueType,
    EnyoOnboardingV2OcppConnectOutcome,
    EnyoOnboardingV2PauseReason,
    EnyoOnboardingV2TargetType,
    EnyoOnboardingV2TransitionSourceKind,
} from '../../types/enyo-onboarding-v2.js';
import type {
    EnyoOnboardingV2ActionBlock,
    EnyoOnboardingV2Guide,
    EnyoOnboardingV2Step,
    EnyoOnboardingV2Transition,
} from '../../types/enyo-onboarding-v2.js';
import {EnyoDeviceTestOutcomeEnum} from '../../types/enyo-device-test.js';

/**
 * Thrown by {@link assertValidOnboardingGuideV2} when a guide fails validation.
 * The message lists every blocking error so callers can surface them directly.
 */
export class OnboardingV2ValidationError extends Error {
    /** The individual blocking errors that caused the failure. */
    public readonly errors: string[];

    /**
     * @param errors - The blocking validation errors.
     */
    constructor(errors: string[]) {
        super(`Invalid onboarding guide (v2):\n- ${errors.join('\n- ')}`);
        this.name = 'OnboardingV2ValidationError';
        this.errors = errors;
    }
}

/** The outcome of validating a v2 guide. */
export interface OnboardingV2ValidationResult {
    /** True when there are no blocking `errors` (warnings are still allowed). */
    ok: boolean;
    /** Blocking problems — these must be fixed before publishing. */
    errors: string[];
    /** Advisory problems — allowed, but usually worth fixing. */
    warnings: string[];
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Structural + plausibility validation of a v2 guide graph. `errors` block
 * publishing; `warnings` are advisory (e.g. unreachable step, no path to a
 * completing exit — `success` or the `enyo-todo` hand-off).
 *
 * @param guide - The v2 guide to validate.
 * @returns The {@link OnboardingV2ValidationResult}.
 */
export function validateOnboardingGuideV2(
    guide: EnyoOnboardingV2Guide,
): OnboardingV2ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!guide.steps?.length) {
        return {ok: false, errors: ['`steps` must be a non-empty array.'], warnings};
    }

    const stepIds = new Set<string>();
    const stepNames = new Set<string>();
    for (const [i, step] of guide.steps.entries()) {
        const at = `steps[${i}] (${step.name || '?'})`;
        if (!step.id) errors.push(`${at}: id is required.`);
        else if (stepIds.has(step.id)) errors.push(`${at}: duplicate id "${step.id}".`);
        else stepIds.add(step.id);

        if (!step.name || !SLUG_RE.test(step.name)) {
            errors.push(`${at}: name must be a kebab-case slug.`);
        } else if (stepNames.has(step.name)) {
            errors.push(`${at}: duplicate internal name "${step.name}".`);
        } else {
            stepNames.add(step.name);
        }
        if (!step.title?.length) warnings.push(`${at}: empty title.`);
        if (!step.blocks?.length) warnings.push(`${at}: no content blocks.`);

        validateActionBlocks(step, at, errors, warnings);
        validateLinkBlocks(step, at, errors, warnings);
        validateInputBlocks(step, at, errors, warnings);
        validateAuthBlocks(step, at, errors, warnings);
    }

    if (!guide.startStepId || !stepIds.has(guide.startStepId)) {
        errors.push('`startStepId` must reference an existing step.');
    }

    let hasCompletingExit = false;
    for (const [i, step] of guide.steps.entries()) {
        const at = `steps[${i}] (${step.name})`;
        const required = requiredHandleKeys(step);
        const wired = new Set<string>();

        for (const t of step.transitions ?? []) {
            const key = sourceKey(t.source);
            if (!required.has(key)) errors.push(`${at}: transition source "${key}" matches no option/outcome.`);
            if (wired.has(key)) errors.push(`${at}: source "${key}" wired more than once.`);
            wired.add(key);

            const tg = t.target;
            if (tg.type === EnyoOnboardingV2TargetType.Success) hasCompletingExit = true;
            else if (tg.type === EnyoOnboardingV2TargetType.Step && !stepIds.has(tg.stepId)) {
                errors.push(`${at}: transition targets missing step "${tg.stepId}".`);
            } else if (tg.type === EnyoOnboardingV2TargetType.Pause) {
                // "enyo übernimmt" is a terminal hand-off, not a park: it completes
                // the run for the installer, so it satisfies the completion check
                // and has nothing to resume at.
                if (tg.reason === EnyoOnboardingV2PauseReason.EnyoTodo) {
                    hasCompletingExit = true;
                    if (tg.resumeStepName) {
                        warnings.push(
                            `${at}: pause reason "${EnyoOnboardingV2PauseReason.EnyoTodo}" is a hand-off to enyo, ` +
                                `not a resumable park — resumeStepName "${tg.resumeStepName}" is ignored.`,
                        );
                    }
                } else if (tg.resumeStepName && !stepNames.has(tg.resumeStepName)) {
                    errors.push(`${at}: pause resumeStepName "${tg.resumeStepName}" is unknown.`);
                }
            } else if (
                tg.type === EnyoOnboardingV2TargetType.StartVariant &&
                tg.variant === guide.startVariant
            ) {
                warnings.push(`${at}: links to the guide's own start variant.`);
            }
        }
        for (const key of required) {
            if (!wired.has(key)) errors.push(`${at}: routing handle "${key}" has no transition (dead branch).`);
        }
    }

    // reachability
    if (guide.startStepId && stepIds.has(guide.startStepId)) {
        const reachable = reachableFrom(guide, guide.startStepId);
        for (const step of guide.steps) {
            if (!reachable.has(step.id)) warnings.push(`step "${step.name}" is unreachable from the start.`);
        }
    }
    if (!hasCompletingExit) {
        warnings.push(
            'No branch reaches a completing exit — wire a `success` target, or a `pause` with reason ' +
                `"${EnyoOnboardingV2PauseReason.EnyoTodo}" when enyo takes the setup over.`,
        );
    }

    validateNetworkScanFlag(guide, warnings);

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Like {@link validateOnboardingGuideV2}, but throws
 * {@link OnboardingV2ValidationError} when there are blocking errors. Warnings
 * never throw; the validated guide is returned on success for chaining.
 *
 * @param guide - The v2 guide to validate.
 * @returns The same guide when it has no blocking errors.
 * @throws {OnboardingV2ValidationError} When validation produces any error.
 */
export function assertValidOnboardingGuideV2(
    guide: EnyoOnboardingV2Guide,
): EnyoOnboardingV2Guide {
    const {ok, errors} = validateOnboardingGuideV2(guide);
    if (!ok) throw new OnboardingV2ValidationError(errors);
    return guide;
}

/** Every {@link EnyoDeviceTestOutcomeEnum} value, for outcome-value checks. */
const DEVICE_TEST_OUTCOMES: ReadonlySet<string> = new Set(Object.values(EnyoDeviceTestOutcomeEnum));

/**
 * Validates the action blocks of a step.
 *
 * A `device-test` block is checked more strictly than the other action kinds
 * because its outcomes are not free-form: they are the verdicts the energy app's
 * {@link EnyoDeviceTestHandler} can return, so an unknown `value` is an outcome
 * that can never fire and a missing `failed` is an installer stranded on a step
 * with no exit the moment anything goes wrong.
 */
function validateActionBlocks(
    step: EnyoOnboardingV2Step,
    at: string,
    errors: string[],
    warnings: string[],
): void {
    for (const block of step.blocks ?? []) {
        if (block.type !== EnyoOnboardingV2BlockType.Action) continue;

        if (block.action !== EnyoOnboardingV2ActionKind.DeviceTest) {
            if (block.deviceSelection) {
                warnings.push(
                    `${at}: block "${block.id}" sets deviceSelection but is not a device-test action; it is ignored.`,
                );
            }
            if (block.action === EnyoOnboardingV2ActionKind.OcppConnect) {
                validateOcppConnectOutcomes(block, at, errors);
            }
            if (block.action === EnyoOnboardingV2ActionKind.EebusPair) {
                validateEebusPairOutcomes(block, at, errors, warnings);
            }
            continue;
        }

        const values = new Set<string>();
        for (const outcome of block.outcomes ?? []) {
            if (!DEVICE_TEST_OUTCOMES.has(outcome.value)) {
                errors.push(
                    `${at}: device-test block "${block.id}" has outcome value "${outcome.value}", which is not an EnyoDeviceTestOutcomeEnum member.`,
                );
            } else if (values.has(outcome.value)) {
                errors.push(
                    `${at}: device-test block "${block.id}" wires outcome value "${outcome.value}" more than once.`,
                );
            }
            values.add(outcome.value);
        }

        if (!values.has(EnyoDeviceTestOutcomeEnum.Failed)) {
            errors.push(
                `${at}: device-test block "${block.id}" has no "${EnyoDeviceTestOutcomeEnum.Failed}" outcome; every breakdown lands there, so the installer would have no exit.`,
            );
        }
        for (const outcome of DEVICE_TEST_OUTCOMES) {
            if (!values.has(outcome)) {
                warnings.push(
                    `${at}: device-test block "${block.id}" does not handle outcome "${outcome}".`,
                );
            }
        }
    }
}

/** An absolute `http(s)` URL — the only scheme a link block may carry. */
const HTTP_URL_RE = /^https?:\/\/\S+$/i;

/**
 * Validates the link blocks of a step.
 *
 * The scheme check is **security-relevant, not cosmetic**: the installer app
 * renders a link block as a tap target, so this keeps `javascript:`, `data:` and
 * `file:` payloads out of it. connect-core enforces the identical rule
 * server-side and the app re-checks before opening — three gates, deliberately.
 * Do not relax it to a generic "looks like a URL" test.
 *
 * @param step - The step whose blocks are checked.
 * @param at - Human-readable location prefix for messages.
 * @param errors - Collector for blocking problems.
 * @param warnings - Collector for advisory problems.
 */
function validateLinkBlocks(
    step: EnyoOnboardingV2Step,
    at: string,
    errors: string[],
    warnings: string[],
): void {
    for (const block of step.blocks ?? []) {
        if (block.type !== EnyoOnboardingV2BlockType.Link) continue;

        if (!block.url?.trim()) {
            errors.push(`${at}: link block "${block.id}" has no url.`);
        } else if (!HTTP_URL_RE.test(block.url.trim())) {
            errors.push(
                `${at}: link block "${block.id}" url must be an absolute http(s) URL.`,
            );
        }
        if (!block.label?.length) {
            warnings.push(
                `${at}: link block "${block.id}" has no label — the raw URL is shown instead.`,
            );
        }
    }
}

/** Every valid {@link EnyoOnboardingV2InputValueType} value. */
const INPUT_VALUE_TYPES: ReadonlySet<string> = new Set(Object.values(EnyoOnboardingV2InputValueType));

/**
 * Outcome values the host treats as "the check succeeded" — mirrors the
 * runtime's own positive-outcome set, `paired` included, so an eebus-pair
 * result is not read as a failure.
 */
const POSITIVE_INPUT_OUTCOMES: ReadonlySet<string> = new Set([
    'reachable',
    'success',
    'found',
    EnyoOnboardingV2EebusPairOutcome.Paired,
]);

/**
 * The {@link EnyoDeviceTestOutcomeEnum} verdicts that collapse onto a positive
 * input outcome; every other verdict collapses onto a negative one.
 */
const POSITIVE_DEVICE_TEST_OUTCOMES: ReadonlySet<string> = new Set([
    EnyoDeviceTestOutcomeEnum.AppliancesCreated,
    EnyoDeviceTestOutcomeEnum.AppliancesAlreadyExisted,
    EnyoDeviceTestOutcomeEnum.DeviceConfirmedNoAppliance,
]);

/** True when `value` routes a successful check (exact verdict or binary key). */
function isPositiveInputOutcomeValue(value: string): boolean {
    return POSITIVE_INPUT_OUTCOMES.has(value) || POSITIVE_DEVICE_TEST_OUTCOMES.has(value);
}

/**
 * Validates the input blocks of a step.
 *
 * An {@link EnyoOnboardingV2InputValueType.IpAddress} block is checked more
 * strictly than the other value types because it is the only one the host
 * actually runs a check for: a one-sided outcome set there is a step the
 * installer can enter and never leave, so both "no positive" and "no negative"
 * are errors rather than warnings. Unlike a device test there is no `failed`
 * verdict the host can fall back to.
 *
 * @param step - The step whose blocks are checked.
 * @param at - Human-readable location prefix for messages.
 * @param errors - Collector for blocking problems.
 * @param warnings - Collector for advisory problems.
 */
function validateInputBlocks(
    step: EnyoOnboardingV2Step,
    at: string,
    errors: string[],
    warnings: string[],
): void {
    for (const block of step.blocks ?? []) {
        if (block.type !== EnyoOnboardingV2BlockType.Input) continue;

        if (!INPUT_VALUE_TYPES.has(block.valueType)) {
            errors.push(
                `${at}: input block "${block.id}" has an unknown valueType "${block.valueType}".`,
            );
        }
        if (!block.label?.length) errors.push(`${at}: input block "${block.id}" has no label.`);
        if (!block.submitLabel?.length) {
            errors.push(`${at}: input block "${block.id}" has no submitLabel.`);
        }

        const outcomes = block.outcomes ?? [];
        if (outcomes.length < 2) {
            errors.push(`${at}: input block "${block.id}" needs at least 2 outcomes.`);
        }

        const ids = new Set<string>();
        const values = new Set<string>();
        for (const outcome of outcomes) {
            if (ids.has(outcome.id)) {
                errors.push(
                    `${at}: input block "${block.id}" has a duplicate outcome id "${outcome.id}".`,
                );
            }
            ids.add(outcome.id);

            if (values.has(outcome.value)) {
                errors.push(
                    `${at}: input block "${block.id}" wires outcome value "${outcome.value}" more than once.`,
                );
            }
            values.add(outcome.value);
        }

        if (block.valueType === EnyoOnboardingV2InputValueType.IpAddress) {
            if (![...values].some(isPositiveInputOutcomeValue)) {
                errors.push(
                    `${at}: input block "${block.id}" has no outcome for a successful check — ` +
                        `wire "reachable" (or an EnyoDeviceTestOutcomeEnum success member).`,
                );
            }
            if (![...values].some((v) => !isPositiveInputOutcomeValue(v))) {
                errors.push(
                    `${at}: input block "${block.id}" has no outcome for a failed check — ` +
                        `the installer would be stranded when the device does not answer.`,
                );
            }
        } else if (outcomes.length > 1) {
            warnings.push(
                `${at}: input block "${block.id}" has valueType "${block.valueType}", which runs no check — ` +
                    `only the positive outcome can ever fire, so its other ${outcomes.length - 1} outcome(s) are dead branches.`,
            );
        }
    }
}

/** Every {@link EnyoOnboardingV2OcppConnectOutcome} value. */
const OCPP_CONNECT_OUTCOMES: ReadonlySet<string> = new Set(
    Object.values(EnyoOnboardingV2OcppConnectOutcome),
);

/**
 * Validates the outcomes of an {@link EnyoOnboardingV2ActionKind.OcppConnect}
 * block.
 *
 * The block waits for the charger to dial into our CSMS; it can only ever report
 * that the connection arrived or that it did not, so its outcome `value`s are
 * closed over {@link EnyoOnboardingV2OcppConnectOutcome}. Both must be wired: a
 * charger that never calls home — wrong URL typed, no mobile coverage in the
 * garage — is the *common* case, and a guide without a `timeout` branch strands
 * the installer on a spinner.
 *
 * @param block - The ocpp-connect action block being checked.
 * @param at - Human-readable location prefix for messages.
 * @param errors - Collector for blocking problems.
 */
function validateOcppConnectOutcomes(
    block: EnyoOnboardingV2ActionBlock,
    at: string,
    errors: string[],
): void {
    const values = new Set<string>();
    for (const outcome of block.outcomes ?? []) {
        if (!OCPP_CONNECT_OUTCOMES.has(outcome.value)) {
            errors.push(
                `${at}: ocpp-connect block "${block.id}" has outcome value "${outcome.value}", which is not an EnyoOnboardingV2OcppConnectOutcome member.`,
            );
        } else if (values.has(outcome.value)) {
            errors.push(
                `${at}: ocpp-connect block "${block.id}" wires outcome value "${outcome.value}" more than once.`,
            );
        }
        values.add(outcome.value);
    }
    for (const required of OCPP_CONNECT_OUTCOMES) {
        if (!values.has(required)) {
            errors.push(
                `${at}: ocpp-connect block "${block.id}" has no "${required}" outcome; both results must be routed.`,
            );
        }
    }
}

/** Every {@link EnyoOnboardingV2EebusPairOutcome} value. */
const EEBUS_PAIR_OUTCOMES: ReadonlySet<string> = new Set(
    Object.values(EnyoOnboardingV2EebusPairOutcome),
);

/**
 * Validates the outcomes of an {@link EnyoOnboardingV2ActionKind.EebusPair}
 * block.
 *
 * The block reports one of three things — a peer was picked and the SHIP
 * handshake came up, discovery found nothing, or the handshake failed — so its
 * outcome `value`s are closed over {@link EnyoOnboardingV2EebusPairOutcome}.
 * Anything else is an outcome that can never fire.
 *
 * The missing `paired` branch is a warning rather than an error: it strands
 * every successful pairing, but an author staging a guide step by step may
 * legitimately not have wired it yet.
 *
 * @param block - The eebus-pair action block being checked.
 * @param at - Human-readable location prefix for messages.
 * @param errors - Collector for blocking problems.
 * @param warnings - Collector for advisory problems.
 */
function validateEebusPairOutcomes(
    block: EnyoOnboardingV2ActionBlock,
    at: string,
    errors: string[],
    warnings: string[],
): void {
    const values = new Set<string>();
    for (const outcome of block.outcomes ?? []) {
        if (!EEBUS_PAIR_OUTCOMES.has(outcome.value)) {
            errors.push(
                `${at}: eebus-pair block "${block.id}" has outcome value "${outcome.value}", which is not an EnyoOnboardingV2EebusPairOutcome member.`,
            );
        } else if (values.has(outcome.value)) {
            errors.push(
                `${at}: eebus-pair block "${block.id}" wires outcome value "${outcome.value}" more than once.`,
            );
        }
        values.add(outcome.value);
    }

    if (!values.has(EnyoOnboardingV2EebusPairOutcome.Paired)) {
        warnings.push(
            `${at}: eebus-pair block "${block.id}" has no "${EnyoOnboardingV2EebusPairOutcome.Paired}" outcome — ` +
                'a successful pairing would have nowhere to go.',
        );
    }
}

/**
 * Validates the auth blocks of a step.
 *
 * An auth block has exactly one handle, and the **server** decides when it
 * fires — there is no failure branch to author, because a failed login keeps the
 * installer on the step to retry. So the checks are about the handle existing and
 * being routable at all, and about the step not pretending the login is optional:
 * a second decision block next to it would offer a way past a gate the client is
 * not allowed to skip.
 *
 * @param step - The step whose blocks are checked.
 * @param at - Human-readable location prefix for messages.
 * @param errors - Collector for blocking problems.
 * @param warnings - Collector for advisory problems.
 */
function validateAuthBlocks(
    step: EnyoOnboardingV2Step,
    at: string,
    errors: string[],
    warnings: string[],
): void {
    const authBlocks = (step.blocks ?? []).filter(
        (b) => b.type === EnyoOnboardingV2BlockType.Auth,
    );

    for (const block of authBlocks) {
        if (!block.label?.length) errors.push(`${at}: auth block "${block.id}" has no label.`);
        if (!block.outcome?.id) {
            errors.push(
                `${at}: auth block "${block.id}" has no outcome id — its success handle cannot be routed.`,
            );
        }
        if (!block.outcome?.label?.length) {
            warnings.push(`${at}: auth block "${block.id}" outcome has no label.`);
        }
    }

    if (authBlocks.length > 1) {
        errors.push(`${at}: more than one auth block; a step can hold at most one login.`);
    }
    if (authBlocks.length === 1) {
        const others = (step.blocks ?? []).filter(
            (b) =>
                b.type === EnyoOnboardingV2BlockType.Choice ||
                b.type === EnyoOnboardingV2BlockType.Action ||
                b.type === EnyoOnboardingV2BlockType.Input,
        );
        if (others.length) {
            warnings.push(
                `${at}: auth block "${authBlocks[0]!.id}" shares the step with ${others.length} other decision block(s) — ` +
                    'those give the installer a way past a login the server gates.',
            );
        }
    }
}

/**
 * Checks {@link EnyoOnboardingV2Guide.requiresNetworkScan} against what the guide
 * actually does.
 *
 * Opting out means "don't search, start here" — right for a device that is never
 * on the LAN (an OCPP wallbox), wrong if the guide then relies on scan results.
 * Both mismatches are warnings, not errors: the flag describes the host's
 * behaviour before the guide runs, and an author may have a reason.
 *
 * @param guide - The guide being validated.
 * @param warnings - Collector for advisory problems.
 */
function validateNetworkScanFlag(guide: EnyoOnboardingV2Guide, warnings: string[]): void {
    if (guide.requiresNetworkScan !== false) return;

    const blocks = guide.steps.flatMap((s) => s.blocks ?? []);
    const scansItself = blocks.some(
        (b) =>
            b.type === EnyoOnboardingV2BlockType.Action &&
            b.action === EnyoOnboardingV2ActionKind.NetworkScan,
    );
    if (scansItself) return;

    const dependsOnDetected = blocks.some(
        (b) =>
            b.type === EnyoOnboardingV2BlockType.Action &&
            b.action === EnyoOnboardingV2ActionKind.DeviceTest &&
            (b.deviceSelection ?? EnyoOnboardingV2DeviceSelection.Detected) !==
                EnyoOnboardingV2DeviceSelection.Current,
    );
    if (dependsOnDetected) {
        warnings.push(
            'requiresNetworkScan is false, but a device-test block selects from detected devices — ' +
                'nothing was scanned, so it has nothing to test. Use deviceSelection "current", or run a ' +
                'network-scan action inside the guide.',
        );
    }

    const pairsEebus = blocks.some(
        (b) =>
            b.type === EnyoOnboardingV2BlockType.Action &&
            b.action === EnyoOnboardingV2ActionKind.EebusPair,
    );
    if (pairsEebus) {
        warnings.push(
            'requiresNetworkScan is false, but an eebus-pair block asks the installer to pick a ' +
                'discovered EEBUS peer — nothing was scanned, so the picker would open on an empty ' +
                'list. Run a network-scan action inside the guide ahead of it.',
        );
    }
}

/**
 * The set of routing-handle keys a step must wire exactly once: one per
 * choice option / action outcome / input outcome, or the single `continue`
 * handle when the step has no interactive block.
 *
 * A `Link` block contributes nothing — it is passive content.
 */
function requiredHandleKeys(step: EnyoOnboardingV2Step): Set<string> {
    const keys = new Set<string>();
    for (const b of step.blocks ?? []) {
        if (b.type === EnyoOnboardingV2BlockType.Choice) {
            for (const o of b.options) keys.add(`choice:${b.id}:${o.id}`);
        } else if (
            b.type === EnyoOnboardingV2BlockType.Action ||
            b.type === EnyoOnboardingV2BlockType.Input
        ) {
            for (const o of b.outcomes) keys.add(`outcome:${b.id}:${o.id}`);
        } else if (b.type === EnyoOnboardingV2BlockType.Auth && b.outcome?.id) {
            keys.add(`outcome:${b.id}:${b.outcome.id}`);
        }
    }
    if (keys.size === 0) keys.add('continue');
    return keys;
}

/** The canonical handle key for a transition source. */
function sourceKey(s: EnyoOnboardingV2Transition['source']): string {
    if (s.kind === EnyoOnboardingV2TransitionSourceKind.Continue) return 'continue';
    if (s.kind === EnyoOnboardingV2TransitionSourceKind.Choice) return `choice:${s.blockId}:${s.optionId}`;
    return `outcome:${s.blockId}:${s.outcomeId}`;
}

/** Breadth-first set of step ids reachable from `startId` via `step` targets. */
function reachableFrom(guide: EnyoOnboardingV2Guide, startId: string): Set<string> {
    const byId = new Map(guide.steps.map((s) => [s.id, s]));
    const seen = new Set<string>();
    const queue = [startId];
    while (queue.length) {
        const id = queue.shift()!;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const t of byId.get(id)?.transitions ?? []) {
            if (t.target.type === EnyoOnboardingV2TargetType.Step && !seen.has(t.target.stepId)) {
                queue.push(t.target.stepId);
            }
        }
    }
    return seen;
}
