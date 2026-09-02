import {
    EnyoElectricityTariff,
    EnyoTariffBonus,
    GridFeeModeEnum,
    TariffGridFeeConfig,
    TariffPriceCompositionInfo,
} from '../../types/enyo-electricity-tariff.js';
import {EnyoDynamicGridFeeRegistration} from '../../types/enyo-grid-fee.js';
import {
    EnyoPriceAppliesToEnum,
    EnyoPriceSchedule,
    EnyoPriceScheduleTypeEnum,
} from '../../types/enyo-price-schedule.js';
import {parseTimeOfDay} from './price-schedule-resolver.js';

/**
 * Thrown when a grid fee, tariff bonus or price schedule violates one of the
 * invariants enforced by this module. The message names the offending field or
 * window index so callers can surface it directly to the user.
 */
export class PriceComponentValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PriceComponentValidationError';
    }
}

function fail(message: string): never {
    throw new PriceComponentValidationError(message);
}

function requireNonEmpty(value: string | undefined, field: string): void {
    if (value === undefined || value.trim().length === 0) {
        fail(`${field} must be a non-empty string`);
    }
}

function requireValidTimezone(timezone: string, field: string): void {
    requireNonEmpty(timezone, field);
    try {
        new Intl.DateTimeFormat('en-US', {timeZone: timezone});
    } catch {
        fail(`${field} must be a valid IANA time zone identifier, got '${timezone}'`);
    }
}

function requireNonNegativeAmount(amount: number, field: string): void {
    if (!Number.isFinite(amount)) {
        fail(`${field} must be a finite number`);
    }
    if (amount < 0) {
        fail(
            `${field} must not be negative — amounts are unsigned magnitudes; ` +
            `grid fees are added to and bonuses subtracted from the energy price`,
        );
    }
}

function requireIsoTimestamp(value: string, field: string): number {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
        fail(`${field} must be a valid ISO timestamp, got '${value}'`);
    }
    return parsed;
}

function requireValidityRange(validFromIso: string | undefined, validUntilIso: string | undefined, label: string): void {
    const from = validFromIso === undefined ? undefined : requireIsoTimestamp(validFromIso, `${label}.validFromIso`);
    const until = validUntilIso === undefined ? undefined : requireIsoTimestamp(validUntilIso, `${label}.validUntilIso`);
    if (from !== undefined && until !== undefined && until <= from) {
        fail(`${label}.validUntilIso must be after ${label}.validFromIso`);
    }
}

function requireAppliesTo(appliesTo: EnyoPriceAppliesToEnum, field: string): void {
    if (!Object.values(EnyoPriceAppliesToEnum).includes(appliesTo)) {
        fail(`${field} must be one of ${Object.values(EnyoPriceAppliesToEnum).join(', ')}`);
    }
}

/** Half-open minute interval on a 0–2880 line, used for recurring overlap checks. */
interface MinuteInterval {
    start: number;
    end: number;
}

function toMinuteIntervals(start: number, end: number): MinuteInterval[] {
    return start < end
        ? [{start, end}]
        : [{start, end: 1440}, {start: 0, end}];
}

function intervalsOverlap(a: MinuteInterval[], b: MinuteInterval[]): boolean {
    return a.some(left => b.some(right => left.start < right.end && right.start < left.end));
}

function setsIntersect(a: number[] | undefined, b: number[] | undefined): boolean {
    if (a === undefined || b === undefined) {
        return true;
    }
    return a.some(value => b.includes(value));
}

/**
 * Validates a {@link EnyoPriceSchedule}. Throws on the first violation.
 *
 * Enforces finite, non-negative amounts, well-formed `HH:mm` times, day and
 * month ranges, ordered absolute windows, and that no two windows which can
 * occur on the same day overlap in time — an overlap would make the resolved
 * amount depend on array order rather than on the schedule itself.
 *
 * Overlap detection for recurring windows is conservative: two windows are only
 * compared when their day-of-week and month sets can intersect. A window that
 * wraps past midnight is compared on both of its legs.
 *
 * @param schedule - The schedule to validate
 * @param label - Prefix used in error messages, e.g. `'gridFee.schedule'`
 * @throws {PriceComponentValidationError} On the first invariant violation
 */
export function validatePriceSchedule(schedule: EnyoPriceSchedule, label = 'schedule'): void {
    if (schedule === null || typeof schedule !== 'object') {
        fail(`${label} must be an object`);
    }

    if (schedule.type === EnyoPriceScheduleTypeEnum.Constant) {
        requireNonNegativeAmount(schedule.amountPerKwh, `${label}.amountPerKwh`);
        return;
    }

    if (schedule.type === EnyoPriceScheduleTypeEnum.Absolute) {
        if (schedule.windows.length === 0) {
            fail(`${label}.windows must contain at least one window`);
        }
        const ranges = schedule.windows.map((window, index) => {
            const start = requireIsoTimestamp(window.startIso, `${label}.windows[${index}].startIso`);
            const end = requireIsoTimestamp(window.endIso, `${label}.windows[${index}].endIso`);
            if (end <= start) {
                fail(`${label}.windows[${index}].endIso must be after startIso`);
            }
            requireNonNegativeAmount(window.amountPerKwh, `${label}.windows[${index}].amountPerKwh`);
            return {start, end, index};
        }).sort((a, b) => a.start - b.start);

        for (let i = 1; i < ranges.length; i++) {
            if (ranges[i].start < ranges[i - 1].end) {
                fail(`${label}.windows[${ranges[i].index}] overlaps windows[${ranges[i - 1].index}]`);
            }
        }
        return;
    }

    if (schedule.type === EnyoPriceScheduleTypeEnum.Recurring) {
        if (schedule.windows.length === 0) {
            fail(`${label}.windows must contain at least one window`);
        }
        const parsed = schedule.windows.map((window, index) => {
            const start = parseTimeOfDay(window.startTimeOfDay);
            const end = parseTimeOfDay(window.endTimeOfDay);
            if (start === null) {
                fail(`${label}.windows[${index}].startTimeOfDay must be a 'HH:mm' time, got '${window.startTimeOfDay}'`);
            }
            if (end === null) {
                fail(`${label}.windows[${index}].endTimeOfDay must be a 'HH:mm' time, got '${window.endTimeOfDay}'`);
            }
            if (start === end) {
                fail(`${label}.windows[${index}] must not start and end at the same time of day`);
            }
            if (window.daysOfWeek !== undefined) {
                if (window.daysOfWeek.length === 0) {
                    fail(`${label}.windows[${index}].daysOfWeek must not be empty — omit it for 'every day'`);
                }
                for (const day of window.daysOfWeek) {
                    if (!Number.isInteger(day) || day < 0 || day > 6) {
                        fail(`${label}.windows[${index}].daysOfWeek must contain integers 0 (Sunday) to 6 (Saturday), got ${day}`);
                    }
                }
            }
            if (window.months !== undefined) {
                if (window.months.length === 0) {
                    fail(`${label}.windows[${index}].months must not be empty — omit it for 'every month'`);
                }
                for (const month of window.months) {
                    if (!Number.isInteger(month) || month < 1 || month > 12) {
                        fail(`${label}.windows[${index}].months must contain integers 1 to 12, got ${month}`);
                    }
                }
            }
            requireNonNegativeAmount(window.amountPerKwh, `${label}.windows[${index}].amountPerKwh`);
            return {window, index, intervals: toMinuteIntervals(start as number, end as number)};
        });

        for (let i = 0; i < parsed.length; i++) {
            for (let j = i + 1; j < parsed.length; j++) {
                const left = parsed[i];
                const right = parsed[j];
                if (!setsIntersect(left.window.daysOfWeek, right.window.daysOfWeek)) {
                    continue;
                }
                if (!setsIntersect(left.window.months, right.window.months)) {
                    continue;
                }
                if (intervalsOverlap(left.intervals, right.intervals)) {
                    fail(`${label}.windows[${right.index}] overlaps windows[${left.index}]`);
                }
            }
        }
        return;
    }

    fail(`${label}.type must be one of ${Object.values(EnyoPriceScheduleTypeEnum).join(', ')}`);
}

/**
 * Validates a dynamic grid fee registration. Throws on the first violation.
 *
 * @param registration - The grid fee to validate
 * @throws {PriceComponentValidationError} On the first invariant violation
 *
 * @example
 * ```typescript
 * validateDynamicGridFee(registration);
 * await energyApp.useGridFee().registerGridFee(registration);
 * ```
 */
export function validateDynamicGridFee(registration: EnyoDynamicGridFeeRegistration): void {
    requireNonEmpty(registration.id, 'gridFee.id');
    requireNonEmpty(registration.name, 'gridFee.name');
    requireNonEmpty(registration.gridOperator, 'gridFee.gridOperator');
    requireNonEmpty(registration.currency, 'gridFee.currency');
    requireValidTimezone(registration.timezone, 'gridFee.timezone');
    requireAppliesTo(registration.appliesTo, 'gridFee.appliesTo');
    requireValidityRange(registration.validFromIso, registration.validUntilIso, 'gridFee');
    validatePriceSchedule(registration.schedule, 'gridFee.schedule');
}

/**
 * Validates a single tariff bonus. Throws on the first violation.
 *
 * @param bonus - The bonus to validate
 * @param label - Prefix used in error messages, e.g. `'bonuses[0]'`
 * @throws {PriceComponentValidationError} On the first invariant violation
 */
export function validateTariffBonus(bonus: EnyoTariffBonus, label = 'bonus'): void {
    requireNonEmpty(bonus.id, `${label}.id`);
    requireNonEmpty(bonus.name, `${label}.name`);
    requireValidTimezone(bonus.timezone, `${label}.timezone`);
    requireAppliesTo(bonus.appliesTo, `${label}.appliesTo`);
    requireValidityRange(bonus.validFromIso, bonus.validUntilIso, label);
    if (bonus.priority !== undefined && !Number.isFinite(bonus.priority)) {
        fail(`${label}.priority must be a finite number`);
    }
    validatePriceSchedule(bonus.schedule, `${label}.schedule`);
}

/**
 * Validates a tariff's bonus list: every bonus is individually valid and ids are
 * unique within the tariff.
 *
 * @param bonuses - The bonuses to validate
 * @throws {PriceComponentValidationError} On the first invariant violation
 */
export function validateTariffBonuses(bonuses: EnyoTariffBonus[]): void {
    const seen = new Set<string>();
    bonuses.forEach((bonus, index) => {
        validateTariffBonus(bonus, `bonuses[${index}]`);
        if (seen.has(bonus.id)) {
            fail(`bonuses[${index}].id '${bonus.id}' is used more than once in the same tariff`);
        }
        seen.add(bonus.id);
    });
}

/**
 * Validates how a tariff's pricing data declares its grid fee.
 *
 * Catches the configuration that silently double-charges the customer: declaring
 * a dynamic grid fee while also declaring that the tariff's prices already
 * include the grid fee. Anyone trusting the declaration would add the fee on top
 * of prices that already contain it.
 *
 * @param config - The grid fee configuration of one tariff pricing shape
 * @param priceComposition - The tariff's price composition declaration, if any
 * @param label - Prefix used in error messages, e.g. `'dynamicTariffData'`
 * @throws {PriceComponentValidationError} On the first invariant violation
 */
export function validateTariffGridFeeConfig(
    config: TariffGridFeeConfig,
    priceComposition: TariffPriceCompositionInfo | undefined,
    label = 'tariffData',
): void {
    const mode = config.gridFeeMode ?? GridFeeModeEnum.Static;
    if (!Object.values(GridFeeModeEnum).includes(mode)) {
        fail(`${label}.gridFeeMode must be one of ${Object.values(GridFeeModeEnum).join(', ')}`);
    }
    if (mode === GridFeeModeEnum.Dynamic && priceComposition?.includesGridFee === true) {
        fail(
            `${label} declares a dynamic grid fee while priceComposition.includesGridFee is true — ` +
            `the fee is already contained in the tariff's prices and must not be added again`,
        );
    }
}

/**
 * Validates the pricing-related parts of a complete electricity tariff: the grid
 * fee link of whichever pricing shape is present, and the tariff's bonuses.
 *
 * Call it before {@link EnergyAppElectricityTariff.registerTariff} to turn what
 * would otherwise be a silently mispriced tariff into an actionable error.
 *
 * @param tariff - The tariff to validate (with or without its `id`)
 * @throws {PriceComponentValidationError} On the first invariant violation
 *
 * @example
 * ```typescript
 * validateElectricityTariffPricing(tariff);
 * await energyApp.useElectricityTariff().registerTariff(tariff);
 * ```
 */
export function validateElectricityTariffPricing(
    tariff: Omit<EnyoElectricityTariff, 'id'> & {id?: string},
): void {
    if (tariff.staticTariffData !== undefined) {
        validateTariffGridFeeConfig(tariff.staticTariffData, tariff.priceComposition, 'staticTariffData');
    }
    if (tariff.timeVariableTariffData !== undefined) {
        validateTariffGridFeeConfig(tariff.timeVariableTariffData, tariff.priceComposition, 'timeVariableTariffData');
    }
    if (tariff.dynamicTariffData !== undefined) {
        validateTariffGridFeeConfig(tariff.dynamicTariffData, tariff.priceComposition, 'dynamicTariffData');
    }
    if (tariff.bonuses !== undefined) {
        validateTariffBonuses(tariff.bonuses);
    }
}
