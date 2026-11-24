/**
 * Client-side validation and helpers for authentications (v2)
 * ({@link EnyoAuthenticationV2Definition}). The validator mirrors the host's
 * check, so a package can fail fast before calling `upsert()`.
 */

import type {EnyoPackageConfigurationTranslatedValue} from '../../types/enyo-settings.js';
import {ENYO_AUTHENTICATION_MAX_TIMEOUT_MS, EnyoAuthenticationStateEnum} from '../../types/enyo-authentication.js';
import {
    EnyoAuthenticationV2StateEnum,
    type EnyoAuthenticationV2,
    type EnyoAuthenticationV2Definition,
    type EnyoAuthenticationV2Filter,
    type EnyoAuthenticationV2ReauthenticationOptions,
    type EnyoAuthenticationV2Target,
} from '../../types/enyo-authentication-v2.js';

/** Languages accepted for the translated texts of an authentication. */
const SUPPORTED_LANGUAGES: readonly string[] = ['de', 'en'];

/** Pattern an {@link EnyoAuthenticationV2Definition.authenticationKey} must match. */
const AUTHENTICATION_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

/** Pattern a key of {@link EnyoAuthenticationV2TargetBase.externalIds} must match. */
const EXTERNAL_ID_KEY_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

/** Longest allowed value in {@link EnyoAuthenticationV2TargetBase.externalIds}. */
const EXTERNAL_ID_MAX_VALUE_LENGTH = 256;

/** Most entries allowed in {@link EnyoAuthenticationV2TargetBase.externalIds}. */
const EXTERNAL_ID_MAX_ENTRIES = 20;

/**
 * Thrown by {@link assertValidAuthenticationV2Definition} when a definition
 * fails validation. The message lists every error.
 */
export class AuthenticationV2ValidationError extends Error {
    /** The individual validation errors. */
    public readonly errors: string[];

    /**
     * @param errors - The validation errors.
     */
    constructor(errors: string[]) {
        super(`Invalid authentication (v2):\n- ${errors.join('\n- ')}`);
        this.name = 'AuthenticationV2ValidationError';
        this.errors = errors;
    }
}

/**
 * Checks an {@link EnyoAuthenticationV2Definition} the way the host does.
 *
 * Checks the key format, that there is at least one target, that a package
 * target stands alone, that targets carry ids and are not duplicated, the
 * targets' `externalIds`, the
 * translated `name` / `description` (`de` / `en`, one entry per language, no
 * empty values), that the configuration for the chosen method is present, and
 * the timeout range.
 *
 * @param definition - The definition to check.
 * @returns Every error found; an empty array means the definition is valid.
 */
export function validateAuthenticationV2Definition(definition: EnyoAuthenticationV2Definition): string[] {
    const errors: string[] = [];

    if (!AUTHENTICATION_KEY_PATTERN.test(definition.authenticationKey ?? '')) {
        errors.push(`authenticationKey "${definition.authenticationKey}" must be 1–128 characters out of A–Z a–z 0–9 . _ : -`);
    }

    errors.push(...validateTargets(definition.targets));

    if (!definition.name || definition.name.length === 0) {
        errors.push('name needs at least one translation');
    } else {
        errors.push(...validateTranslations('name', definition.name));
    }
    if (definition.description) {
        errors.push(...validateTranslations('description', definition.description));
    }

    switch (definition.authenticationType) {
        case 'apiKey':
            if (!definition.apiKey) errors.push('authenticationType "apiKey" requires apiKey');
            break;
        case 'oauth':
            if (!definition.oauth) errors.push('authenticationType "oauth" requires oauth');
            break;
        case 'usernamePassword':
            if (!definition.usernamePassword) errors.push('authenticationType "usernamePassword" requires usernamePassword');
            break;
        default:
            errors.push(`unknown authenticationType "${definition.authenticationType}"`);
    }

    if (definition.timeoutMs !== undefined
        && (!Number.isFinite(definition.timeoutMs) || definition.timeoutMs <= 0 || definition.timeoutMs > ENYO_AUTHENTICATION_MAX_TIMEOUT_MS)) {
        errors.push(`timeoutMs must be > 0 and <= ${ENYO_AUTHENTICATION_MAX_TIMEOUT_MS}`);
    }

    return errors;
}

/**
 * Like {@link validateAuthenticationV2Definition}, but throws.
 *
 * @param definition - The definition to check.
 * @throws {AuthenticationV2ValidationError} When at least one error was found.
 */
export function assertValidAuthenticationV2Definition(definition: EnyoAuthenticationV2Definition): void {
    const errors = validateAuthenticationV2Definition(definition);
    if (errors.length > 0) {
        throw new AuthenticationV2ValidationError(errors);
    }
}

/**
 * Checks the options of `useAuthenticationV2().requireReauthentication()`
 * against the authentication they are meant for, the way the host does:
 * translated `stateReason` (`de` / `en`), and that every affected target is a
 * target of the authentication.
 *
 * @param authentication - The authentication (or definition) to re-authenticate.
 * @param options - The options to check.
 * @returns Every error found; an empty array means the options are valid.
 */
export function validateAuthenticationV2ReauthenticationOptions(
    authentication: Pick<EnyoAuthenticationV2Definition, 'targets'>,
    options: EnyoAuthenticationV2ReauthenticationOptions,
): string[] {
    const errors: string[] = [];
    if (!options.reason) {
        errors.push('reason is required');
    }
    if (options.stateReason) {
        errors.push(...validateTranslations('stateReason', options.stateReason));
    }
    options.affectedTargets?.forEach((target, index) => {
        if (!authenticationV2HasTarget(authentication, target)) {
            errors.push(`affectedTargets[${index}] is not a target of this authentication`);
        }
    });
    return errors;
}

/**
 * Finds the target of an authentication that carries a given external id,
 * e.g. the vehicle whose `vendorVehicleId` the vendor reported in a webhook.
 *
 * @param authentication - The authentication to search.
 * @param key - The key in {@link EnyoAuthenticationV2TargetBase.externalIds}, e.g. `vendorVehicleId`.
 * @param value - The value to look for.
 * @returns The first matching target, or `undefined`.
 */
export function findAuthenticationV2TargetByExternalId(
    authentication: Pick<EnyoAuthenticationV2Definition, 'targets'>,
    key: string,
    value: string,
): EnyoAuthenticationV2Target | undefined {
    return authentication.targets.find(target => target.externalIds?.[key] === value);
}

/**
 * Whether two targets denote the same package, appliance or vehicle.
 * {@link EnyoAuthenticationV2TargetBase.externalIds} are not compared.
 *
 * @param a - First target.
 * @param b - Second target.
 * @returns `true` when both have the same type and id.
 */
export function isSameAuthenticationV2Target(a: EnyoAuthenticationV2Target, b: EnyoAuthenticationV2Target): boolean {
    if (a.type !== b.type) return false;
    switch (a.type) {
        case 'package':
            return true;
        case 'appliance':
            return a.applianceId === (b as typeof a).applianceId;
        case 'vehicle':
            return a.vehicleId === (b as typeof a).vehicleId;
        default:
            return false;
    }
}

/**
 * Whether an authentication is used for an appliance or vehicle.
 *
 * Only explicit targets count; a package-wide authentication does not cover a
 * specific appliance or vehicle by this check.
 *
 * @param authentication - The authentication (or definition) to check.
 * @param target - The appliance or vehicle to look for.
 * @returns `true` when `target` is one of the authentication's targets.
 */
export function authenticationV2HasTarget(
    authentication: Pick<EnyoAuthenticationV2Definition, 'targets'>,
    target: EnyoAuthenticationV2Target,
): boolean {
    return authentication.targets.some(t => isSameAuthenticationV2Target(t, target));
}

/**
 * Applies an {@link EnyoAuthenticationV2Filter} to a list of authentications,
 * with the same semantics as `useAuthenticationV2().list(filter)`. Useful for
 * hosts and test doubles.
 *
 * @param authentications - The authentications to filter.
 * @param filter - The criteria; all given criteria must match.
 * @returns The matching authentications, in input order.
 */
export function filterAuthenticationsV2(
    authentications: EnyoAuthenticationV2[],
    filter: EnyoAuthenticationV2Filter = {},
): EnyoAuthenticationV2[] {
    return authentications.filter(auth => {
        if (filter.applianceId !== undefined
            && !authenticationV2HasTarget(auth, {type: 'appliance', applianceId: filter.applianceId})) return false;
        if (filter.vehicleId !== undefined
            && !authenticationV2HasTarget(auth, {type: 'vehicle', vehicleId: filter.vehicleId})) return false;
        if (filter.packageWide !== undefined
            && authenticationV2HasTarget(auth, {type: 'package'}) !== filter.packageWide) return false;
        if (filter.states && !filter.states.includes(auth.state)) return false;
        return true;
    });
}

/**
 * Maps a v2 state to the state the deprecated v1 API reports, for hosts that
 * serve both APIs from one store.
 *
 * `ReauthenticationRequired` has no v1 equivalent and is reported as
 * `Unauthenticated`; v1 callers see the reason through
 * `failureReason: 'sessionExpired'`.
 *
 * @param state - The v2 state.
 * @returns The v1 state.
 */
export function toAuthenticationV1State(state: EnyoAuthenticationV2StateEnum): EnyoAuthenticationStateEnum {
    switch (state) {
        case EnyoAuthenticationV2StateEnum.Authenticated:
            return EnyoAuthenticationStateEnum.Authenticated;
        case EnyoAuthenticationV2StateEnum.AuthenticationFailed:
            return EnyoAuthenticationStateEnum.AuthenticationFailed;
        default:
            return EnyoAuthenticationStateEnum.Unauthenticated;
    }
}

/**
 * Validates the target list of a definition.
 *
 * @param targets - The targets to check.
 * @returns The errors found.
 */
function validateTargets(targets: EnyoAuthenticationV2Target[] | undefined): string[] {
    if (!targets || targets.length === 0) {
        return ['targets needs at least one target'];
    }
    const errors: string[] = [];
    if (targets.some(t => t.type === 'package') && targets.length > 1) {
        errors.push('a "package" target cannot be combined with other targets');
    }
    targets.forEach((target, index) => {
        if (target.type === 'appliance' && !target.applianceId) {
            errors.push(`targets[${index}] needs an applianceId`);
        } else if (target.type === 'vehicle' && !target.vehicleId) {
            errors.push(`targets[${index}] needs a vehicleId`);
        } else if (!['package', 'appliance', 'vehicle'].includes(target.type)) {
            errors.push(`targets[${index}] has unknown type "${(target as {type: string}).type}"`);
        }
        if (targets.findIndex(t => isSameAuthenticationV2Target(t, target)) < index) {
            errors.push(`targets[${index}] is a duplicate`);
        }
        if (target.externalIds !== undefined) {
            errors.push(...validateExternalIds(`targets[${index}].externalIds`, target.externalIds));
        }
    });
    return errors;
}

/**
 * Validates the external ids of one target: key format, value length and
 * number of entries.
 *
 * @param field - Field path used in error messages.
 * @param externalIds - The ids to check.
 * @returns The errors found.
 */
function validateExternalIds(field: string, externalIds: Record<string, string>): string[] {
    const errors: string[] = [];
    const entries = Object.entries(externalIds);
    if (entries.length > EXTERNAL_ID_MAX_ENTRIES) {
        errors.push(`${field} has more than ${EXTERNAL_ID_MAX_ENTRIES} entries`);
    }
    for (const [key, value] of entries) {
        if (!EXTERNAL_ID_KEY_PATTERN.test(key)) {
            errors.push(`${field} key "${key}" must be 1–64 characters out of A–Z a–z 0–9 . _ -`);
        }
        if (typeof value !== 'string' || value.length === 0 || value.length > EXTERNAL_ID_MAX_VALUE_LENGTH) {
            errors.push(`${field}.${key} must be a string of 1–${EXTERNAL_ID_MAX_VALUE_LENGTH} characters`);
        }
    }
    return errors;
}

/**
 * Validates a translated text: supported languages, one entry per language,
 * no empty values.
 *
 * @param field - Field name used in error messages.
 * @param values - The translations to check.
 * @returns The errors found.
 */
function validateTranslations(field: string, values: EnyoPackageConfigurationTranslatedValue[]): string[] {
    const errors: string[] = [];
    const seen = new Set<string>();
    for (const entry of values) {
        if (!SUPPORTED_LANGUAGES.includes(entry.language)) {
            errors.push(`${field} has unsupported language "${entry.language}" (supported: ${SUPPORTED_LANGUAGES.join(', ')})`);
        }
        if (seen.has(entry.language)) {
            errors.push(`${field} has more than one "${entry.language}" translation`);
        }
        seen.add(entry.language);
        if (!entry.value || entry.value.trim() === '') {
            errors.push(`${field} has an empty "${entry.language}" translation`);
        }
    }
    return errors;
}
