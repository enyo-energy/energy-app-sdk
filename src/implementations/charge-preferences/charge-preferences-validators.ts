/**
 * Client-side validation for {@link EnyoChargePreferences} — the charging
 * preferences a vehicle ({@link EnyoVehicle}) and a wallbox
 * ({@link EnyoChargerApplianceMetadata}) both carry. One validator serves both,
 * because the fields and their meaning are the same in both places.
 *
 * Two classes of problem live here:
 *
 * 1. **Malformed values.** A `HH:mm` that is not a time, a timezone that is not
 *    an IANA zone, a price that is not a finite number. These fail at planning
 *    time, in the dark, on the night the charge was supposed to happen.
 * 2. **Values that cannot take effect or were probably mistyped.** A ct/kWh
 *    ceiling while the price limit is expressed as a share of the day, a
 *    EUR/kWh price in a ct/kWh field. Nothing rejects these — they simply do
 *    nothing or the wrong thing, which reads to a user as "the app ignored me".
 *
 * `errors` mean the preferences are malformed; `warnings` are advisory. Use
 * {@link validateChargePreferences} for the non-throwing result, or
 * {@link assertValidChargePreferences} to throw.
 */

import {EnyoChargeModeEnum, EnyoPriceLimitModeEnum} from '../../types/enyo-data-bus-value.js';
import type {EnyoChargePreferences} from '../../types/enyo-charge-preferences.js';

/**
 * Thrown by {@link assertValidChargePreferences} when the preferences fail
 * validation. The message lists every blocking error so callers can surface
 * them directly.
 */
export class ChargePreferencesValidationError extends Error {
    /** The individual blocking errors that caused the failure. */
    public readonly errors: string[];

    /**
     * @param errors - The blocking validation errors.
     */
    constructor(errors: string[]) {
        super(`Invalid charge preferences:\n- ${errors.join('\n- ')}`);
        this.name = 'ChargePreferencesValidationError';
        this.errors = errors;
    }
}

/** The outcome of validating {@link EnyoChargePreferences}. */
export interface ChargePreferencesValidationResult {
    /** True when there are no blocking `errors` (warnings are still allowed). */
    ok: boolean;
    /** Blocking problems — the preferences are malformed. */
    errors: string[];
    /** Advisory problems — allowed, but usually worth fixing. */
    warnings: string[];
}

/** 24-hour `HH:mm`, the format {@link EnyoChargePreferences.departureTimeHHmm} uses. */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Plausible band for a price ceiling in ct/kWh.
 *
 * Wide on purpose, and negative at the bottom: wholesale prices go negative, and
 * "charge only when I am paid to" is a real preference. The band exists to catch
 * a EUR/kWh value entered into a ct/kWh field (`0.07` where `7` was meant) and
 * the reverse (`700`), not to express an opinion about tariffs.
 */
const PRICE_LIMIT_MIN_CT = -100;
const PRICE_LIMIT_MAX_CT = 200;

/**
 * The band a relative price ceiling must lie in, in percent of the day.
 *
 * Matches the automation validators' `AUTOMATION_MIN/MAX_CHEAPEST_SHARE_PERCENT`
 * on purpose: "the cheapest 25 % of the day" means the same thing whether it
 * drives a charging session or an automation.
 *
 * `0` is excluded because it selects no hours at all — that is "never import",
 * which is {@link EnyoChargeModeEnum.PriceLimit}, not a ceiling.
 */
const PRICE_LIMIT_SHARE_MIN_PERCENT = 1;
const PRICE_LIMIT_SHARE_MAX_PERCENT = 100;

/**
 * Above this, an {@link EnyoChargePreferences.immediateReserveKwh} is almost
 * certainly Wh entered into a kWh field — no car battery holds that much.
 */
const IMMEDIATE_RESERVE_MAX_PLAUSIBLE_KWH = 200;

const CHARGE_MODES: ReadonlySet<string> = new Set(Object.values(EnyoChargeModeEnum));
const PRICE_LIMIT_MODES: ReadonlySet<string> = new Set(Object.values(EnyoPriceLimitModeEnum));

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
 * True when `value` is set — `null` and `undefined` both count as unset.
 *
 * @param value - The field value.
 * @returns True when the value is neither `null` nor `undefined`.
 */
function isSet(value: unknown): boolean {
    return value !== undefined && value !== null;
}

/**
 * True when `value` is a finite number.
 *
 * @param value - The field value.
 * @returns True for a finite number, false for anything else (including `NaN`).
 */
function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validates the charging preferences of a vehicle or a wallbox.
 *
 * Pass an {@link EnyoVehicle}, an {@link EnyoChargerApplianceMetadata} or just
 * the {@link EnyoChargePreferences} fields — only those fields are read.
 *
 * Checks applied:
 *
 * - `defaultChargeMode` holds an {@link EnyoChargeModeEnum} member (**error**).
 * - `defaultChargeLimitPercent` is a finite number in 0…100 (**error**), and
 *   not `0` (**warning** — a target the car is already at, so it never charges).
 * - `priceLimitMode` holds an {@link EnyoPriceLimitModeEnum} member (**error**).
 * - `priceLimitCtPerKwh` is a finite number (**error**), and lies in a plausible
 *   ct/kWh band (**warning** — catches a EUR/kWh value in a ct/kWh field).
 * - `priceLimitSharePercent` is an integer in 1…100 (**error**), and not `100`
 *   (**warning** — the whole day counts as cheap, so it is no ceiling at all).
 * - `immediateReserveKwh` is a finite non-negative number (**error**), and not
 *   above 200 kWh (**warning** — catches a Wh value in a kWh field).
 * - `departureTimeHHmm` is `HH:mm`, and `departureTimezone` is an IANA zone the
 *   runtime resolves (**error**).
 * - `departureTimeHHmm` set without a timezone (**warning** — the wall-clock
 *   value is ambiguous across a DST boundary).
 * - A ceiling value stored that `priceLimitMode` does not read (**warning**).
 * - A `priceLimitMode` without the value it reads (**warning** — no ceiling
 *   applies; leave the mode unset to say that outright).
 *
 * A ceiling stored next to a non-cost-optimised `defaultChargeMode` is **not**
 * flagged: a session switched to cost-optimised still picks the ceiling up.
 * `null` and `undefined` both count as unset.
 *
 * @param preferences - The vehicle, wallbox metadata or bare preferences.
 * @returns The {@link ChargePreferencesValidationResult}.
 *
 * @example
 * ```typescript
 * const {ok, errors, warnings} = validateChargePreferences(vehicle);
 * warnings.forEach((w) => console.warn('charge preferences:', w));
 * if (!ok) console.error('charge preferences are malformed', errors);
 *
 * validateChargePreferences(charger.metadata); // the same checks for a wallbox
 * ```
 */
export function validateChargePreferences(
    preferences: EnyoChargePreferences,
): ChargePreferencesValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!preferences) return {ok: false, errors: ['preferences are required.'], warnings};

    const {
        defaultChargeLimitPercent,
        defaultChargeMode,
        priceLimitMode,
        priceLimitCtPerKwh,
        priceLimitSharePercent,
        immediateReserveKwh,
        departureTimeHHmm,
        departureTimezone,
    } = preferences;

    // ── default mode and charge limit ──────────────────────────────────────
    if (isSet(defaultChargeMode) && !CHARGE_MODES.has(defaultChargeMode as string)) {
        errors.push(`\`defaultChargeMode\` "${defaultChargeMode}" is not an EnyoChargeModeEnum member.`);
    }

    if (isSet(defaultChargeLimitPercent)) {
        if (!isFiniteNumber(defaultChargeLimitPercent)) {
            errors.push('`defaultChargeLimitPercent` must be a finite number when set.');
        } else if (defaultChargeLimitPercent < 0 || defaultChargeLimitPercent > 100) {
            errors.push(
                `\`defaultChargeLimitPercent\` is ${defaultChargeLimitPercent}; it is a percentage and ` +
                    'must lie between 0 and 100.',
            );
        } else if (defaultChargeLimitPercent === 0) {
            warnings.push(
                '`defaultChargeLimitPercent` is 0, a target every car is already at, so no session ' +
                    'would ever charge.',
            );
        }
    }

    // ── price ceiling ──────────────────────────────────────────────────────
    if (isSet(priceLimitMode) && !PRICE_LIMIT_MODES.has(priceLimitMode as string)) {
        errors.push(`\`priceLimitMode\` "${priceLimitMode}" is not an EnyoPriceLimitModeEnum member.`);
    }

    if (isSet(priceLimitCtPerKwh)) {
        if (!isFiniteNumber(priceLimitCtPerKwh)) {
            errors.push('`priceLimitCtPerKwh` must be a finite number when set.');
        } else if (priceLimitCtPerKwh < PRICE_LIMIT_MIN_CT || priceLimitCtPerKwh > PRICE_LIMIT_MAX_CT) {
            warnings.push(
                `\`priceLimitCtPerKwh\` is ${priceLimitCtPerKwh}, outside the plausible ` +
                    `${PRICE_LIMIT_MIN_CT}…${PRICE_LIMIT_MAX_CT} ct/kWh band — this field is in ` +
                    'cents per kWh, not EUR per kWh.',
            );
        }
    }

    if (isSet(priceLimitSharePercent)) {
        const share = priceLimitSharePercent;
        if (!isFiniteNumber(share)) {
            errors.push('`priceLimitSharePercent` must be a finite number when set.');
        } else if (!Number.isInteger(share)) {
            errors.push(
                `\`priceLimitSharePercent\` is ${share}; a share of the day is a whole ` +
                    'percentage and must be an integer.',
            );
        } else if (share < PRICE_LIMIT_SHARE_MIN_PERCENT || share > PRICE_LIMIT_SHARE_MAX_PERCENT) {
            errors.push(
                `\`priceLimitSharePercent\` is ${share}; it is a percentage of the day and must ` +
                    `lie between ${PRICE_LIMIT_SHARE_MIN_PERCENT} and ${PRICE_LIMIT_SHARE_MAX_PERCENT}.`,
            );
        } else if (share === PRICE_LIMIT_SHARE_MAX_PERCENT) {
            warnings.push(
                '`priceLimitSharePercent` is 100, which treats the whole day as cheap and so ' +
                    'imposes no ceiling at all. Leave `priceLimitMode` unset to say that outright.',
            );
        }
    }

    if (isSet(priceLimitCtPerKwh) && priceLimitMode !== EnyoPriceLimitModeEnum.CtPerKwh) {
        warnings.push(
            '`priceLimitCtPerKwh` is set, but it is only read while `priceLimitMode` is ' +
                `"${EnyoPriceLimitModeEnum.CtPerKwh}".`,
        );
    }
    if (isSet(priceLimitSharePercent) && priceLimitMode !== EnyoPriceLimitModeEnum.CheapestShare) {
        warnings.push(
            '`priceLimitSharePercent` is set, but it is only read while `priceLimitMode` is ' +
                `"${EnyoPriceLimitModeEnum.CheapestShare}".`,
        );
    }
    if (priceLimitMode === EnyoPriceLimitModeEnum.CtPerKwh && !isSet(priceLimitCtPerKwh)) {
        warnings.push(
            '`priceLimitMode` is "ct-per-kwh" but `priceLimitCtPerKwh` is unset — no ceiling ' +
                'applies. Leave `priceLimitMode` unset to say that outright.',
        );
    }
    if (priceLimitMode === EnyoPriceLimitModeEnum.CheapestShare && !isSet(priceLimitSharePercent)) {
        warnings.push(
            '`priceLimitMode` is "cheapest-share" but `priceLimitSharePercent` is unset — no ceiling ' +
                'applies. Leave `priceLimitMode` unset to say that outright.',
        );
    }

    // ── immediate reserve ──────────────────────────────────────────────────
    if (isSet(immediateReserveKwh)) {
        if (!isFiniteNumber(immediateReserveKwh)) {
            errors.push('`immediateReserveKwh` must be a finite number when set.');
        } else if (immediateReserveKwh < 0) {
            errors.push(
                `\`immediateReserveKwh\` is ${immediateReserveKwh}; a reserve cannot be negative — ` +
                    'use 0 or leave it unset to switch it off.',
            );
        } else if (immediateReserveKwh > IMMEDIATE_RESERVE_MAX_PLAUSIBLE_KWH) {
            warnings.push(
                `\`immediateReserveKwh\` is ${immediateReserveKwh} kWh, more than any car battery holds — ` +
                    'this field is in kilowatt-hours, not watt-hours.',
            );
        }
    }

    // ── departure time ─────────────────────────────────────────────────────
    if (isSet(departureTimeHHmm)) {
        if (typeof departureTimeHHmm !== 'string' || !TIME_RE.test(departureTimeHHmm)) {
            errors.push(`\`departureTimeHHmm\` "${departureTimeHHmm}" is not a 24-hour HH:mm time.`);
        }
        if (!isSet(departureTimezone)) {
            warnings.push(
                '`departureTimeHHmm` is set without `departureTimezone` — the wall-clock ' +
                    'value cannot be resolved unambiguously across a DST boundary.',
            );
        }
    }
    if (isSet(departureTimezone)
        && (typeof departureTimezone !== 'string' || !isValidTimezone(departureTimezone))) {
        errors.push(`\`departureTimezone\` "${departureTimezone}" is not an IANA timezone.`);
    }

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Like {@link validateChargePreferences}, but throws
 * {@link ChargePreferencesValidationError} when there are blocking errors.
 * Warnings never throw; the validated object is returned on success for
 * chaining.
 *
 * @param preferences - The vehicle, wallbox metadata or bare preferences.
 * @returns The same object when it has no blocking errors.
 * @throws {ChargePreferencesValidationError} When validation produces any error.
 *
 * @example
 * ```typescript
 * const metadata = assertValidChargePreferences(appliance.metadata.charger!);
 * ```
 */
export function assertValidChargePreferences<T extends EnyoChargePreferences>(preferences: T): T {
    const {ok, errors} = validateChargePreferences(preferences);
    if (!ok) throw new ChargePreferencesValidationError(errors);
    return preferences;
}
