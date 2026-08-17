/**
 * Client-side validator for {@link EnyoModbusServerRegistration} lists.
 *
 * The host rejects a conflicting registration at call time by throwing
 * {@link EnyoModbusServerRegistrationConflictError}, which is the authoritative
 * check but a poor way to find out your own register map overlaps itself. This
 * validator catches everything that is knowable without the host — self-overlap,
 * duplicate keys, missing metadata — so an app can fail fast at startup with all
 * the problems at once instead of one throw at a time.
 *
 * It cannot see other apps' registrations, so a clean result here does **not**
 * guarantee registration will succeed.
 */

import {
    EnyoModbusServerRegisterSpace,
    type EnyoModbusServerRegistration,
} from '../../types/enyo-modbus-server.js';
import type {EnergyAppModbusDataType} from './interfaces.js';

/** The outcome of validating a list of registrations. */
export interface ModbusServerValidationResult {
    /** True when there are no blocking `errors` (warnings are still allowed). */
    ok: boolean;
    /** Blocking problems — registration will fail or serve wrong data. */
    errors: string[];
    /** Advisory problems — allowed, but usually worth fixing. */
    warnings: string[];
}

/**
 * Thrown by {@link assertValidModbusServerRegistrations} when a register map
 * fails validation. The message lists every blocking error.
 */
export class ModbusServerValidationError extends Error {
    /** The individual blocking errors that caused the failure. */
    public readonly errors: string[];

    /**
     * @param errors - The blocking validation errors.
     */
    constructor(errors: string[]) {
        super(`Invalid Modbus server register map:\n- ${errors.join('\n- ')}`);
        this.name = 'ModbusServerValidationError';
        this.errors = errors;
    }
}

/** Word counts for the data types whose span is fixed. */
const WORDS_BY_DATA_TYPE: Readonly<Record<Exclude<EnergyAppModbusDataType, 'string'>, number>> = {
    uint16: 1,
    int16: 1,
    acc16: 1,
    uint32: 2,
    int32: 2,
    float32: 2,
    acc32: 2,
};

/** The two spaces addressed in bits rather than 16-bit words. */
const BIT_SPACES: ReadonlySet<EnyoModbusServerRegisterSpace> = new Set([
    EnyoModbusServerRegisterSpace.Coil,
    EnyoModbusServerRegisterSpace.DiscreteInput,
]);

/**
 * How many words (or bits) a registration occupies, starting at its `address`.
 *
 * Bit spaces always occupy one. Word spaces derive their span from `dataType`,
 * except `'string'`, which needs an explicit `quantity` — when that is missing
 * the span is unknowable and this returns `undefined` so the caller can report
 * it rather than guess.
 *
 * @param registration - The registration to measure.
 * @returns The span, or `undefined` when it cannot be derived.
 */
export function modbusServerRegisterSpan(
    registration: EnyoModbusServerRegistration,
): number | undefined {
    if (BIT_SPACES.has(registration.space)) return 1;

    const {dataType, quantity} = registration as {dataType: EnergyAppModbusDataType; quantity?: number};
    if (dataType === 'string') {
        return quantity && quantity > 0 ? quantity : undefined;
    }
    return WORDS_BY_DATA_TYPE[dataType];
}

/**
 * Checks a register map for problems that are knowable without the host.
 *
 * Reports as errors: overlapping ranges within the same space, duplicate `key`s,
 * a missing or empty `name`, a `'string'` register without `quantity`, an
 * unknown `dataType`, and a negative address. Reports as warnings: `scale` on a
 * string register (which the host ignores) and a `unit` on a coil or discrete
 * input (a bit has no unit).
 *
 * Two registrations only conflict within the same space — holding 40071 and
 * input 40071 are different addresses and both are fine.
 *
 * @param registrations - The register map to check.
 * @returns The {@link ModbusServerValidationResult}.
 */
export function validateModbusServerRegistrations(
    registrations: EnyoModbusServerRegistration[],
): ModbusServerValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!registrations?.length) {
        return {ok: true, errors, warnings};
    }

    const keys = new Set<string>();
    /** Claimed ranges per space, so the overlap check never crosses spaces. */
    const claimed = new Map<EnyoModbusServerRegisterSpace, {from: number; to: number; at: string}[]>();

    for (const [i, registration] of registrations.entries()) {
        const at = `registrations[${i}] (${registration.key || '?'})`;

        if (!registration.key?.trim()) {
            errors.push(`${at}: key is required.`);
        } else if (keys.has(registration.key)) {
            errors.push(`${at}: duplicate key "${registration.key}".`);
        } else {
            keys.add(registration.key);
        }

        if (!registration.name?.length) {
            errors.push(`${at}: name is required — it is what an installer sees in the register map.`);
        }

        if (!Number.isInteger(registration.address) || registration.address < 0) {
            errors.push(`${at}: address must be a non-negative integer.`);
            continue;
        }

        if (BIT_SPACES.has(registration.space) && registration.unit) {
            warnings.push(`${at}: unit "${registration.unit}" on a ${registration.space} is meaningless — a bit has no unit.`);
        }

        const span = modbusServerRegisterSpan(registration);
        if (span === undefined) {
            const {dataType} = registration as {dataType: EnergyAppModbusDataType};
            if (dataType === 'string') {
                errors.push(`${at}: dataType "string" needs a positive quantity — its length cannot be derived.`);
            } else {
                errors.push(`${at}: unknown dataType "${dataType}".`);
            }
            continue;
        }

        if (!BIT_SPACES.has(registration.space)) {
            const {dataType, scale} = registration as {dataType: EnergyAppModbusDataType; scale?: number};
            if (dataType === 'string' && scale !== undefined) {
                warnings.push(`${at}: scale is ignored on a string register.`);
            }
        }

        const from = registration.address;
        const to = from + span - 1;
        const inSpace = claimed.get(registration.space) ?? [];
        const clash = inSpace.find((r) => from <= r.to && to >= r.from);
        if (clash) {
            errors.push(
                `${at}: ${registration.space} range ${from}..${to} overlaps ${clash.at} (${clash.from}..${clash.to}).`,
            );
        }
        inSpace.push({from, to, at});
        claimed.set(registration.space, inSpace);
    }

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Like {@link validateModbusServerRegistrations}, but throws
 * {@link ModbusServerValidationError} when there are blocking errors. Warnings
 * never throw; the validated list is returned on success for chaining.
 *
 * @param registrations - The register map to check.
 * @returns The same list when it has no blocking errors.
 * @throws {ModbusServerValidationError} When validation produces any error.
 */
export function assertValidModbusServerRegistrations(
    registrations: EnyoModbusServerRegistration[],
): EnyoModbusServerRegistration[] {
    const {ok, errors} = validateModbusServerRegistrations(registrations);
    if (!ok) throw new ModbusServerValidationError(errors);
    return registrations;
}
