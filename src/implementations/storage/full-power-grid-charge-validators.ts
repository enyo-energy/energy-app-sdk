import {
    EnyoCommandAcknowledgeAnswerEnum,
    EnyoDataBusSetStorageControlV2,
    EnyoDataBusSetStorageScheduleV1,
    EnyoStorageControlDirectionEnum,
    EnyoStorageControlModeEnum,
    EnyoStorageScheduleDirectionEnum,
    EnyoStorageScheduleModeEnum,
} from '../../types/enyo-data-bus-value.js';
import {EnyoBatteryApplianceMetadata, EnyoBatteryFeature} from '../../types/enyo-battery-appliance.js';

/**
 * What a {@link EnyoBatteryFeature.GridChargeFullPowerOnly} battery should do for an accepted
 * storage command or schedule entry.
 */
export enum FullPowerGridChargeActionEnum {
    /** Start (or keep running) the full-power grid charge. */
    StartGridCharge = 'start-grid-charge',
    /**
     * Hand the battery back to its own logic. Stops a running charge only when the battery
     * declares {@link EnyoBatteryFeature.GridChargeFullPowerStoppable}; otherwise the charge
     * runs on until the battery is full.
     */
    Release = 'release',
}

/**
 * Outcome of {@link validateFullPowerGridChargeControl} and
 * {@link validateFullPowerGridChargeSchedule}: the answer to send in the
 * `CommandAcknowledgeV1`, and what to do when the command is accepted.
 */
export interface FullPowerGridChargeValidationResult {
    /** {@link EnyoCommandAcknowledgeAnswerEnum.Accepted} or {@link EnyoCommandAcknowledgeAnswerEnum.NotSupported}. */
    answer: EnyoCommandAcknowledgeAnswerEnum.Accepted | EnyoCommandAcknowledgeAnswerEnum.NotSupported;
    /**
     * The action to take for an accepted `SetStorageControlV2`, or for an accepted
     * `SetStorageScheduleV1` in `Auto` mode. Absent when the command is not supported, and for a
     * schedule in `Schedule` mode, which uses {@link scheduleActions}.
     */
    action?: FullPowerGridChargeActionEnum;
    /**
     * For an accepted `SetStorageScheduleV1` in `Schedule` mode: the action for each entry of
     * the relative schedule, by index.
     */
    scheduleActions?: FullPowerGridChargeActionEnum[];
    /** Why the command is not supported, for `rejectionReason`. Set exactly when {@link answer} is `NotSupported`. */
    rejectionReason?: string;
}

/**
 * Whether the battery declares {@link EnyoBatteryFeature.GridChargeFullPowerOnly}, i.e. it can
 * only be charged from the grid at full power and has no other control.
 *
 * @param metadata - The battery's metadata, if known.
 * @returns `true` when the feature is declared.
 */
export function isFullPowerGridChargeOnly(metadata?: EnyoBatteryApplianceMetadata): boolean {
    return metadata?.features?.includes(EnyoBatteryFeature.GridChargeFullPowerOnly) ?? false;
}

/**
 * Whether a full-power grid charge of the battery can be ended early, i.e. it declares both
 * {@link EnyoBatteryFeature.GridChargeFullPowerOnly} and
 * {@link EnyoBatteryFeature.GridChargeFullPowerStoppable}. When `false`, an energy manager must
 * plan every started charge as a charge to 100 % SoC.
 *
 * @param metadata - The battery's metadata, if known.
 * @returns `true` when a running charge stops on `Auto` / `Idle`.
 */
export function isFullPowerGridChargeStoppable(metadata?: EnyoBatteryApplianceMetadata): boolean {
    return isFullPowerGridChargeOnly(metadata)
        && (metadata?.features?.includes(EnyoBatteryFeature.GridChargeFullPowerStoppable) ?? false);
}

/**
 * Checks a `SetStorageControlV2` against the {@link EnyoBatteryFeature.GridChargeFullPowerOnly}
 * contract, and returns the answer for the `CommandAcknowledgeV1` and the action to take.
 *
 * Used by the battery integration to answer the command, and by an energy manager to check a
 * command before sending it.
 *
 * Accepted:
 * - `Auto` → {@link FullPowerGridChargeActionEnum.Release}.
 * - `Controlled` + `Charge` with `powerW` of at least `maxChargingPowerW` →
 *   {@link FullPowerGridChargeActionEnum.StartGridCharge}.
 *
 * `NotSupported`: a battery without the feature or without a positive `maxChargingPowerW`,
 * `Controlled` without a `control`, `Hold`, `Discharge`, and any `Charge` below full power
 * (including `powerW = 0`).
 *
 * @param message - The command to check.
 * @param metadata - The battery's metadata.
 * @returns `Accepted` with the action, or `NotSupported` with the reason.
 */
export function validateFullPowerGridChargeControl(
    message: EnyoDataBusSetStorageControlV2,
    metadata: EnyoBatteryApplianceMetadata | undefined,
): FullPowerGridChargeValidationResult {
    const capabilityError = checkCapability(metadata);
    if (capabilityError) {
        return notSupported(capabilityError);
    }
    if (message.data.mode === EnyoStorageControlModeEnum.Auto) {
        return accepted(FullPowerGridChargeActionEnum.Release);
    }
    const control = message.data.control;
    if (!control) {
        return notSupported('Controlled mode without a control setpoint.');
    }
    if (control.direction !== EnyoStorageControlDirectionEnum.Charge) {
        return notSupported(`Direction ${control.direction} is not supported: the battery can only charge from the grid at full power.`);
    }
    const chargeError = checkFullPower(control.powerW, metadata!);
    return chargeError ? notSupported(chargeError) : accepted(FullPowerGridChargeActionEnum.StartGridCharge);
}

/**
 * Checks a `SetStorageScheduleV1` against the {@link EnyoBatteryFeature.GridChargeFullPowerOnly}
 * contract, and returns the answer for the `CommandAcknowledgeV1` and the action for each entry.
 *
 * Accepted:
 * - `Auto` → {@link FullPowerGridChargeActionEnum.Release} in {@link FullPowerGridChargeValidationResult.action}.
 * - `Schedule` whose entries are all either `Idle` (→ `Release`) or `Charge` with `powerW` of at
 *   least `maxChargingPowerW` (→ `StartGridCharge`). The actions are returned per entry in
 *   {@link FullPowerGridChargeValidationResult.scheduleActions}.
 *
 * `NotSupported`: a battery without the feature or without a positive `maxChargingPowerW`, an
 * empty schedule, and a schedule with any `Discharge` entry or `Charge` entry below full power
 * (including `powerW = 0`). One unsupported entry makes the whole schedule unsupported, so the
 * battery never runs half of a plan.
 *
 * @param message - The schedule to check.
 * @param metadata - The battery's metadata.
 * @returns `Accepted` with the actions, or `NotSupported` with the reason.
 */
export function validateFullPowerGridChargeSchedule(
    message: EnyoDataBusSetStorageScheduleV1,
    metadata: EnyoBatteryApplianceMetadata | undefined,
): FullPowerGridChargeValidationResult {
    const capabilityError = checkCapability(metadata);
    if (capabilityError) {
        return notSupported(capabilityError);
    }
    if (message.data.mode === EnyoStorageScheduleModeEnum.Auto) {
        return accepted(FullPowerGridChargeActionEnum.Release);
    }
    const entries = message.data.relativeSchedule ?? [];
    if (entries.length === 0) {
        return notSupported('Schedule mode without schedule entries.');
    }
    const scheduleActions: FullPowerGridChargeActionEnum[] = [];
    for (const [index, entry] of entries.entries()) {
        if (entry.direction === EnyoStorageScheduleDirectionEnum.Idle) {
            scheduleActions.push(FullPowerGridChargeActionEnum.Release);
            continue;
        }
        if (entry.direction !== EnyoStorageScheduleDirectionEnum.Charge) {
            return notSupported(`Entry ${index}: direction ${entry.direction} is not supported: the battery can only charge from the grid at full power.`);
        }
        const chargeError = checkFullPower(entry.powerW, metadata!);
        if (chargeError) {
            return notSupported(`Entry ${index}: ${chargeError}`);
        }
        scheduleActions.push(FullPowerGridChargeActionEnum.StartGridCharge);
    }
    return {answer: EnyoCommandAcknowledgeAnswerEnum.Accepted, scheduleActions};
}

/**
 * Checks that the battery declares the feature and a usable `maxChargingPowerW`.
 *
 * @param metadata - The battery's metadata.
 * @returns The reason the battery cannot take full-power grid charge commands, or `undefined`.
 */
function checkCapability(metadata: EnyoBatteryApplianceMetadata | undefined): string | undefined {
    if (!isFullPowerGridChargeOnly(metadata)) {
        return `The battery does not declare ${EnyoBatteryFeature.GridChargeFullPowerOnly}.`;
    }
    const maxChargingPowerW = metadata!.maxChargingPowerW;
    if (maxChargingPowerW === undefined || !Number.isFinite(maxChargingPowerW) || maxChargingPowerW <= 0) {
        return 'The battery declares no positive maxChargingPowerW.';
    }
    return undefined;
}

/**
 * Checks that a charge setpoint asks for full power.
 *
 * @param powerW - The requested charge power in Watts.
 * @param metadata - The battery's metadata, already checked by {@link checkCapability}.
 * @returns The reason the setpoint is not supported, or `undefined`.
 */
function checkFullPower(powerW: number, metadata: EnyoBatteryApplianceMetadata): string | undefined {
    const maxChargingPowerW = metadata.maxChargingPowerW!;
    if (!Number.isFinite(powerW) || powerW < maxChargingPowerW) {
        return `Charge at ${powerW} W is not supported: the battery can only charge at full power (${maxChargingPowerW} W).`;
    }
    return undefined;
}

/**
 * Builds an accepted {@link FullPowerGridChargeValidationResult}.
 *
 * @param action - The action to take.
 * @returns The accepted result.
 */
function accepted(action: FullPowerGridChargeActionEnum): FullPowerGridChargeValidationResult {
    return {answer: EnyoCommandAcknowledgeAnswerEnum.Accepted, action};
}

/**
 * Builds a not-supported {@link FullPowerGridChargeValidationResult}.
 *
 * @param rejectionReason - Why the command is not supported.
 * @returns The not-supported result.
 */
function notSupported(rejectionReason: string): FullPowerGridChargeValidationResult {
    return {answer: EnyoCommandAcknowledgeAnswerEnum.NotSupported, rejectionReason};
}
