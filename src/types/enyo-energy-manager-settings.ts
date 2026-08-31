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
    /** How much energy the battery may discharge into a charging vehicle, in Wh. Unset/`null` disables it. */
    BatteryDischargeWhileChargingWh = 'battery-discharge-while-charging-wh',
    /** Hard block on battery discharge into a charging vehicle. Overrides any Wh allowance. */
    BlockBatteryDischargeWhileEvCharging = 'block-battery-discharge-while-ev-charging',

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
     * How much energy the house battery may contribute to a vehicle charging
     * session, in **watt-hours**.
     *
     * Off by default, and off is the safe answer: left alone, a wallbox drains
     * the house battery into the car — a lossy way to move energy that was meant
     * to carry the house through the evening. Setting a figure here opts the
     * transfer in, and bounds it.
     *
     * - a **number** — the battery may give up to this many Wh to the session.
     * - **`null`** or **`undefined`** — **disabled**. The battery does not
     *   discharge into the vehicle at all. The two are equivalent here: `null`
     *   is a stored "off", `undefined` is no stored value, and both mean the
     *   feature is not active.
     *
     * `0` is accepted and means the same thing as disabled; prefer `null` to say
     * it deliberately.
     *
     * Only meaningful while {@link batteryControl} is `true` — holding the
     * battery back during a session is a battery-side action, and an energy
     * manager that may not steer the battery cannot honour any figure here.
     */
    batteryDischargeWhileChargingWh?: number | null;
    /**
     * Whether the house battery is forbidden from discharging into a vehicle
     * while it charges — a hard block, regardless of any budget.
     *
     * **This overrides {@link batteryDischargeWhileChargingWh}.** The two govern
     * the same flow at different strengths: the Wh field is a budget the energy
     * manager may spend, this one closes the tap. When it is `true`, any
     * allowance is ignored rather than merged, so a stored budget can never take
     * effect. `validateEnergyManagerSettingsState()` warns when both are set
     * that way.
     *
     * Why both exist: the budget answers "how much", this answers "at all". A
     * user who wants the battery kept for the house says so once here, and it
     * keeps holding no matter what number is left over in the allowance field.
     *
     * Only meaningful while {@link batteryControl} is `true` — an energy manager
     * that may not steer the battery cannot hold it back either.
     *
     * As with every field here, `undefined` is not `false`: it means unsupported
     * or never chosen, while `false` is the user deciding the battery *may*
     * contribute.
     */
    blockBatteryDischargeWhileEvCharging?: boolean;

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
     * The value {@link requires} must hold. `true` for the boolean gates;
     * an {@link EnyoChargeModeEnum} member for the charge-mode-specific ones.
     */
    equals: boolean | EnyoChargeModeEnum;
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
    [EnergyManagerSettingEnum.BatteryDischargeWhileChargingWh]: {
        requires: EnergyManagerSettingEnum.BatteryControl,
        equals: true,
    },
    [EnergyManagerSettingEnum.BlockBatteryDischargeWhileEvCharging]: {
        requires: EnergyManagerSettingEnum.BatteryControl,
        equals: true,
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
    [EnergyManagerSettingEnum.BatteryDischargeWhileChargingWh]: ['batteryDischargeWhileChargingWh'],
    [EnergyManagerSettingEnum.BlockBatteryDischargeWhileEvCharging]: ['blockBatteryDischargeWhileEvCharging'],
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
