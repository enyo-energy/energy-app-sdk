/**
 * Client-side validator for the contact relays a wallbox declares in
 * {@link EnyoChargerApplianceMetadata.contactRelays} — the wallbox counterpart
 * of the heat pump's SG Ready relay checks in `validateHeatpumpAdvancedMetadata()`.
 *
 * Use {@link validateChargerContactRelays} for the non-throwing result, or
 * {@link assertValidChargerContactRelays} to throw on failure.
 */

import {EnyoChargerContactRelayFunctionEnum} from '../../types/enyo-charger-appliance.js';
import type {EnyoChargerApplianceContactRelay} from '../../types/enyo-charger-appliance.js';

/** The outcome of validating a wallbox's contact relays. */
export interface ChargerContactRelaysValidationResult {
    /** True when there are no blocking `errors` (warnings are still allowed). */
    ok: boolean;
    /** Blocking problems — the energy manager cannot use the relays as declared. */
    errors: string[];
    /** Advisory problems — allowed, but usually worth reviewing. */
    warnings: string[];
}

/**
 * Thrown by {@link assertValidChargerContactRelays} when validation produces
 * errors. The message lists every blocking error.
 */
export class ChargerContactRelaysValidationError extends Error {
    /** The individual blocking errors that caused the failure. */
    public readonly errors: string[];

    /**
     * @param errors - The blocking validation errors.
     */
    constructor(errors: string[]) {
        super(`Invalid charger contact relays:\n- ${errors.join('\n- ')}`);
        this.name = 'ChargerContactRelaysValidationError';
        this.errors = errors;
    }
}

const FUNCTIONS = new Set<string>(Object.values(EnyoChargerContactRelayFunctionEnum));

/**
 * Validates the contact relays of one wallbox.
 *
 * Errors: not an array; a missing, non-integer, negative or duplicate `index`;
 * an unknown `function`; `limitKw` missing or not positive on
 * `power-reduction`, or set on another function; an empty `applianceId`; one
 * plug linked to two relays.
 *
 * Warnings: two relays with the same function (for `power-reduction`, the same
 * `limitKw`), and `active` on a relay linked to a plug, whose state is read
 * from the plug.
 *
 * @param relays - The declared relays, possibly `undefined` (valid: none wired).
 * @returns The {@link ChargerContactRelaysValidationResult}.
 *
 * @example
 * ```typescript
 * const {ok, errors} = validateChargerContactRelays([
 *     {index: 0, function: EnyoChargerContactRelayFunctionEnum.ChargingEnable, applianceId: 'plug-1'},
 * ]);
 * ```
 */
export function validateChargerContactRelays(
    relays: readonly EnyoChargerApplianceContactRelay[] | undefined,
): ChargerContactRelaysValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (relays === undefined) return {ok: true, errors, warnings};
    if (!Array.isArray(relays)) {
        errors.push('contactRelays must be an array.');
        return {ok: false, errors, warnings};
    }

    const indexes = new Set<number>();
    const targets = new Set<string>();
    const plugs = new Map<string, number>();

    relays.forEach((relay: EnyoChargerApplianceContactRelay, position: number) => {
        const at = `contactRelays[${position}]`;
        if (relay === null || typeof relay !== 'object') {
            errors.push(`${at}: must be an object.`);
            return;
        }

        if (!Number.isInteger(relay.index) || relay.index < 0) {
            errors.push(`${at}: index must be a whole number ≥ 0.`);
        } else if (indexes.has(relay.index)) {
            errors.push(`${at}: duplicate index ${relay.index}.`);
        } else {
            indexes.add(relay.index);
        }

        if (!FUNCTIONS.has(relay.function)) {
            errors.push(`${at}: function "${relay.function}" is not a valid value.`);
            return;
        }

        if (relay.function === EnyoChargerContactRelayFunctionEnum.PowerReduction) {
            if (typeof relay.limitKw !== 'number' || !Number.isFinite(relay.limitKw) || relay.limitKw <= 0) {
                errors.push(`${at}: power-reduction needs limitKw, a power in kW greater than 0.`);
            }
        } else if (relay.limitKw !== undefined) {
            errors.push(`${at}: limitKw only applies to power-reduction.`);
        }

        const target = relay.function === EnyoChargerContactRelayFunctionEnum.PowerReduction
            ? `${relay.function}@${relay.limitKw}`
            : relay.function;
        if (targets.has(target)) {
            warnings.push(`${at}: another relay already has function ${relay.function}.`);
        }
        targets.add(target);

        if (relay.applianceId !== undefined) {
            if (typeof relay.applianceId !== 'string' || relay.applianceId === '') {
                errors.push(`${at}: applianceId must be a non-empty string.`);
                return;
            }
            const other = plugs.get(relay.applianceId);
            if (other !== undefined) {
                errors.push(`${at}: plug ${relay.applianceId} is already linked to contactRelays[${other}].`);
            } else {
                plugs.set(relay.applianceId, position);
            }
            if (relay.active !== undefined) {
                warnings.push(`${at}: active is ignored on a relay linked to a smart plug — its state is read from the plug.`);
            }
        }
    });

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Like {@link validateChargerContactRelays}, but throws
 * {@link ChargerContactRelaysValidationError} on errors. Warnings never throw.
 *
 * @param relays - The declared relays.
 * @returns The relays, or an empty array when `undefined`.
 * @throws {ChargerContactRelaysValidationError} When validation produces any error.
 */
export function assertValidChargerContactRelays(
    relays: readonly EnyoChargerApplianceContactRelay[] | undefined,
): readonly EnyoChargerApplianceContactRelay[] {
    const {ok, errors} = validateChargerContactRelays(relays);
    if (!ok) throw new ChargerContactRelaysValidationError(errors);
    return relays ?? [];
}
