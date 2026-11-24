/**
 * Which {@link EnyoHeatpumpControlAreaEnum | control areas} and
 * {@link EnyoHeatpumpControlModeEnum | modes} a heat pump offers, and which
 * mode applies per area — the customer's choice in
 * {@link EnyoHeatpumpApplianceMetadata.controlModes}, or a default derived from
 * the switches that existed before (`heatpumpControl`, `controlAllowed`,
 * `curveOptimization.enabled`).
 *
 * Pure functions on the heat pump's metadata, shared by the host (app, sync
 * of the old switches) and the energy manager, so both read the same modes.
 */

import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum as Feature,
    EnyoHeatpumpControlAreaEnum,
    EnyoHeatpumpControlModeEnum,
    EnyoHeatpumpProgramModeEnum,
} from '../../types/enyo-heatpump-appliance.js';
import type {EnyoHeatpumpApplianceMetadata, EnyoHeatpumpControlModes} from '../../types/enyo-heatpump-appliance.js';
import type {EnergyManagerSettingValues} from '../../types/enyo-energy-manager-settings.js';

const {Off, Recommend, Auto} = EnyoHeatpumpControlModeEnum;

/** Every area, in the order the app shows them. */
const AREA_ORDER: readonly EnyoHeatpumpControlAreaEnum[] = [
    EnyoHeatpumpControlAreaEnum.SolarHotWater,
    EnyoHeatpumpControlAreaEnum.CostOptimizedHeating,
    EnyoHeatpumpControlAreaEnum.HeatingCurve,
];

/**
 * Whether the heat pump declares at least one of the features.
 *
 * @param metadata - The heat pump's metadata.
 * @param features - The features to look for.
 * @returns `true` when one of them is declared.
 */
function hasAny(metadata: EnyoHeatpumpApplianceMetadata, ...features: Feature[]): boolean {
    const declared = metadata.availableFeatures ?? [];
    return features.some((feature) => declared.includes(feature));
}

/**
 * Whether the energy manager can pre-heat this heat pump: a buffer tank or
 * room it can raise, or power it can announce.
 *
 * @param metadata - The heat pump's metadata.
 * @returns `true` when pre-heating is possible.
 */
function canPreHeat(metadata: EnyoHeatpumpApplianceMetadata): boolean {
    return hasAny(
        metadata,
        Feature.BufferTankOverheating,
        Feature.RoomOverheating,
        Feature.AvailablePowerAnnouncement,
        Feature.PvSurplusSignal,
    );
}

/**
 * Whether the energy manager can switch this heat pump to eco: it declares
 * {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.ProgramSwitch} and a
 * heating circuit lists eco in its `supportedProgramModes`. Domestic-hot-water
 * zones do not count — the energy manager switches only heating circuits to
 * eco, and Core's `HeatpumpEcoMode` capability uses the same rule.
 *
 * @param metadata - The heat pump's metadata.
 * @returns `true` when eco is possible.
 */
function canSwitchToEco(metadata: EnyoHeatpumpApplianceMetadata): boolean {
    return hasAny(metadata, Feature.ProgramSwitch)
        && (metadata.heatingCircuits ?? [])
            .some((circuit) => (circuit.supportedProgramModes ?? []).includes(EnyoHeatpumpProgramModeEnum.Eco));
}

/**
 * Whether the heat pump has a heating curve to judge: a circuit that reports
 * one, or the {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.HeatingCurve} /
 * {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.HeatingCurveOffset}
 * feature — the rule of Core's `HeatpumpHeatingCurve` capability.
 *
 * @param metadata - The heat pump's metadata.
 * @returns `true` when the heating curve area is offered.
 */
function hasHeatingCurve(metadata: EnyoHeatpumpApplianceMetadata): boolean {
    return (metadata.heatingCircuits ?? []).some((circuit) => circuit.heatingCurve !== undefined)
        || hasAny(metadata, Feature.HeatingCurve, Feature.HeatingCurveOffset);
}

/**
 * The modes the customer can choose for one area of this heat pump, in the
 * order `Off`, `Recommend`, `Auto`. Empty when the heat pump does not offer
 * the area at all; otherwise `Off` is always included.
 *
 * | Area | Offered when | `Recommend` when | `Auto` when |
 * |---|---|---|---|
 * | `SolarHotWater` | `DomesticHotWaterOverheating`, `PvSurplusSignal` or `AvailablePowerAnnouncement` | offered | offered |
 * | `CostOptimizedHeating` | pre-heating (`BufferTankOverheating`, `RoomOverheating`, `AvailablePowerAnnouncement` or `PvSurplusSignal`) or eco (`ProgramSwitch` and a heating circuit listing eco) | pre-heating — eco gives no recommendations | offered |
 * | `HeatingCurve` | `HeatingCurve` or `HeatingCurveOffset`, or a circuit reports `heatingCurve` | offered | `HeatingCurveOffset` |
 *
 * @param metadata - The heat pump's metadata.
 * @param area - The area.
 * @returns The modes the area offers; empty when the area is not offered.
 */
export function availableHeatpumpControlModes(
    metadata: EnyoHeatpumpApplianceMetadata,
    area: EnyoHeatpumpControlAreaEnum,
): EnyoHeatpumpControlModeEnum[] {
    switch (area) {
        case EnyoHeatpumpControlAreaEnum.SolarHotWater:
            return hasAny(
                metadata,
                Feature.DomesticHotWaterOverheating,
                Feature.PvSurplusSignal,
                Feature.AvailablePowerAnnouncement,
            ) ? [Off, Recommend, Auto] : [];
        case EnyoHeatpumpControlAreaEnum.CostOptimizedHeating: {
            const preHeat = canPreHeat(metadata);
            if (!preHeat && !canSwitchToEco(metadata)) return [];
            return preHeat ? [Off, Recommend, Auto] : [Off, Auto];
        }
        case EnyoHeatpumpControlAreaEnum.HeatingCurve:
            if (!hasHeatingCurve(metadata)) return [];
            return hasAny(metadata, Feature.HeatingCurveOffset) ? [Off, Recommend, Auto] : [Off, Recommend];
        default:
            return [];
    }
}

/**
 * The areas this heat pump offers, in the fixed order `SolarHotWater`,
 * `CostOptimizedHeating`, `HeatingCurve`. See
 * {@link availableHeatpumpControlModes} for when an area is offered.
 *
 * @param metadata - The heat pump's metadata.
 * @returns The offered areas; empty when the heat pump offers none.
 */
export function heatpumpControlAreas(metadata: EnyoHeatpumpApplianceMetadata): EnyoHeatpumpControlAreaEnum[] {
    return AREA_ORDER.filter((area) => availableHeatpumpControlModes(metadata, area).length > 0);
}

/**
 * The mode that applies per area of this heat pump — what an energy manager
 * declaring {@link EnergyManagerFeatureEnum.HeatpumpRecommendations} acts on,
 * and what the app shows.
 *
 * The result has exactly one mode for every area the heat pump offers
 * ({@link heatpumpControlAreas}) and no entry for any other area. Per area:
 * - A stored mode ({@link EnyoHeatpumpApplianceMetadata.controlModes}) that
 *   the area offers applies.
 * - A stored mode the area does not offer (e.g. `Auto` for the heating curve
 *   without `HeatingCurveOffset`) falls back to `Recommend`, or `Off` where
 *   `Recommend` is not offered either.
 * - Without a stored mode the default follows from the switches that existed
 *   before, with `controlled = settings.heatpumpControl === true &&
 *   metadata.controlAllowed !== false` (a missing `heatpumpControl` means off,
 *   as in the energy manager today):
 *   - `SolarHotWater`: `controlled` ? `Auto` : `Recommend`
 *   - `CostOptimizedHeating`: `controlled` ? `Auto` : `Recommend` — `Off` when
 *     `Recommend` is not offered (eco only)
 *   - `HeatingCurve`: `Auto` when `controlled`, a circuit has
 *     `curveOptimization.enabled` and `Auto` is offered; `Recommend` otherwise
 *
 * So nobody who lets the energy manager control today loses anything, and new
 * customers start on `Recommend`.
 *
 * The defaults read `controlAllowed`. A host that writes `controlAllowed`
 * with {@link deriveHeatpumpControlAllowed} should store the resolved modes in
 * `controlModes` at the same time; otherwise its own `controlAllowed: false`
 * would feed back into the defaults and keep them on `Recommend`.
 *
 * @param metadata - The heat pump's metadata.
 * @param settings - The energy manager settings; only `heatpumpControl` is read.
 * @returns The mode per offered area.
 */
export function resolveHeatpumpControlModes(
    metadata: EnyoHeatpumpApplianceMetadata,
    settings: Pick<EnergyManagerSettingValues, 'heatpumpControl'>,
): EnyoHeatpumpControlModes {
    const controlled = settings.heatpumpControl === true && metadata.controlAllowed !== false;
    const curveOptimizationEnabled = (metadata.heatingCircuits ?? [])
        .some((circuit) => circuit.curveOptimization?.enabled === true);
    const defaults: Record<EnyoHeatpumpControlAreaEnum, EnyoHeatpumpControlModeEnum> = {
        [EnyoHeatpumpControlAreaEnum.SolarHotWater]: controlled ? Auto : Recommend,
        [EnyoHeatpumpControlAreaEnum.CostOptimizedHeating]: controlled ? Auto : Recommend,
        [EnyoHeatpumpControlAreaEnum.HeatingCurve]: controlled && curveOptimizationEnabled ? Auto : Recommend,
    };

    const resolved: EnyoHeatpumpControlModes = {};
    for (const area of AREA_ORDER) {
        const available = availableHeatpumpControlModes(metadata, area);
        if (available.length === 0) continue;
        const wanted = metadata.controlModes?.[area] ?? defaults[area];
        resolved[area] = available.includes(wanted) ? wanted : available.includes(Recommend) ? Recommend : Off;
    }
    return resolved;
}

/**
 * The `controlAllowed` the host writes for energy managers without
 * {@link EnergyManagerFeatureEnum.HeatpumpRecommendations}: `true` as soon as
 * one area is {@link EnyoHeatpumpControlModeEnum.Auto}.
 *
 * @param modes - The resolved modes ({@link resolveHeatpumpControlModes}).
 * @returns Whether an older energy manager may control the heat pump.
 */
export function deriveHeatpumpControlAllowed(modes: EnyoHeatpumpControlModes): boolean {
    return Object.values(modes).includes(Auto);
}

/**
 * The `curveOptimization.enabled` the host writes on every heating circuit for
 * energy managers without
 * {@link EnergyManagerFeatureEnum.HeatpumpRecommendations}: `true` only when
 * {@link EnyoHeatpumpControlAreaEnum.HeatingCurve} is
 * {@link EnyoHeatpumpControlModeEnum.Auto}.
 *
 * Not `mode !== Off`: an older energy manager lowers the curve on its own
 * whenever `enabled` is set and the heat pump may be controlled, so `Recommend`
 * combined with `Auto` in another area would lower the curve against the
 * customer's choice.
 *
 * @param modes - The resolved modes ({@link resolveHeatpumpControlModes}).
 * @returns Whether an older energy manager may optimise the heating curve.
 */
export function deriveHeatpumpCurveOptimizationEnabled(modes: EnyoHeatpumpControlModes): boolean {
    return modes[EnyoHeatpumpControlAreaEnum.HeatingCurve] === Auto;
}
