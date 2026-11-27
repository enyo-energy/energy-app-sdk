/**
 * Whether, and how, the energy manager may steer an air conditioning unit.
 *
 * Two things decide: the unit
 * ({@link EnyoAirConditioningApplianceMetadata.controlAllowed} — may enyo steer
 * it?) and the house-wide energy manager settings (`airConditioningControl`,
 * `airConditioningHeatingMode`, `airConditioningCoolingMode`). These pure
 * functions combine them, so the app and the energy manager reach the same
 * answer.
 */

import {
    EnyoAirConditioningApplianceAvailableFeaturesEnum as Feature,
} from '../../types/enyo-air-conditioning-appliance.js';
import type {EnyoAirConditioningApplianceMetadata} from '../../types/enyo-air-conditioning-appliance.js';
import {EnergyManagerAirConditioningModeEnum} from '../../types/enyo-energy-manager-settings.js';
import type {EnergyManagerSettingValues} from '../../types/enyo-energy-manager-settings.js';

/** What the energy manager may do with one air conditioning unit, per direction. */
export interface EnyoAirConditioningResolvedModes {
    /** The mode for heating; `Off` when the unit cannot heat or is not steered. */
    heating: EnergyManagerAirConditioningModeEnum;
    /** The mode for cooling; `Off` when the unit cannot cool or is not steered. */
    cooling: EnergyManagerAirConditioningModeEnum;
}

/** The setting values these functions read. */
export type AirConditioningControlSettings = Pick<
    EnergyManagerSettingValues,
    'airConditioningControl' | 'airConditioningHeatingMode' | 'airConditioningCoolingMode'
>;

/**
 * Whether the energy manager may steer this air conditioning unit at all.
 *
 * @param metadata - The unit's metadata; `undefined` when it has none.
 * @param settings - The energy manager settings (or just the air conditioning ones).
 * @returns `true` only when the unit allows control (`controlAllowed` is not
 *   `false`) and the house-wide `airConditioningControl` is `true`.
 *
 * @example
 * ```typescript
 * isAirConditioningControlled({availableFeatures: [], controlAllowed: true}, {airConditioningControl: true});
 * // true
 * ```
 */
export function isAirConditioningControlled(
    metadata: Pick<EnyoAirConditioningApplianceMetadata, 'controlAllowed'> | undefined,
    settings: Pick<AirConditioningControlSettings, 'airConditioningControl'> | undefined,
): boolean {
    return metadata !== undefined &&
        metadata.controlAllowed !== false &&
        settings?.airConditioningControl === true;
}

/** Every valid mode, to ignore a value from untyped JSON. */
const MODES: readonly string[] = Object.values(EnergyManagerAirConditioningModeEnum);

/**
 * The mode of one direction: the setting, when the unit is steered and has the
 * feature, else `Off`.
 *
 * @param controlled - Whether the unit is steered at all.
 * @param hasFeature - Whether the unit can run in this direction.
 * @param mode - The stored setting.
 * @returns The effective mode.
 */
function resolveDirection(
    controlled: boolean,
    hasFeature: boolean,
    mode: EnergyManagerAirConditioningModeEnum | undefined,
): EnergyManagerAirConditioningModeEnum {
    if (!controlled || !hasFeature || mode === undefined || !MODES.includes(mode)) {
        return EnergyManagerAirConditioningModeEnum.Off;
    }
    return mode;
}

/**
 * Resolves what the energy manager may do with one air conditioning unit, for
 * heating and for cooling.
 *
 * A direction is `Off` when the unit is not steered (see
 * {@link isAirConditioningControlled}), when it lacks the
 * {@link EnyoAirConditioningApplianceAvailableFeaturesEnum.Heating} /
 * {@link EnyoAirConditioningApplianceAvailableFeaturesEnum.Cooling} feature,
 * or when the setting is absent or unknown — so nothing is steered without the
 * customer's explicit choice. Otherwise it is the setting.
 *
 * @param metadata - The unit's metadata; `undefined` when it has none.
 * @param settings - The energy manager settings (or just the air conditioning ones).
 * @returns The mode per direction.
 *
 * @example
 * ```typescript
 * resolveAirConditioningModes(
 *     {availableFeatures: [Heating, Cooling], controlAllowed: true},
 *     {airConditioningControl: true, airConditioningHeatingMode: 'auto', airConditioningCoolingMode: 'boost'},
 * );
 * // {heating: 'auto', cooling: 'boost'}
 * ```
 */
export function resolveAirConditioningModes(
    metadata: Pick<EnyoAirConditioningApplianceMetadata, 'availableFeatures' | 'controlAllowed'> | undefined,
    settings: AirConditioningControlSettings | undefined,
): EnyoAirConditioningResolvedModes {
    const controlled = isAirConditioningControlled(metadata, settings);
    const features = Array.isArray(metadata?.availableFeatures) ? metadata.availableFeatures : [];
    return {
        heating: resolveDirection(controlled, features.includes(Feature.Heating), settings?.airConditioningHeatingMode),
        cooling: resolveDirection(controlled, features.includes(Feature.Cooling), settings?.airConditioningCoolingMode),
    };
}
