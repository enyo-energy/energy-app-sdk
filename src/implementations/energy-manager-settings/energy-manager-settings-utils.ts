/**
 * Lookups over the energy-manager settings gate tree.
 *
 * {@link ENERGY_MANAGER_SETTING_DEPENDENCIES} is the data; these are the two
 * questions worth asking of it. Both exist so a cockpit, an energy manager and
 * the validator answer them the same way instead of each restating the tree.
 *
 * The tree is not flat. `BatteryEvDischargeFixedWh` is gated on
 * `BatteryEvDischargeMode`, which is itself gated on `BatteryControl` — so
 * "which setting does this depend on" and "may this setting take effect right
 * now" are genuinely different questions, and the second one has to walk.
 */

import {
    ENERGY_MANAGER_SETTING_DEPENDENCIES,
    ENERGY_MANAGER_SETTING_VALUE_KEYS,
} from '../../types/enyo-energy-manager-settings.js';
import type {
    EnergyManagerSettingDependency,
    EnergyManagerSettingEnum,
    EnergyManagerSettingValues,
} from '../../types/enyo-energy-manager-settings.js';

/**
 * The setting a given setting depends on, and the value that gate must hold.
 *
 * Returns `null` for an ungated setting — `BatteryControl`, `HeatpumpControl`,
 * `HeatingRodControl` and `ChargerControl` are the roots of the tree and depend
 * on nothing.
 *
 * The gate's required *value* comes back with it, because the gate alone is not
 * actionable: knowing `PriceLimitCtPerKwh` depends on `DefaultChargeMode` does
 * not tell you it needs that mode to be `price-limit` specifically.
 *
 * Only the **direct** gate is returned, one level up. Use
 * {@link isEnergyManagerSettingActive} to resolve a whole chain.
 *
 * @param setting - The setting to look up.
 * @returns Its {@link EnergyManagerSettingDependency}, or `null` when ungated.
 *
 * @example
 * ```typescript
 * getEnergyManagerSettingDependency(EnergyManagerSettingEnum.HeatingRodMode);
 * // → {requires: EnergyManagerSettingEnum.HeatingRodControl, equals: true}
 *
 * getEnergyManagerSettingDependency(EnergyManagerSettingEnum.BatteryEvDischargeFixedWh);
 * // → {requires: EnergyManagerSettingEnum.BatteryEvDischargeMode, equals: 'fixed-wh'}
 *
 * getEnergyManagerSettingDependency(EnergyManagerSettingEnum.BatteryControl);
 * // → null
 * ```
 */
export function getEnergyManagerSettingDependency(
    setting: EnergyManagerSettingEnum,
): EnergyManagerSettingDependency | null {
    return ENERGY_MANAGER_SETTING_DEPENDENCIES[setting] ?? null;
}

/**
 * Whether a setting can take effect given the values currently stored — the
 * question a cockpit asks before rendering a control, and an energy manager asks
 * before acting on one.
 *
 * Walks the whole chain, not just the direct gate: a fixed-Wh budget is live
 * only when the mode is `fixed-wh` **and** battery control is on. Checking one
 * level would report a budget as active under a mode whose own gate is closed.
 *
 * An ungated setting is always active. A gate that is unset (`undefined`) counts
 * as not holding — consistent with the rest of this model, where absent is
 * neither `true` nor `false` but "no choice was made".
 *
 * Says nothing about whether the setting is *supported*; check
 * {@link EnergyManagerSettingsState.supported} for that. A setting can be
 * perfectly active and still not implemented by the installed energy manager.
 *
 * @param setting - The setting to test.
 * @param values - The currently stored values.
 * @returns True when every gate above this setting holds.
 *
 * @example
 * ```typescript
 * const values = {
 *     batteryControl: true,
 *     batteryEvDischargeMode: EnergyManagerBatteryEvDischargeModeEnum.SocLimit,
 * };
 *
 * isEnergyManagerSettingActive(EnergyManagerSettingEnum.BatteryEvDischargeSocLimitPercent, values);
 * // → true
 * isEnergyManagerSettingActive(EnergyManagerSettingEnum.BatteryEvDischargeFixedWh, values);
 * // → false — the mode is soc-limit, so a Wh budget could never be spent
 * ```
 */
export function isEnergyManagerSettingActive(
    setting: EnergyManagerSettingEnum,
    values: EnergyManagerSettingValues,
): boolean {
    // The tree is small and authored by hand, but a cycle would hang the walk —
    // bound it by the number of settings rather than trusting the data.
    const seen = new Set<EnergyManagerSettingEnum>();
    let current: EnergyManagerSettingEnum | null = setting;

    while (current) {
        if (seen.has(current)) return false;
        seen.add(current);

        const dependency: EnergyManagerSettingDependency | null =
            getEnergyManagerSettingDependency(current);
        if (!dependency) return true;

        const [key] = ENERGY_MANAGER_SETTING_VALUE_KEYS[dependency.requires];
        if (!key || values[key] !== dependency.equals) return false;

        current = dependency.requires;
    }

    return true;
}
