/**
 * Which control areas and modes a heating rod offers, and which mode applies —
 * the counterpart of `heatpump-control-modes.ts` for heating rods.
 *
 * A heating rod has a single area,
 * {@link EnyoHeatpumpControlAreaEnum.LegionellaProgram}. Its surplus heating
 * keeps following the energy manager settings (`heatingRodControl`,
 * `heatingRodMode`) and has no area.
 *
 * Pure functions on the rod's metadata, shared by the host (app) and the
 * energy manager, so both read the same modes.
 */

import {EnyoHeatpumpControlAreaEnum, EnyoHeatpumpControlModeEnum} from '../../types/enyo-heatpump-appliance.js';
import {EnyoHeatingRodApplianceAvailableFeaturesEnum} from '../../types/enyo-heating-rod-appliance.js';
import {integrationControlModeDefault} from '../heatpump/heatpump-control-modes.js';
import type {EnyoHeatingRodApplianceMetadata, EnyoHeatingRodControlModes} from '../../types/enyo-heating-rod-appliance.js';

const {Off, Recommend, Auto} = EnyoHeatpumpControlModeEnum;

/** The control areas a heating rod can have. */
export type EnyoHeatingRodControlArea = EnyoHeatpumpControlAreaEnum.LegionellaProgram;

/**
 * The modes the customer can choose for one area of this heating rod, in the
 * order `Off`, `Recommend`, `Auto`. Empty when the rod does not offer the area.
 *
 * | Area | Offered when | `Recommend` when | `Auto` when |
 * |---|---|---|---|
 * | `LegionellaProgram` | the rod reports `legionella` | offered (the customer moves the slot on the device) | `LegionellaSchedule` is declared and `legionella.adjustable` is set |
 *
 * A monitor-only rod ({@link EnyoHeatingRodApplianceMetadata.controlAllowed}
 * `false`) offers only `Off`.
 *
 * @param metadata - The heating rod's metadata.
 * @param area - The area.
 * @returns The modes the area offers; empty when the area is not offered.
 */
export function availableHeatingRodControlModes(
    metadata: EnyoHeatingRodApplianceMetadata,
    area: EnyoHeatpumpControlAreaEnum,
): EnyoHeatpumpControlModeEnum[] {
    if (area !== EnyoHeatpumpControlAreaEnum.LegionellaProgram || metadata.legionella === undefined) return [];
    if (metadata.controlAllowed === false) return [Off];
    const canSchedule = (metadata.availableFeatures ?? []).includes(EnyoHeatingRodApplianceAvailableFeaturesEnum.LegionellaSchedule)
        && metadata.legionella.adjustable !== undefined;
    return canSchedule ? [Off, Recommend, Auto] : [Off, Recommend];
}

/**
 * The areas this heating rod offers — `LegionellaProgram` when the rod
 * reports its legionella program, otherwise none.
 *
 * @param metadata - The heating rod's metadata.
 * @returns The offered areas.
 */
export function heatingRodControlAreas(metadata: EnyoHeatingRodApplianceMetadata): EnyoHeatingRodControlArea[] {
    return availableHeatingRodControlModes(metadata, EnyoHeatpumpControlAreaEnum.LegionellaProgram).length > 0
        ? [EnyoHeatpumpControlAreaEnum.LegionellaProgram]
        : [];
}

/**
 * The mode that applies per area of this heating rod — what an energy manager
 * declaring {@link EnergyManagerFeatureEnum.LegionellaProgram} acts on, and
 * what the app shows.
 *
 * One mode for every offered area ({@link heatingRodControlAreas}). A stored
 * mode ({@link EnyoHeatingRodApplianceMetadata.controlModes}) applies when the
 * area offers it; a stored `Auto` the rod cannot do falls back to `Recommend`.
 * Without a stored mode the default is the integration's
 * ({@link EnyoHeatingRodApplianceMetadata.controlModeDefaults}, `Off` or
 * `Recommend`), else `Recommend` — a hygiene setting is not moved without the
 * customer choosing `Auto`, so an `Auto` default is ignored. A monitor-only
 * rod resolves to `Off`.
 *
 * @param metadata - The heating rod's metadata.
 * @returns The mode per offered area.
 *
 * @example
 * ```ts
 * const modes = resolveHeatingRodControlModes(rod.metadata.heatingRod);
 * if (modes[EnyoHeatpumpControlAreaEnum.LegionellaProgram] === EnyoHeatpumpControlModeEnum.Auto) {
 *     // move the slot with SetLegionellaScheduleV1
 * }
 * ```
 */
export function resolveHeatingRodControlModes(metadata: EnyoHeatingRodApplianceMetadata): EnyoHeatingRodControlModes {
    const resolved: EnyoHeatingRodControlModes = {};
    for (const area of heatingRodControlAreas(metadata)) {
        const available = availableHeatingRodControlModes(metadata, area);
        const wanted = metadata.controlModes?.[area]
            ?? integrationControlModeDefault(metadata.controlModeDefaults, area)
            ?? Recommend;
        resolved[area] = available.includes(wanted) ? wanted : available.includes(Recommend) ? Recommend : Off;
    }
    return resolved;
}
