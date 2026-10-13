import {
    EnyoDataBusHeatpumpFlexibilityAnnouncementV3,
    EnyoHeatpumpFlexibilityOption,
    EnyoHeatpumpHeatSourceEnum,
} from '../../types/enyo-data-bus-value.js';
import {
    EnyoHeatpumpApplianceAvailableFeaturesEnum,
    EnyoHeatpumpApplianceMetadata,
} from '../../types/enyo-heatpump-appliance.js';
import {HEATPUMP_CONTROL_TARGET_FEATURE} from './heatpump-control-validators.js';

/**
 * Result of {@link validateHeatpumpFlexibilityAnnouncement}: `ok` is `false`
 * when there are errors; warnings never block.
 */
export interface HeatpumpFlexibilityValidationResult {
    /** `true` when there are no errors. */
    ok: boolean;
    /** Problems that make the offer wrong or unactionable. */
    errors: string[];
    /** Problems worth logging that do not make the offer wrong. */
    warnings: string[];
}

/**
 * Derives the `offerId` of a `HeatpumpFlexibilityAnnouncementV3` from what is
 * offered.
 *
 * Measured values (`currentTemperatureC`, `progress`) are left out, so the id
 * stays the same while the tank warms up and changes only when the offer's
 * substance — zones, headroom, sources, power, timing, requirement — changes.
 * Independent of the order of the options.
 *
 * @param options - The offer's options.
 * @returns An 8-character hex id.
 */
export function heatpumpFlexibilityOfferId(options: EnyoHeatpumpFlexibilityOption[]): string {
    const substance = options
        .map(({currentTemperatureC: _t, progress: _p, ...rest}) => stableStringify(rest))
        .sort()
        .join('|');
    // FNV-1a, 32 bit: short, deterministic, and enough to tell offers apart.
    let hash = 0x811c9dc5;
    for (let i = 0; i < substance.length; i++) {
        hash ^= substance.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Validates the data of a `HeatpumpFlexibilityAnnouncementV3`, optionally
 * against the heatpump's metadata.
 *
 * Errors:
 * - `validUntilIso` is not an ISO 8601 timestamp.
 * - Two options for the same `target` and `index` (an omitted index counts as `0`).
 * - An option's `maxDeltaK` is not a finite positive number, or its
 *   `minDeltaK` is not positive or exceeds `maxDeltaK`.
 * - An option offers no heat source, the same source twice, or a power band
 *   that is negative, inverted or has a non-positive `stepWatt`.
 * - `earliestStartIso` / `latestStartIso` / `required.byIso` is not ISO 8601,
 *   or `earliestStartIso` is not before `latestStartIso`.
 * - `required.deltaK` is not positive or exceeds `maxDeltaK`.
 * - With metadata: a DHW option's `setpointC + maxDeltaK` exceeds the zone's
 *   `maxTemperatureC`; a heating-rod source without `HeatingRodControllable`;
 *   an option whose target's overheating feature is not declared (it could
 *   never be controlled).
 *
 * Warnings:
 * - With metadata: the heatpump does not declare `FlexibilityAnnouncementV3`.
 * - A negative `estimatedElectricalKwh`.
 *
 * @param data - The announcement's data.
 * @param metadata - The heatpump's metadata, if known.
 * @returns The validation result.
 *
 * @example
 * ```typescript
 * const {ok, errors} = validateHeatpumpFlexibilityAnnouncement(message.data, appliance.heatpump);
 * if (!ok) console.error('invalid heatpump offer', errors);
 * ```
 */
export function validateHeatpumpFlexibilityAnnouncement(
    data: EnyoDataBusHeatpumpFlexibilityAnnouncementV3['data'],
    metadata?: EnyoHeatpumpApplianceMetadata,
): HeatpumpFlexibilityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const isIso = (value: string | undefined) => value === undefined || Number.isFinite(Date.parse(value));
    const features = metadata?.availableFeatures ?? [];

    if (!isIso(data.validUntilIso) || data.validUntilIso === undefined) {
        errors.push(`validUntilIso is not an ISO 8601 timestamp: ${data.validUntilIso}`);
    }
    if (metadata && !features.includes(EnyoHeatpumpApplianceAvailableFeaturesEnum.FlexibilityAnnouncementV3)) {
        warnings.push('The heatpump does not declare FlexibilityAnnouncementV3 — consumers may ignore the offer.');
    }

    const seen = new Set<string>();
    for (const [i, option] of (data.options ?? []).entries()) {
        const prefix = `options[${i}] (${option.target} ${option.index ?? 0})`;
        const key = `${option.target}:${option.index ?? 0}`;
        if (seen.has(key)) errors.push(`${prefix}: the zone is offered more than once`);
        seen.add(key);

        if (!Number.isFinite(option.maxDeltaK) || option.maxDeltaK <= 0) {
            errors.push(`${prefix}: maxDeltaK must be a finite positive number; got ${option.maxDeltaK}`);
        }
        if (option.minDeltaK !== undefined) {
            if (!Number.isFinite(option.minDeltaK) || option.minDeltaK <= 0) {
                errors.push(`${prefix}: minDeltaK must be a finite positive number; got ${option.minDeltaK}`);
            } else if (option.minDeltaK > option.maxDeltaK) {
                errors.push(`${prefix}: minDeltaK ${option.minDeltaK} K exceeds maxDeltaK ${option.maxDeltaK} K`);
            }
        }

        if (!option.heatSources || option.heatSources.length === 0) {
            errors.push(`${prefix}: at least one heat source must be offered`);
        }
        const sources = new Set<string>();
        for (const source of option.heatSources ?? []) {
            if (sources.has(source.heatSource)) errors.push(`${prefix}: heat source ${source.heatSource} is offered twice`);
            sources.add(source.heatSource);
            const {minWatt, maxWatt, stepWatt} = source.power ?? {};
            if (![minWatt, maxWatt, stepWatt].every((v) => Number.isFinite(v))
                || minWatt! < 0 || maxWatt! < minWatt! || stepWatt! <= 0) {
                errors.push(`${prefix}: ${source.heatSource} power band must have 0 <= minWatt <= maxWatt and stepWatt > 0`);
            }
            if (source.estimatedElectricalKwh !== undefined && source.estimatedElectricalKwh < 0) {
                warnings.push(`${prefix}: ${source.heatSource} estimatedElectricalKwh is negative`);
            }
            if (metadata && source.heatSource === EnyoHeatpumpHeatSourceEnum.HeatingRod
                && !features.includes(EnyoHeatpumpApplianceAvailableFeaturesEnum.HeatingRodControllable)) {
                errors.push(`${prefix}: a heating rod is offered but the heatpump does not declare HeatingRodControllable`);
            }
        }

        for (const field of ['earliestStartIso', 'latestStartIso'] as const) {
            if (!isIso(option[field])) errors.push(`${prefix}: ${field} is not an ISO 8601 timestamp`);
        }
        if (option.earliestStartIso && option.latestStartIso
            && Date.parse(option.earliestStartIso) >= Date.parse(option.latestStartIso)) {
            errors.push(`${prefix}: earliestStartIso must lie before latestStartIso`);
        }

        if (option.required) {
            if (!Number.isFinite(option.required.deltaK) || option.required.deltaK <= 0) {
                errors.push(`${prefix}: required.deltaK must be a finite positive number`);
            } else if (option.required.deltaK > option.maxDeltaK) {
                errors.push(`${prefix}: required.deltaK ${option.required.deltaK} K exceeds maxDeltaK ${option.maxDeltaK} K`);
            }
            if (!isIso(option.required.byIso) || option.required.byIso === undefined) {
                errors.push(`${prefix}: required.byIso is not an ISO 8601 timestamp`);
            }
        }

        if (metadata) {
            const feature = HEATPUMP_CONTROL_TARGET_FEATURE[option.target];
            if (feature && !features.includes(feature)) {
                errors.push(`${prefix}: the heatpump does not declare ${feature}, so the offer could never be controlled`);
            }
            if (option.target === 'dhw' && option.setpointC !== undefined) {
                const zones = metadata.domesticHotWater ?? [];
                const zone = option.index === undefined ? zones[0] : zones.find((z) => z.index === option.index);
                if (zone?.maxTemperatureC !== undefined && option.setpointC + option.maxDeltaK > zone.maxTemperatureC) {
                    errors.push(
                        `${prefix}: setpointC ${option.setpointC} °C + maxDeltaK ${option.maxDeltaK} K exceeds ` +
                            `maxTemperatureC ${zone.maxTemperatureC} °C`,
                    );
                }
            }
        }
    }

    return {ok: errors.length === 0, errors, warnings};
}

/** JSON with object keys sorted, so equal content gives an equal string. */
function stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value as Record<string, unknown>).sort()
            .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
            .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
            .join(',')}}`;
    }
    return JSON.stringify(value);
}
