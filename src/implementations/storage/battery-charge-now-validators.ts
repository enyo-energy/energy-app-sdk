import {
    EnyoBatteryChargeNowStateEnum,
    EnyoBatteryChargeNowStopReasonEnum,
    EnyoDataBusRequestBatteryChargeNowV1,
} from '../../types/enyo-data-bus-value.js';
import {EnyoBatteryApplianceMetadata, EnyoBatteryFeature} from '../../types/enyo-battery-appliance.js';

/** Target SoC in percent a `RequestBatteryChargeNowV1` charges to when it names none. */
export const DEFAULT_BATTERY_CHARGE_NOW_TARGET_SOC_PERCENT = 100;

/**
 * Outcome of {@link validateBatteryChargeNowRequest}: whether an energy manager
 * should take a `RequestBatteryChargeNowV1` on, and the target it charges to.
 */
export interface BatteryChargeNowValidationResult {
    /** {@link EnyoBatteryChargeNowStateEnum.Accepted} or {@link EnyoBatteryChargeNowStateEnum.Rejected}. */
    state: EnyoBatteryChargeNowStateEnum.Accepted | EnyoBatteryChargeNowStateEnum.Rejected;
    /** Why the request is rejected. Set exactly when {@link state} is `Rejected`. */
    stopReason?: EnyoBatteryChargeNowStopReasonEnum;
    /**
     * The SoC in percent to charge to: the requested target (default
     * {@link DEFAULT_BATTERY_CHARGE_NOW_TARGET_SOC_PERCENT}), lowered to the
     * battery's `maxSoC` when that is lower. Absent when the request is
     * malformed.
     */
    effectiveTargetSocPercent?: number;
}

/**
 * Validates a `RequestBatteryChargeNowV1` against the battery's metadata and
 * current state of charge, and returns whether an energy manager should accept
 * it — the answer to publish as the first `BatteryChargeNowStatusV1`.
 *
 * Rules, in order — the first that fails decides:
 * 1. `targetSocPercent`, when given, is a finite number from 1 to 100, and
 *    `maxDurationMinutes`, when given, is a finite positive number
 *    (**InvalidRequest**).
 * 2. The battery's metadata sets `controlAllowed: false`, or lists `features`
 *    without {@link EnyoBatteryFeature.ManualCharge} (**ControlNotAllowed**).
 *    A battery without a `features` list is not rejected, since the list is
 *    optional.
 * 3. The current SoC is at or above the effective target (**AlreadyAtTarget**).
 *
 * Without metadata only rule 1 and, given the SoC, rule 3 are checked. Runtime
 * conditions the metadata cannot tell — the battery being offline, battery
 * control switched off in the energy manager settings, no PV surplus for a
 * battery without grid charging — are left to the energy manager.
 *
 * @param message - The request to validate.
 * @param metadata - The battery's metadata, if known.
 * @param currentSocPercent - The battery's current state of charge in percent, if known.
 * @returns `Accepted` with the effective target when every rule holds, otherwise `Rejected` with the reason.
 */
export function validateBatteryChargeNowRequest(
    message: EnyoDataBusRequestBatteryChargeNowV1,
    metadata?: EnyoBatteryApplianceMetadata,
    currentSocPercent?: number,
): BatteryChargeNowValidationResult {
    const {targetSocPercent, maxDurationMinutes} = message.data;

    const targetValid = targetSocPercent === undefined
        || (Number.isFinite(targetSocPercent) && targetSocPercent >= 1 && targetSocPercent <= 100);
    const durationValid = maxDurationMinutes === undefined
        || (Number.isFinite(maxDurationMinutes) && maxDurationMinutes > 0);
    if (!targetValid || !durationValid) {
        return reject(EnyoBatteryChargeNowStopReasonEnum.InvalidRequest);
    }

    const effectiveTargetSocPercent = resolveBatteryChargeNowTargetSoc(targetSocPercent, metadata);

    if (metadata) {
        const lacksManualCharge = metadata.features !== undefined
            && !metadata.features.includes(EnyoBatteryFeature.ManualCharge);
        if (metadata.controlAllowed === false || lacksManualCharge) {
            return reject(EnyoBatteryChargeNowStopReasonEnum.ControlNotAllowed, effectiveTargetSocPercent);
        }
    }

    if (currentSocPercent !== undefined && Number.isFinite(currentSocPercent)
        && currentSocPercent >= effectiveTargetSocPercent) {
        return reject(EnyoBatteryChargeNowStopReasonEnum.AlreadyAtTarget, effectiveTargetSocPercent);
    }

    return {state: EnyoBatteryChargeNowStateEnum.Accepted, effectiveTargetSocPercent};
}

/**
 * The SoC in percent a `RequestBatteryChargeNowV1` actually charges to: the
 * requested target (default {@link DEFAULT_BATTERY_CHARGE_NOW_TARGET_SOC_PERCENT}),
 * lowered to the battery's `maxSoC` when that is lower.
 *
 * @param targetSocPercent - The request's `targetSocPercent`, if given.
 * @param metadata - The battery's metadata, if known.
 * @returns The effective target SoC in percent.
 */
export function resolveBatteryChargeNowTargetSoc(
    targetSocPercent: number | undefined,
    metadata?: EnyoBatteryApplianceMetadata,
): number {
    const requested = targetSocPercent ?? DEFAULT_BATTERY_CHARGE_NOW_TARGET_SOC_PERCENT;
    const maxSoC = metadata?.maxSoC;
    return maxSoC !== undefined && Number.isFinite(maxSoC) ? Math.min(requested, maxSoC) : requested;
}

/**
 * Builds a rejected {@link BatteryChargeNowValidationResult}.
 *
 * @param stopReason - Why the request is rejected.
 * @param effectiveTargetSocPercent - The effective target, when it could be resolved.
 * @returns The rejected result.
 */
function reject(
    stopReason: EnyoBatteryChargeNowStopReasonEnum,
    effectiveTargetSocPercent?: number,
): BatteryChargeNowValidationResult {
    return {state: EnyoBatteryChargeNowStateEnum.Rejected, stopReason, effectiveTargetSocPercent};
}
