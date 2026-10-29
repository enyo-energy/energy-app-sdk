/**
 * Client-side validator for how a package promotes its subscription plans:
 * the feature catalog ({@link EnergyAppPackageDefinition.subscriptionFeatures}),
 * the free tier ({@link EnergyAppPackageDefinition.subscriptionFreeTier}), the
 * offer screen blocks ({@link EnergyAppPackageDefinition.subscriptionOfferScreen})
 * and the plans' `includedFeatures` and `highlight`.
 *
 * `validatePackageSubscriptionPlans()` runs these checks as part of the plan
 * validation, so most callers never call {@link validatePackageSubscriptionOffer}
 * directly.
 */

import type {
    EnergyAppPackageDefinition,
    EnergyAppPackageLanguage
} from '../../energy-app-package-definition.js';
import {EnyoSubscriptionModeEnum} from '../../types/enyo-subscription.js';
import {
    EnyoSubscriptionIncludedFeature,
    EnyoSubscriptionOfferBlock,
    EnyoSubscriptionOfferBlockStoreEntry,
    EnyoSubscriptionOfferBlockTypeEnum,
    EnyoSubscriptionOfferHintKindEnum,
    EnyoSubscriptionOfferIconEnum,
    EnyoSubscriptionPlanHighlightEnum
} from '../../types/enyo-subscription-offer.js';
import {getIncludedFeatureKey} from './define-subscription-plan.js';

/** The outcome of validating how a package promotes its plans. */
export interface PackageSubscriptionOfferValidationResult {
    /** True when there are no blocking `errors` (warnings are still allowed). */
    ok: boolean;
    /** Blocking problems — these must be fixed before releasing. */
    errors: string[];
    /** Advisory problems — allowed, but usually worth reviewing. */
    warnings: string[];
}

/**
 * The parts of a package definition the offer validator reads.
 */
export type PackageSubscriptionOfferSource = Pick<
    EnergyAppPackageDefinition,
    'subscriptionPlans' | 'subscriptionMode' | 'subscriptionFeatures' | 'subscriptionFreeTier' | 'subscriptionOfferScreen'
>;

/** A feature key — the same kebab-case slug shape as a plan key. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Languages every text on the offer screen must be translated into. */
const REQUIRED_LANGUAGES: readonly EnergyAppPackageLanguage[] = ['de', 'en'];

/**
 * Checks that a list of localized entries has no duplicate language, covers
 * every required language, and fills the required fields in every entry.
 *
 * @param entries - The localized entries, e.g. a feature's `storeEntry`.
 * @param at - Location prefix for messages.
 * @param requiredFields - Fields that must be non-empty in every entry.
 * @param errors - Collector for blocking errors.
 */
function validateTranslations<T extends { language: EnergyAppPackageLanguage }>(
    entries: T[] | undefined,
    at: string,
    requiredFields: readonly (keyof T & string)[],
    errors: string[],
): void {
    const languages = new Set<string>();

    for (const [index, entry] of (entries ?? []).entries()) {
        const entryAt = `${at}[${index}] (${entry.language || '?'})`;
        if (languages.has(entry.language)) {
            errors.push(`${entryAt}: duplicate language "${entry.language}".`);
        }
        languages.add(entry.language);

        for (const field of requiredFields) {
            const value = entry[field];
            if (typeof value !== 'string' || !value.trim()) {
                errors.push(`${entryAt}: ${field} is required.`);
            }
        }
    }

    for (const language of REQUIRED_LANGUAGES) {
        if (!languages.has(language)) {
            errors.push(`${at}: entry for language "${language}" is required.`);
        }
    }
}

/**
 * Checks the included features of a plan or of the free tier: every entry
 * names a declared feature, no feature is listed twice, and every value is
 * translated.
 *
 * @param included - The included features, or `undefined` when none are declared.
 * @param featureKeys - The keys of the feature catalog.
 * @param at - Location prefix for messages.
 * @param errors - Collector for blocking errors.
 */
function validateIncludedFeatures(
    included: EnyoSubscriptionIncludedFeature[] | undefined,
    featureKeys: Set<string>,
    at: string,
    errors: string[],
): void {
    const seen = new Set<string>();

    for (const [index, feature] of (included ?? []).entries()) {
        const key = getIncludedFeatureKey(feature);
        const featureAt = `${at}.includedFeatures[${index}] (${key || '?'})`;

        if (!featureKeys.has(key)) {
            errors.push(`${featureAt}: "${key}" is not a feature of subscriptionFeatures.`);
        } else if (seen.has(key)) {
            errors.push(`${featureAt}: feature "${key}" is listed twice.`);
        }
        seen.add(key);

        if (typeof feature !== 'string') {
            validateTranslations(feature.value, `${featureAt}.value`, ['value'], errors);
        }
    }
}

/**
 * Checks that every key of a block's key list is declared.
 *
 * @param keys - The keys the block refers to, or `undefined` for "all".
 * @param known - The declared keys.
 * @param kind - `'feature'` or `'plan'`, used in messages.
 * @param at - Location prefix for messages.
 * @param errors - Collector for blocking errors.
 */
function validateBlockKeys(
    keys: string[] | undefined,
    known: Set<string>,
    kind: 'feature' | 'plan',
    at: string,
    errors: string[],
): void {
    if (keys === undefined) return;
    if (keys.length === 0) {
        errors.push(`${at}: ${kind}Keys must not be empty — omit it to use every ${kind}.`);
    }
    const seen = new Set<string>();
    for (const key of keys) {
        if (!known.has(key)) errors.push(`${at}: "${key}" is not a declared ${kind}.`);
        else if (seen.has(key)) errors.push(`${at}: ${kind} "${key}" is listed twice.`);
        seen.add(key);
    }
}

/**
 * Checks a block's optional heading and text: when set, they must be
 * translated into every required language.
 *
 * @param storeEntry - The block's localized texts.
 * @param at - Location prefix for messages.
 * @param requiredFields - Fields that must be non-empty in every entry.
 * @param errors - Collector for blocking errors.
 */
function validateBlockTexts(
    storeEntry: EnyoSubscriptionOfferBlockStoreEntry[] | undefined,
    at: string,
    requiredFields: readonly ('title' | 'text')[],
    errors: string[],
): void {
    validateTranslations(storeEntry, `${at}.storeEntry`, requiredFields, errors);
    for (const [index, entry] of (storeEntry ?? []).entries()) {
        if (!entry.title?.trim() && !entry.text?.trim()) {
            errors.push(`${at}.storeEntry[${index}] (${entry.language || '?'}): title or text is required.`);
        }
    }
}

/**
 * Checks an optional icon against {@link EnyoSubscriptionOfferIconEnum}.
 *
 * @param icon - The icon, or `undefined`.
 * @param at - Location prefix for messages.
 * @param errors - Collector for blocking errors.
 */
function validateIcon(icon: string | undefined, at: string, errors: string[]): void {
    if (icon !== undefined && !Object.values(EnyoSubscriptionOfferIconEnum).includes(icon as EnyoSubscriptionOfferIconEnum)) {
        errors.push(`${at}: icon "${icon}" is not supported — use one of EnyoSubscriptionOfferIconEnum.`);
    }
}

/**
 * Validates how a package promotes its plans:
 *
 * - **Features**: keys are unique kebab-case slugs, icons are known, and every
 *   feature has a German and English title.
 * - **Plans**: `includedFeatures` name declared features, at most once each,
 *   with translated values; `highlight` is known and set on at most one plan.
 * - **Free tier**: only with `subscriptionMode: 'optional'`, translated, and
 *   its `includedFeatures` follow the plan rules.
 * - **Offer screen**: at least one block, every block type is known, texts are
 *   translated (a `hero` needs a title, a `hint` a known kind and a text),
 *   referenced features and plans exist, a comparison has at least two
 *   columns and a free column only with a free tier, and there is at most one
 *   `plans` block.
 *
 * Warnings flag features no tier includes, comparison rows no column
 * includes, and offer declarations without plans.
 *
 * @param definition - The package definition, or just the fields listed in
 *   {@link PackageSubscriptionOfferSource}.
 * @returns The {@link PackageSubscriptionOfferValidationResult}.
 *
 * @example
 * ```typescript
 * const {ok, errors} = validatePackageSubscriptionOffer(packageDef);
 * if (!ok) throw new Error(errors.join('\n'));
 * ```
 */
export function validatePackageSubscriptionOffer(
    definition: PackageSubscriptionOfferSource,
): PackageSubscriptionOfferValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const plans = definition.subscriptionPlans ?? [];
    const features = definition.subscriptionFeatures ?? [];
    const freeTier = definition.subscriptionFreeTier;
    const screen = definition.subscriptionOfferScreen;

    if (!plans.length) {
        if (definition.subscriptionFeatures || freeTier || screen) {
            warnings.push(
                'subscriptionFeatures, subscriptionFreeTier or subscriptionOfferScreen is set but no subscriptionPlans are declared — it has no effect.',
            );
        }
        return {ok: true, errors, warnings};
    }

    const featureKeys = new Set<string>();
    for (const [index, feature] of features.entries()) {
        const at = `subscriptionFeatures[${index}] (${feature.featureKey || '?'})`;
        if (!feature.featureKey?.trim()) {
            errors.push(`${at}: featureKey is required.`);
        } else if (!SLUG_RE.test(feature.featureKey)) {
            errors.push(`${at}: featureKey must be a kebab-case slug, e.g. "price-optimisation".`);
        } else if (featureKeys.has(feature.featureKey)) {
            errors.push(`${at}: duplicate featureKey "${feature.featureKey}" — feature keys must be unique within the package.`);
        }
        featureKeys.add(feature.featureKey);
        validateIcon(feature.icon, at, errors);
        validateTranslations(feature.storeEntry, `${at}.storeEntry`, ['title'], errors);
    }

    const includedSomewhere = new Set<string>();
    const highlighted: string[] = [];
    for (const [index, plan] of plans.entries()) {
        const at = `subscriptionPlans[${index}] (${plan.planKey || '?'})`;
        validateIncludedFeatures(plan.includedFeatures, featureKeys, at, errors);
        plan.includedFeatures?.forEach(feature => includedSomewhere.add(getIncludedFeatureKey(feature)));

        if (plan.highlight !== undefined) {
            if (!Object.values(EnyoSubscriptionPlanHighlightEnum).includes(plan.highlight as EnyoSubscriptionPlanHighlightEnum)) {
                errors.push(`${at}: highlight "${plan.highlight}" is not supported.`);
            }
            highlighted.push(plan.planKey);
        }
    }
    if (highlighted.length > 1) {
        errors.push(`Only one plan may be highlighted, but ${highlighted.map(key => `"${key}"`).join(', ')} are.`);
    }

    if (freeTier) {
        if (definition.subscriptionMode === EnyoSubscriptionModeEnum.Required) {
            errors.push('subscriptionFreeTier is not allowed with subscriptionMode "required" — the app has no free base.');
        }
        validateTranslations(freeTier.storeEntry, 'subscriptionFreeTier.storeEntry', ['title'], errors);
        validateIncludedFeatures(freeTier.includedFeatures, featureKeys, 'subscriptionFreeTier', errors);
        freeTier.includedFeatures?.forEach(feature => includedSomewhere.add(getIncludedFeatureKey(feature)));
    }

    for (const feature of features) {
        if (feature.featureKey && !includedSomewhere.has(feature.featureKey)) {
            warnings.push(`Feature "${feature.featureKey}" is not included in any plan or the free tier.`);
        }
    }

    if (screen) {
        validateOfferScreenBlocks(screen.blocks, definition, featureKeys, errors, warnings);
    }

    return {ok: errors.length === 0, errors, warnings};
}

/**
 * Checks the blocks of the offer screen.
 *
 * @param blocks - The declared blocks.
 * @param definition - The package definition, for plans and the free tier.
 * @param featureKeys - The keys of the feature catalog.
 * @param errors - Collector for blocking errors.
 * @param warnings - Collector for advisory problems.
 */
function validateOfferScreenBlocks(
    blocks: EnyoSubscriptionOfferBlock[] | undefined,
    definition: PackageSubscriptionOfferSource,
    featureKeys: Set<string>,
    errors: string[],
    warnings: string[],
): void {
    if (!Array.isArray(blocks) || blocks.length === 0) {
        errors.push('subscriptionOfferScreen.blocks must contain at least one block — omit subscriptionOfferScreen to show only the plans.');
        return;
    }

    const plans = definition.subscriptionPlans ?? [];
    const planKeys = new Set(plans.map(plan => plan.planKey));
    let plansBlocks = 0;

    for (const [index, block] of blocks.entries()) {
        const at = `subscriptionOfferScreen.blocks[${index}] (${block?.type || '?'})`;

        switch (block?.type) {
            case EnyoSubscriptionOfferBlockTypeEnum.Hero:
                validateIcon(block.icon, at, errors);
                validateBlockTexts(block.storeEntry, at, ['title'], errors);
                break;

            case EnyoSubscriptionOfferBlockTypeEnum.Features:
                if (featureKeys.size === 0) {
                    errors.push(`${at}: a features block needs subscriptionFeatures to list.`);
                }
                validateBlockKeys(block.featureKeys, featureKeys, 'feature', at, errors);
                if (block.storeEntry) validateBlockTexts(block.storeEntry, at, [], errors);
                break;

            case EnyoSubscriptionOfferBlockTypeEnum.Comparison: {
                if (featureKeys.size === 0) {
                    errors.push(`${at}: a comparison block needs subscriptionFeatures as its rows.`);
                }
                validateBlockKeys(block.featureKeys, featureKeys, 'feature', at, errors);
                validateBlockKeys(block.planKeys, planKeys, 'plan', at, errors);

                const freeColumn = block.includeFreeTier ?? definition.subscriptionFreeTier !== undefined;
                if (freeColumn && !definition.subscriptionFreeTier) {
                    errors.push(`${at}: includeFreeTier needs subscriptionFreeTier to fill the free column.`);
                }
                const columnPlans = plans.filter(plan => block.planKeys?.includes(plan.planKey) ?? true);
                if (columnPlans.length + (freeColumn ? 1 : 0) < 2) {
                    errors.push(`${at}: a comparison needs at least two columns — add the free tier or another plan.`);
                }

                const included = new Set<string>([
                    ...(freeColumn ? definition.subscriptionFreeTier?.includedFeatures ?? [] : []),
                    ...columnPlans.flatMap(plan => plan.includedFeatures ?? []),
                ].map(getIncludedFeatureKey));
                for (const key of block.featureKeys ?? featureKeys) {
                    if (featureKeys.has(key) && !included.has(key)) {
                        warnings.push(`${at}: feature "${key}" is not included in any compared column — its row stays empty.`);
                    }
                }
                if (block.storeEntry) validateBlockTexts(block.storeEntry, at, [], errors);
                break;
            }

            case EnyoSubscriptionOfferBlockTypeEnum.Hint:
                if (!Object.values(EnyoSubscriptionOfferHintKindEnum).includes(block.kind as EnyoSubscriptionOfferHintKindEnum)) {
                    errors.push(`${at}: kind "${block.kind}" is not supported.`);
                }
                validateIcon(block.icon, at, errors);
                validateBlockTexts(block.storeEntry, at, ['text'], errors);
                break;

            case EnyoSubscriptionOfferBlockTypeEnum.Plans:
                plansBlocks++;
                if (block.storeEntry) validateBlockTexts(block.storeEntry, at, [], errors);
                break;

            default:
                errors.push(`${at}: block type "${(block as { type?: string })?.type}" is not supported.`);
        }
    }

    if (plansBlocks > 1) {
        errors.push('subscriptionOfferScreen.blocks may contain at most one "plans" block.');
    }
}
