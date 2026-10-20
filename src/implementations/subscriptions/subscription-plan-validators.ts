/**
 * Client-side validator for the subscription plans declared in a package
 * definition ({@link EnergyAppPackageDefinition.subscriptionPlans}).
 *
 * The enyo CLI reads the plans at release time and enyo sells them from then
 * on, so a missing price, a malformed amount or a missing translation would
 * only show up on a customer's checkout screen. Everything that would break
 * the offer or the checkout is a blocking `error` caught here instead.
 *
 * Use {@link validatePackageSubscriptionPlans} for the non-throwing result, or
 * {@link assertValidPackageSubscriptionPlans} to throw on failure.
 */

import type {
    EnergyAppPackageDefinition,
    EnergyAppPackageLanguage,
    EnergyAppPackageSubscriptionPlan
} from '../../energy-app-package-definition.js';
import {EnergyAppPermissionTypeEnum} from '../../energy-app-permission.type.js';
import {EnyoCurrencyEnum} from '../../types/enyo-currency.js';
import {
    EnyoSubscriptionPaymentIntervalEnum,
    EnyoSubscriptionPricingModelEnum,
    EnyoSubscriptionUnit,
    EnyoSubscriptionUnitTypeEnum
} from '../../types/enyo-subscription.js';

/**
 * Thrown by {@link assertValidPackageSubscriptionPlans} when a package's
 * subscription plans fail validation. The message lists every blocking error
 * so callers can surface them directly.
 */
export class PackageSubscriptionPlansValidationError extends Error {
    /** The individual blocking errors that caused the failure. */
    public readonly errors: string[];

    /**
     * @param errors - The blocking validation errors.
     */
    constructor(errors: string[]) {
        super(`Invalid subscription plans:\n- ${errors.join('\n- ')}`);
        this.name = 'PackageSubscriptionPlansValidationError';
        this.errors = errors;
    }
}

/** The outcome of validating a package's subscription plans. */
export interface PackageSubscriptionPlansValidationResult {
    /** True when there are no blocking `errors` (warnings are still allowed). */
    ok: boolean;
    /** Blocking problems — these must be fixed before releasing. */
    errors: string[];
    /** Advisory problems — allowed, but usually worth reviewing. */
    warnings: string[];
}

/**
 * The parts of a package definition the validator reads: the plans, and the
 * permissions to check that the app can read its subscriptions.
 */
export type PackageSubscriptionPlansSource = Pick<EnergyAppPackageDefinition, 'subscriptionPlans' | 'permissions'>;

/** A plan key — the same kebab-case slug shape used for public file names. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Languages every plan must be translated into. */
const REQUIRED_LANGUAGES: readonly EnergyAppPackageLanguage[] = ['de', 'en'];

/**
 * Tests whether an amount has at most two decimal places, allowing for
 * floating-point noise such as `41.18 * 100 = 4117.999…`.
 *
 * @param amount - The amount to check.
 * @returns True when the amount can be charged in whole cents.
 */
function hasAtMostTwoDecimals(amount: number): boolean {
    const cents = amount * 100;
    return Math.abs(cents - Math.round(cents)) < 1e-6;
}

/**
 * Checks the prices of one plan.
 *
 * @param plan - The plan whose prices are checked.
 * @param at - Location prefix for messages.
 * @param errors - Collector for blocking errors.
 */
function validatePrices(plan: EnergyAppPackageSubscriptionPlan, at: string, errors: string[]): void {
    if (!Array.isArray(plan.prices) || plan.prices.length === 0) {
        errors.push(`${at}: at least one price is required.`);
        return;
    }

    const currencies = new Set<string>();
    for (const [index, price] of plan.prices.entries()) {
        const priceAt = `${at}.prices[${index}]`;
        const amount = price.amountWithoutTax;

        if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
            errors.push(`${priceAt}: amountWithoutTax must be a number greater than 0.`);
        } else if (!hasAtMostTwoDecimals(amount)) {
            errors.push(`${priceAt}: amountWithoutTax ${amount} has more than two decimal places.`);
        }

        if (!Object.values(EnyoCurrencyEnum).includes(price.currency)) {
            errors.push(`${priceAt}: currency "${price.currency}" is not supported.`);
        } else if (currencies.has(price.currency)) {
            errors.push(`${priceAt}: duplicate currency "${price.currency}" — declare one price per currency.`);
        } else {
            currencies.add(price.currency);
        }
    }
}

/**
 * Checks the store entries of one plan.
 *
 * @param plan - The plan whose store entries are checked.
 * @param at - Location prefix for messages.
 * @param errors - Collector for blocking errors.
 */
function validateStoreEntries(plan: EnergyAppPackageSubscriptionPlan, at: string, errors: string[]): void {
    const languages = new Set<string>();

    for (const [index, entry] of (plan.storeEntry ?? []).entries()) {
        const entryAt = `${at}.storeEntry[${index}] (${entry.language || '?'})`;

        if (languages.has(entry.language)) {
            errors.push(`${entryAt}: duplicate language "${entry.language}".`);
        }
        languages.add(entry.language);

        if (!entry.title?.trim()) errors.push(`${entryAt}: title is required.`);
        if (!entry.shortDescription?.trim()) errors.push(`${entryAt}: shortDescription is required.`);
        if (entry.benefits?.some(benefit => !benefit?.trim())) {
            errors.push(`${entryAt}: benefits must not contain empty entries.`);
        }
    }

    for (const language of REQUIRED_LANGUAGES) {
        if (!languages.has(language)) {
            errors.push(`${at}: storeEntry for language "${language}" is required.`);
        }
    }
}

/**
 * Structural validation of a package's subscription plans: plan keys are
 * unique kebab-case slugs, the payment interval is known, every plan has at
 * least one positive net price per currency with at most two decimal places,
 * trial days are a positive whole number and not used on a one-time plan, every plan is translated into
 * German and English, and the package requests the `Subscriptions`
 * permission so the app can read what was bought.
 *
 * @param definition - The package definition, or just its `subscriptionPlans`
 *   and `permissions`. A package without plans is trivially valid.
 * @returns The {@link PackageSubscriptionPlansValidationResult}.
 *
 * @example
 * ```typescript
 * const {ok, errors} = validatePackageSubscriptionPlans(packageDef);
 * if (!ok) throw new Error(errors.join('\n'));
 * ```
 */
export function validatePackageSubscriptionPlans(
    definition: PackageSubscriptionPlansSource,
): PackageSubscriptionPlansValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const plans = definition.subscriptionPlans;

    if (!plans?.length) return {ok: true, errors, warnings};

    const hasPermission = (definition.permissions ?? []).some(entry =>
        (typeof entry === 'string' ? entry : entry.permission) === EnergyAppPermissionTypeEnum.Subscriptions);
    if (!hasPermission) {
        errors.push(
            'subscriptionPlans are declared but the `Subscriptions` permission is missing — the app could not read what was bought.',
        );
    }

    const planKeys = new Set<string>();

    for (const [index, plan] of plans.entries()) {
        const at = `subscriptionPlans[${index}] (${plan.planKey || '?'})`;

        if (!plan.planKey?.trim()) {
            errors.push(`${at}: planKey is required.`);
        } else if (!SLUG_RE.test(plan.planKey)) {
            errors.push(`${at}: planKey must be a kebab-case slug, e.g. "premium".`);
        } else if (planKeys.has(plan.planKey)) {
            errors.push(`${at}: duplicate planKey "${plan.planKey}" — plan keys must be unique within the package.`);
        } else {
            planKeys.add(plan.planKey);
        }

        if (!Object.values(EnyoSubscriptionPaymentIntervalEnum).includes(plan.paymentInterval as EnyoSubscriptionPaymentIntervalEnum)) {
            errors.push(`${at}: paymentInterval "${plan.paymentInterval}" is not supported.`);
        }

        if (plan.pricingModel !== undefined
            && !Object.values(EnyoSubscriptionPricingModelEnum).includes(plan.pricingModel as EnyoSubscriptionPricingModelEnum)) {
            errors.push(`${at}: pricingModel "${plan.pricingModel}" is not supported.`);
        }

        validatePrices(plan, at, errors);

        if (plan.trialDays !== undefined) {
            if (plan.paymentInterval === EnyoSubscriptionPaymentIntervalEnum.OneTime) {
                errors.push(`${at}: trialDays is not allowed for a one-time plan — there is no later charge to defer.`);
            } else if (!Number.isInteger(plan.trialDays) || plan.trialDays <= 0) {
                errors.push(`${at}: trialDays must be a whole number greater than 0 — omit it for plans without a trial.`);
            }
        }

        validateStoreEntries(plan, at, errors);
    }

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Like {@link validatePackageSubscriptionPlans}, but throws
 * {@link PackageSubscriptionPlansValidationError} when there are blocking
 * errors. Warnings never throw; the validated plans are returned on success
 * for chaining.
 *
 * @param definition - The package definition, or just its `subscriptionPlans`
 *   and `permissions`.
 * @returns The declared plans, or `undefined` when the package declares none.
 * @throws {PackageSubscriptionPlansValidationError} When validation produces any error.
 */
export function assertValidPackageSubscriptionPlans(
    definition: PackageSubscriptionPlansSource,
): EnergyAppPackageSubscriptionPlan[] | undefined {
    const {ok, errors} = validatePackageSubscriptionPlans(definition);
    if (!ok) throw new PackageSubscriptionPlansValidationError(errors);
    return definition.subscriptionPlans;
}

/** The outcome of validating the units reported for a `per-unit` plan. */
export interface SubscriptionUnitsValidationResult {
    /** True when there are no `errors`. */
    ok: boolean;
    /** Problems that make the host reject the units. */
    errors: string[];
}

/**
 * Validates the units an app reports for a `per-unit` plan with
 * {@link EnergyAppSubscriptions.setUnits}: every unit has a known type and a
 * non-empty reference, no unit is reported twice (same `type` and
 * `referenceId`), and every custom unit has a non-empty name in German and
 * English. The host applies the same rules and rejects invalid units.
 *
 * @param units - The units to report.
 * @returns The {@link SubscriptionUnitsValidationResult}.
 *
 * @example
 * ```typescript
 * const {ok, errors} = validateSubscriptionUnits(units);
 * if (!ok) logger.warn(errors.join('\n'));
 * ```
 */
export function validateSubscriptionUnits(units: EnyoSubscriptionUnit[]): SubscriptionUnitsValidationResult {
    const errors: string[] = [];
    const seen = new Set<string>();

    for (const [index, unit] of units.entries()) {
        const at = `units[${index}] (${unit.type || '?'} ${unit.referenceId || '?'})`;

        if (!Object.values(EnyoSubscriptionUnitTypeEnum).includes(unit.type as EnyoSubscriptionUnitTypeEnum)) {
            errors.push(`${at}: type "${unit.type}" is not supported.`);
        }

        if (!unit.referenceId?.trim()) {
            errors.push(`${at}: referenceId is required.`);
        } else {
            const key = `${unit.type}\u0000${unit.referenceId}`;
            if (seen.has(key)) {
                errors.push(`${at}: duplicate unit — type and referenceId must be unique.`);
            }
            seen.add(key);
        }

        if (unit.type === EnyoSubscriptionUnitTypeEnum.Custom) {
            const names = unit.name ?? [];
            for (const language of REQUIRED_LANGUAGES) {
                if (!names.some(name => name.language === language && name.value?.trim())) {
                    errors.push(`${at}: a custom unit needs a name in language "${language}".`);
                }
            }
        }
    }

    return {ok: errors.length === 0, errors};
}
