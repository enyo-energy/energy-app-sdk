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
 *
 * `controlAllowed` stays the integration's capability: a heat pump it marks
 * monitor-only (`false`) offers only `Off` in every area, whatever is stored.
 */

import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum as Feature,
    EnyoHeatpumpControlAreaEnum,
    EnyoHeatpumpControlModeEnum,
    EnyoHeatpumpProgramModeEnum,
} from '../../types/enyo-heatpump-appliance.js';
import type {
    EnyoHeatpumpApplianceMetadata,
    EnyoHeatpumpControlModeDefault,
    EnyoHeatpumpControlModeDefaults,
    EnyoHeatpumpControlModes,
} from '../../types/enyo-heatpump-appliance.js';
import type {EnergyManagerSettingValues} from '../../types/enyo-energy-manager-settings.js';

const {Off, Recommend, Auto} = EnyoHeatpumpControlModeEnum;

/** Every area, in the order the app shows them. */
const AREA_ORDER: readonly EnyoHeatpumpControlAreaEnum[] = [
    EnyoHeatpumpControlAreaEnum.SolarHotWater,
    EnyoHeatpumpControlAreaEnum.CostOptimizedHeating,
    EnyoHeatpumpControlAreaEnum.HeatingCurve,
    EnyoHeatpumpControlAreaEnum.LegionellaProgram,
];

/** The modes an integration may register as a default — never `Auto`. */
const DEFAULTABLE_MODES: readonly EnyoHeatpumpControlModeEnum[] = [Off, Recommend];

/**
 * The integration's default for one area, from `controlModeDefaults` of a heat
 * pump or heating rod — only when it is `Off` or `Recommend`. An `Auto` or any
 * other value (e.g. from untyped JSON) is ignored, so an integration can never
 * make the energy manager steer a device the customer did not hand over.
 *
 * @param defaults - The integration's `controlModeDefaults`, if any.
 * @param area - The area.
 * @returns The registered default, or `undefined` when there is no usable one.
 */
export function integrationControlModeDefault(
    defaults: EnyoHeatpumpControlModeDefaults | undefined,
    area: EnyoHeatpumpControlAreaEnum,
): EnyoHeatpumpControlModeDefault | undefined {
    const mode = defaults?.[area];
    return mode !== undefined && DEFAULTABLE_MODES.includes(mode)
        ? mode as EnyoHeatpumpControlModeDefault
        : undefined;
}

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
 * Whether a domestic-hot-water zone reports its legionella program, so the
 * energy manager can at least recommend a slot.
 *
 * @param metadata - The heat pump's metadata.
 * @returns `true` when the legionella area is offered.
 */
function hasLegionellaProgram(metadata: EnyoHeatpumpApplianceMetadata): boolean {
    return (metadata.domesticHotWater ?? []).some((zone) => zone.legionella !== undefined);
}

/**
 * Whether the energy manager can write the legionella slot itself: the heat
 * pump declares {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.LegionellaSchedule}
 * and a zone states which parts of the slot are `adjustable`.
 *
 * @param metadata - The heat pump's metadata.
 * @returns `true` when `Auto` is possible for the legionella area.
 */
function canScheduleLegionella(metadata: EnyoHeatpumpApplianceMetadata): boolean {
    return hasAny(metadata, Feature.LegionellaSchedule)
        && (metadata.domesticHotWater ?? []).some((zone) => zone.legionella?.adjustable !== undefined);
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
 * | `LegionellaProgram` | a DHW zone reports `legionella` | offered (the customer moves the slot on the device) | `LegionellaSchedule` and a zone with `legionella.adjustable` |
 *
 * A heat pump the integration marks monitor-only
 * ({@link EnyoHeatpumpApplianceMetadata.controlAllowed} `false`) offers only
 * `Off` in each of these areas: recommending or steering something the
 * integration cannot control would end in commands it refuses.
 *
 * @param metadata - The heat pump's metadata.
 * @param area - The area.
 * @returns The modes the area offers; empty when the area is not offered.
 */
export function availableHeatpumpControlModes(
    metadata: EnyoHeatpumpApplianceMetadata,
    area: EnyoHeatpumpControlAreaEnum,
): EnyoHeatpumpControlModeEnum[] {
    const modes = offeredHeatpumpControlModes(metadata, area);
    return modes.length > 0 && metadata.controlAllowed === false ? [Off] : modes;
}

/**
 * The modes an area offers by the heat pump's features alone, before
 * `controlAllowed` is applied — see {@link availableHeatpumpControlModes}.
 *
 * @param metadata - The heat pump's metadata.
 * @param area - The area.
 * @returns The modes the features allow; empty when the area is not offered.
 */
function offeredHeatpumpControlModes(
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
        case EnyoHeatpumpControlAreaEnum.LegionellaProgram:
            if (!hasLegionellaProgram(metadata)) return [];
            return canScheduleLegionella(metadata) ? [Off, Recommend, Auto] : [Off, Recommend];
        default:
            return [];
    }
}

/**
 * The areas this heat pump offers, in the fixed order `SolarHotWater`,
 * `CostOptimizedHeating`, `HeatingCurve`, `LegionellaProgram`. See
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
 *   as in the energy manager today). `base` is the integration's default
 *   ({@link EnyoHeatpumpApplianceMetadata.controlModeDefaults}, `Off` or
 *   `Recommend`) and `Recommend` when it registered none:
 *   - `SolarHotWater`: `controlled` ? `Auto` : `base`
 *   - `CostOptimizedHeating`: `controlled` ? `Auto` : `base` — `Off` when
 *     `Recommend` is not offered (eco only)
 *   - `HeatingCurve`: `Auto` when `controlled`, a circuit has
 *     `curveOptimization.enabled` and `Auto` is offered; `base` otherwise
 *   - `LegionellaProgram`: always `base` — no switch ever covered it, and
 *     a hygiene setting is not moved without the customer choosing `Auto`
 *
 * So nobody who lets the energy manager control today loses anything — the
 * customer's earlier switches win over the integration's default — and new
 * customers start on the integration's default, or `Recommend`. An
 * integration's default is never `Auto`: an `Auto` there is ignored.
 *
 * A monitor-only heat pump (`controlAllowed: false`) resolves to `Off` in
 * every area, also when the customer stored another mode: the integration's
 * capability wins over the customer's choice. Nobody derives or overwrites
 * `controlAllowed` from the modes.
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
    const base = (area: EnyoHeatpumpControlAreaEnum): EnyoHeatpumpControlModeEnum =>
        integrationControlModeDefault(metadata.controlModeDefaults, area) ?? Recommend;
    const defaults: Record<EnyoHeatpumpControlAreaEnum, EnyoHeatpumpControlModeEnum> = {
        [EnyoHeatpumpControlAreaEnum.SolarHotWater]:
            controlled ? Auto : base(EnyoHeatpumpControlAreaEnum.SolarHotWater),
        [EnyoHeatpumpControlAreaEnum.CostOptimizedHeating]:
            controlled ? Auto : base(EnyoHeatpumpControlAreaEnum.CostOptimizedHeating),
        [EnyoHeatpumpControlAreaEnum.HeatingCurve]:
            controlled && curveOptimizationEnabled ? Auto : base(EnyoHeatpumpControlAreaEnum.HeatingCurve),
        [EnyoHeatpumpControlAreaEnum.LegionellaProgram]: base(EnyoHeatpumpControlAreaEnum.LegionellaProgram),
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
 * This is the only field kept in sync for older energy managers. The other
 * areas are not: `controlAllowed` stays the integration's monitor-only flag,
 * and the house-wide `heatpumpControl` cannot carry a choice made per heat
 * pump. So after a rollback to an energy manager without
 * {@link EnergyManagerFeatureEnum.HeatpumpRecommendations}, hot water and
 * pre-heating follow the old switches again, also where the customer chose
 * `Recommend`. Accepted on purpose: the app offers the modes only while the
 * active energy manager declares that feature.
 *
 * @param modes - The resolved modes ({@link resolveHeatpumpControlModes}).
 * @returns Whether an older energy manager may optimise the heating curve.
 */
export function deriveHeatpumpCurveOptimizationEnabled(modes: EnyoHeatpumpControlModes): boolean {
    return modes[EnyoHeatpumpControlAreaEnum.HeatingCurve] === Auto;
}

/**
 * Whether eco in expensive hours takes effect on this heat pump for an energy
 * manager declaring {@link EnergyManagerFeatureEnum.HeatpumpRecommendations}:
 * the setting is on, the heat pump can switch a heating circuit to eco, and its
 * {@link EnyoHeatpumpControlAreaEnum.CostOptimizedHeating} area resolves to
 * {@link EnyoHeatpumpControlModeEnum.Auto}.
 *
 * Replaces the `heatpumpControl` gate in `ENERGY_MANAGER_SETTING_DEPENDENCIES`
 * for such an energy manager — that gate is per house and cannot see the
 * area modes, which are per heat pump. Older energy managers keep using the
 * gate.
 *
 * @param metadata - The heat pump's metadata.
 * @param settings - The energy manager settings; `heatpumpControl` (defaults)
 *   and `heatpumpEcoModeInExpensiveTimes` are read.
 * @returns `true` when the energy manager may switch this heat pump to eco.
 */
export function isHeatpumpEcoModeActive(
    metadata: EnyoHeatpumpApplianceMetadata,
    settings: Pick<EnergyManagerSettingValues, 'heatpumpControl' | 'heatpumpEcoModeInExpensiveTimes'>,
): boolean {
    return settings.heatpumpEcoModeInExpensiveTimes === true
        && canSwitchToEco(metadata)
        && resolveHeatpumpControlModes(metadata, settings)[EnyoHeatpumpControlAreaEnum.CostOptimizedHeating] === Auto;
}
