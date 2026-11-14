/**
 * Machine-readable grouping of {@link EnergyAppModelFeatureEnum} by device
 * category, and of {@link EnergyAppModelLimitationEnum} by the features it
 * qualifies.
 *
 * Consumers — the enyo Store rating, lead qualification, onboarding — need to
 * know which features a device of a category *could* have, e.g. to grade a model
 * by how many of them it declares. Exporting the grouping here keeps every
 * consumer in step with the enum, instead of each one keeping its own copy that
 * silently misses new members.
 */

import {EnergyAppPackageCategory} from '../../energy-app-package-definition.js';
import {EnergyAppModelFeatureEnum, EnergyAppModelLimitationEnum} from '../../energy-app-model-feature.enum.js';

/** Categories whose devices can follow a grid operator's consumption limit (§14a EnWG). */
const CONTROLLABLE_CONSUMER_CATEGORIES: readonly EnergyAppPackageCategory[] = [
    EnergyAppPackageCategory.BatteryStorage,
    EnergyAppPackageCategory.Inverter,
    EnergyAppPackageCategory.Wallbox,
    EnergyAppPackageCategory.HeatPump,
    EnergyAppPackageCategory.HeatingRod,
    EnergyAppPackageCategory.AirConditioning,
    EnergyAppPackageCategory.ClimateControl,
    EnergyAppPackageCategory.SmartPlug,
];

/** Battery features belong to storage and to hybrid inverters, which steer their battery. */
const BATTERY_CATEGORIES: readonly EnergyAppPackageCategory[] = [
    EnergyAppPackageCategory.BatteryStorage,
    EnergyAppPackageCategory.Inverter,
];

const CLIMATE_CATEGORIES: readonly EnergyAppPackageCategory[] = [
    EnergyAppPackageCategory.AirConditioning,
    EnergyAppPackageCategory.ClimateControl,
];

/**
 * The package categories each {@link EnergyAppModelFeatureEnum} member belongs
 * to — exhaustive over the enum, enforced by the type.
 *
 * Most features belong to one category. Some belong to several: battery
 * features also to hybrid inverters, readouts to every category whose devices
 * report them, and the grid operator limits to every controllable device.
 *
 * @example
 * ```typescript
 * ENERGY_APP_MODEL_FEATURE_CATEGORIES[EnergyAppModelFeatureEnum.ChargingSchedule];
 * // [EnergyAppPackageCategory.Wallbox]
 * ```
 */
export const ENERGY_APP_MODEL_FEATURE_CATEGORIES: Readonly<Record<EnergyAppModelFeatureEnum, readonly EnergyAppPackageCategory[]>> = {
    [EnergyAppModelFeatureEnum.BatteryChargingFromGrid]: BATTERY_CATEGORIES,
    [EnergyAppModelFeatureEnum.BatteryChargeLimitation]: BATTERY_CATEGORIES,
    [EnergyAppModelFeatureEnum.BatteryDischargeLimitation]: BATTERY_CATEGORIES,
    [EnergyAppModelFeatureEnum.BatteryGridChargeFullPowerOnly]: BATTERY_CATEGORIES,
    [EnergyAppModelFeatureEnum.BatteryGridChargeFullPowerStoppable]: BATTERY_CATEGORIES,
    [EnergyAppModelFeatureEnum.BatteryGridDischarging]: BATTERY_CATEGORIES,
    [EnergyAppModelFeatureEnum.BatteryHold]: BATTERY_CATEGORIES,
    [EnergyAppModelFeatureEnum.BatteryManualCharge]: BATTERY_CATEGORIES,

    [EnergyAppModelFeatureEnum.PvFeedInLimitation]: [EnergyAppPackageCategory.Inverter],
    [EnergyAppModelFeatureEnum.InverterPowerLimitation]: [EnergyAppPackageCategory.Inverter],
    [EnergyAppModelFeatureEnum.InverterGridOutageDetection]: [EnergyAppPackageCategory.Inverter],

    [EnergyAppModelFeatureEnum.ChargingStartStop]: [EnergyAppPackageCategory.Wallbox],
    [EnergyAppModelFeatureEnum.ChargingPowerLimitation]: [EnergyAppPackageCategory.Wallbox],
    [EnergyAppModelFeatureEnum.ChargingPhaseSwitching]: [EnergyAppPackageCategory.Wallbox],
    [EnergyAppModelFeatureEnum.PvSurplusCharging]: [EnergyAppPackageCategory.Wallbox],
    [EnergyAppModelFeatureEnum.ChargingSchedule]: [EnergyAppPackageCategory.Wallbox],
    [EnergyAppModelFeatureEnum.ChargingVehicleSocReadout]: [EnergyAppPackageCategory.Wallbox],
    [EnergyAppModelFeatureEnum.ChargingMidMeter]: [EnergyAppPackageCategory.Wallbox],
    [EnergyAppModelFeatureEnum.ChargingEichrechtMeter]: [EnergyAppPackageCategory.Wallbox],
    [EnergyAppModelFeatureEnum.ChargingRfidAuthorization]: [EnergyAppPackageCategory.Wallbox],

    [EnergyAppModelFeatureEnum.HeatpumpDhwBoost]: [EnergyAppPackageCategory.HeatPump],
    [EnergyAppModelFeatureEnum.HeatpumpTemperatureSetpoint]: [EnergyAppPackageCategory.HeatPump],
    [EnergyAppModelFeatureEnum.HeatpumpPowerModulation]: [EnergyAppPackageCategory.HeatPump],
    [EnergyAppModelFeatureEnum.HeatpumpSgReady]: [EnergyAppPackageCategory.HeatPump],
    [EnergyAppModelFeatureEnum.HeatpumpRoomTemperatureInput]: [EnergyAppPackageCategory.HeatPump],
    [EnergyAppModelFeatureEnum.HeatpumpPvSurplusSignal]: [EnergyAppPackageCategory.HeatPump],
    [EnergyAppModelFeatureEnum.HeatpumpBufferTankOverheating]: [EnergyAppPackageCategory.HeatPump],
    [EnergyAppModelFeatureEnum.HeatpumpRoomOverheating]: [EnergyAppPackageCategory.HeatPump],
    [EnergyAppModelFeatureEnum.HeatpumpHeatingRodControl]: [EnergyAppPackageCategory.HeatPump],
    [EnergyAppModelFeatureEnum.HeatpumpProgramSwitch]: [EnergyAppPackageCategory.HeatPump],
    [EnergyAppModelFeatureEnum.HeatpumpHeatingCurveOffset]: [EnergyAppPackageCategory.HeatPump],
    [EnergyAppModelFeatureEnum.HeatpumpVacationMode]: [EnergyAppPackageCategory.HeatPump],
    [EnergyAppModelFeatureEnum.HeatpumpCooling]: [EnergyAppPackageCategory.HeatPump],
    [EnergyAppModelFeatureEnum.HeatpumpPowerReadout]: [EnergyAppPackageCategory.HeatPump],

    [EnergyAppModelFeatureEnum.HeatingRodSwitching]: [EnergyAppPackageCategory.HeatingRod],
    [EnergyAppModelFeatureEnum.HeatingRodPowerModulation]: [EnergyAppPackageCategory.HeatingRod],
    [EnergyAppModelFeatureEnum.HeatingRodDhwSensor]: [EnergyAppPackageCategory.HeatingRod],

    [EnergyAppModelFeatureEnum.ClimateTemperatureSetpoint]: CLIMATE_CATEGORIES,
    [EnergyAppModelFeatureEnum.ClimateModeControl]: CLIMATE_CATEGORIES,
    [EnergyAppModelFeatureEnum.ClimateCooling]: CLIMATE_CATEGORIES,
    [EnergyAppModelFeatureEnum.ClimateHeating]: CLIMATE_CATEGORIES,
    [EnergyAppModelFeatureEnum.ClimatePowerControl]: CLIMATE_CATEGORIES,

    [EnergyAppModelFeatureEnum.GridPowerReadout]: [
        EnergyAppPackageCategory.Meter,
        EnergyAppPackageCategory.Inverter,
        EnergyAppPackageCategory.BatteryStorage,
        EnergyAppPackageCategory.EnergyManagement,
    ],
    [EnergyAppModelFeatureEnum.EnergyConsumptionReadout]: [
        EnergyAppPackageCategory.Meter,
        EnergyAppPackageCategory.Wallbox,
        EnergyAppPackageCategory.SmartPlug,
        EnergyAppPackageCategory.HeatPump,
        EnergyAppPackageCategory.HeatingRod,
        ...CLIMATE_CATEGORIES,
    ],

    [EnergyAppModelFeatureEnum.VehicleSocReadout]: [EnergyAppPackageCategory.Vehicle],
    [EnergyAppModelFeatureEnum.VehicleChargeStartStop]: [EnergyAppPackageCategory.Vehicle],
    [EnergyAppModelFeatureEnum.VehicleChargeLimit]: [EnergyAppPackageCategory.Vehicle],
    [EnergyAppModelFeatureEnum.VehicleLocationReadout]: [EnergyAppPackageCategory.Vehicle],
    [EnergyAppModelFeatureEnum.VehicleOdometerReadout]: [EnergyAppPackageCategory.Vehicle],
    [EnergyAppModelFeatureEnum.VehiclePreconditioning]: [EnergyAppPackageCategory.Vehicle],

    [EnergyAppModelFeatureEnum.SwitchOnOff]: [EnergyAppPackageCategory.SmartPlug],
    [EnergyAppModelFeatureEnum.PowerMeasurement]: [EnergyAppPackageCategory.SmartPlug],

    [EnergyAppModelFeatureEnum.GridOperatorConsumptionLimitation]: CONTROLLABLE_CONSUMER_CATEGORIES,
    [EnergyAppModelFeatureEnum.GridOperatorProductionLimitation]: [
        EnergyAppPackageCategory.Inverter,
        EnergyAppPackageCategory.BatteryStorage,
    ],
};

/**
 * The features each {@link EnergyAppModelLimitationEnum} member qualifies —
 * exhaustive over the enum, enforced by the type.
 *
 * A model declaring a limitation should declare at least one of its features,
 * otherwise the limitation restricts nothing; `validatePackageCompatibility()`
 * warns about that. An empty list means the limitation applies to the model as
 * a whole (e.g. delayed readings) and is never checked.
 */
export const ENERGY_APP_MODEL_LIMITATION_FEATURES: Readonly<Record<EnergyAppModelLimitationEnum, readonly EnergyAppModelFeatureEnum[]>> = {
    [EnergyAppModelLimitationEnum.BatteryChargeCannotBeBlocked]: [
        EnergyAppModelFeatureEnum.BatteryHold,
        EnergyAppModelFeatureEnum.BatteryChargeLimitation,
    ],
    [EnergyAppModelLimitationEnum.BatteryDischargeCannotBeBlocked]: [
        EnergyAppModelFeatureEnum.BatteryHold,
        EnergyAppModelFeatureEnum.BatteryDischargeLimitation,
    ],
    [EnergyAppModelLimitationEnum.BatteryChargeSetpointForced]: [
        EnergyAppModelFeatureEnum.BatteryChargingFromGrid,
        EnergyAppModelFeatureEnum.BatteryChargeLimitation,
    ],
    [EnergyAppModelLimitationEnum.ChargingCannotBePaused]: [
        EnergyAppModelFeatureEnum.ChargingStartStop,
        EnergyAppModelFeatureEnum.ChargingPowerLimitation,
        EnergyAppModelFeatureEnum.ChargingSchedule,
        EnergyAppModelFeatureEnum.VehicleChargeStartStop,
    ],
    [EnergyAppModelLimitationEnum.ChargingRequiresReplug]: [
        EnergyAppModelFeatureEnum.ChargingStartStop,
        EnergyAppModelFeatureEnum.ChargingSchedule,
        EnergyAppModelFeatureEnum.VehicleChargeStartStop,
    ],
    [EnergyAppModelLimitationEnum.PhaseSwitchingBetweenSessionsOnly]: [
        EnergyAppModelFeatureEnum.ChargingPhaseSwitching,
    ],
    [EnergyAppModelLimitationEnum.ControlRateLimited]: [],
    [EnergyAppModelLimitationEnum.DelayedReadings]: [],
    [EnergyAppModelLimitationEnum.CoarseEnergyCounters]: [],
    [EnergyAppModelLimitationEnum.HeatpumpDhwBoostInterruptsHeating]: [
        EnergyAppModelFeatureEnum.HeatpumpDhwBoost,
    ],
    [EnergyAppModelLimitationEnum.HeatpumpBoostUsesElectricHeater]: [
        EnergyAppModelFeatureEnum.HeatpumpDhwBoost,
        EnergyAppModelFeatureEnum.HeatpumpBufferTankOverheating,
        EnergyAppModelFeatureEnum.HeatpumpRoomOverheating,
    ],
};

/**
 * Lists every model feature a device of the given category can have — the
 * denominator for grading how complete a model's declaration is.
 *
 * @param category - The package or model category.
 * @returns The features belonging to `category`, in enum order; empty for a
 *   category without model features (e.g. tariffs).
 *
 * @example
 * ```typescript
 * getModelFeaturesForCategory(EnergyAppPackageCategory.HeatingRod);
 * // [HeatingRodSwitching, HeatingRodPowerModulation, HeatingRodDhwSensor, EnergyConsumptionReadout, GridOperatorConsumptionLimitation]
 * ```
 */
export function getModelFeaturesForCategory(category: EnergyAppPackageCategory): EnergyAppModelFeatureEnum[] {
    return (Object.values(EnergyAppModelFeatureEnum) as EnergyAppModelFeatureEnum[])
        .filter((feature) => ENERGY_APP_MODEL_FEATURE_CATEGORIES[feature].includes(category));
}
