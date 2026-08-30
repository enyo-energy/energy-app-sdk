/**
 * Client-side validation for an {@link EnyoOnboardingV2GuidesResult} — the whole
 * answer an app hands back when the host asks for its v2 onboarding guides.
 *
 * {@link validateOnboardingGuideV2} checks one guide's graph. This checks the
 * *set*: that every guide in it is publishable, that each one says which
 * vendor/model/start-variant it applies to, and that no two of them claim the
 * same one. Those last two only become checkable here, because a guide is now
 * selected out of an app's own answer rather than bound to a catalog entry at
 * publish time — a guide with no binding can never be chosen for a device, and
 * two guides with the same binding leave the host with no way to pick.
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
 * Placeholder used in a binding key for a guide that names no model — it applies
 * to every model of its vendor, and therefore collides with any other such guide
 * for the same vendor and start variant.
 */
const ANY_MODEL = '*';

/**
 * A short human-readable label for a guide, for use in messages.
 *
 * Prefers the first translated title, since ids are not required at guide level;
 * falls back to the start variant so a titleless guide is still identifiable.
 *
 * @param guide - The guide to label.
 * @param index - Its position in the answer's `guides` array.
 * @returns A message prefix such as ``guides[2] ("Wallbox über OCPP")``.
 */
function guideLabel(guide: EnyoOnboardingV2Guide, index: number): string {
    const title = guide.title?.[0]?.value;
    return `guides[${index}] (${title ? `"${title}"` : (guide.startVariant ?? '?')})`;
}

/**
 * Every (vendor, model, start variant) binding a guide claims.
 *
 * A guide with several `modelIds` claims one binding per model, so two guides
 * that overlap on a single model collide even when the rest of their model lists
 * differ.
 *
 * @param guide - The guide to derive bindings for.
 * @returns The binding keys, or an empty array when the guide names no vendor.
 */
function bindingKeys(guide: EnyoOnboardingV2Guide): string[] {
    if (!guide.vendorId) return [];
    const models = guide.modelIds?.length ? guide.modelIds : [ANY_MODEL];
    return models.map((modelId) => `${guide.vendorId}|${modelId}|${guide.startVariant}`);
}

/**
 * Validates a complete guides answer: the envelope, every guide in it, and the
 * bindings across them.
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

    // Which guide(s) claimed each binding, so a collision can name both sides.
    const claimedBy = new Map<string, string>();

    for (const [i, guide] of result.guides.entries()) {
        const at = guideLabel(guide, i);

        const guideResult = validateOnboardingGuideV2(guide, context);
        errors.push(...guideResult.errors.map((e) => `${at}: ${e}`));
        warnings.push(...guideResult.warnings.map((w) => `${at}: ${w}`));

        if (!guide.vendorId) {
            warnings.push(
                `${at}: no vendorId — the host matches a run by vendor, model and start variant, ` +
                    'so an unbound guide can never be selected.',
            );
        } else if (!guide.modelIds?.length) {
            warnings.push(`${at}: no modelIds — this guide applies to every model of "${guide.vendorId}".`);
        }

        for (const key of bindingKeys(guide)) {
            const previous = claimedBy.get(key);
            if (previous) {
                errors.push(
                    `${at}: binding "${key}" is already claimed by ${previous} — ` +
                        'the host cannot choose between two guides for the same vendor, model and start variant.',
                );
            } else {
                claimedBy.set(key, at);
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
