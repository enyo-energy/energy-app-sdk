/**
 * Client-side validation for an {@link EnyoOnboardingV2DynamicResult} — the
 * value an app hands back when the host asks it to resolve a dynamic block.
 *
 * These checks exist because of *when* a bad value fails. The installer copies
 * whatever is rendered into a wallbox's configuration menu or a browser bar; a
 * URL with a stray space, or an `http://` where `wss://` was meant, does not
 * fail here — it fails minutes later as an `ocpp-connect` timeout with nothing
 * to point at. Catching it at the boundary is the only cheap moment.
 *
 * `errors` mean the value should not be returned (answer `null` instead —
 * "unavailable" is a supported answer, a broken value is not); `warnings` are
 * advisory. Use {@link validateOnboardingV2DynamicResult} for the non-throwing
 * result, or {@link assertValidOnboardingV2DynamicResult} to throw.
 */

import {EnyoOnboardingV2DynamicKind} from '../../types/enyo-onboarding-v2.js';
import type {
    EnyoOnboardingV2DynamicRequest,
    EnyoOnboardingV2DynamicResult,
} from '../../types/enyo-onboarding-v2-dynamic.js';

/**
 * Thrown by {@link assertValidOnboardingV2DynamicResult} when a value fails
 * validation. The message lists every blocking error so callers can surface
 * them directly.
 */
export class OnboardingV2DynamicValidationError extends Error {
    /** The individual blocking errors that caused the failure. */
    public readonly errors: string[];

    /**
     * @param errors - The blocking validation errors.
     */
    constructor(errors: string[]) {
        super(`Invalid onboarding dynamic value (v2):\n- ${errors.join('\n- ')}`);
        this.name = 'OnboardingV2DynamicValidationError';
        this.errors = errors;
    }
}

/** The outcome of validating an {@link EnyoOnboardingV2DynamicResult}. */
export interface OnboardingV2DynamicValidationResult {
    /** True when there are no blocking `errors` (warnings are still allowed). */
    ok: boolean;
    /** Blocking problems — return `null` rather than this value. */
    errors: string[];
    /** Advisory problems — allowed, but usually worth fixing. */
    warnings: string[];
}

/** Every {@link EnyoOnboardingV2DynamicKind} value. */
const DYNAMIC_KINDS: ReadonlySet<string> = new Set(Object.values(EnyoOnboardingV2DynamicKind));

/**
 * The schemes an OCPP backend URL may carry. `ws`/`wss` are the OCPP transport;
 * `http`/`https` are tolerated because some vendor menus accept them and derive
 * the websocket scheme themselves.
 */
const OCPP_URL_RE = /^(wss?|https?):\/\/\S+$/i;

/** A scheme that carries the value in the clear. */
const INSECURE_SCHEME_RE = /^(ws|http):\/\//i;

/** A bare dotted-quad IPv4 address, each octet 0–255. */
const IPV4_RE = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/** An absolute `http(s)` URL — the other accepted shape for a device address. */
const HTTP_URL_RE = /^https?:\/\/\S+$/i;

/**
 * Validates the value behind a dynamic block, per kind.
 *
 * Kind-specific rules:
 *
 * - {@link EnyoOnboardingV2DynamicKind.OcppUrl} — must be an absolute
 *   `ws`/`wss`/`http`/`https` URL (error otherwise, since the installer pastes
 *   it verbatim into the charger). A plaintext scheme is a warning: the OCPP
 *   session carries the charge point's identity, and `wss` is what a production
 *   CSMS should be handing out.
 * - {@link EnyoOnboardingV2DynamicKind.DeviceIp} — a bare IPv4 or an `http(s)`
 *   URL is accepted silently; anything else is a warning rather than an error,
 *   because a hostname is a legitimate answer this SDK cannot check.
 *
 * Whitespace inside the value is always an error. The value is rendered as a
 * copy target, and a URL that survives a copy but not a paste is the worst
 * version of this bug.
 *
 * @param result - The value the handler is about to return.
 * @param request - Optional originating request; enables cross-checks of
 *   `requestId` and `kind`.
 * @returns The {@link OnboardingV2DynamicValidationResult}.
 *
 * @example
 * ```typescript
 * const answer = {requestId: request.requestId, kind: request.kind, value: endpoint.url};
 * const {ok, errors} = validateOnboardingV2DynamicResult(answer, request);
 * if (!ok) {
 *     console.error('dynamic value rejected', errors);
 *     return null;   // unavailable beats wrong
 * }
 * return answer;
 * ```
 */
export function validateOnboardingV2DynamicResult(
    result: EnyoOnboardingV2DynamicResult,
    request?: EnyoOnboardingV2DynamicRequest,
): OnboardingV2DynamicValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!result) {
        return {
            ok: false,
            errors: ['result is required — resolve the handler with `null` to answer "unavailable".'],
            warnings,
        };
    }

    if (!result.requestId) errors.push('`requestId` is required.');
    else if (request && result.requestId !== request.requestId) {
        errors.push(
            `\`requestId\` "${result.requestId}" does not match the request's "${request.requestId}".`,
        );
    }

    if (!result.kind) errors.push('`kind` is required.');
    else if (!DYNAMIC_KINDS.has(result.kind)) {
        errors.push(`\`kind\` "${result.kind}" is not an EnyoOnboardingV2DynamicKind member.`);
    } else if (request && result.kind !== request.kind) {
        errors.push(
            `\`kind\` "${result.kind}" does not match the requested "${request.kind}" — ` +
                'the host would render this value in the wrong slot.',
        );
    }

    const value = result.value;
    if (typeof value !== 'string' || value.trim() === '') {
        errors.push('`value` is required and must be non-empty — return `null` to answer "unavailable".');
        return {ok: errors.length === 0, errors, warnings};
    }
    if (value !== value.trim()) {
        errors.push('`value` has leading or trailing whitespace; it is copied verbatim by the installer.');
    }
    if (/\s/.test(value.trim())) {
        errors.push('`value` contains whitespace; it is a copy target, not prose.');
    }

    const trimmed = value.trim();
    if (result.kind === EnyoOnboardingV2DynamicKind.OcppUrl) {
        if (!OCPP_URL_RE.test(trimmed)) {
            errors.push(
                `\`value\` "${trimmed}" is not an absolute ws/wss/http(s) URL — ` +
                    'the installer pastes it straight into the charger.',
            );
        } else if (INSECURE_SCHEME_RE.test(trimmed)) {
            warnings.push(
                '`value` uses a plaintext scheme; an OCPP session carries the charge point identity, ' +
                    'so a production CSMS should hand out a `wss://` URL.',
            );
        }
    } else if (result.kind === EnyoOnboardingV2DynamicKind.DeviceIp) {
        if (!IPV4_RE.test(trimmed) && !HTTP_URL_RE.test(trimmed)) {
            warnings.push(
                `\`value\` "${trimmed}" is neither an IPv4 address nor an http(s) URL. ` +
                    'A hostname may be intended; check it is something the installer can act on.',
            );
        }
    }

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Like {@link validateOnboardingV2DynamicResult}, but throws
 * {@link OnboardingV2DynamicValidationError} when there are blocking errors.
 * Warnings never throw; the validated value is returned on success for
 * chaining.
 *
 * Prefer the non-throwing form inside a handler: "unavailable" (`null`) is a
 * supported answer, so a rejected value has a graceful fallback that an
 * exception throws away.
 *
 * @param result - The value the handler is about to return.
 * @param request - Optional originating request, as for
 *   {@link validateOnboardingV2DynamicResult}.
 * @returns The same value when it has no blocking errors.
 * @throws {OnboardingV2DynamicValidationError} When validation produces any error.
 */
export function assertValidOnboardingV2DynamicResult(
    result: EnyoOnboardingV2DynamicResult,
    request?: EnyoOnboardingV2DynamicRequest,
): EnyoOnboardingV2DynamicResult {
    const {ok, errors} = validateOnboardingV2DynamicResult(result, request);
    if (!ok) throw new OnboardingV2DynamicValidationError(errors);
    return result;
}
