/**
 * Client-side validation for the external control contact of a smart plug
 * ({@link EnyoSmartPlugExternalControlContact}) — a relay wired as a control
 * contact of an appliance owned by another energy app, e.g. the SG Ready input
 * of a heat pump.
 *
 * An empty appliance id, a negative zone or `normal` as the On state all
 * compile, yet the energy manager would switch the wrong thing or nothing.
 * `errors` mean the value is malformed; `warnings` are advisory.
 */

import {
    EnyoHeatpumpSgReadyFunctionEnum,
    EnyoHeatpumpSgReadyStateEnum,
} from '../../types/enyo-heatpump-appliance.js';
import {EnyoSmartPlugExternalControlTypeEnum} from '../../types/enyo-smart-plug-appliance.js';
import type {EnyoSmartPlugExternalControlContact} from '../../types/enyo-smart-plug-appliance.js';

/** The outcome of validating a smart plug's external control contact. */
export interface SmartPlugExternalControlContactValidationResult {
    /** True when there are no blocking errors. */
    ok: boolean;
    /** Blocking problems — the value is malformed. */
    errors: string[];
    /** Advisory problems — the value is usable but probably not what was meant. */
    warnings: string[];
}

const CONTROL_TYPES = new Set<string>(Object.values(EnyoSmartPlugExternalControlTypeEnum));
const SG_READY_FUNCTIONS = new Set<string>(Object.values(EnyoHeatpumpSgReadyFunctionEnum));
const SG_READY_STATES = new Set<string>(Object.values(EnyoHeatpumpSgReadyStateEnum));

/**
 * Validates the external control contact of a smart plug
 * ({@link EnyoSmartPlugApplianceMetadata.externalControlContact}).
 *
 * `null` and `undefined` are valid: `null` removes the link, `undefined`
 * leaves the stored link as it is.
 *
 * Rules:
 *  - Error: `type` is not an `EnyoSmartPlugExternalControlTypeEnum` member.
 *  - Error: `applianceId` is empty or not a string.
 *  - Error: `function` is not an `EnyoHeatpumpSgReadyFunctionEnum` member.
 *  - Error: `zoneIndex` is set but not a non-negative integer.
 *  - Error: `onState` is not an `EnyoHeatpumpSgReadyStateEnum` member, or is
 *    `normal` — relay Off already means normal, so On could never change it.
 *  - Warning: `onState` is `blocked` — switching the relay on blocks the heat
 *    pump, so the energy manager can never use it to raise it.
 *
 * Whether the referenced appliance exists, or another relay already claims the
 * same function and zone, can only be checked against the full appliance list
 * and is left to the consumer.
 *
 * @param contact - The external control contact to validate.
 * @returns The validation result.
 */
export function validateSmartPlugExternalControlContact(
    contact: EnyoSmartPlugExternalControlContact | null | undefined,
): SmartPlugExternalControlContactValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (contact === null || contact === undefined) return {ok: true, errors, warnings};

    if (!CONTROL_TYPES.has(contact.type)) {
        errors.push(`type "${contact.type}" is not a valid value`);
        return {ok: false, errors, warnings};
    }
    if (typeof contact.applianceId !== 'string' || contact.applianceId.trim() === '') {
        errors.push('applianceId must be a non-empty string');
    }
    if (!SG_READY_FUNCTIONS.has(contact.function)) {
        errors.push(`function "${contact.function}" is not a valid value`);
    }
    if (contact.zoneIndex !== undefined && !(Number.isInteger(contact.zoneIndex) && contact.zoneIndex >= 0)) {
        errors.push(`zoneIndex ${contact.zoneIndex} must be a non-negative integer`);
    }
    if (contact.onState !== undefined) {
        if (!SG_READY_STATES.has(contact.onState)) {
            errors.push(`onState "${contact.onState}" is not a valid value`);
        } else if (contact.onState === EnyoHeatpumpSgReadyStateEnum.Normal) {
            errors.push('onState must not be normal — relay Off already means normal');
        } else if (contact.onState === EnyoHeatpumpSgReadyStateEnum.Blocked) {
            warnings.push('onState is blocked — switching the relay on blocks the heat pump and can never raise it');
        }
    }

    return {ok: errors.length === 0, errors, warnings};
}
