/**
 * Three-way answer to "does this model support feature X?": yes, checked and
 * no, or not declared.
 *
 * A model's `features` only list what works, so a missing feature is
 * ambiguous. `unsupportedFeatures` lists what has been checked and does not
 * work; {@link getModelFeatureSupport} combines both lists, so sales, the enyo
 * Store and onboarding show ✓ / ✗ / ? the same way.
 */

import {
    EnergyAppModelFeatureEnum,
    EnergyAppModelFeatureSupportEnum,
} from '../../energy-app-model-feature.enum.js';
import type {EnergyAppPackageCompatibilityModel} from '../../energy-app-package-definition.js';

/**
 * Tells whether a model supports a feature.
 *
 * @param model - The model entry (or just its two feature lists); `undefined`
 *   when no model is known.
 * @param feature - The feature asked about.
 * @returns `Supported` when it is in `features`, `Unsupported` when it is in
 *   `unsupportedFeatures`, else `Unknown`. `features` wins should a malformed
 *   declaration list it in both.
 *
 * @example
 * ```typescript
 * const battery = {features: [], unsupportedFeatures: [EnergyAppModelFeatureEnum.BatteryChargingFromGrid]};
 * getModelFeatureSupport(battery, EnergyAppModelFeatureEnum.BatteryChargingFromGrid);
 * // EnergyAppModelFeatureSupportEnum.Unsupported
 * getModelFeatureSupport(battery, EnergyAppModelFeatureEnum.BatteryHold);
 * // EnergyAppModelFeatureSupportEnum.Unknown
 * ```
 */
export function getModelFeatureSupport(
    model: Partial<Pick<EnergyAppPackageCompatibilityModel, 'features' | 'unsupportedFeatures'>> | undefined,
    feature: EnergyAppModelFeatureEnum,
): EnergyAppModelFeatureSupportEnum {
    if (Array.isArray(model?.features) && model.features.includes(feature)) {
        return EnergyAppModelFeatureSupportEnum.Supported;
    }
    if (Array.isArray(model?.unsupportedFeatures) && model.unsupportedFeatures.includes(feature)) {
        return EnergyAppModelFeatureSupportEnum.Unsupported;
    }
    return EnergyAppModelFeatureSupportEnum.Unknown;
}
