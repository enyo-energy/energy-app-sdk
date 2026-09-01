/**
 * Energy manager **general settings** — the closed, typed set of controls the
 * enyo app offers the user and the active energy manager honours.
 *
 * These are deliberately *not* {@link EnyoPackageConfigurationSetting}s. That
 * model is per-package, string-valued, and rendered on the declaring package's
 * own configuration screen. These settings are the opposite in every dimension:
 * the SDK defines the set, the values are typed, the enyo cockpit renders them
 * once, and **every** app may read them — the energy manager steers by them, and
 * an integration needs to know whether it is allowed to act at all.
 *
 * The shape mirrors {@link EnergyManagerFeatureEnum}: the SDK owns the
 * vocabulary, and an energy manager declares the subset it honours through
 * {@link EnergyAppEnergyManager.registerSupportedSettings}. A cockpit that must
 * render "Batteriesteuerung" identically no matter which energy manager is
 * installed can only do that against a fixed vocabulary.
 *
 * **Absent is not `false`.** An optional boolean that is `undefined` means the
 * setting is unsupported or the user never chose; `false` means the user
 * deliberately turned it off. Code that collapses the two will steer hardware an
 * installer switched off on purpose. Check
 * {@link EnergyManagerSettingsState.supported} first, then the value.
 *
 * Pure type declarations (no runtime logic). Validate a state before publishing
 * or acting on it with `validateEnergyManagerSettingsState()`
 * (`../implementations/energy-manager-settings/energy-manager-settings-validators.ts`).
 */

import type {EnyoChargeModeEnum} from './enyo-data-bus-value.js';

/**
 * The general settings an energy manager can honour.
 *
 * One member per user-facing control. {@link CostOptimizedTarget} covers both
 * halves of the target time (the wall-clock value and its timezone) — they are
 * one setting to the user and are supported, reported and changed together.
 */
export enum EnergyManagerSettingEnum {
    // ── Battery ────────────────────────────────────────────────────────────

    /** Whether the energy manager may steer the battery at all. Gates the other battery settings. */
    BatteryControl = 'battery-control',
    /** How aggressively the battery is charged — see {@link EnergyManagerBatteryChargingModeEnum}. */
    BatteryChargingMode = 'battery-charging-mode',
    /** Whether the battery may be charged from the grid, not only from PV surplus. */
    BatteryChargeFromGrid = 'battery-charge-from-grid',
    /** How the battery may feed a charging vehicle — see {@link EnergyManagerBatteryEvDischargeModeEnum}. */
    BatteryEvDischargeMode = 'battery-ev-discharge-mode',
    /** The per-session budget, in Wh. Only under {@link EnergyManagerBatteryEvDischargeModeEnum.FixedWh}. */
    BatteryEvDischargeFixedWh = 'battery-ev-discharge-fixed-wh',
    /** The SoC floor, in %. Only under {@link EnergyManagerBatteryEvDischargeModeEnum.SocLimit}. */
    BatteryEvDischargeSocLimitPercent = 'battery-ev-discharge-soc-limit-percent',

    // ── Heat pump ──────────────────────────────────────────────────────────

    /** Whether the energy manager may steer the heat pump. */
    HeatpumpControl = 'heatpump-control',

    // ── Heating rod ────────────────────────────────────────────────────────

    /** Whether the energy manager may steer the heating rod. Gates {@link HeatingRodMode}. */
    HeatingRodControl = 'heating-rod-control',
    /** What the heating rod is allowed to do — see {@link EnergyManagerHeatingRodModeEnum}. */
    HeatingRodMode = 'heating-rod-mode',

    // ── Charger ────────────────────────────────────────────────────────────

    /** Whether the energy manager may steer the wallbox. Gates the other charger settings. */
    ChargerControl = 'charger-control',
    /** The charge mode applied when a session starts without an explicit one ({@link EnyoChargeModeEnum}). */
    DefaultChargeMode = 'default-charge-mode',
    /** The price ceiling for {@link EnyoChargeModeEnum.PriceLimit} charging, in ct/kWh. */
    PriceLimitCtPerKwh = 'price-limit-ct-per-kwh',
    /** The daily deadline {@link EnyoChargeModeEnum.CostOptimized} plans against (time + timezone). */
    CostOptimizedTarget = 'cost-optimized-target',
}

/**
 * How aggressively the energy manager charges the battery.
 *
 * The difference is *when* energy goes in, not how much: `Paced` waits for the
 * cheap or self-produced energy the optimiser is expecting, `Immediate` takes it
 * as soon as it is available.
 */
export enum EnergyManagerBatteryChargingModeEnum {
    /**
     * Spread the charge across the planning window, following PV and price.
     * Gentler on the cells and usually cheaper; the battery is not full as early.
     */
    Paced = 'paced',
    /**
     * Charge at the full available power as soon as energy is there. Fills the
     * battery earliest, at the cost of ignoring what the next hours would offer.
     */
    Immediate = 'immediate',
}

/**
 * How the house battery may feed a vehicle that is charging.
 *
 * Replaces the earlier pair of a boolean block and a nullable Wh budget. That
 * shape could express "off" two ways and had no room for the answers installers
 * actually want — drain to a floor, or let enyo work it out — so the strategy is
 * now named once here and its parameter lives in a separate setting.
 *
 * Read {@link None} and {@link Unmanaged} carefully: they are not synonyms, and
 * confusing them is the difference between the energy manager holding the
 * battery back and it simply not looking.
 */
export enum EnergyManagerBatteryEvDischargeModeEnum {
    /**
     * Allow a fixed budget per session, given by
     * {@link EnergyManagerSettingValues.batteryEvDischargeFixedWh}.
     *
     * The plain answer to "how much of my house battery may go into the car" —
     * an amount, spent and then stopped.
     */
    FixedWh = 'fixed-wh',
    /**
     * Discharge into the vehicle until the battery reaches the floor given by
     * {@link EnergyManagerSettingValues.batteryEvDischargeSocLimitPercent}.
     *
     * The same intent as {@link FixedWh} expressed in the unit owners actually
     * reason in — "keep half the battery for the house" survives a change of
     * battery, where a watt-hour figure does not.
     */
    SocLimit = 'soc-limit',
    /**
     * Let enyo decide, session by session.
     *
     * The energy manager weighs price, forecast, house load and departure time
     * instead of following a fixed rule. Nothing further to configure — the
     * other two settings carry no meaning here.
     */
    Intelligent = 'intelligent',
    /**
     * Never discharge the battery into a vehicle. The energy manager actively
     * holds it back.
     *
     * This is an instruction, not an absence of one — contrast {@link Unmanaged},
     * which is the absence. Named for what it does rather than for the amount it
     * permits, so that the two cannot be read as the same answer.
     */
    BlockDischarge = 'block-discharge',
    /**
     * The energy manager does not manage this flow at all.
     *
     * It neither permits nor prevents: whatever the hardware does on its own
     * stands, and the battery may well end up feeding the car as a side effect.
     * Choose this when something else owns the decision, never as a way to
     * express "no discharge" — that is {@link BlockDischarge}.
     */
    Unmanaged = 'unmanaged',
}

/**
 * What the heating rod is allowed to do.
 *
 * The distinction is grid draw. A heating rod is the least efficient way to make
 * heat, so running one on imported electricity is a deliberate choice, not a
 * default.
 */
export enum EnergyManagerHeatingRodModeEnum {
    /**
     * Only ever run on PV surplus. The rod is a dump load for energy that would
     * otherwise be exported; it never causes an import.
     */
    PvSurplusOnly = 'pv-surplus-only',
    /**
     * Actively heat to the target, drawing from the grid when needed — e.g. to
     * reach a legionella temperature the compressor alone cannot.
     */
    Boost = 'boost',
}

/**
 * The current values of the general settings.
 *
 * Every field is optional, and **absent does not mean `false`**: a setting the
 * energy manager does not support has no value, and so does one the user has
 * never touched. Read {@link EnergyManagerSettingsState.supported} before
 * interpreting any of these.
 */
export interface EnergyManagerSettingValues {
    /**
     * Whether the energy manager may steer the battery.
     *
     * `false` is an explicit instruction to leave it alone, not merely the
     * absence of permission — do not treat `undefined` as `false`.
     */
    batteryControl?: boolean;
    /** How aggressively to charge the battery. Only meaningful while {@link batteryControl} is `true`. */
    batteryChargingMode?: EnergyManagerBatteryChargingModeEnum;
    /**
     * Whether the battery may be charged from the grid rather than only from PV
     * surplus. Only meaningful while {@link batteryControl} is `true`.
     */
    batteryChargeFromGrid?: boolean;
    /**
     * How the house battery may feed a vehicle that is charging.
     *
     * The strategy; the number it needs, if any, lives in
     * {@link batteryEvDischargeFixedWh} or
     * {@link batteryEvDischargeSocLimitPercent}. Which of those is read follows
     * from the mode, and a value belonging to a different mode is ignored rather
     * than merged.
     *
     * Left alone, a wallbox drains the house battery into the car — a lossy way
     * to move energy that was meant to carry the house through the evening. That
     * is why the strategy is stated explicitly rather than inferred.
     *
     * Only meaningful while {@link batteryControl} is `true`: an energy manager
     * that may not steer the battery can neither permit nor prevent this.
     */
    batteryEvDischargeMode?: EnergyManagerBatteryEvDischargeModeEnum;
    /**
     * The per-session budget the battery may give a charging vehicle, in
     * **watt-hours**.
     *
     * Read only under {@link EnergyManagerBatteryEvDischargeModeEnum.FixedWh};
     * under any other mode it is stale configuration the energy manager ignores.
     * `0` is legal but says the same as
     * {@link EnergyManagerBatteryEvDischargeModeEnum.BlockDischarge} — prefer the mode,
     * which says it where a reader will look.
     *
     * Watt-hours, not kilowatt-hours: a house battery is 5 000–30 000 Wh, so
     * `10` is a rounding error where `10000` was almost certainly meant.
     */
    batteryEvDischargeFixedWh?: number;
    /**
     * The state of charge the battery may be drained down to when feeding a
     * vehicle, in **percent** — a floor, not a target. `50` keeps half the
     * battery for the house.
     *
     * Read only under {@link EnergyManagerBatteryEvDischargeModeEnum.SocLimit};
     * under any other mode it is ignored.
     *
     * Expressed this way because it is the unit owners reason in, and because it
     * survives a change of battery: "keep half for the house" still means half
     * after the pack is replaced, where a watt-hour budget silently means
     * something else.
     */
    batteryEvDischargeSocLimitPercent?: number;

    /**
     * Whether the energy manager may steer the heat pump.
     *
     * Independent of the appliance's own
     * {@link EnyoHeatpumpApplianceMetadata.controlAllowed}: this is the user's
     * house-wide preference, that one is the integration's capability. Both must
     * allow control before the energy manager acts.
     */
    heatpumpControl?: boolean;

    /** Whether the energy manager may steer the heating rod. */
    heatingRodControl?: boolean;
    /** What the heating rod may do. Only meaningful while {@link heatingRodControl} is `true`. */
    heatingRodMode?: EnergyManagerHeatingRodModeEnum;

    /** Whether the energy manager may steer the wallbox. */
    chargerControl?: boolean;
    /**
     * The mode applied to a charging session started without an explicit one.
     * Only meaningful while {@link chargerControl} is `true`.
     */
    defaultChargeMode?: EnyoChargeModeEnum;
    /**
     * Price ceiling for {@link EnyoChargeModeEnum.PriceLimit} charging, in
     * **cents per kWh** — `7` means 7 ct/kWh, matching what the user types and
     * what the settings UI displays.
     *
     * Note this differs from the SDK's machine-readable price fields such as
     * {@link EnyoDiagnosticsActionReason.electricityPricePerKwh}, which are in
     * EUR/kWh. Divide by 100 when comparing the two — a unit mix-up here is off
     * by 100× and entirely plausible-looking on both sides.
     *
     * Negative values are legal and meaningful: wholesale prices go negative,
     * and "only charge when I am paid to" is a real preference.
     *
     * Only meaningful while {@link defaultChargeMode} is
     * {@link EnyoChargeModeEnum.PriceLimit}.
     */
    priceLimitCtPerKwh?: number;
    /**
     * The daily deadline a {@link EnyoChargeModeEnum.CostOptimized} plan works
     * back from, as a wall-clock time in {@link costOptimizedTimezone} —
     * `"07:30"`, 24-hour `HH:mm`.
     *
     * Wall-clock rather than an absolute instant, matching
     * {@link EnyoDefaultChargeMode.completeAtTime}: the requirement is "ready by
     * half seven every morning", which an instant cannot express — it would
     * expire the first time it passed and need re-setting every evening.
     *
     * Only meaningful while {@link defaultChargeMode} is
     * {@link EnyoChargeModeEnum.CostOptimized}.
     */
    costOptimizedTargetTime?: string;
    /**
     * IANA timezone {@link costOptimizedTargetTime} is expressed in, e.g.
     * `"Europe/Berlin"`. Set it whenever the time is set — without it the
     * wall-clock value cannot be resolved unambiguously across a DST boundary,
     * which is exactly the night a mis-planned charge is noticed.
     */
    costOptimizedTimezone?: string;
}

/**
 * The general settings as they currently stand, together with what the active
 * energy manager actually honours.
 *
 * Read {@link supported} first. A value present for a setting outside it is
 * stale configuration the energy manager will ignore, not an instruction.
 */
export interface EnergyManagerSettingsState {
    /**
     * The settings the active energy manager declared support for, via
     * {@link EnergyAppEnergyManager.registerSupportedSettings}. A cockpit
     * renders only these; an app acts only on these.
     */
    supported: EnergyManagerSettingEnum[];
    /** The current values. Only settings named in {@link supported} can carry one. */
    values: EnergyManagerSettingValues;
}

/**
 * One update to the general settings.
 *
 * Carries the **complete** new state rather than a single field, because these
 * settings are saved as a screen: a per-setting event would fire several times
 * for one user action, and each listener would observe intermediate states that
 * never really existed — charger control switched off while a default charge
 * mode was still set, for instance. {@link changed} preserves the "what moved"
 * information without that hazard.
 */
export interface EnergyManagerSettingsChangeEvent {
    /** Which settings changed in this update. Never empty. */
    changed: EnergyManagerSettingEnum[];
    /** The complete new state, so a listener never has to re-read it. */
    state: EnergyManagerSettingsState;
    /** The values as they stood immediately before this update. */
    previousValues: EnergyManagerSettingValues;
}

/**
 * Callback invoked when the general settings change.
 *
 * @param event - What changed, the full new state, and the previous values.
 */
export type EnergyManagerSettingsChangeListener = (
    event: EnergyManagerSettingsChangeEvent
) => Promise<void> | void;

/**
 * A setting that only takes effect while another setting holds a particular
 * value.
 */
export interface EnergyManagerSettingDependency {
    /** The setting that gates this one. */
    requires: EnergyManagerSettingEnum;
    /**
     * The value {@link requires} must hold. `true` for the boolean gates, an
     * {@link EnyoChargeModeEnum} member for the charge-mode-specific ones, and an
     * {@link EnergyManagerBatteryEvDischargeModeEnum} member for the two settings
     * that parameterise the battery-to-vehicle strategy.
     */
    equals: boolean | EnyoChargeModeEnum | EnergyManagerBatteryEvDischargeModeEnum;
}

/**
 * Which settings are gated by which, as data.
 *
 * Six of the ten settings only mean anything while another one holds a specific
 * value. Encoding that here rather than in prose gives the cockpit a single
 * source of truth for greying out dependent controls, and lets
 * `validateEnergyManagerSettingsState()` flag values that can never take effect.
 *
 * Settings absent from this map are ungated.
 *
 * @example
 * ```typescript
 * const dep = ENERGY_MANAGER_SETTING_DEPENDENCIES[EnergyManagerSettingEnum.HeatingRodMode];
 * // {requires: EnergyManagerSettingEnum.HeatingRodControl, equals: true}
 * ```
 */
export const ENERGY_MANAGER_SETTING_DEPENDENCIES: Readonly<
    Partial<Record<EnergyManagerSettingEnum, EnergyManagerSettingDependency>>
> = {
    [EnergyManagerSettingEnum.BatteryChargingMode]: {
        requires: EnergyManagerSettingEnum.BatteryControl,
        equals: true,
    },
    [EnergyManagerSettingEnum.BatteryChargeFromGrid]: {
        requires: EnergyManagerSettingEnum.BatteryControl,
        equals: true,
    },
    [EnergyManagerSettingEnum.BatteryEvDischargeMode]: {
        requires: EnergyManagerSettingEnum.BatteryControl,
        equals: true,
    },
    [EnergyManagerSettingEnum.BatteryEvDischargeFixedWh]: {
        requires: EnergyManagerSettingEnum.BatteryEvDischargeMode,
        equals: EnergyManagerBatteryEvDischargeModeEnum.FixedWh,
    },
    [EnergyManagerSettingEnum.BatteryEvDischargeSocLimitPercent]: {
        requires: EnergyManagerSettingEnum.BatteryEvDischargeMode,
        equals: EnergyManagerBatteryEvDischargeModeEnum.SocLimit,
    },
    [EnergyManagerSettingEnum.HeatingRodMode]: {
        requires: EnergyManagerSettingEnum.HeatingRodControl,
        equals: true,
    },
    [EnergyManagerSettingEnum.DefaultChargeMode]: {
        requires: EnergyManagerSettingEnum.ChargerControl,
        equals: true,
    },
    [EnergyManagerSettingEnum.PriceLimitCtPerKwh]: {
        requires: EnergyManagerSettingEnum.DefaultChargeMode,
        equals: 'price-limit' as EnyoChargeModeEnum,
    },
    [EnergyManagerSettingEnum.CostOptimizedTarget]: {
        requires: EnergyManagerSettingEnum.DefaultChargeMode,
        equals: 'cost-optimized' as EnyoChargeModeEnum,
    },
} as const;

/**
 * The {@link EnergyManagerSettingValues} field(s) each setting is carried by.
 *
 * {@link EnergyManagerSettingEnum.CostOptimizedTarget} maps to two fields — the
 * wall-clock time and its timezone — because they are one setting to the user
 * and travel together.
 */
export const ENERGY_MANAGER_SETTING_VALUE_KEYS: Readonly<
    Record<EnergyManagerSettingEnum, ReadonlyArray<keyof EnergyManagerSettingValues>>
> = {
    [EnergyManagerSettingEnum.BatteryControl]: ['batteryControl'],
    [EnergyManagerSettingEnum.BatteryChargingMode]: ['batteryChargingMode'],
    [EnergyManagerSettingEnum.BatteryChargeFromGrid]: ['batteryChargeFromGrid'],
    [EnergyManagerSettingEnum.BatteryEvDischargeMode]: ['batteryEvDischargeMode'],
    [EnergyManagerSettingEnum.BatteryEvDischargeFixedWh]: ['batteryEvDischargeFixedWh'],
    [EnergyManagerSettingEnum.BatteryEvDischargeSocLimitPercent]: ['batteryEvDischargeSocLimitPercent'],
    [EnergyManagerSettingEnum.HeatpumpControl]: ['heatpumpControl'],
    [EnergyManagerSettingEnum.HeatingRodControl]: ['heatingRodControl'],
    [EnergyManagerSettingEnum.HeatingRodMode]: ['heatingRodMode'],
    [EnergyManagerSettingEnum.ChargerControl]: ['chargerControl'],
    [EnergyManagerSettingEnum.DefaultChargeMode]: ['defaultChargeMode'],
    [EnergyManagerSettingEnum.PriceLimitCtPerKwh]: ['priceLimitCtPerKwh'],
    [EnergyManagerSettingEnum.CostOptimizedTarget]: [
        'costOptimizedTargetTime',
        'costOptimizedTimezone',
    ],
} as const;
