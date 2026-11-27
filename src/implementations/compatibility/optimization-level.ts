/**
 * How far the energy manager can optimise a model, condensed into one level
 * for sales, the enyo Store rating and lead qualification: fully, partly, or
 * only monitor it.
 *
 * The level is derived from the model's declared features and limitations —
 * never declared by hand — by the rules in
 * {@link ENERGY_APP_MODEL_OPTIMIZATION_RULES}, so every consumer grades a
 * model the same way.
 */

import {EnergyAppPackageCategory, EnergyAppPackageCompatibilityStatus} from '../../energy-app-package-definition.js';
import type {EnergyAppPackageCompatibilityModel} from '../../energy-app-package-definition.js';
import {EnergyAppModelFeatureEnum as F} from '../../energy-app-model-feature.enum.js';
import {ENERGY_APP_MODEL_LIMITATION_FEATURES} from './model-feature-categories.js';

/** How far the energy manager can optimise a model. */
export enum EnergyAppModelOptimizationLevelEnum {
    /** Every control the energy manager needs to shift the device by price and forecast is there, without a restricting limitation. */
    Full = 'full',
    /** Some control is there, but not all of it, or a limitation restricts it. */
    Partial = 'partial',
    /** No control: the device can only be monitored. */
    MonitoringOnly = 'monitoring-only',
    /** The model is declared not compatible. */
    NotCompatible = 'not-compatible',
    /** The device kind is not steered at all (meter, tariff, sensor). */
    NotApplicable = 'not-applicable',
    /** No model or no category known. */
    Unknown = 'unknown',
}

/**
 * What one device category needs for each level.
 *
 * `full` is a list of groups: the model reaches {@link EnergyAppModelOptimizationLevelEnum.Full}
 * when it declares at least one feature of **every** group. `partial` lists the
 * steering features: one of them is enough for
 * {@link EnergyAppModelOptimizationLevelEnum.Partial}.
 */
export interface EnergyAppModelOptimizationRule {
    /** Groups of alternatives; one feature per group is required for full optimisation. */
    full: readonly (readonly F[])[];
    /** Features of which any one allows partial optimisation. */
    partial: readonly F[];
}

const BATTERY_STEERING: readonly F[] = [
    F.BatteryChargingFromGrid,
    F.BatteryChargeLimitation,
    F.BatteryDischargeLimitation,
    F.BatteryGridChargeFullPowerOnly,
    F.BatteryGridDischarging,
    F.BatteryHold,
    F.BatteryManualCharge,
];

const BATTERY_FULL: readonly (readonly F[])[] = [
    [F.BatteryChargingFromGrid],
    [F.BatteryHold, F.BatteryDischargeLimitation],
];

/**
 * Air conditioning: heating or cooling — either is enough — that the energy
 * manager can start and stop (mode control) and boost (setpoint or power).
 */
const CLIMATE_RULE: EnergyAppModelOptimizationRule = {
    full: [
        [F.ClimateHeating, F.ClimateCooling],
        [F.ClimateModeControl],
        [F.ClimateTemperatureSetpoint, F.ClimatePowerControl],
    ],
    partial: [F.ClimateTemperatureSetpoint, F.ClimateModeControl, F.ClimatePowerControl],
};

const DRY_CONTACT_STEERING: readonly F[] = [
    F.ChargingStartStop,
    F.HeatpumpSgReady,
    F.HeatpumpDhwBoost,
    F.HeatpumpBufferTankOverheating,
    F.HeatpumpRoomOverheating,
    F.HeatpumpHeatingRodControl,
];

/**
 * The optimisation rule of every steered device category. A category without
 * an entry is not steered and yields
 * {@link EnergyAppModelOptimizationLevelEnum.NotApplicable}.
 *
 * An inverter that declares battery features additionally needs the battery's
 * `full` groups (see {@link getModelOptimizationLevel}).
 */
export const ENERGY_APP_MODEL_OPTIMIZATION_RULES: Readonly<Partial<Record<EnergyAppPackageCategory, EnergyAppModelOptimizationRule>>> = {
    [EnergyAppPackageCategory.Wallbox]: {
        full: [[F.ChargingSchedule]],
        partial: [F.ChargingStartStop, F.ChargingPowerLimitation, F.ChargingPhaseSwitching, F.PvSurplusCharging, F.ChargingSchedule],
    },
    [EnergyAppPackageCategory.BatteryStorage]: {
        full: BATTERY_FULL,
        partial: BATTERY_STEERING,
    },
    [EnergyAppPackageCategory.Inverter]: {
        full: [[F.PvFeedInLimitation, F.InverterPowerLimitation]],
        partial: [F.PvFeedInLimitation, F.InverterPowerLimitation, ...BATTERY_STEERING],
    },
    [EnergyAppPackageCategory.HeatPump]: {
        full: [
            [
                F.HeatpumpTemperatureSetpoint,
                F.HeatpumpPowerModulation,
                F.HeatpumpSgReady,
                F.HeatpumpHeatingCurveOffset,
                F.HeatpumpBufferTankOverheating,
                F.HeatpumpRoomOverheating,
                F.HeatpumpPvSurplusSignal,
            ],
            [F.HeatpumpDhwBoost],
        ],
        partial: [
            F.HeatpumpTemperatureSetpoint,
            F.HeatpumpPowerModulation,
            F.HeatpumpSgReady,
            F.HeatpumpHeatingCurveOffset,
            F.HeatpumpBufferTankOverheating,
            F.HeatpumpRoomOverheating,
            F.HeatpumpPvSurplusSignal,
            F.HeatpumpDhwBoost,
            F.HeatpumpProgramSwitch,
            F.HeatpumpHeatingRodControl,
            F.HeatpumpVacationMode,
            F.HeatpumpLegionellaSchedule,
        ],
    },
    [EnergyAppPackageCategory.HeatingRod]: {
        full: [[F.HeatingRodPowerModulation]],
        partial: [F.HeatingRodSwitching, F.HeatingRodPowerModulation, F.HeatingRodLegionellaSchedule],
    },
    [EnergyAppPackageCategory.AirConditioning]: CLIMATE_RULE,
    [EnergyAppPackageCategory.ClimateControl]: CLIMATE_RULE,
    [EnergyAppPackageCategory.SmartPlug]: {
        full: [[F.SwitchOnOff]],
        partial: [F.SwitchOnOff],
    },
    [EnergyAppPackageCategory.DryContact]: {
        full: [DRY_CONTACT_STEERING],
        partial: DRY_CONTACT_STEERING,
    },
    [EnergyAppPackageCategory.Vehicle]: {
        full: [[F.VehicleSocReadout], [F.VehicleChargeStartStop, F.VehicleChargeLimit]],
        partial: [F.VehicleSocReadout, F.VehicleChargeStartStop, F.VehicleChargeLimit],
    },
};

/** Rank of the levels a category rule can produce, best first. */
const LEVEL_RANK: readonly EnergyAppModelOptimizationLevelEnum[] = [
    EnergyAppModelOptimizationLevelEnum.Full,
    EnergyAppModelOptimizationLevelEnum.Partial,
    EnergyAppModelOptimizationLevelEnum.MonitoringOnly,
    EnergyAppModelOptimizationLevelEnum.NotApplicable,
];

/** Context a model's own entry does not carry. */
export interface EnergyAppModelOptimizationContext {
    /** The package's categories, used when the model declares no `category`. */
    packageCategories?: readonly EnergyAppPackageCategory[];
    /** The vendor's status, used when the model declares no `status`. */
    vendorStatus?: EnergyAppPackageCompatibilityStatus;
}

/**
 * Grades how far the energy manager can optimise a model.
 *
 * - `NotCompatible` when the model (else its vendor) is declared not compatible;
 * - `Unknown` without a model, or without a category (the model's own, else the package's);
 * - otherwise by {@link ENERGY_APP_MODEL_OPTIMIZATION_RULES}: `Full` when every
 *   `full` group is met and no declared limitation restricts one of the features
 *   that met it, `Partial` with any steering feature, else `MonitoringOnly`;
 *   `NotApplicable` for a category that is not steered.
 *
 * With several package categories and no model category, the best level over
 * those categories is returned.
 *
 * @param model - The model entry; `undefined` when no model is known.
 * @param context - Package categories and vendor status; see {@link EnergyAppModelOptimizationContext}.
 * @returns The level.
 *
 * @example
 * ```typescript
 * getModelOptimizationLevel({
 *     modelName: 'AC22E', category: EnergyAppPackageCategory.Wallbox,
 *     features: [EnergyAppModelFeatureEnum.ChargingStartStop],
 * });
 * // EnergyAppModelOptimizationLevelEnum.Partial — no ChargingSchedule
 * ```
 */
export function getModelOptimizationLevel(
    model: Pick<EnergyAppPackageCompatibilityModel, 'features'> &
        Partial<Pick<EnergyAppPackageCompatibilityModel, 'limitations' | 'category' | 'status'>> | undefined,
    context: EnergyAppModelOptimizationContext = {},
): EnergyAppModelOptimizationLevelEnum {
    if ((model?.status ?? context.vendorStatus) === EnergyAppPackageCompatibilityStatus.NotCompatible) {
        return EnergyAppModelOptimizationLevelEnum.NotCompatible;
    }
    if (model === undefined) return EnergyAppModelOptimizationLevelEnum.Unknown;

    const categories = model.category !== undefined ? [model.category] : [...(context.packageCategories ?? [])];
    if (categories.length === 0) return EnergyAppModelOptimizationLevelEnum.Unknown;

    const levels = categories.map((category) => levelForCategory(model, category));
    return LEVEL_RANK.find((level) => levels.includes(level)) ?? EnergyAppModelOptimizationLevelEnum.Unknown;
}

/**
 * Grades a model against one category's rule.
 *
 * @param model - The model entry.
 * @param category - The category to grade against.
 * @returns The level for that category.
 */
function levelForCategory(
    model: Pick<EnergyAppPackageCompatibilityModel, 'features'> & Partial<Pick<EnergyAppPackageCompatibilityModel, 'limitations'>>,
    category: EnergyAppPackageCategory,
): EnergyAppModelOptimizationLevelEnum {
    const rule = ENERGY_APP_MODEL_OPTIMIZATION_RULES[category];
    if (rule === undefined) return EnergyAppModelOptimizationLevelEnum.NotApplicable;

    const features = Array.isArray(model.features) ? model.features : [];
    const has = (feature: F) => features.includes(feature);

    const fullGroups = category === EnergyAppPackageCategory.Inverter && BATTERY_STEERING.some(has)
        ? [...rule.full, ...BATTERY_FULL]
        : rule.full;
    const fullMet = fullGroups.every((group) => group.some(has));
    if (fullMet) {
        const used = fullGroups.flat().filter(has);
        const restricted = (Array.isArray(model.limitations) ? model.limitations : [])
            .some((limitation) => (ENERGY_APP_MODEL_LIMITATION_FEATURES[limitation] ?? []).some((f) => used.includes(f)));
        return restricted ? EnergyAppModelOptimizationLevelEnum.Partial : EnergyAppModelOptimizationLevelEnum.Full;
    }
    return rule.partial.some(has)
        ? EnergyAppModelOptimizationLevelEnum.Partial
        : EnergyAppModelOptimizationLevelEnum.MonitoringOnly;
}
