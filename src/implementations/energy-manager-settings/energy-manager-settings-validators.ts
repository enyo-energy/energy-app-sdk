/**
 * Client-side validation for {@link EnergyManagerSettingsState} — the general
 * settings an energy manager declares and the values stored against them.
 *
 * Two classes of problem live here, and only the second is obvious:
 *
 * 1. **Malformed values.** A `HH:mm` that is not a time, a timezone that is not
 *    an IANA zone, a price that is not a finite number. These fail at planning
 *    time, in the dark, on the night the charge was supposed to happen.
 * 2. **Values that can never take effect.** A heating-rod mode stored while rod
 *    control is off, a price limit while the default charge mode is
 *    cost-optimized. Nothing rejects these — they simply do nothing, which reads
 *    to a user as "the app ignored me".
 *
 * The second class is why {@link ENERGY_MANAGER_SETTING_DEPENDENCIES} exists as
 * data: the gate tree is checked here rather than restated by every surface.
 *
 * `errors` mean the state is malformed; `warnings` are advisory. Use
 * {@link validateEnergyManagerSettingsState} for the non-throwing result, or
 * {@link assertValidEnergyManagerSettingsState} to throw.
 */

import {
    ENERGY_MANAGER_SETTING_DEPENDENCIES,
    ENERGY_MANAGER_SETTING_VALUE_KEYS,
    EnergyManagerBatteryChargingModeEnum,
    EnergyManagerBatteryEvDischargeModeEnum,
    EnergyManagerHeatingRodModeEnum,
    EnergyManagerSettingEnum,
} from '../../types/enyo-energy-manager-settings.js';
import type {
    EnergyManagerSettingValues,
    EnergyManagerSettingsState,
} from '../../types/enyo-energy-manager-settings.js';
import {EnyoChargeModeEnum} from '../../types/enyo-data-bus-value.js';

/**
 * Thrown by {@link assertValidEnergyManagerSettingsState} when a state fails
 * validation. The message lists every blocking error so callers can surface them
 * directly.
 */
export class EnergyManagerSettingsValidationError extends Error {
    /** The individual blocking errors that caused the failure. */
    public readonly errors: string[];

    /**
     * @param errors - The blocking validation errors.
     */
    constructor(errors: string[]) {
        super(`Invalid energy manager settings:\n- ${errors.join('\n- ')}`);
        this.name = 'EnergyManagerSettingsValidationError';
        this.errors = errors;
    }
}

/** The outcome of validating an {@link EnergyManagerSettingsState}. */
export interface EnergyManagerSettingsValidationResult {
    /** True when there are no blocking `errors` (warnings are still allowed). */
    ok: boolean;
    /** Blocking problems — the state is malformed. */
    errors: string[];
    /** Advisory problems — allowed, but usually worth fixing. */
    warnings: string[];
}

/** Every {@link EnergyManagerSettingEnum} value. */
const SETTINGS: ReadonlySet<string> = new Set(Object.values(EnergyManagerSettingEnum));

/** 24-hour `HH:mm`, the format {@link EnergyManagerSettingValues.costOptimizedTargetTime} uses. */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Plausible band for a price limit in ct/kWh.
 *
 * Wide on purpose, and negative at the bottom: wholesale prices go negative, and
 * "charge only when I am paid to" is a real preference. The band exists to catch
 * a EUR/kWh value entered into a ct/kWh field (`0.07` where `7` was meant) and
 * the reverse (`700`), not to express an opinion about tariffs.
 */
const PRICE_LIMIT_MIN_CT = -100;
const PRICE_LIMIT_MAX_CT = 200;

/**
 * Below this, a {@link EnergyManagerSettingValues.batteryEvDischargeFixedWh}
 * budget is almost certainly kWh entered into a Wh field.
 *
 * `10` would be ten watt-hours — a rounding error against any house battery,
 * where `10` kWh was plainly meant. `0` is handled separately: it is legal, and
 * warned about for duplicating mode `block-discharge` rather than for being a unit slip.
 */
const DISCHARGE_BUDGET_MIN_PLAUSIBLE_WH = 100;

/** Every {@link EnergyManagerBatteryEvDischargeModeEnum} value. */
const EV_DISCHARGE_MODES: ReadonlySet<string> = new Set(
    Object.values(EnergyManagerBatteryEvDischargeModeEnum),
);

/** Value enums checked per field, for the enum-valued settings. */
const BATTERY_CHARGING_MODES: ReadonlySet<string> = new Set(
    Object.values(EnergyManagerBatteryChargingModeEnum),
);
const HEATING_ROD_MODES: ReadonlySet<string> = new Set(
    Object.values(EnergyManagerHeatingRodModeEnum),
);
const CHARGE_MODES: ReadonlySet<string> = new Set(Object.values(EnyoChargeModeEnum));

/**
 * True when `timezone` is an IANA zone this runtime recognises.
 *
 * Uses `Intl` rather than a pattern: `"Europe/Berlin"` and `"Europe/Berln"` are
 * indistinguishable by shape, and only the first one resolves a wall-clock time.
 *
 * @param timezone - The candidate IANA timezone identifier.
 * @returns True when the runtime accepts it.
 */
function isValidTimezone(timezone: string): boolean {
    try {
        new Intl.DateTimeFormat('en-US', {timeZone: timezone});
        return true;
    } catch {
        return false;
    }
}

/**
 * Reads the effective value a dependency is gated on.
 *
 * @param values - The stored values.
 * @param setting - The gating setting.
 * @returns The gate's current value, or `undefined` when it is unset.
 */
function gateValue(
    values: EnergyManagerSettingValues,
    setting: EnergyManagerSettingEnum,
): unknown {
    const [key] = ENERGY_MANAGER_SETTING_VALUE_KEYS[setting];
    return key ? values[key] : undefined;
}

/**
 * Validates an energy manager settings state: the declared support list, the
 * value formats, and the gate tree between them.
 *
 * Checks applied:
 *
 * - `supported` holds only {@link EnergyManagerSettingEnum} members, without
 *   duplicates (**error**).
 * - Each stored value has the right type, and each enum-valued setting holds an
 *   enum member (**error**).
 * - `costOptimizedTargetTime` is `HH:mm`, and `costOptimizedTimezone` is an IANA
 *   zone the runtime resolves (**error**).
 * - `priceLimitCtPerKwh` is a finite number (**error**), and lies in a plausible
 *   ct/kWh band (**warning** — catches a EUR/kWh value in a ct/kWh field).
 * - `batteryEvDischargeMode` holds an enum member (**error**).
 * - `batteryEvDischargeFixedWh` is a finite non-negative number (**error**), and
 *   is neither `0` nor a negligible positive figure (**warning** — the first
 *   duplicates mode `block-discharge`, the second catches a kWh value in a Wh field).
 * - `batteryEvDischargeSocLimitPercent` is a finite number in 0…100 (**error**),
 *   and not `100` (**warning** — a floor nothing can discharge past).
 * - A parameter belonging to a mode other than the selected one is flagged by
 *   the gate check below, since {@link ENERGY_MANAGER_SETTING_DEPENDENCIES}
 *   gates each on its own mode.
 * - A value stored for an unsupported setting (**warning** — the energy manager
 *   will ignore it).
 * - A value stored while its gate does not hold (**warning** — it can never take
 *   effect; see {@link ENERGY_MANAGER_SETTING_DEPENDENCIES}).
 * - A supported gate whose dependants are unsupported (**warning** — a
 *   half-built control surface).
 * - `costOptimizedTargetTime` set without a timezone (**warning** — the
 *   wall-clock value is ambiguous across a DST boundary).
 *
 * @param state - The settings state to validate.
 * @returns The {@link EnergyManagerSettingsValidationResult}.
 *
 * @example
 * ```typescript
 * const {ok, errors, warnings} = validateEnergyManagerSettingsState(state);
 * warnings.forEach((w) => console.warn('energy manager settings:', w));
 * if (!ok) console.error('energy manager settings are malformed', errors);
 * ```
 */
export function validateEnergyManagerSettingsState(
    state: EnergyManagerSettingsState,
): EnergyManagerSettingsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!state) return {ok: false, errors: ['state is required.'], warnings};

    if (!Array.isArray(state.supported)) {
        return {ok: false, errors: ['`supported` must be an array.'], warnings};
    }

    const supported = new Set<EnergyManagerSettingEnum>();
    for (const setting of state.supported) {
        if (!SETTINGS.has(setting)) {
            errors.push(`\`supported\` contains "${setting}", which is not an EnergyManagerSettingEnum member.`);
        } else if (supported.has(setting)) {
            errors.push(`\`supported\` lists "${setting}" more than once.`);
        } else {
            supported.add(setting);
        }
    }

    const values = state.values ?? {};

    // ── value formats ──────────────────────────────────────────────────────
    for (const key of ['batteryControl', 'batteryChargeFromGrid', 'heatpumpControl',
        'heatingRodControl', 'chargerControl'] as const) {
        if (values[key] !== undefined && typeof values[key] !== 'boolean') {
            errors.push(`\`${key}\` must be a boolean when set.`);
        }
    }

    if (values.batteryChargingMode !== undefined
        && !BATTERY_CHARGING_MODES.has(values.batteryChargingMode)) {
        errors.push(
            `\`batteryChargingMode\` "${values.batteryChargingMode}" is not an EnergyManagerBatteryChargingModeEnum member.`,
        );
    }
    if (values.heatingRodMode !== undefined && !HEATING_ROD_MODES.has(values.heatingRodMode)) {
        errors.push(
            `\`heatingRodMode\` "${values.heatingRodMode}" is not an EnergyManagerHeatingRodModeEnum member.`,
        );
    }
    if (values.defaultChargeMode !== undefined && !CHARGE_MODES.has(values.defaultChargeMode)) {
        errors.push(
            `\`defaultChargeMode\` "${values.defaultChargeMode}" is not an EnyoChargeModeEnum member.`,
        );
    }

    if (values.priceLimitCtPerKwh !== undefined) {
        if (typeof values.priceLimitCtPerKwh !== 'number'
            || !Number.isFinite(values.priceLimitCtPerKwh)) {
            errors.push('`priceLimitCtPerKwh` must be a finite number when set.');
        } else if (values.priceLimitCtPerKwh < PRICE_LIMIT_MIN_CT
            || values.priceLimitCtPerKwh > PRICE_LIMIT_MAX_CT) {
            warnings.push(
                `\`priceLimitCtPerKwh\` is ${values.priceLimitCtPerKwh}, outside the plausible ` +
                    `${PRICE_LIMIT_MIN_CT}…${PRICE_LIMIT_MAX_CT} ct/kWh band — this field is in ` +
                    'cents per kWh, not EUR per kWh.',
            );
        }
    }

    if (values.batteryEvDischargeMode !== undefined
        && !EV_DISCHARGE_MODES.has(values.batteryEvDischargeMode)) {
        errors.push(
            `\`batteryEvDischargeMode\` "${values.batteryEvDischargeMode}" is not an ` +
                'EnergyManagerBatteryEvDischargeModeEnum member.',
        );
    }

    if (values.batteryEvDischargeFixedWh !== undefined) {
        const budget = values.batteryEvDischargeFixedWh;
        if (typeof budget !== 'number' || !Number.isFinite(budget)) {
            errors.push('`batteryEvDischargeFixedWh` must be a finite number when set.');
        } else if (budget < 0) {
            errors.push(
                `\`batteryEvDischargeFixedWh\` is ${budget}; a budget cannot be negative. ` +
                    `Use mode "${EnergyManagerBatteryEvDischargeModeEnum.BlockDischarge}" to forbid the transfer.`,
            );
        } else if (budget === 0) {
            warnings.push(
                '`batteryEvDischargeFixedWh` is 0, which says the same as mode ' +
                    `"${EnergyManagerBatteryEvDischargeModeEnum.BlockDischarge}" — prefer the mode, which says it ` +
                    'where a reader will look.',
            );
        } else if (budget < DISCHARGE_BUDGET_MIN_PLAUSIBLE_WH) {
            warnings.push(
                `\`batteryEvDischargeFixedWh\` is ${budget} Wh, which is negligible against any ` +
                    'house battery — this field is in watt-hours, not kilowatt-hours.',
            );
        }
    }

    if (values.batteryEvDischargeSocLimitPercent !== undefined) {
        const soc = values.batteryEvDischargeSocLimitPercent;
        if (typeof soc !== 'number' || !Number.isFinite(soc)) {
            errors.push('`batteryEvDischargeSocLimitPercent` must be a finite number when set.');
        } else if (soc < 0 || soc > 100) {
            errors.push(
                `\`batteryEvDischargeSocLimitPercent\` is ${soc}; it is a percentage and must lie ` +
                    'between 0 and 100.',
            );
        } else if (soc === 100) {
            warnings.push(
                '`batteryEvDischargeSocLimitPercent` is 100, a floor the battery is already at, so ' +
                    `nothing can ever be discharged — mode "${EnergyManagerBatteryEvDischargeModeEnum.BlockDischarge}" ` +
                    'states that intent directly.',
            );
        }
    }

    if (values.costOptimizedTargetTime !== undefined) {
        if (typeof values.costOptimizedTargetTime !== 'string'
            || !TIME_RE.test(values.costOptimizedTargetTime)) {
            errors.push(
                `\`costOptimizedTargetTime\` "${values.costOptimizedTargetTime}" is not a 24-hour HH:mm time.`,
            );
        }
        if (values.costOptimizedTimezone === undefined) {
            warnings.push(
                '`costOptimizedTargetTime` is set without `costOptimizedTimezone` — the wall-clock ' +
                    'value cannot be resolved unambiguously across a DST boundary.',
            );
        }
    }
    if (values.costOptimizedTimezone !== undefined) {
        if (typeof values.costOptimizedTimezone !== 'string'
            || !isValidTimezone(values.costOptimizedTimezone)) {
            errors.push(
                `\`costOptimizedTimezone\` "${values.costOptimizedTimezone}" is not an IANA timezone.`,
            );
        }
    }

    // ── stored but unsupported ─────────────────────────────────────────────
    for (const setting of Object.values(EnergyManagerSettingEnum)) {
        const keys = ENERGY_MANAGER_SETTING_VALUE_KEYS[setting];
        const held = keys.filter((key) => values[key] !== undefined);
        if (held.length && !supported.has(setting)) {
            warnings.push(
                `"${setting}" holds a value (${held.join(', ')}) but is not in \`supported\` — ` +
                    'the energy manager will ignore it.',
            );
        }
    }

    // ── gate tree ──────────────────────────────────────────────────────────
    for (const [setting, dependency] of Object.entries(ENERGY_MANAGER_SETTING_DEPENDENCIES)) {
        if (!dependency) continue;
        const key = setting as EnergyManagerSettingEnum;

        const held = ENERGY_MANAGER_SETTING_VALUE_KEYS[key].some((k) => values[k] !== undefined);
        if (held && gateValue(values, dependency.requires) !== dependency.equals) {
            warnings.push(
                `"${key}" holds a value, but it only takes effect while "${dependency.requires}" ` +
                    `is ${JSON.stringify(dependency.equals)} — it currently cannot.`,
            );
        }

        if (supported.has(dependency.requires) && !supported.has(key)
            && gateValue(values, dependency.requires) === dependency.equals) {
            warnings.push(
                `"${dependency.requires}" is supported and active, but its dependent setting ` +
                    `"${key}" is not — the user is offered a gate with nothing behind it.`,
            );
        }
    }

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Like {@link validateEnergyManagerSettingsState}, but throws
 * {@link EnergyManagerSettingsValidationError} when there are blocking errors.
 * Warnings never throw; the validated state is returned on success for chaining.
 *
 * @param state - The settings state to validate.
 * @returns The same state when it has no blocking errors.
 * @throws {EnergyManagerSettingsValidationError} When validation produces any error.
 */
export function assertValidEnergyManagerSettingsState(
    state: EnergyManagerSettingsState,
): EnergyManagerSettingsState {
    const {ok, errors} = validateEnergyManagerSettingsState(state);
    if (!ok) throw new EnergyManagerSettingsValidationError(errors);
    return state;
}
