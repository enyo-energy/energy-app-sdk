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

/**
 * The general settings an energy manager can honour.
 *
 * One member per user-facing control.
 *
 * Charge-mode preferences — the default {@link EnyoChargeModeEnum}, the price
 * ceiling and the cost-optimised deadline — are deliberately **not** general
 * settings: they live on the wallbox ({@link EnyoChargerApplianceMetadata}) and
 * on the vehicle (`EnyoVehicle`), the places a session resolves them from.
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
    /**
     * The SoC, in %, the battery is charged to from PV surplus before any other
     * surplus consumer (EV, heating rod, …) gets a share.
     */
    BatteryPvPriorityTargetSocPercent = 'battery-pv-priority-target-soc-percent',
    /**
     * The home consumption, in W, above which the battery must not discharge.
     * Unset or `null` means no such block.
     */
    BatteryDischargeBlockAboveHomeConsumptionW = 'battery-discharge-block-above-home-consumption-w',

    // ── Heat pump ──────────────────────────────────────────────────────────

    /** Whether the energy manager may steer the heat pump. Gates {@link HeatpumpEcoModeInExpensiveTimes}. */
    HeatpumpControl = 'heatpump-control',
    /**
     * Whether the heat pump is switched to its eco / reduced setpoint while
     * electricity is expensive.
     */
    HeatpumpEcoModeInExpensiveTimes = 'heatpump-eco-mode-in-expensive-times',

    // ── Heating rod ────────────────────────────────────────────────────────

    /** Whether the energy manager may steer the heating rod. Gates {@link HeatingRodMode}. */
    HeatingRodControl = 'heating-rod-control',
    /** What the heating rod is allowed to do — see {@link EnergyManagerHeatingRodModeEnum}. */
    HeatingRodMode = 'heating-rod-mode',
    /**
     * The SoC floor, in %, down to which the house battery may feed the
     * heating rod. Unset or `null` means the battery never feeds the rod.
     */
    HeatingRodBatteryDischargeSocLimitPercent = 'heating-rod-battery-discharge-soc-limit-percent',

    // ── Charger ────────────────────────────────────────────────────────────

    /** Whether the energy manager may steer the wallbox. Gates the other charger settings. */
    ChargerControl = 'charger-control',
    /**
     * Whether cost-optimised charging on a non-dynamic tariff places its grid
     * energy in low-load hours (by EPEX spot) to relieve the grid.
     */
    GridOptimizedEvCharging = 'grid-optimized-ev-charging',
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
     * otherwise be exported; it never causes an import. With
     * {@link EnergyManagerSettingValues.heatingRodBatteryDischargeSocLimitPercent}
     * set, the battery above that floor counts as supply too.
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
     * The state of charge, in **percent**, the battery is charged to from PV
     * surplus **before** any other surplus consumer gets a share — a target,
     * not a floor. `40` means: until the battery holds 40 %, PV surplus goes
     * into the battery first, and an EV charging on PV, a heating rod in
     * {@link EnergyManagerHeatingRodModeEnum.PvSurplusOnly}, a heat pump surplus
     * boost or a surplus automation only receives what the battery cannot take.
     * Above the target, surplus is shared as without this setting.
     *
     * Only consumers that run *on surplus* are held back. An explicit user
     * request, an immediate or cost-optimised charge session that imports from
     * the grid, and any other grid-backed mode are unaffected — this setting
     * decides who gets the sun first, not whether the house may import.
     *
     * **Disabled by default.** Absent or `null` means "no priority" — the
     * battery competes for surplus as it always has. Write `null` to switch it
     * off again; `0` says the same but is flagged by the validator. While the battery is below the target it is charged as
     * fast as the surplus allows, overriding
     * {@link EnergyManagerBatteryChargingModeEnum.Paced}; once the target is
     * reached, {@link batteryChargingMode} applies again. The energy manager
     * applies its own hysteresis around the target so consumers are not cycled
     * on and off at the threshold.
     *
     * Not to be confused with {@link batteryEvDischargeSocLimitPercent}: that
     * is a floor for *discharging* the battery into a vehicle, this is a target
     * for *charging* it from PV. They are independent.
     *
     * When a consumer is held back or reduced because of this setting, the
     * energy manager states it with
     * {@link EnyoDataBusCommandReasonTypeEnum.BatteryPvPriority}.
     *
     * Only meaningful while {@link batteryControl} is `true`.
     */
    batteryPvPriorityTargetSocPercent?: number | null;
    /**
     * The home consumption, in **watts**, above which the battery is blocked
     * from discharging. `11000` means: while the house draws more than 11 kW,
     * the battery holds its charge and the grid covers the load; once
     * consumption falls back below, the battery may discharge again.
     *
     * Keeps a large but short-lived household load — a sauna, an oven, an
     * instantaneous water heater — from emptying the battery in minutes, so its
     * charge is left for the base load in the evening and night.
     *
     * **Disabled by default.** Absent or `null` means the battery discharges
     * regardless of consumption; write `null` to switch it off again.
     *
     * "Home consumption" is the household itself plus every appliance the
     * energy manager does **not** track — the same quantity as
     * {@link HomeConsumptionTimeseriesEntry.homeConsumptionW}. Tracked
     * appliances (wallbox, heat pump, heating rod, air conditioning, …) are
     * excluded, as is the battery's own charging: a charging car never trips
     * the block on its own. The energy manager applies its own hysteresis and
     * averaging around the threshold so a brief spike does not toggle the
     * battery.
     *
     * The block wins over every permission to discharge: while it holds,
     * neither {@link batteryEvDischargeMode} nor
     * {@link heatingRodBatteryDischargeSocLimitPercent} lets the battery feed
     * anything. Charging is unaffected.
     *
     * Watts, not kilowatts — the cockpit may show kW, but the stored value is
     * W like every other power in this SDK: `11` would block above 11 W, i.e.
     * almost always.
     *
     * When the battery is held because of this setting, the energy manager
     * states it with {@link EnyoDataBusCommandReasonTypeEnum.HomeConsumptionHigh}.
     *
     * Only meaningful while {@link batteryControl} is `true`.
     */
    batteryDischargeBlockAboveHomeConsumptionW?: number | null;

    /**
     * Whether the energy manager may steer the heat pump.
     *
     * Independent of the appliance's own
     * {@link EnyoHeatpumpApplianceMetadata.controlAllowed}: this is the user's
     * house-wide preference, that one is the integration's capability. Both must
     * allow control before the energy manager acts.
     */
    heatpumpControl?: boolean;
    /**
     * Whether the energy manager switches the heat pump to the user's **eco**
     * setpoint while electricity is expensive. **Off by default** — absent or
     * `false` means off.
     *
     * While on, the energy manager sends
     * {@link EnyoDataBusHeatpumpProgramSwitchV3} with
     * {@link EnyoHeatpumpProgramModeEnum.Eco} to every zone (heating circuit or
     * DHW zone) that lists `eco` in its `supportedProgramModes`, for the hours
     * the active consumption tariff makes expensive, and
     * {@link EnyoHeatpumpProgramModeEnum.Program} once they are over. The
     * temperatures are the user's own
     * ({@link EnyoHeatpumpApplianceHeatingCircuit.programModeTemperaturesC}) —
     * the energy manager chooses only *when* eco applies, never how low it is.
     *
     * Which hours count as expensive is the energy manager's call, taken from
     * the tariff: the dearest slots of the day under a
     * {@link EnyoTariffPricingTypeEnum.Dynamic} tariff, the high-price windows
     * under a {@link EnyoTariffPricingTypeEnum.TimeVariable} one. Under a
     * {@link EnyoTariffPricingTypeEnum.Static} tariff no hour is dearer than
     * another, so the setting has no effect. While PV surplus covers the heat
     * pump, the grid price does not apply and the energy manager may leave the
     * zone on its program.
     *
     * Only heat pumps declaring
     * {@link EnyoHeatpumpApplianceAvailableFeaturesEnum.ProgramSwitch} can
     * follow it; on all others the setting has no effect.
     *
     * Each switch to eco because of this setting carries the reason
     * {@link EnyoDataBusCommandReasonTypeEnum.ElectricityPriceAboveThreshold}
     * (category {@link EnyoDataBusCommandReasonCategoryEnum.EnergyPrice}), with
     * {@link EnyoDataBusCommandReason.electricityPricePerKwh} set to the price
     * of the current slot.
     *
     * Only meaningful while {@link heatpumpControl} is `true`.
     */
    heatpumpEcoModeInExpensiveTimes?: boolean;

    /** Whether the energy manager may steer the heating rod. */
    heatingRodControl?: boolean;
    /** What the heating rod may do. Only meaningful while {@link heatingRodControl} is `true`. */
    heatingRodMode?: EnergyManagerHeatingRodModeEnum;
    /**
     * The state of charge, in **percent**, down to which the house battery may
     * feed the heating rod — a floor, not a target. `80` lets the rod draw from
     * the battery while it holds more than 80 %, and stops it there.
     *
     * **Disabled by default.** Absent or `null` means the battery never feeds
     * the rod; write `null` to switch it off again.
     *
     * Applies under both {@link EnergyManagerHeatingRodModeEnum} values. Under
     * {@link EnergyManagerHeatingRodModeEnum.PvSurplusOnly} it widens the rod's
     * supply from PV surplus to PV surplus plus the battery above the floor —
     * still never a grid import. Under
     * {@link EnergyManagerHeatingRodModeEnum.Boost} the battery above the floor
     * is drawn before the grid.
     *
     * The energy manager can only hold the battery at the floor while
     * {@link batteryControl} is `true`; set without it, the validator warns.
     * Keep it at or above {@link batteryPvPriorityTargetSocPercent}: a floor
     * below that target lets the rod drain the battery into a range the PV
     * priority then refills, and the two work against each other.
     *
     * When the battery feeds the rod, or is held back from it at the floor, the
     * energy manager states it with
     * {@link EnyoDataBusCommandReasonTypeEnum.BatterySupportsHeatingRod} or
     * {@link EnyoDataBusCommandReasonTypeEnum.BatteryReservedFromHeatingRod}.
     *
     * Only meaningful while {@link heatingRodControl} is `true`.
     */
    heatingRodBatteryDischargeSocLimitPercent?: number | null;

    /** Whether the energy manager may steer the wallbox. */
    chargerControl?: boolean;
    /**
     * Whether EV charging should avoid putting load on the grid when it is
     * busiest. **Off by default** — absent or `false` means off.
     *
     * Applies only to sessions in {@link EnyoChargeModeEnum.CostOptimized},
     * whatever made them cost-optimised (the wallbox, the vehicle or the
     * session), and only while the active consumption tariff is
     * **not** dynamic — {@link EnyoTariffPricingTypeEnum.Static} or
     * {@link EnyoTariffPricingTypeEnum.TimeVariable}. It adds no charge mode
     * and changes no other mode.
     *
     * Without it, such a session imports whatever PV did not cover as late as
     * possible before its deadline (static tariff) or in the tariff's cheap
     * windows (time-of-use). With it, the energy manager places that grid
     * energy in the hours with the lowest EPEX spot price before the deadline
     * instead — the spot price standing in for how heavily the grid is loaded.
     * PV surplus still comes first, and the deadline is still met.
     *
     * The purpose is grid relief, not savings: the customer's price per kWh is
     * unchanged by it on a static tariff, and on a time-of-use tariff a
     * low-load hour may fall in a more expensive window — the owner opted into
     * that trade by switching this on. A price ceiling on the session still
     * applies as before, against the customer's own tariff.
     *
     * Under a dynamic tariff the setting has no effect: cost-optimised charging
     * already follows the market price there. When no EPEX prices are
     * available, the energy manager falls back to the behaviour without it.
     *
     * Charging placed or deferred because of this setting is stated with
     * {@link EnyoDataBusCommandReasonTypeEnum.GridLoadOptimized}.
     *
     * Only meaningful while {@link chargerControl} is `true`.
     */
    gridOptimizedEvCharging?: boolean;
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
 * never really existed — charger control switched off while grid-optimised
 * EV charging was still on, for instance. {@link changed} preserves the "what moved"
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
     * The value {@link requires} must hold. `true` for the boolean gates, and
     * an {@link EnergyManagerBatteryEvDischargeModeEnum} member for the two
     * settings that parameterise the battery-to-vehicle strategy.
     */
    equals: boolean | EnergyManagerBatteryEvDischargeModeEnum;
}

/**
 * Which settings are gated by which, as data.
 *
 * Eleven of the fifteen settings only mean anything while another one holds a specific
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
    [EnergyManagerSettingEnum.BatteryPvPriorityTargetSocPercent]: {
        requires: EnergyManagerSettingEnum.BatteryControl,
        equals: true,
    },
    [EnergyManagerSettingEnum.BatteryDischargeBlockAboveHomeConsumptionW]: {
        requires: EnergyManagerSettingEnum.BatteryControl,
        equals: true,
    },
    [EnergyManagerSettingEnum.HeatpumpEcoModeInExpensiveTimes]: {
        requires: EnergyManagerSettingEnum.HeatpumpControl,
        equals: true,
    },
    [EnergyManagerSettingEnum.HeatingRodMode]: {
        requires: EnergyManagerSettingEnum.HeatingRodControl,
        equals: true,
    },
    [EnergyManagerSettingEnum.HeatingRodBatteryDischargeSocLimitPercent]: {
        requires: EnergyManagerSettingEnum.HeatingRodControl,
        equals: true,
    },
    [EnergyManagerSettingEnum.GridOptimizedEvCharging]: {
        requires: EnergyManagerSettingEnum.ChargerControl,
        equals: true,
    },
} as const;

/**
 * The {@link EnergyManagerSettingValues} field(s) each setting is carried by.
 *
 * Every setting currently maps to exactly one field; the value is an array so a
 * setting that is one control to the user but several values (a time and its
 * timezone, say) can be carried without changing the shape.
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
    [EnergyManagerSettingEnum.BatteryPvPriorityTargetSocPercent]: ['batteryPvPriorityTargetSocPercent'],
    [EnergyManagerSettingEnum.BatteryDischargeBlockAboveHomeConsumptionW]: [
        'batteryDischargeBlockAboveHomeConsumptionW',
    ],
    [EnergyManagerSettingEnum.HeatpumpControl]: ['heatpumpControl'],
    [EnergyManagerSettingEnum.HeatpumpEcoModeInExpensiveTimes]: ['heatpumpEcoModeInExpensiveTimes'],
    [EnergyManagerSettingEnum.HeatingRodControl]: ['heatingRodControl'],
    [EnergyManagerSettingEnum.HeatingRodMode]: ['heatingRodMode'],
    [EnergyManagerSettingEnum.HeatingRodBatteryDischargeSocLimitPercent]: [
        'heatingRodBatteryDischargeSocLimitPercent',
    ],
    [EnergyManagerSettingEnum.ChargerControl]: ['chargerControl'],
    [EnergyManagerSettingEnum.GridOptimizedEvCharging]: ['gridOptimizedEvCharging'],
} as const;
