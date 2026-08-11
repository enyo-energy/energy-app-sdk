/**
 * Client-side validation for {@link EnyoDeviceTestResult}, plus the canonical
 * aggregation of per-device verdicts into the single outcome an onboarding guide
 * branches on.
 *
 * A device-test result is one of the few payloads in this SDK where the summary
 * and the detail can silently disagree — an outcome of
 * {@link EnyoDeviceTestOutcomeEnum.AppliancesCreated} with an empty `appliances`
 * array routes the installer to a success screen for appliances that do not
 * exist. These checks catch that at the boundary, before the host acts on it.
 *
 * `errors` mean the result is malformed; `warnings` are advisory. Use
 * {@link validateDeviceTestResult} for the non-throwing result, or
 * {@link assertValidDeviceTestResult} to throw on the first failure.
 */

import {
    EnyoDeviceTestApplianceDispositionEnum,
    EnyoDeviceTestOutcomeEnum,
} from '../../types/enyo-device-test.js';
import type {
    EnyoDeviceTestDeviceResult,
    EnyoDeviceTestRequest,
    EnyoDeviceTestResult,
} from '../../types/enyo-device-test.js';

/**
 * Thrown by {@link assertValidDeviceTestResult} when a result fails validation.
 * The message lists every blocking error so callers can surface them directly.
 */
export class DeviceTestValidationError extends Error {
    /** The individual blocking errors that caused the failure. */
    public readonly errors: string[];

    /**
     * @param errors - The blocking validation errors.
     */
    constructor(errors: string[]) {
        super(`Invalid device test result:\n- ${errors.join('\n- ')}`);
        this.name = 'DeviceTestValidationError';
        this.errors = errors;
    }
}

/** The outcome of validating a device-test result. */
export interface DeviceTestValidationResult {
    /** True when there are no blocking `errors` (warnings are still allowed). */
    ok: boolean;
    /** Blocking problems — the result is malformed. */
    errors: string[];
    /** Advisory problems — allowed, but usually worth fixing. */
    warnings: string[];
}

/**
 * Outcomes that mean the test produced no appliance, and for which a non-empty
 * `appliances` array is contradictory.
 */
const APPLIANCE_FREE_OUTCOMES: ReadonlySet<EnyoDeviceTestOutcomeEnum> = new Set([
    EnyoDeviceTestOutcomeEnum.DeviceConfirmedNoAppliance,
    EnyoDeviceTestOutcomeEnum.NotSupported,
    EnyoDeviceTestOutcomeEnum.Unreachable,
    EnyoDeviceTestOutcomeEnum.AuthenticationRequired,
    EnyoDeviceTestOutcomeEnum.AccessNotGranted,
    EnyoDeviceTestOutcomeEnum.UserActionRequired,
    EnyoDeviceTestOutcomeEnum.Failed,
]);

/**
 * Precedence used by {@link aggregateDeviceTestOutcome}, most significant first.
 *
 * Success dominates: one device yielding an appliance is a successful run even
 * when a sibling device was unreachable, because the installer's next step is
 * driven by what was achieved, not by what was also present on the network. Below
 * the successes, the outcomes the installer can *act on* (credentials, a button
 * to press, an access grant) outrank the ones they cannot, so a scan containing
 * one fixable device does not route to a dead end.
 */
const OUTCOME_PRECEDENCE: readonly EnyoDeviceTestOutcomeEnum[] = [
    EnyoDeviceTestOutcomeEnum.AppliancesCreated,
    EnyoDeviceTestOutcomeEnum.AppliancesAlreadyExisted,
    EnyoDeviceTestOutcomeEnum.DeviceConfirmedNoAppliance,
    EnyoDeviceTestOutcomeEnum.AuthenticationRequired,
    EnyoDeviceTestOutcomeEnum.UserActionRequired,
    EnyoDeviceTestOutcomeEnum.AccessNotGranted,
    EnyoDeviceTestOutcomeEnum.Unreachable,
    EnyoDeviceTestOutcomeEnum.Failed,
    EnyoDeviceTestOutcomeEnum.NotSupported,
];

/**
 * Reduces per-device verdicts to the single aggregate outcome an onboarding
 * guide branches on, following {@link OUTCOME_PRECEDENCE}.
 *
 * Prefer this over hand-rolling the aggregate: the precedence between a
 * partly-successful scan's outcomes is easy to get subtly wrong, and getting it
 * wrong sends the installer down the wrong branch.
 *
 * @param devices - The per-device results of a test.
 * @returns The aggregate outcome; {@link EnyoDeviceTestOutcomeEnum.Failed} when
 *   `devices` is empty, since a test that judged nothing did not succeed.
 *
 * @example
 * ```typescript
 * const outcome = aggregateDeviceTestOutcome(devices);
 * return {requestId: request.requestId, outcome, devices, appliances};
 * ```
 */
export function aggregateDeviceTestOutcome(
    devices: EnyoDeviceTestDeviceResult[],
): EnyoDeviceTestOutcomeEnum {
    if (!devices?.length) return EnyoDeviceTestOutcomeEnum.Failed;
    const present = new Set(devices.map((d) => d.outcome));
    for (const outcome of OUTCOME_PRECEDENCE) {
        if (present.has(outcome)) return outcome;
    }
    return EnyoDeviceTestOutcomeEnum.Failed;
}

/**
 * Checks that a device-test result is internally consistent and — when the
 * originating request is supplied — that it answers what was actually asked.
 *
 * @param result - The result the handler is about to return.
 * @param request - Optional originating request; enables cross-checks of
 *   `requestId` and device coverage.
 * @returns The {@link DeviceTestValidationResult}.
 *
 * @example
 * ```typescript
 * const {ok, errors} = validateDeviceTestResult(result, request);
 * if (!ok) console.warn('device test result is malformed', errors);
 * ```
 */
export function validateDeviceTestResult(
    result: EnyoDeviceTestResult,
    request?: EnyoDeviceTestRequest,
): DeviceTestValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!result) return {ok: false, errors: ['result is required.'], warnings};
    if (!result.requestId) errors.push('`requestId` is required.');
    if (request && result.requestId && result.requestId !== request.requestId) {
        errors.push(
            `\`requestId\` "${result.requestId}" does not match the request's "${request.requestId}".`,
        );
    }
    if (!result.outcome) errors.push('`outcome` is required.');

    const devices = result.devices ?? [];
    if (!devices.length) errors.push('`devices` must contain one entry per tested device.');

    const deviceIds = new Set<string>();
    for (const [i, device] of devices.entries()) {
        const at = `devices[${i}]`;
        if (!device.networkDeviceId) errors.push(`${at}: networkDeviceId is required.`);
        else if (deviceIds.has(device.networkDeviceId)) {
            errors.push(`${at}: duplicate networkDeviceId "${device.networkDeviceId}".`);
        } else {
            deviceIds.add(device.networkDeviceId);
        }
        if (!device.outcome) errors.push(`${at}: outcome is required.`);
    }

    if (request) {
        const requested = new Set((request.devices ?? []).map((d) => d.id));
        for (const id of deviceIds) {
            if (!requested.has(id)) errors.push(`devices: "${id}" was not part of the request.`);
        }
        for (const id of requested) {
            if (!deviceIds.has(id)) warnings.push(`no verdict reported for requested device "${id}".`);
        }
    }

    const appliances = result.appliances ?? [];
    const applianceIds = new Set<string>();
    for (const [i, appliance] of appliances.entries()) {
        const at = `appliances[${i}]`;
        if (!appliance.applianceId) errors.push(`${at}: applianceId is required.`);
        else if (applianceIds.has(appliance.applianceId)) {
            errors.push(`${at}: duplicate applianceId "${appliance.applianceId}".`);
        } else {
            applianceIds.add(appliance.applianceId);
        }
        if (!appliance.applianceType) errors.push(`${at}: applianceType is required.`);
        if (!appliance.disposition) errors.push(`${at}: disposition is required.`);
        if (!appliance.networkDeviceId) {
            errors.push(`${at}: networkDeviceId is required.`);
        } else if (deviceIds.size && !deviceIds.has(appliance.networkDeviceId)) {
            errors.push(`${at}: networkDeviceId "${appliance.networkDeviceId}" is not among the tested devices.`);
        }
    }

    const created = appliances.filter(
        (a) => a.disposition === EnyoDeviceTestApplianceDispositionEnum.Created,
    );

    if (result.outcome === EnyoDeviceTestOutcomeEnum.AppliancesCreated && !created.length) {
        errors.push('outcome is `appliances-created` but no appliance has disposition `created`.');
    }
    if (result.outcome === EnyoDeviceTestOutcomeEnum.AppliancesAlreadyExisted) {
        if (!appliances.length) {
            errors.push('outcome is `appliances-already-existed` but `appliances` is empty.');
        } else if (created.length) {
            errors.push(
                'outcome is `appliances-already-existed` but an appliance has disposition `created` — use `appliances-created`.',
            );
        }
    }
    if (appliances.length && APPLIANCE_FREE_OUTCOMES.has(result.outcome)) {
        errors.push(`outcome "${result.outcome}" reports appliances; that combination is contradictory.`);
    }

    if (devices.length && result.outcome) {
        const expected = aggregateDeviceTestOutcome(devices);
        if (expected !== result.outcome) {
            warnings.push(
                `aggregate outcome "${result.outcome}" differs from the per-device aggregate "${expected}"; consider aggregateDeviceTestOutcome().`,
            );
        }
    }

    if (
        !result.message?.length &&
        (result.outcome === EnyoDeviceTestOutcomeEnum.UserActionRequired ||
            result.outcome === EnyoDeviceTestOutcomeEnum.AuthenticationRequired)
    ) {
        warnings.push(
            `outcome "${result.outcome}" asks the installer to act but carries no translated \`message\`.`,
        );
    }

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Like {@link validateDeviceTestResult}, but throws
 * {@link DeviceTestValidationError} when there are blocking errors. Warnings
 * never throw; the validated result is returned on success for chaining.
 *
 * @param result - The result to validate.
 * @param request - Optional originating request; enables cross-checks.
 * @returns The same result when it has no blocking errors.
 * @throws {DeviceTestValidationError} When validation produces any error.
 */
export function assertValidDeviceTestResult(
    result: EnyoDeviceTestResult,
    request?: EnyoDeviceTestRequest,
): EnyoDeviceTestResult {
    const {ok, errors} = validateDeviceTestResult(result, request);
    if (!ok) throw new DeviceTestValidationError(errors);
    return result;
}
