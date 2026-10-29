import type {EnergyAppPackageLanguage} from "../energy-app-package-definition.js";

/**
 * The fixed set of icons enyo can render on the subscription offer screen,
 * for features ({@link EnyoSubscriptionFeature.icon}) and blocks
 * ({@link EnyoSubscriptionOfferHeroBlock.icon},
 * {@link EnyoSubscriptionOfferHintBlock.icon}).
 *
 * Packages cannot ship their own icons here: every app's offer screen uses
 * the same icon style, and the host can render them natively.
 */
export enum EnyoSubscriptionOfferIconEnum {
    /** Saving money, e.g. lower electricity costs. */
    PiggyBank = 'piggy-bank',
    /** Money or prices in general. */
    Coins = 'coins',
    /** Euro amounts, e.g. a dynamic tariff. */
    Euro = 'euro',
    /** Statistics, history or forecasts. */
    Chart = 'chart',
    /** Energy, power or fast charging. */
    Lightning = 'lightning',
    /** Solar power and PV surplus. */
    Sun = 'sun',
    /** Home batteries. */
    Battery = 'battery',
    /** Heat pumps and heating. */
    HeatPump = 'heat-pump',
    /** Temperatures and room climate. */
    Thermometer = 'thermometer',
    /** Electric vehicles. */
    Car = 'car',
    /** Wallboxes and charging stations. */
    Wallbox = 'wallbox',
    /** Plugs and smart sockets. */
    Plug = 'plug',
    /** The home or the whole household. */
    Home = 'home',
    /** CO₂ savings and green energy. */
    Leaf = 'leaf',
    /** Schedules and timed control. */
    Clock = 'clock',
    /** Calendars, contract terms or billing periods. */
    Calendar = 'calendar',
    /** Reliability and protection. */
    Shield = 'shield',
    /** Privacy and security. */
    Lock = 'lock',
    /** Notifications and alerts. */
    Bell = 'bell',
    /** Personal support. */
    Support = 'support',
    /** Partners, e.g. a vendor integration that costs money. */
    Handshake = 'handshake',
    /** Premium or highlighted features. */
    Star = 'star',
    /** New or smart features. */
    Sparkles = 'sparkles',
    /** Something included. */
    Check = 'check',
    /** General information. */
    Info = 'info',
}

/**
 * String union of every offer screen icon, derived from
 * {@link EnyoSubscriptionOfferIconEnum} so both spellings stay interchangeable.
 */
export type EnyoSubscriptionOfferIcon = `${EnyoSubscriptionOfferIconEnum}`;

/**
 * A badge that makes one plan stand out on the offer screen, set on
 * {@link EnergyAppPackageSubscriptionPlan.highlight}. At most one plan of a
 * package may be highlighted.
 */
export enum EnyoSubscriptionPlanHighlightEnum {
    /** The plan the app recommends for most customers. */
    Recommended = 'recommended',
    /** The plan with the best price for what it includes, e.g. a yearly plan next to a monthly one. */
    BestValue = 'best-value',
    /** The plan most customers choose. */
    MostPopular = 'most-popular',
}

/**
 * String union of every plan highlight, derived from
 * {@link EnyoSubscriptionPlanHighlightEnum} so both spellings stay
 * interchangeable.
 */
export type EnyoSubscriptionPlanHighlight = `${EnyoSubscriptionPlanHighlightEnum}`;

/**
 * What a hint on the offer screen tells the customer. The host styles hints
 * by their kind.
 */
export enum EnyoSubscriptionOfferHintKindEnum {
    /**
     * Why the app costs money at all, e.g. "We have to charge for this because
     * the car vendors charge us for every connected vehicle."
     */
    PricingReason = 'pricing-reason',
    /** Something the customer needs for the plan to be useful, e.g. a dynamic electricity tariff. */
    Requirement = 'requirement',
    /** General information about the offer. */
    Info = 'info',
    /** Fine print, e.g. how savings were estimated. */
    Legal = 'legal',
}

/**
 * String union of every hint kind, derived from
 * {@link EnyoSubscriptionOfferHintKindEnum} so both spellings stay
 * interchangeable.
 */
export type EnyoSubscriptionOfferHintKind = `${EnyoSubscriptionOfferHintKindEnum}`;

/**
 * One translated piece of text on the offer screen.
 */
export interface EnyoSubscriptionOfferTranslation {
    /** Language code this translation applies to. */
    language: EnergyAppPackageLanguage;
    /** The displayed text in the given language. */
    value: string;
}

/**
 * Localized texts of one {@link EnyoSubscriptionFeature}.
 */
export interface EnyoSubscriptionFeatureStoreEntry {
    /** Language code for this store entry. */
    language: EnergyAppPackageLanguage;
    /** Short name of the feature, e.g. `'Dynamic price optimisation'`. */
    title: string;
    /** Optional sentence explaining the feature, shown below the title. */
    description?: string;
}

/**
 * A feature of the app, declared once in
 * {@link EnergyAppPackageDefinition.subscriptionFeatures} and referenced by
 * the plans that include it ({@link EnergyAppPackageSubscriptionPlan.includedFeatures})
 * and by the free tier ({@link EnyoSubscriptionFreeTier.includedFeatures}).
 *
 * Declaring the features once lets enyo show them in feature lists and build
 * a comparison table of the free tier and the plans, row by row.
 *
 * @example
 * ```typescript
 * defineSubscriptionFeature({
 *     featureKey: 'price-optimisation',
 *     icon: EnyoSubscriptionOfferIconEnum.PiggyBank,
 *     storeEntry: [
 *         {language: 'en', title: 'Dynamic price optimisation', description: 'Charges when electricity is cheapest.'},
 *         {language: 'de', title: 'Optimierung nach dynamischen Preisen', description: 'Lädt, wenn Strom am günstigsten ist.'}
 *     ]
 * })
 * ```
 */
export interface EnyoSubscriptionFeature {
    /**
     * Stable, app-chosen key: a kebab-case slug, unique within the package.
     * Plans and the free tier refer to the feature by it.
     */
    featureKey: string;
    /** Optional icon shown next to the feature. */
    icon?: EnyoSubscriptionOfferIcon;
    /** Localized texts. Entries for `de` and `en` are required. */
    storeEntry: EnyoSubscriptionFeatureStoreEntry[];
}

/**
 * A feature included with a value that differs between the free tier and the
 * plans, e.g. "1 vehicle" in the free tier and "up to 5 vehicles" in a plan.
 * The value is shown in the comparison table instead of a check mark.
 */
export interface EnyoSubscriptionIncludedFeatureValue {
    /** The {@link EnyoSubscriptionFeature.featureKey} of the included feature. */
    featureKey: string;
    /** Translated value, e.g. `'up to 5 vehicles'`. Entries for `de` and `en` are required. */
    value: EnyoSubscriptionOfferTranslation[];
}

/**
 * A feature included in a plan or in the free tier: either just its
 * {@link EnyoSubscriptionFeature.featureKey} (shown as a check mark in the
 * comparison table) or a {@link EnyoSubscriptionIncludedFeatureValue} with a
 * translated value.
 */
export type EnyoSubscriptionIncludedFeature = string | EnyoSubscriptionIncludedFeatureValue;

/**
 * Localized texts of the {@link EnyoSubscriptionFreeTier}.
 */
export interface EnyoSubscriptionFreeTierStoreEntry {
    /** Language code for this store entry. */
    language: EnergyAppPackageLanguage;
    /** Name of the free tier, e.g. `'Basic'`. Used as the free column's header. */
    title: string;
    /** Optional sentence describing what the free tier offers. */
    shortDescription?: string;
}

/**
 * What the app offers for free, declared in
 * {@link EnergyAppPackageDefinition.subscriptionFreeTier}. Only allowed with
 * `subscriptionMode: 'optional'`: a `required` app has no free base.
 *
 * enyo shows it as the free column of the comparison table and as the option
 * a customer can downgrade to.
 */
export interface EnyoSubscriptionFreeTier {
    /** Localized texts. Entries for `de` and `en` are required. */
    storeEntry: EnyoSubscriptionFreeTierStoreEntry[];
    /**
     * The features the free tier includes, as keys of
     * {@link EnergyAppPackageDefinition.subscriptionFeatures}, in display
     * order.
     */
    includedFeatures: EnyoSubscriptionIncludedFeature[];
}

/**
 * The kinds of block an offer screen is built from.
 */
export enum EnyoSubscriptionOfferBlockTypeEnum {
    /** A large headline with an optional text and icon, usually first. */
    Hero = 'hero',
    /** A list of features with their icons and descriptions. */
    Features = 'features',
    /** A table comparing the free tier and the plans feature by feature. */
    Comparison = 'comparison',
    /** A highlighted note, e.g. why the app costs money. */
    Hint = 'hint',
    /** The plan cards the customer chooses from and checks out with. */
    Plans = 'plans',
}

/**
 * String union of every block type, derived from
 * {@link EnyoSubscriptionOfferBlockTypeEnum} so both spellings stay
 * interchangeable.
 */
export type EnyoSubscriptionOfferBlockType = `${EnyoSubscriptionOfferBlockTypeEnum}`;

/**
 * Localized texts of an offer screen block.
 */
export interface EnyoSubscriptionOfferBlockStoreEntry {
    /** Language code for this store entry. */
    language: EnergyAppPackageLanguage;
    /** Optional heading of the block. Required for a `hero` block. */
    title?: string;
    /** Optional body text of the block. Required for a `hint` block. */
    text?: string;
}

/**
 * A large headline at the top of the offer screen.
 */
export interface EnyoSubscriptionOfferHeroBlock {
    /** Discriminator identifying this as a hero block. */
    type: 'hero';
    /** Optional icon shown with the headline. */
    icon?: EnyoSubscriptionOfferIcon;
    /** Localized texts; `title` is required. Entries for `de` and `en` are required. */
    storeEntry: EnyoSubscriptionOfferBlockStoreEntry[];
}

/**
 * A list of features with their icons and descriptions.
 */
export interface EnyoSubscriptionOfferFeaturesBlock {
    /** Discriminator identifying this as a features block. */
    type: 'features';
    /**
     * The features to list, as keys of
     * {@link EnergyAppPackageDefinition.subscriptionFeatures}, in display
     * order. Omit to list every declared feature.
     */
    featureKeys?: string[];
    /** Optional localized heading and text. When set, entries for `de` and `en` are required. */
    storeEntry?: EnyoSubscriptionOfferBlockStoreEntry[];
}

/**
 * A table comparing the free tier and the plans: one row per feature, one
 * column per tier. A cell shows a check mark, the feature's
 * {@link EnyoSubscriptionIncludedFeatureValue.value}, or nothing when the
 * tier does not include the feature.
 */
export interface EnyoSubscriptionOfferComparisonBlock {
    /** Discriminator identifying this as a comparison block. */
    type: 'comparison';
    /**
     * Whether the first column is the {@link EnyoSubscriptionFreeTier}.
     * Defaults to `true` when the package declares a free tier.
     */
    includeFreeTier?: boolean;
    /** The plans to compare, as plan keys, in column order. Omit to compare every plan. */
    planKeys?: string[];
    /** The rows, as feature keys, in display order. Omit to compare every declared feature. */
    featureKeys?: string[];
    /** Optional localized heading and text. When set, entries for `de` and `en` are required. */
    storeEntry?: EnyoSubscriptionOfferBlockStoreEntry[];
}

/**
 * A highlighted note on the offer screen, styled by its
 * {@link EnyoSubscriptionOfferHintKindEnum | kind}.
 *
 * @example
 * ```typescript
 * {
 *     type: 'hint',
 *     kind: EnyoSubscriptionOfferHintKindEnum.PricingReason,
 *     icon: EnyoSubscriptionOfferIconEnum.Handshake,
 *     storeEntry: [
 *         {language: 'en', title: 'Why does this cost money?', text: 'The car vendors charge us for every connected vehicle.'},
 *         {language: 'de', title: 'Warum kostet das Geld?', text: 'Die Fahrzeughersteller berechnen uns jedes verbundene Fahrzeug.'}
 *     ]
 * }
 * ```
 */
export interface EnyoSubscriptionOfferHintBlock {
    /** Discriminator identifying this as a hint block. */
    type: 'hint';
    /** What the hint tells the customer. */
    kind: EnyoSubscriptionOfferHintKind;
    /** Optional icon; the host picks one matching the kind when omitted. */
    icon?: EnyoSubscriptionOfferIcon;
    /** Localized texts; `text` is required. Entries for `de` and `en` are required. */
    storeEntry: EnyoSubscriptionOfferBlockStoreEntry[];
}

/**
 * The plan cards the customer chooses from. At most one per offer screen;
 * when the screen has none, the host shows the plans after the last block.
 */
export interface EnyoSubscriptionOfferPlansBlock {
    /** Discriminator identifying this as a plans block. */
    type: 'plans';
    /** Optional localized heading and text. When set, entries for `de` and `en` are required. */
    storeEntry?: EnyoSubscriptionOfferBlockStoreEntry[];
}

/**
 * One block of the offer screen, identified by its `type`.
 */
export type EnyoSubscriptionOfferBlock =
    | EnyoSubscriptionOfferHeroBlock
    | EnyoSubscriptionOfferFeaturesBlock
    | EnyoSubscriptionOfferComparisonBlock
    | EnyoSubscriptionOfferHintBlock
    | EnyoSubscriptionOfferPlansBlock;

/**
 * The layout of the screen on which enyo offers the package's plans, declared
 * in {@link EnergyAppPackageDefinition.subscriptionOfferScreen}. The blocks
 * are shown from top to bottom in the declared order.
 *
 * Without an offer screen enyo shows only the plan cards with each plan's
 * store entry.
 *
 * @example
 * ```typescript
 * defineSubscriptionOfferScreen({
 *     blocks: [
 *         {type: 'hero', icon: 'piggy-bank', storeEntry: [
 *             {language: 'en', title: 'Charge for less', text: 'Smart charging with dynamic prices.'},
 *             {language: 'de', title: 'Günstiger laden', text: 'Intelligentes Laden mit dynamischen Preisen.'}
 *         ]},
 *         {type: 'comparison'},
 *         {type: 'hint', kind: 'pricing-reason', storeEntry: [
 *             {language: 'en', text: 'The car vendors charge us for every connected vehicle.'},
 *             {language: 'de', text: 'Die Fahrzeughersteller berechnen uns jedes verbundene Fahrzeug.'}
 *         ]},
 *         {type: 'plans'}
 *     ]
 * })
 * ```
 */
export interface EnyoSubscriptionOfferScreen {
    /** The blocks of the screen, top to bottom. At least one is required. */
    blocks: EnyoSubscriptionOfferBlock[];
}

