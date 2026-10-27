import {
    EnyoCommandAcknowledgeActionResult,
    EnyoCommandAcknowledgeAnswerEnum,
    EnyoDataBusHeatpumpFlexibilityAnnouncementV3,
    EnyoDataBusHeatpumpProgramSwitchV3,
    EnyoDataBusSetHeatpumpHeatingCurveOffsetV1,
    EnyoHeatpumpControlAction,
    EnyoHeatpumpControlTargetEnum,
    EnyoHeatpumpHeatSourceEnum,
    EnyoPowerSourceEnum,
    EnyoPowerSourceShare,
} from '../../types/enyo-data-bus-value.js';
import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum,
    EnyoHeatpumpApplianceMetadata,
    EnyoHeatpumpOverrideProgramMode,
    EnyoHeatpumpProgramModeEnum,
} from '../../types/enyo-heatpump-appliance.js';

/**
 * The overheating feature each `HeatpumpControlV3` target needs — and that a
 * `HeatpumpFlexibilityAnnouncementV3` option for that target needs to be
 * actionable.
 */
export const HEATPUMP_CONTROL_TARGET_FEATURE: Readonly<Record<EnyoHeatpumpControlTargetEnum, EnyoHeatpumpApplianceAvailableFeaturesEnum>> = {
    [EnyoHeatpumpControlTargetEnum.Dhw]: EnyoHeatpumpApplianceAvailableFeaturesEnum.DomesticHotWaterOverheating,
    [EnyoHeatpumpControlTargetEnum.BufferTank]: EnyoHeatpumpApplianceAvailableFeaturesEnum.BufferTankOverheating,
    [EnyoHeatpumpControlTargetEnum.Room]: EnyoHeatpumpApplianceAvailableFeaturesEnum.RoomOverheating,
};

/**
 * Whether a session's power sources consist of PV alone — the only case in
 * which a heating rod may run.
 *
 * @param powerSources - The session's `powerSources`.
 * @returns `true` when at least one share is given and every share is PV.
 */
export function isPvOnlyPowerSources(powerSources: EnyoPowerSourceShare[] | undefined): boolean {
    return !!powerSources
        && powerSources.length > 0
        && powerSources.every((share) => share.source === EnyoPowerSourceEnum.Pv);
}

/**
 * Validates one action of a `HeatpumpControlV3` session against the
 * heatpump's metadata and the session's power sources, and returns the answer
 * the action deserves.
 *
 * Used by `HeatpumpIntegrationEnergyApp` before it calls any handler; an
 * integration that overrides `handleHeatpumpControl` can call it itself.
 *
 * Rules, in order — the first that fails decides:
 * 1. `target` is an {@link EnyoHeatpumpControlTargetEnum} member, and
 *    `deltaK`, when given, is a finite positive number (**Rejected**).
 * 2. `heatSource` is `HeatingRod` or `Both` but `powerSources` are missing or
 *    not PV alone — the rod runs on PV surplus only (**Rejected**).
 * 3. `heatSource` is `HeatingRod` or `Both` but the heatpump does not declare
 *    `HeatingRodControllable` (**NotSupported**).
 * 4. The heatpump does not declare the target's overheating feature
 *    (`DomesticHotWaterOverheating`, `BufferTankOverheating`,
 *    `RoomOverheating`) (**NotSupported**).
 * 5. The metadata lists zones for the target but none with the action's
 *    `index` (**Rejected**).
 * 6. For a DHW action: the zone's `targetTemperatureC + deltaK` exceeds its
 *    `maxTemperatureC` (**Rejected**). Skipped when either value is unknown.
 *
 * 7. When an `offer` is given (the heatpump's current
 *    `HeatpumpFlexibilityAnnouncementV3`): the action's zone is offered,
 *    its `deltaK` does not exceed the offered `maxDeltaK`, and its
 *    `heatSource` is among the offered sources — `Both` needs both
 *    (**Rejected**). Zones match on `target` and `index`, an omitted index
 *    counting as `0`.
 *
 * Without metadata only rules 1, 2 and 7 can be checked.
 *
 * @param action - The action to validate.
 * @param metadata - The heatpump's metadata, if known.
 * @param powerSources - The session's `powerSources`.
 * @param offer - The heatpump's current offer, when the session answers one.
 * @returns The action's result: `Accepted` when every rule holds.
 *
 * @example
 * ```typescript
 * const result = validateHeatpumpControlAction(
 *     {target: EnyoHeatpumpControlTargetEnum.Dhw, index: 0, deltaK: 8},
 *     appliance.heatpump,
 *     message.data.powerSources,
 * );
 * if (result.answer !== EnyoCommandAcknowledgeAnswerEnum.Accepted) console.warn(result.rejectionReason);
 * ```
 */
export function validateHeatpumpControlAction(
    action: EnyoHeatpumpControlAction,
    metadata: EnyoHeatpumpApplianceMetadata | undefined,
    powerSources: EnyoPowerSourceShare[] | undefined,
    offer?: EnyoDataBusHeatpumpFlexibilityAnnouncementV3['data'],
): EnyoCommandAcknowledgeActionResult {
    const result = (answer: EnyoCommandAcknowledgeAnswerEnum, rejectionReason?: string): EnyoCommandAcknowledgeActionResult => ({
        target: action.target,
        ...(action.index !== undefined ? {index: action.index} : {}),
        answer,
        ...(rejectionReason !== undefined ? {rejectionReason} : {}),
    });
    const rejected = (reason: string) => result(EnyoCommandAcknowledgeAnswerEnum.Rejected, reason);
    const notSupported = (reason: string) => result(EnyoCommandAcknowledgeAnswerEnum.NotSupported, reason);

    if (!Object.values(EnyoHeatpumpControlTargetEnum).includes(action.target)) {
        return rejected(`Unknown control target "${action.target}".`);
    }
    if (action.deltaK !== undefined && (!Number.isFinite(action.deltaK) || action.deltaK <= 0)) {
        return rejected(`deltaK must be a finite positive number of Kelvin; got ${action.deltaK}.`);
    }

    const usesRod = action.heatSource === EnyoHeatpumpHeatSourceEnum.HeatingRod
        || action.heatSource === EnyoHeatpumpHeatSourceEnum.Both;
    if (usesRod && !isPvOnlyPowerSources(powerSources)) {
        return rejected(
            `heatSource "${action.heatSource}" may only run on PV surplus, but powerSources are not PV alone.`,
        );
    }

    if (offer) {
        const option = offer.options.find(
            (o) => o.target === action.target && (o.index ?? 0) === (action.index ?? 0),
        );
        if (!option) {
            return rejected(`Offer ${offer.offerId} does not offer ${action.target} zone ${action.index ?? 0}.`);
        }
        if (action.deltaK !== undefined && action.deltaK > option.maxDeltaK) {
            return rejected(
                `deltaK ${action.deltaK} K exceeds the offered maxDeltaK of ${option.maxDeltaK} K (offer ${offer.offerId}).`,
            );
        }
        const offered = new Set(option.heatSources.map((h) => h.heatSource));
        const needed = action.heatSource === EnyoHeatpumpHeatSourceEnum.Both
            ? [EnyoHeatpumpHeatSourceEnum.Compressor, EnyoHeatpumpHeatSourceEnum.HeatingRod]
            : action.heatSource !== undefined ? [action.heatSource] : [];
        const missing = needed.filter((h) => !offered.has(h as EnyoHeatpumpHeatSourceEnum.Compressor));
        if (missing.length > 0) {
            return rejected(`heatSource "${action.heatSource}" was not offered (offer ${offer.offerId}).`);
        }
    }

    if (!metadata) return result(EnyoCommandAcknowledgeAnswerEnum.Accepted);
    const features = metadata.availableFeatures ?? [];

    if (usesRod && !features.includes(EnyoHeatpumpApplianceAvailableFeaturesEnum.HeatingRodControllable)) {
        return notSupported('The heatpump\'s heating rod cannot be controlled (no HeatingRodControllable).');
    }
    const feature = HEATPUMP_CONTROL_TARGET_FEATURE[action.target];
    if (!features.includes(feature)) {
        return notSupported(`The heatpump does not support ${action.target} overheating (no ${feature}).`);
    }

    const zones: Array<{index: number}> | undefined = action.target === EnyoHeatpumpControlTargetEnum.Dhw
        ? metadata.domesticHotWater
        : action.target === EnyoHeatpumpControlTargetEnum.BufferTank
            ? metadata.bufferTanks
            : metadata.heatingCircuits;
    const zone = zones && zones.length > 0
        ? (action.index === undefined ? zones[0] : zones.find((z) => z.index === action.index))
        : undefined;
    if (zones && zones.length > 0 && !zone) {
        return rejected(`No ${action.target} zone with index ${action.index}.`);
    }

    if (action.target === EnyoHeatpumpControlTargetEnum.Dhw && zone && action.deltaK !== undefined) {
        const dhw = zone as NonNullable<EnyoHeatpumpApplianceMetadata['domesticHotWater']>[number];
        if (dhw.maxTemperatureC !== undefined && Number.isFinite(dhw.targetTemperatureC)) {
            const raised = dhw.targetTemperatureC + action.deltaK;
            if (raised > dhw.maxTemperatureC) {
                return rejected(
                    `Raising DHW zone ${dhw.index} from ${dhw.targetTemperatureC} °C by ${action.deltaK} K ` +
                        `gives ${raised} °C, above its maxTemperatureC of ${dhw.maxTemperatureC} °C.`,
                );
            }
        }
    }

    return result(EnyoCommandAcknowledgeAnswerEnum.Accepted);
}

/** Input of {@link computeHeatpumpSetpointRaise}. */
export interface HeatpumpSetpointRaiseInput {
    /** The zone's current setpoint, in °C. */
    setpointC: number;
    /** The raise the action asks for, in Kelvin. */
    deltaK: number;
    /** The zone's measured temperature now, in °C. Without it the hysteresis rule cannot apply. */
    currentTemperatureC?: number;
    /**
     * How far the temperature must fall below the setpoint before the device
     * starts heating, in Kelvin (`hysteresisK` of the DHW zone or buffer tank).
     */
    hysteresisK?: number;
    /** The highest setpoint allowed, in °C (e.g. `maxTemperatureC` of the DHW zone). */
    maxTemperatureC?: number;
}

/** Result of {@link computeHeatpumpSetpointRaise}. */
export type HeatpumpSetpointRaiseResult =
    | {
        ok: true;
        /** The setpoint to write, in °C. */
        targetTemperatureC: number;
        /** The effective raise above the current setpoint, in Kelvin — at least the requested `deltaK`. */
        appliedDeltaK: number;
    }
    | {
        ok: false;
        /** Why no setpoint makes the device start heating within the limits. */
        rejectionReason: string;
    };

/**
 * Computes the setpoint a setpoint-only heatpump needs to **start heating a
 * zone now** for a `HeatpumpControlV3` action — the rule every integration
 * applies the same way.
 *
 * Such a device only heats once the temperature is a hysteresis below the
 * setpoint. So the setpoint written is the larger of
 * - `setpointC + deltaK` (what the energy manager asked for), and
 * - `currentTemperatureC + hysteresisK` (what makes the device start),
 *
 * and must not exceed `maxTemperatureC`. When the requested raise alone
 * exceeds the maximum, or the maximum leaves no setpoint high enough to start
 * the device, the action cannot work and is to be answered `Rejected`.
 *
 * @param input - Setpoint, requested raise, and the zone's state and limits.
 * @returns The setpoint to write and the effective raise, or why it cannot work.
 *
 * @example
 * ```typescript
 * // Setpoint 50 °C, hysteresis 5 K, max 60 °C, energy manager asks +2 K.
 * // Tank at 44 °C: 50 + 2 = 52 °C is above 44 + 5 = 49 °C, so the request alone starts it.
 * computeHeatpumpSetpointRaise({setpointC: 50, deltaK: 2, currentTemperatureC: 44, hysteresisK: 5, maxTemperatureC: 60});
 * // → {ok: true, targetTemperatureC: 52, appliedDeltaK: 2}
 *
 * // Tank at 49 °C: the device only starts at 49 + 5 = 54 °C, so the raise grows to +4 K.
 * computeHeatpumpSetpointRaise({setpointC: 50, deltaK: 2, currentTemperatureC: 49, hysteresisK: 5, maxTemperatureC: 60});
 * // → {ok: true, targetTemperatureC: 54, appliedDeltaK: 4}
 * ```
 */
export function computeHeatpumpSetpointRaise(input: HeatpumpSetpointRaiseInput): HeatpumpSetpointRaiseResult {
    const {setpointC, deltaK, currentTemperatureC, hysteresisK, maxTemperatureC} = input;
    if (!Number.isFinite(setpointC) || !Number.isFinite(deltaK) || deltaK <= 0) {
        return {ok: false, rejectionReason: `A finite setpoint and a positive deltaK are needed; got ${setpointC} °C and ${deltaK} K.`};
    }
    const requested = setpointC + deltaK;
    const trigger = currentTemperatureC !== undefined && hysteresisK !== undefined
        ? currentTemperatureC + hysteresisK
        : -Infinity;
    const target = Math.max(requested, trigger);

    if (maxTemperatureC !== undefined && target > maxTemperatureC) {
        return {
            ok: false,
            rejectionReason: requested > maxTemperatureC
                ? `Raising ${setpointC} °C by ${deltaK} K gives ${requested} °C, above the maximum of ${maxTemperatureC} °C.`
                : `Starting the device needs a setpoint of ${trigger} °C (${currentTemperatureC} °C + ` +
                    `${hysteresisK} K hysteresis), above the maximum of ${maxTemperatureC} °C.`,
        };
    }
    return {ok: true, targetTemperatureC: target, appliedDeltaK: target - setpointC};
}

/**
 * How far ahead `untilIso` of a `HeatpumpProgramSwitchV3` to `Comfort` or
 * `Eco` may lie, in minutes. Bounds how long a zone stays switched when the
 * energy manager stops re-sending (e.g. after a restart).
 */
export const HEATPUMP_PROGRAM_SWITCH_MAX_MINUTES = 30;

/**
 * Clock-skew tolerance on top of {@link HEATPUMP_PROGRAM_SWITCH_MAX_MINUTES},
 * in seconds, so an `untilIso` sent exactly 30 min ahead is not rejected
 * because the two clocks differ slightly.
 */
export const HEATPUMP_PROGRAM_SWITCH_CLOCK_TOLERANCE_SECONDS = 60;

/** The answer {@link validateHeatpumpProgramSwitch} gives a `HeatpumpProgramSwitchV3`. */
export interface HeatpumpProgramSwitchValidationResult {
    /** `Accepted` when every rule holds. */
    answer: EnyoCommandAcknowledgeAnswerEnum;
    /** Why the switch was rejected or is not supported. */
    rejectionReason?: string;
}

/**
 * Validates a `HeatpumpProgramSwitchV3` against the heatpump's metadata and
 * returns the answer it deserves.
 *
 * Used by `HeatpumpIntegrationEnergyApp` before it calls
 * `handleHeatpumpProgramSwitch`; an integration handling the message itself
 * can call it too.
 *
 * Rules, in order — the first that fails decides:
 * 1. `target` is `Room` or `Dhw`, and `mode` is an
 *    {@link EnyoHeatpumpProgramModeEnum} member (**Rejected**).
 * 2. For `Comfort` / `Eco`: `untilIso` is an ISO 8601 timestamp in the future
 *    and at most {@link HEATPUMP_PROGRAM_SWITCH_MAX_MINUTES} minutes ahead
 *    (plus {@link HEATPUMP_PROGRAM_SWITCH_CLOCK_TOLERANCE_SECONDS})
 *    (**Rejected**).
 * 3. The heatpump does not declare `ProgramSwitch` (**NotSupported**).
 * 4. The metadata lists zones for the target but none with the message's
 *    `index` (**Rejected**).
 * 5. For `Comfort` / `Eco`: the zone does not list the mode in
 *    `supportedProgramModes` (**NotSupported**).
 *
 * Without metadata only rules 1 and 2 can be checked.
 *
 * @param data - The message's data.
 * @param metadata - The heatpump's metadata, if known.
 * @param nowMs - The current time in epoch milliseconds; injectable for tests.
 * @returns The answer: `Accepted` when every rule holds.
 *
 * @example
 * ```typescript
 * const result = validateHeatpumpProgramSwitch(message.data, appliance.heatpump);
 * if (result.answer !== EnyoCommandAcknowledgeAnswerEnum.Accepted) console.warn(result.rejectionReason);
 * ```
 */
export function validateHeatpumpProgramSwitch(
    data: EnyoDataBusHeatpumpProgramSwitchV3['data'],
    metadata: EnyoHeatpumpApplianceMetadata | undefined,
    nowMs: number = Date.now(),
): HeatpumpProgramSwitchValidationResult {
    const rejected = (rejectionReason: string) => ({answer: EnyoCommandAcknowledgeAnswerEnum.Rejected, rejectionReason});
    const notSupported = (rejectionReason: string) => ({answer: EnyoCommandAcknowledgeAnswerEnum.NotSupported, rejectionReason});

    if (data.target !== EnyoHeatpumpControlTargetEnum.Room && data.target !== EnyoHeatpumpControlTargetEnum.Dhw) {
        return rejected(`Only room and dhw zones can be switched; got "${data.target}".`);
    }
    if (!Object.values(EnyoHeatpumpProgramModeEnum).includes(data.mode)) {
        return rejected(`Unknown program mode "${data.mode}".`);
    }
    const isOverride = data.mode !== EnyoHeatpumpProgramModeEnum.Program;
    if (isOverride) {
        const untilMs = data.untilIso !== undefined ? Date.parse(data.untilIso) : Number.NaN;
        if (!Number.isFinite(untilMs)) {
            return rejected(`A switch to ${data.mode} needs untilIso as an ISO 8601 timestamp; got ${data.untilIso}.`);
        }
        if (untilMs <= nowMs) {
            return rejected(`untilIso ${data.untilIso} has already passed.`);
        }
        const maxMs = nowMs + HEATPUMP_PROGRAM_SWITCH_MAX_MINUTES * 60_000 + HEATPUMP_PROGRAM_SWITCH_CLOCK_TOLERANCE_SECONDS * 1000;
        if (untilMs > maxMs) {
            return rejected(
                `untilIso ${data.untilIso} is more than ${HEATPUMP_PROGRAM_SWITCH_MAX_MINUTES} min ahead; ` +
                    're-send the switch instead of sending a far-off untilIso.',
            );
        }
    }

    if (!metadata) return {answer: EnyoCommandAcknowledgeAnswerEnum.Accepted};
    if (!(metadata.availableFeatures ?? []).includes(EnyoHeatpumpApplianceAvailableFeaturesEnum.ProgramSwitch)) {
        return notSupported('The heatpump does not support program switches (no ProgramSwitch).');
    }

    const zones = data.target === EnyoHeatpumpControlTargetEnum.Dhw ? metadata.domesticHotWater : metadata.heatingCircuits;
    const zone = zones && zones.length > 0
        ? (data.index === undefined ? zones[0] : zones.find((z) => z.index === data.index))
        : undefined;
    if (zones && zones.length > 0 && !zone) {
        return rejected(`No ${data.target} zone with index ${data.index}.`);
    }
    if (isOverride && !(zone?.supportedProgramModes ?? []).includes(data.mode as EnyoHeatpumpOverrideProgramMode)) {
        return notSupported(`The ${data.target} zone ${zone?.index ?? data.index ?? 0} cannot be switched to ${data.mode}.`);
    }
    return {answer: EnyoCommandAcknowledgeAnswerEnum.Accepted};
}

/** The answer {@link validateHeatpumpHeatingCurveOffset} gives a `SetHeatpumpHeatingCurveOffsetV1`. */
export interface HeatpumpHeatingCurveOffsetValidationResult {
    /** `Accepted` when every rule holds. */
    answer: EnyoCommandAcknowledgeAnswerEnum;
    /** Why the offset was rejected or is not supported. */
    rejectionReason?: string;
}

/**
 * Validates a `SetHeatpumpHeatingCurveOffsetV1` against the heatpump's
 * metadata and returns the answer it deserves.
 *
 * Used by `HeatpumpIntegrationEnergyApp` before it calls
 * `handleHeatpumpHeatingCurveOffset`; an integration handling the message
 * itself can call it too.
 *
 * Rules, in order — the first that fails decides:
 * 1. `heatingCircuitIndex` is an integer ≥ 0 and `offsetK` a finite number
 *    (**Rejected**).
 * 2. The heatpump does not declare `HeatingCurveOffset` (**NotSupported**).
 * 3. No heating circuit has the message's index (**Rejected**).
 * 4. `offsetK` is not `0` and the circuit has no `heatingCurveOffsetRangeK`
 *    or `offsetK` lies outside it (**Rejected**). `0` — restoring the initial
 *    curve — is always allowed.
 *
 * Without metadata only rule 1 can be checked.
 *
 * @param data - The message's data.
 * @param metadata - The heatpump's metadata, if known.
 * @returns The answer: `Accepted` when every rule holds.
 *
 * @example
 * ```typescript
 * const result = validateHeatpumpHeatingCurveOffset(message.data, appliance.heatpump);
 * if (result.answer !== EnyoCommandAcknowledgeAnswerEnum.Accepted) console.warn(result.rejectionReason);
 * ```
 */
export function validateHeatpumpHeatingCurveOffset(
    data: EnyoDataBusSetHeatpumpHeatingCurveOffsetV1['data'],
    metadata: EnyoHeatpumpApplianceMetadata | undefined,
): HeatpumpHeatingCurveOffsetValidationResult {
    const rejected = (rejectionReason: string) => ({answer: EnyoCommandAcknowledgeAnswerEnum.Rejected, rejectionReason});

    if (!Number.isInteger(data.heatingCircuitIndex) || data.heatingCircuitIndex < 0) {
        return rejected(`heatingCircuitIndex must be an integer ≥ 0; got ${data.heatingCircuitIndex}.`);
    }
    if (typeof data.offsetK !== 'number' || !Number.isFinite(data.offsetK)) {
        return rejected(`offsetK must be a finite number; got ${data.offsetK}.`);
    }

    if (!metadata) return {answer: EnyoCommandAcknowledgeAnswerEnum.Accepted};
    if (!(metadata.availableFeatures ?? []).includes(EnyoHeatpumpApplianceAvailableFeaturesEnum.HeatingCurveOffset)) {
        return {
            answer: EnyoCommandAcknowledgeAnswerEnum.NotSupported,
            rejectionReason: 'The heatpump does not support heating curve offsets (no HeatingCurveOffset).',
        };
    }
    const circuit = (metadata.heatingCircuits ?? []).find((c) => c.index === data.heatingCircuitIndex);
    if (!circuit) {
        return rejected(`No heating circuit with index ${data.heatingCircuitIndex}.`);
    }
    if (data.offsetK === 0) return {answer: EnyoCommandAcknowledgeAnswerEnum.Accepted};
    const range = circuit.heatingCurveOffsetRangeK;
    if (!range) {
        return rejected(`Heating circuit ${circuit.index} declares no heatingCurveOffsetRangeK; only offsetK 0 is accepted.`);
    }
    if (data.offsetK < range.minK || data.offsetK > range.maxK) {
        return rejected(
            `offsetK ${data.offsetK} K is outside the range ${range.minK}…${range.maxK} K of heating circuit ${circuit.index}.`,
        );
    }
    return {answer: EnyoCommandAcknowledgeAnswerEnum.Accepted};
}
