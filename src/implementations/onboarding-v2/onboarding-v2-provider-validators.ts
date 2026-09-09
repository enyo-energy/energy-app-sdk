/**
 * Client-side validation for an {@link EnyoOnboardingV2GuidesResult} — the whole
 * answer an app hands back when the host asks for its v2 onboarding guides.
 *
 * {@link validateOnboardingGuideV2} checks one guide's graph. This checks the
 * *set*: that every guide in it is publishable and that no two of them use the
 * same `name`, which is the handle an app addresses one specific guide by.
 *
 * It deliberately says nothing about vendor and model bindings. Those are
 * enyo's — attached when a guide is registered, derived from the package serving
 * it and the vendor catalog — so an app's answer cannot claim one, cannot
 * collide on one, and should not carry one
 * ({@link EnyoOnboardingV2Guide.vendorId}). A guide that sets them anyway is
 * warned about by {@link validateOnboardingGuideV2}.
 *
 * `errors` mean the answer is not fit to return; `warnings` are advisory. Use
 * {@link validateOnboardingV2GuidesResult} for the non-throwing result, or
 * {@link assertValidOnboardingV2GuidesResult} to throw.
 */

import {validateOnboardingGuideV2} from './onboarding-v2-validators.js';
import type {OnboardingV2ValidationContext} from './onboarding-v2-validators.js';
import type {EnyoOnboardingV2Guide} from '../../types/enyo-onboarding-v2.js';
import type {EnyoOnboardingV2GuidesResult} from '../../types/enyo-onboarding-v2-provider.js';

/**
 * Thrown by {@link assertValidOnboardingV2GuidesResult} when an answer fails
 * validation. The message lists every blocking error so callers can surface
 * them directly.
 */
export class OnboardingV2GuidesValidationError extends Error {
    /** The individual blocking errors that caused the failure. */
    public readonly errors: string[];

    /**
     * @param errors - The blocking validation errors.
     */
    constructor(errors: string[]) {
        super(`Invalid onboarding guides result (v2):\n- ${errors.join('\n- ')}`);
        this.name = 'OnboardingV2GuidesValidationError';
        this.errors = errors;
    }
}

/** The outcome of validating an {@link EnyoOnboardingV2GuidesResult}. */
export interface OnboardingV2GuidesValidationResult {
    /** True when there are no blocking `errors` (warnings are still allowed). */
    ok: boolean;
    /** Blocking problems — the answer should not be returned to the host. */
    errors: string[];
    /** Advisory problems — allowed, but usually worth fixing. */
    warnings: string[];
}

/**
 * A short human-readable label for a guide, for use in messages.
 *
 * Prefers {@link EnyoOnboardingV2Guide.name} — it is the handle the author will
 * search for — then the first translated title, then the start variant, so a
 * guide with neither a name nor a title is still identifiable.
 *
 * @param guide - The guide to label.
 * @param index - Its position in the answer's `guides` array.
 * @returns A message prefix such as ``guides[2] ("Wallbox über OCPP")``.
 */
function guideLabel(guide: EnyoOnboardingV2Guide, index: number): string {
    const name = guide.name?.trim();
    if (name) return `guides[${index}] ("${name}")`;
    const title = guide.title?.[0]?.value;
    return `guides[${index}] (${title ? `"${title}"` : (guide.startVariant ?? '?')})`;
}

/**
 * Validates a complete guides answer: the envelope, every guide in it, and the
 * `name` handles across them.
 *
 * Each guide is run through {@link validateOnboardingGuideV2}, and its errors
 * and warnings are surfaced here prefixed with the guide's position — pass the
 * declaring package's `files` in `context` to have image references resolved
 * rather than merely reported.
 *
 * An empty `guides` array is valid but warned about: it is the deliberate
 * statement "I have no guides, drop the ones you cached". An app that meant
 * "I cannot answer right now" must resolve its handler with `null` instead.
 *
 * @param result - The answer the handler is about to return.
 * @param context - Optional {@link OnboardingV2ValidationContext} every guide is
 *   checked against.
 * @returns The {@link OnboardingV2GuidesValidationResult}.
 *
 * @example
 * ```typescript
 * const result = {requestId: request.requestId, guides: buildGuides()};
 * const {ok, errors, warnings} = validateOnboardingV2GuidesResult(result, {
 *     files: packageDefinition.files,
 * });
 * if (!ok) {
 *     console.error('onboarding guides invalid', errors);
 *     return null;
 * }
 * warnings.forEach((w) => console.warn('onboarding guides:', w));
 * return result;
 * ```
 */
export function validateOnboardingV2GuidesResult(
    result: EnyoOnboardingV2GuidesResult,
    context?: OnboardingV2ValidationContext,
): OnboardingV2GuidesValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!result?.requestId) {
        errors.push('`requestId` is required and must echo the request.');
    }

    if (!Array.isArray(result?.guides)) {
        errors.push('`guides` must be an array — resolve the handler with `null` to answer "nothing".');
        return {ok: false, errors, warnings};
    }

    if (result.guides.length === 0) {
        warnings.push(
            'Empty `guides` retires every guide the host cached for this app. ' +
                'Resolve the handler with `null` instead if the intent was "no answer right now".',
        );
    }

    // The explicit `name` handles — a duplicate makes an app unable to say which
    // of the two guides it means.
    const namedBy = new Map<string, string>();

    for (const [i, guide] of result.guides.entries()) {
        const at = guideLabel(guide, i);

        const guideResult = validateOnboardingGuideV2(guide, context);
        errors.push(...guideResult.errors.map((e) => `${at}: ${e}`));
        warnings.push(...guideResult.warnings.map((w) => `${at}: ${w}`));

        const name = guide.name?.trim();
        if (name) {
            const previouslyNamed = namedBy.get(name);
            if (previouslyNamed) {
                errors.push(
                    `${at}: name "${name}" is already used by ${previouslyNamed} — ` +
                        'a name is how an app addresses one specific guide, so two guides cannot share one.',
                );
            } else {
                namedBy.set(name, at);
            }
        }
    }

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Like {@link validateOnboardingV2GuidesResult}, but throws
 * {@link OnboardingV2GuidesValidationError} when there are blocking errors.
 * Warnings never throw; the validated answer is returned on success for
 * chaining.
 *
 * @param result - The answer the handler is about to return.
 * @param context - Optional {@link OnboardingV2ValidationContext}, as for
 *   {@link validateOnboardingV2GuidesResult}.
 * @returns The same answer when it has no blocking errors.
 * @throws {OnboardingV2GuidesValidationError} When validation produces any error.
 */
export function assertValidOnboardingV2GuidesResult(
    result: EnyoOnboardingV2GuidesResult,
    context?: OnboardingV2ValidationContext,
): EnyoOnboardingV2GuidesResult {
    const {ok, errors} = validateOnboardingV2GuidesResult(result, context);
    if (!ok) throw new OnboardingV2GuidesValidationError(errors);
    return result;
}
