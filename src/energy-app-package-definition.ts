import {EnergyAppPermissionType} from "./energy-app-permission.type.js";
import {getSdkVersion} from "./version.js";
import {EnergyAppModelFeatureEnum} from "./energy-app-model-feature.enum.js";
import type {EnyoFileTranslation} from "./types/enyo-file.js";
import type {EnyoOnboardingV2Guide} from "./types/enyo-onboarding-v2.js";
import type {EnyoOnboardingTranslatedContent} from "./types/enyo-onboarding.js";
import type {
    EnyoSubscriptionMode,
    EnyoSubscriptionPaymentInterval,
    EnyoSubscriptionPrice,
    EnyoSubscriptionPricingModel
} from "./types/enyo-subscription.js";
import type {
    EnyoSubscriptionFeature,
    EnyoSubscriptionFreeTier,
    EnyoSubscriptionIncludedFeature,
    EnyoSubscriptionOfferScreen,
    EnyoSubscriptionPlanHighlight
} from "./types/enyo-subscription-offer.js";

export type EnergyAppPackageLanguage = 'de' | 'en';

export enum EnergyAppPackageCategory {
    Inverter = 'inverter',
    Wallbox = 'wallbox',
    Meter = 'meter',
    EnergyManagement = 'energy-management',
    HeatPump = 'heat-pump',
    AirConditioning = 'air-conditioning',
    BatteryStorage = 'battery-storage',
    ClimateControl = 'climate-control',
    DynamicElectricityTariff = 'dynamic-electricity-tariff',
    StaticElectricityTariff = 'static-electricity-tariff',
    TemperatureSensor = 'temperature-sensor',
    SmartPlug = 'smart-plug',
    HeatingRod = 'heating-rod',
    GridOperator = 'grid-operator',
    /**
     * Integrations that talk to a car — typically a manufacturer cloud API —
     * and link it to one of the user's vehicles. See `EnergyAppVehicle`'s
     * `onPairVehicle` for how the link is made.
     */
    Vehicle = 'vehicle',
    Other = 'other',
}

/**
 * Configuration options for restricting internet access in an Energy App package.
 * Defines which internet origins (domains) the Energy App is allowed to access.
 */
export interface EnergyAppPackageRestrictedInternetAccessOption {
    /** List of allowed internet origins (domains) that the Energy App can access. Only these origins will be accessible. This information is shown to the user */
    origins: string[];
}

/**
 * Optional device detection configuration for hostname detection. The check is always lower case string
 */
export interface EnergyAppPackageOptionsDeviceDetectionHostname {
    operation: 'eq' | 'startsWith';
    matchingValue: string;
}

/**
 * Which Modbus register bank a device detection rule reads.
 * - `'holding'`: holding registers, function code 3
 * - `'input'`: input registers, function code 4
 *
 * The two banks are separate address spaces, so the same address may hold
 * different data (or nothing) in each.
 */
export type EnergyAppPackageOptionsDeviceDetectionModbusRegisterType = 'holding' | 'input';

/**
 * How the Modbus device detection rules in
 * {@link EnergyAppPackageOptionsDeviceDetection.modbus} are combined.
 *
 * Each name has two parts:
 * - `Registers…`: how the entries (registers) of the `modbus` list combine.
 *   `Or` means one matching register is enough; `And` means every register has
 *   to match, all on the same unit id.
 * - `MatchingValues…`: how the `matchingValues` within one register combine.
 *   `Or` means the register's value has to match one of them; `And` means it
 *   has to match all of them.
 *
 * Only read from the **first** entry of the `modbus` list and applies to the
 * whole list; set it there and nowhere else. Defaults to
 * {@link RegistersOr_MatchingValuesOr} when omitted, which is the behaviour of
 * all existing rules.
 */
export enum EnergyAppPackageOptionsDeviceDetectionModbusModeEnum {
    /** One register has to match, with one of its matching values. The default. */
    RegistersOr_MatchingValuesOr = 'RegistersOr_MatchingValuesOr',
    /** One register has to match, with all of its matching values. */
    RegistersOr_MatchingValuesAnd = 'RegistersOr_MatchingValuesAnd',
    /** Every register has to match, each with one of its matching values. */
    RegistersAnd_MatchingValuesOr = 'RegistersAnd_MatchingValuesOr',
    /** Every register has to match, each with all of its matching values. */
    RegistersAnd_MatchingValuesAnd = 'RegistersAnd_MatchingValuesAnd',
}

/**
 * Optional device detection configuration for Modbus TCP register matching:
 * read a register range and compare its decoded value against the matching
 * values.
 *
 * How several entries and several matching values combine is set by
 * {@link mode} on the first entry of the list.
 *
 * @example
 * // Vendor name in holding registers AND model id in an input register:
 * modbus: [
 *   {
 *     mode: EnergyAppPackageOptionsDeviceDetectionModbusModeEnum.RegistersAnd_MatchingValuesOr,
 *     unitIds: [1],
 *     registerAddress: 40001,
 *     registerSize: 2,
 *     type: 'string',
 *     matchingValues: ['SMA'],
 *   },
 *   {
 *     unitIds: [1],
 *     registerType: 'input',
 *     registerAddress: 30053,
 *     registerSize: 2,
 *     type: 'UInt32BE',
 *     matchingValues: ['9401', '9402'],
 *   },
 * ]
 */
export interface EnergyAppPackageOptionsDeviceDetectionModbus {
    /**
     * How all entries of the `modbus` list and their matching values combine.
     * Only read from the first entry of the list — set it there and leave it
     * out on the others. Defaults to
     * {@link EnergyAppPackageOptionsDeviceDetectionModbusModeEnum.RegistersOr_MatchingValuesOr}.
     */
    mode?: EnergyAppPackageOptionsDeviceDetectionModbusModeEnum;
    unitIds: number[];
    /**
     * Which register bank to read. Defaults to `'holding'` when omitted,
     * which is the behaviour of all existing rules.
     */
    registerType?: EnergyAppPackageOptionsDeviceDetectionModbusRegisterType;
    /** Register address, for example 30001 */
    registerAddress: number;
    /** Register size, for example 2 for 30001 - 30002 */
    registerSize: number;
    /** the data type of the register, numbers will be mapped to strings to compare with matching values */
    type: 'string' | 'UInt32BE' | 'UInt16BE' | 'UInt32LE' | 'UInt16LE';
    /** matching values, for example the vendor names or model names */
    matchingValues: string[];
}

export interface EnergyAppPackageOptionsDeviceDetectionHttp {
    /** port of http call */
    port: number;
    /** path of http call */
    path: string;
    /** the operation to do */
    operation: 'body_json_field_eq' | 'header_eq' | 'header_startsWith' | 'body_contains';
    /** for rest APIs with json response, define the field for example device.vendor*/
    field?: string;
    headerName?: string;
    /** matching values, for example the vendor names or model names */
    matchingValues: string[];
}

export interface EnergyAppPackageOptionsDeviceDetectionOcpp {
    /** field name in the boot notification */
    field: string;
    /** matching values, for example the vendor names or model names */
    matchingValues: string[];
}

export interface EnergyAppPackageOptionsDeviceDetectionEebus {
    /**
     * Field name to match against from the remote node's EEBUS Node
     * Identification (NID) data. `'deviceCode'` and `'manufacturerNodeIdentification'`
     * map to the corresponding fields on `EebusNodeIdentity` and allow
     * stable identification across firmware upgrades.
     */
    field: 'vendor' | 'brand' | 'model' | 'deviceCode' | 'manufacturerNodeIdentification';
    /** matching values, for example the vendor names or model names */
    matchingValues: string[];
}

/**
 * Optional device detection configuration for mDNS TXT record matching.
 * Matches against TXT record key-value pairs advertised by devices via mDNS.
 */
export interface EnergyAppPackageOptionsDeviceDetectionMdns {
    /** The TXT record key to match against */
    key: 'model' | 'brand' | 'uuid' | 'serial' | string;
    /** The matching operation to perform on the TXT record value */
    operation: 'eq' | 'startsWith';
    /** Values to match the TXT record value against */
    matchingValues: string[];
    /**
     * The DNS-SD service type the device advertises itself under, including the
     * `.local` suffix — e.g. `'_enphase-envoy._tcp.local'`.
     *
     * The host browses a small built-in set of common service types
     * (`_http._tcp`, `_https._tcp`, `_device-info._tcp`, `_modbus._tcp`). Devices
     * advertising a vendor-specific type are invisible to that set, so their TXT
     * records never reach detection. Declaring the type here adds it to the
     * host's browse set — no host firmware update needed.
     *
     * When set, this rule only matches TXT records advertised by a service of
     * this exact type. When omitted, the rule matches TXT records from any
     * browsed service on the device (previous behaviour, unchanged).
     *
     * Find a device's type with `avahi-browse -a -t` (Linux) or
     * `dns-sd -B _services._dns-sd._udp` (macOS).
     *
     * @example '_enphase-envoy._tcp.local'
     */
    serviceType?: string;
}

/**
 * Optional device detection configuration for MQTT-based detection.
 * Subscribes to a topic on the internal broker and matches messages against expected values.
 */
export interface EnergyAppPackageOptionsDeviceDetectionMqtt {
    /** MQTT topic to subscribe to for device detection */
    topic: string;
    /** JSON field path to match against (e.g. "device.vendor"). If omitted, the entire payload is matched */
    field?: string;
    /** Matching values to identify the device */
    matchingValues: string[];
}

/**
 * Optional device detection configuration for UDP broadcast probing.
 * The host broadcasts the probe message on the local network and matches a
 * JSON field in each response against the expected values to identify the
 * device.
 *
 * @example
 * // Detect Marstek Venus batteries answering on port 30000:
 * {
 *   port: 30000,
 *   message: { id: 0, method: 'Marstek.GetDevice', params: { ble_mac: '0' } },
 *   field: 'src',
 *   operation: 'startsWith',
 *   matchingValues: ['VenusC'],
 * }
 */
export interface EnergyAppPackageOptionsDeviceDetectionUdp {
    /**
     * Destination UDP port the device listens on. The probe is broadcast to
     * this port (e.g. 30000 for Marstek Venus); responses are read from the
     * datagrams the device sends back. Required — a UDP broadcast always needs
     * a destination port.
     */
    port: number;
    /**
     * The probe message to broadcast. Provide a JSON-serializable object
     * (sent as its JSON string) or a raw string payload.
     */
    message: Record<string, unknown> | string;
    /**
     * JSON field path in the response to match against. Supports dot notation
     * for nested keys (e.g. `'src'` or `'result.device'`). If omitted, the
     * entire response payload is matched.
     */
    field?: string;
    /** The matching operation to perform on the response field value */
    operation: 'eq' | 'startsWith';
    /** Values to match the response field value against */
    matchingValues: string[];
}

/**
 * Optional device detection configuration
 */
export interface EnergyAppPackageOptionsDeviceDetection {
    hostName?: EnergyAppPackageOptionsDeviceDetectionHostname[];
    modbus?: EnergyAppPackageOptionsDeviceDetectionModbus[];
    http?: EnergyAppPackageOptionsDeviceDetectionHttp[];
    ocpp?: EnergyAppPackageOptionsDeviceDetectionOcpp[];
    eebus?: EnergyAppPackageOptionsDeviceDetectionEebus[];
    mqtt?: EnergyAppPackageOptionsDeviceDetectionMqtt[];
    mdns?: EnergyAppPackageOptionsDeviceDetectionMdns[];
    udp?: EnergyAppPackageOptionsDeviceDetectionUdp[];
}

/**
 * Optional configuration settings for an Energy App package.
 */
export interface EnergyAppPackageOptions {
    /** Configuration for restricting internet access to specific domains */
    restrictedInternetAccess?: EnergyAppPackageRestrictedInternetAccessOption;
    /** device detection configuration to auto-suggest this energy app on onboarding */
    deviceDetection?: EnergyAppPackageOptionsDeviceDetection;
    /** If your Developer Org is allowed to auto install packages and the device is sold via your Distributor account, you can auto install packages*/
    autoInstall?: boolean;
}

/**
 * Localized store entry information for an Energy App package.
 * Contains all the display information shown to users in the package store.
 */
export interface EnergyAppPackageStoreEntry {
    /** Language code for this store entry */
    language: EnergyAppPackageLanguage;
    /** Display title of the package */
    title: string;
    /** Brief description shown in package listings */
    shortDescription: string;
    /** Detailed description of the package functionality */
    description: string;
}

/**
 * Localized store information for one subscription plan. Shown by enyo on the
 * offer and checkout screens and in the customer's subscription overview.
 */
export interface EnergyAppPackageSubscriptionPlanStoreEntry {
    /** Language code for this store entry */
    language: EnergyAppPackageLanguage;
    /** Display name of the plan, e.g. `'Premium'` */
    title: string;
    /** One sentence describing what the plan unlocks */
    shortDescription: string;
    /**
     * Optional list of benefits, shown as bullet points on the plan card.
     *
     * Prefer {@link EnergyAppPackageSubscriptionPlan.includedFeatures}: features
     * carry icons and descriptions and feed the comparison table. The host
     * shows `benefits` only for plans without `includedFeatures`.
     */
    benefits?: string[];
}

/**
 * A subscription plan an Energy App package sells, declared in
 * {@link EnergyAppPackageDefinition.subscriptionPlans}.
 *
 * A plan can unlock the whole app or only parts of it — the app decides that
 * in its own code by checking whether the plan is active (see
 * {@link EnergyAppSubscriptions}). enyo handles checkout, billing, renewal and
 * cancellation; the plan only describes what is sold and at which price.
 *
 * The enyo CLI reads the plans at release time. A price change therefore
 * requires a new release, and only applies to new purchases: running
 * subscriptions keep the price they were bought at.
 *
 * @example
 * ```typescript
 * defineSubscriptionPlan({
 *     planKey: 'premium',
 *     paymentInterval: EnyoSubscriptionPaymentIntervalEnum.Yearly,
 *     prices: [{amountWithoutTax: 41.18, currency: EnyoCurrencyEnum.EUR}],
 *     trialDays: 30,
 *     storeEntry: [
 *         {language: 'en', title: 'Premium', shortDescription: 'Optimises your heat pump with dynamic prices.'},
 *         {language: 'de', title: 'Premium', shortDescription: 'Optimiert deine Wärmepumpe mit dynamischen Preisen.'}
 *     ]
 * })
 * ```
 */
export interface EnergyAppPackageSubscriptionPlan {
    /**
     * Stable, app-chosen key for this plan: a kebab-case slug, unique within
     * the package. Subscriptions refer to the plan by this key, so treat it as
     * an API — renaming it disconnects every existing subscription from the
     * app's checks.
     */
    planKey: string;
    /** How often the plan is paid for: `one-time`, `monthly` or `yearly`. */
    paymentInterval: EnyoSubscriptionPaymentInterval;
    /**
     * Whether the price is charged once for the package on the device
     * (`per-package`, the default) or once per unit (`per-unit`). For
     * `per-unit` the units are the appliances and vehicles the app marks as
     * billed under this plan ({@link EnyoAppliance.billing},
     * {@link EnyoVehiclePairResult.billing}), plus the custom units it reports
     * with {@link EnergyAppSubscriptions.setUnits}.
     */
    pricingModel?: EnyoSubscriptionPricingModel;
    /**
     * Net price, one entry per currency. At least one entry is required. The
     * amount is always the total for one interval: per month for `monthly`,
     * per year for `yearly`, and the single amount for `one-time`. For a
     * `per-unit` plan it is the amount per unit.
     */
    prices: EnyoSubscriptionPrice[];
    /**
     * Optional length of a free trial in days. The customer is charged for the
     * first time when the trial ends, unless they cancelled before. Not
     * allowed for `one-time` plans.
     */
    trialDays?: number;
    /** Localized store information. Entries for `de` and `en` are required. */
    storeEntry: EnergyAppPackageSubscriptionPlanStoreEntry[];
    /**
     * The features this plan includes, as keys of
     * {@link EnergyAppPackageDefinition.subscriptionFeatures} — or with a
     * translated value such as "up to 5 vehicles" — in display order. Shown on
     * the plan card and in the comparison table.
     *
     * List every feature the customer gets with the plan, including those of
     * the free tier, so the comparison table reads correctly.
     */
    includedFeatures?: EnyoSubscriptionIncludedFeature[];
    /**
     * Optional badge that makes this plan stand out on the offer screen, e.g.
     * `recommended`. At most one plan of a package may be highlighted.
     */
    highlight?: EnyoSubscriptionPlanHighlight;
    /** Optional internal note explaining this plan; never shown to users. */
    internalComment?: string;
}

/**
 * Defines a permission entry for an Energy App package.
 * Contains the permission type and an internal comment explaining its usage.
 */
export interface EnergyAppPackagePermission {
    /** The permission type required by the package */
    permission: EnergyAppPermissionType;
    /** Internal documentation describing what this permission is used for */
    internalComment: string;
}

/**
 * Whether a declared compatibility entry means "this works" or "this is known
 * not to work".
 *
 * Used by {@link EnergyAppPackageCompatibilityVendor.status} and
 * {@link EnergyAppPackageCompatibilityModel.status} so a package can
 * list a vendor or model it has explicitly tested and found unsupported,
 * instead of silently leaving it out. The enyo Store and onboarding flows can
 * then tell the user "this device is not supported by this app" rather than
 * showing nothing at all.
 */
export enum EnergyAppPackageCompatibilityStatus {
    /** The package supports this vendor or model. */
    Compatible = 'compatible',
    /** The package has been verified **not** to work with this vendor or model. */
    NotCompatible = 'not-compatible',
}

/**
 * The model years a {@link EnergyAppPackageCompatibilityModel} entry covers,
 * both ends inclusive.
 *
 * Model names alone are ambiguous for products that are sold under one name
 * for many years: a 2020 "ID.3" and a 2024 "ID.3" can talk to completely
 * different vendor APIs, and the same holds for inverter generations. The range
 * lets the enyo Store, onboarding flows and the customer portal tell a user
 * whether *their* device is covered.
 *
 * Years are whole calendar years (model years for vehicles, years of
 * manufacture for other devices). Leave out {@link to} for a model that is
 * still being built; leave out {@link from} only when the start is genuinely
 * unknown. A product with several generations is declared as several model
 * entries, one range each.
 *
 * Validated by `validatePackageCompatibility()`.
 *
 * @example
 * ```typescript
 * models: [
 *     {modelName: 'ID.3', modelYears: {from: 2020, to: 2023}, features: [...]},
 *     {modelName: 'ID.3', modelYears: {from: 2024}, features: [...]},
 * ]
 * ```
 */
export interface EnergyAppPackageCompatibilityYearRange {
    /** First supported year, inclusive. Omit when the start is unknown. */
    from?: number;
    /** Last supported year, inclusive. Omit while the model is still built. */
    to?: number;
}

/**
 * A specific device model supported by an Energy App package.
 * the concrete models the package has been verified to work with.
 */
export interface EnergyAppPackageCompatibilityModel {
    /** Human-readable model name as marketed by the vendor (e.g. "SE10K-RW0TEBNN4") */
    modelName: string;
    /**
     * Optional range of model years this entry covers.
     *
     * Recommended for every model whose name is reused across generations —
     * always for vehicles, and for inverters, wallboxes or heat pumps where a
     * name spans hardware revisions. The same `modelName` may appear more than
     * once per vendor as long as the ranges do not overlap. Omit when the entry
     * applies to every year the model was built.
     */
    modelYears?: EnergyAppPackageCompatibilityYearRange;
    /**
     * Optional internal display name shown in the enyo Store / Admin UI when
     * different from the official `modelName` (e.g. a friendlier label).
     */
    displayName?: string;
    /**
     * Optional minimum firmware version the package supports for this model.
     *
     * A free-form, vendor-defined string used for display and internal
     * documentation only. It is **not** an ordering primitive: firmware versions
     * are opaque and are never parsed or compared by the SDK or the host. To
     * express which firmware can be updated to which, declare the explicit
     * upgrade graph in {@link EnergyAppPackageDefinition.firmware} instead.
     */
    minimumFirmwareVersion?: string;
    /**
     * Optional device category of this concrete model (e.g. `Inverter`,
     * `BatteryStorage`).
     *
     * Packages can support models of different kinds — a hybrid inverter plus a
     * matching battery, for example — while
     * {@link EnergyAppPackageDefinition.categories} only describes the package
     * as a whole. Declaring the category per model lets the enyo Store and
     * onboarding flows group and filter individual models correctly. Omit when
     * the package-level categories are precise enough.
     */
    category?: EnergyAppPackageCategory;
    /** Optional internal note explaining model-specific caveats or limitations */
    internalComment?: string;
    /**
     * Whether this model is supported or explicitly unsupported.
     *
     * Defaults to {@link EnergyAppPackageCompatibilityStatus.Compatible} when
     * omitted, so existing definitions keep their meaning. Set it to
     * {@link EnergyAppPackageCompatibilityStatus.NotCompatible} to document a
     * model you have tested and found not to work — use
     * {@link internalComment} to say why.
     */
    status?: EnergyAppPackageCompatibilityStatus;
    /**
     * Important capabilities this specific model supports (e.g. charging the
     * battery from grid, limiting the charge, or forcing a heat pump DHW boost).
     * Lets the enyo Store and onboarding flows surface accurate, model-level
     * feature information.
     */
    features: EnergyAppModelFeatureEnum[];
}

/**
 * A vendor and the list of its models supported by an Energy App package.
 * Used inside {@link EnergyAppPackageDefinition.compatibility} to declare
 * which manufacturers and product models the package targets.
 */
export interface EnergyAppPackageCompatibilityVendor {
    /** Human-readable vendor name (e.g. "SolarEdge", "Fronius") */
    vendorName: string;
    /**
     * Models from this vendor that the package supports.
     *
     * May be empty for a package whose support is brand-wide rather than
     * model-by-model — the usual case for a
     * {@link EnergyAppPackageCategory.Vehicle} integration, where the vendor's
     * cloud API serves every car in the account and the model lines change
     * yearly. An empty array together with `default: true` reads as "every
     * device of this brand"; listing models you have not actually tested is
     * worse than listing none.
     */
    models: EnergyAppPackageCompatibilityModel[];
    /**
     * Whether this vendor is supported or explicitly unsupported.
     *
     * Defaults to {@link EnergyAppPackageCompatibilityStatus.Compatible} when
     * omitted. Set it to
     * {@link EnergyAppPackageCompatibilityStatus.NotCompatible} to declare a
     * brand the package is known not to work with; individual models may still
     * override it with their own {@link EnergyAppPackageCompatibilityModel.status}.
     */
    status?: EnergyAppPackageCompatibilityStatus;
    /**
     * Marks this package as the default Energy App for the vendor when no
     * concrete model has been selected.
     *
     * During onboarding a user may only know the manufacturer of their device,
     * not its exact model. When several packages declare compatibility with the
     * same vendor, the one flagged with `default: true` is the app the enyo
     * Store and onboarding flows pick in that case. Set it on at most one
     * package per vendor; omit it (or set `false`) when the package should only
     * be offered for an explicitly selected model.
     */
    defaultEnergyApp?: boolean;
}

/**
 * A file published together with an Energy App package and served publicly
 * after upload.
 *
 * The file is declared here by its local {@link path}; the enyo CLI uploads it
 * during `enyo release` and the published definition carries the resulting
 * public URL, so the released package tarball never has to carry the bytes.
 * Other parts of the definition refer to the upload by its {@link name} rather
 * than by URL — an onboarding v2 image block
 * ({@link EnyoOnboardingV2ImageBlock.file}) is the first consumer — which keeps
 * the URL an implementation detail that enyo resolves at render time.
 *
 * **Everything declared here is public.** The upload is readable by anyone who
 * has (or guesses) its URL, with no authentication in front of it: it exists so
 * that an installer app can show an image before the energy app runs anywhere.
 * Declare only vendor material safe to publish — installation diagrams, wiring
 * photos, product shots. Never customer data, credentials or licensed content.
 *
 * Not to be confused with {@link EnergyAppFile}, the *runtime* API for offering
 * a user a file to save: those bytes are produced on demand by the running app,
 * are scoped to a device, and never become a URL.
 *
 * @example
 * ```typescript
 * files: [
 *     definePublicFile({
 *         name: 'dip-switches',
 *         path: './assets/onboarding/dip-switches.png',
 *         internalComment: 'Photo of the DIP block behind the front cover'
 *     })
 * ]
 * ```
 */
export interface EnergyAppPackagePublicFile {
    /**
     * Stable, app-chosen name for this file: a kebab-case slug, unique within
     * the package. This is the handle the rest of the definition refers to, so
     * treat it as an API — renaming it breaks every reference to the file.
     */
    name: string;
    /**
     * Path to the file relative to the package root, e.g.
     * `'./assets/onboarding/dip-switches.png'`. Must stay inside the package:
     * absolute paths, `../` segments and URLs are rejected. Resolved and
     * uploaded by the enyo CLI on release; the published definition carries a
     * public URL instead.
     */
    path: string;
    /**
     * Optional IANA MIME type served with the file, e.g. `image/png`. Inferred
     * from the extension when omitted; set it explicitly only when the
     * extension is missing or misleading.
     */
    mimeType?: string;
    /** Optional internal note explaining this file; never shown to users. */
    internalComment?: string;
}

/**
 * How the firmware registry decides which image a device should install next.
 *
 * - `'latest'` — every device is offered the **last declared** firmware entry
 *   that applies to its model, whatever version it currently runs. Since
 *   firmware versions are opaque strings and cannot be ordered, "latest" means
 *   last in the `firmware` array — declaration order *is* the order. Use this
 *   for devices that accept any image directly; `installForFirmwareVersion` is
 *   ignored.
 * - `'dependent'` — the update order is the explicit graph declared through
 *   {@link EnergyAppPackageFirmwareFile.installForFirmwareVersion}: each image
 *   names the versions it can be installed on top of, and the registry walks
 *   that graph one hop at a time. Use this for devices that must be stepped
 *   through intermediate versions.
 */
export type EnergyAppPackageFirmwareMode = 'latest' | 'dependent';

/**
 * Enum form of {@link EnergyAppPackageFirmwareMode} for use in package
 * definitions.
 */
export enum EnergyAppPackageFirmwareModeEnum {
    /** Always offer the last declared firmware entry for the device's model. */
    Latest = 'latest',
    /** Follow the explicit `installForFirmwareVersion` upgrade graph. */
    Dependent = 'dependent',
}

/**
 * A firmware image published together with an Energy App package.
 *
 * The file is declared here by its local `path`; the enyo CLI uploads it during
 * `enyo release`, replacing the path with a registry reference, so the released
 * package tarball never carries the bytes. At runtime the app reaches the
 * uploaded image through {@link EnergyAppFirmwareRegistry}.
 *
 * **Firmware versions are opaque strings.** `firmwareVersion` is whatever the
 * vendor calls it — `'2.4.1'`, `'2024-11-rc3'`, `'A7F2'` — and is never parsed,
 * ordered or compared beyond exact string equality. Nothing can therefore be
 * derived from the string itself, which is why the order comes from
 * {@link EnergyAppPackageDefinition.firmwareMode}: declaration order under
 * `'latest'`, or the explicit {@link installForFirmwareVersion} edges under
 * `'dependent'`.
 *
 * Under `'dependent'`, chains, branches and merges all fall out of that one
 * field: three entries each naming their predecessor form a chain; two entries
 * naming the same predecessor for different models form a branch; one entry
 * naming several predecessors collapses old versions into a single image.
 *
 * Validate the declaration with `validateFirmwareRegistry()` before releasing —
 * an ambiguous or cyclic graph has no correct resolution and is rejected rather
 * than silently resolved.
 *
 * @example
 * ```typescript
 * // firmwareMode: 'dependent' — stepped through intermediate versions
 * firmware: [
 *     defineFirmwareFile({
 *         fileId: 'ac22-baseline',
 *         path: './firmware/ac22-2024-11-rc3.bin',
 *         firmwareVersion: '2024-11-rc3',
 *         modelNames: ['AC-22-Pro'],
 *         fallbackForUnknownVersion: true
 *     }),
 *     defineFirmwareFile({
 *         fileId: 'ac22-hotfix-a',
 *         path: './firmware/ac22-hotfix-a.bin',
 *         firmwareVersion: 'hotfix-a',
 *         installForFirmwareVersion: ['2024-11-rc3'],
 *         modelNames: ['AC-22-Pro']
 *     })
 * ]
 * ```
 */
export interface EnergyAppPackageFirmwareFile {
    /**
     * Stable, app-chosen identifier for this firmware image. Used as the lookup
     * key at runtime and must be unique within the package.
     */
    fileId: string;
    /**
     * Path to the firmware file relative to the package root, e.g.
     * `'./firmware/wallbox-2.4.1.bin'`. Resolved and uploaded by the enyo CLI on
     * release; the published definition carries a registry reference instead.
     */
    path: string;
    /**
     * The firmware version this file installs. An opaque, vendor-defined string
     * that is only ever equality-matched — never parsed or ordered.
     */
    firmwareVersion: string;
    /**
     * The versions this image is installed for — the incoming edges of this node
     * in the upgrade graph. Each string is matched by exact equality against the
     * version a device reports as currently installed; when it matches, this
     * image is the device's next step.
     *
     * Only meaningful when {@link EnergyAppPackageDefinition.firmwareMode} is
     * `'dependent'`; ignored under `'latest'`.
     *
     * Omit (or leave empty) for a root entry: one that heads a chain and is
     * never offered as an update to a known version.
     */
    installForFirmwareVersion?: string[];
    /**
     * When true, this image is offered to devices whose reported version matches
     * no declared node — a recovery or baseline image. At most one entry per
     * model may set this.
     *
     * Only meaningful under `firmwareMode: 'dependent'`; ignored under
     * `'latest'`, where every unrecognised version already receives the last
     * declared image.
     */
    fallbackForUnknownVersion?: boolean;
    /**
     * Optional vendor this firmware belongs to. Should match a `vendorName` from
     * {@link EnergyAppPackageDefinition.compatibility}.
     */
    vendorName?: string;
    /**
     * Optional models this firmware applies to. Scopes graph resolution: an
     * update is only offered to a device whose model is listed here. Omit when
     * the image applies to every model the package supports.
     */
    modelNames?: string[];
    /** Optional translated release notes shown in the host UI. */
    releaseNotes?: EnyoFileTranslation[];
    /** Optional internal note explaining this image; never shown to users. */
    internalComment?: string;
}

/**
 * The values enyo can insert into an
 * {@link EnergyAppPackageInstallerMail installer mail}.
 *
 * Write a placeholder into the subject or body as `{{name}}` — for example
 * `{{customerName}}` — or build it with `installerMailPlaceholder()`. The list
 * is closed: the mail is sent by enyo while the app is not involved, so every
 * value has to come from enyo, and `validatePackageInstallerMail()` rejects
 * any name not listed here.
 *
 * Any value can be missing when the mail is sent (a customer without a phone
 * number, a serial number the customer skipped). enyo then inserts an empty
 * string, so write sentences that still read well without the value — put
 * placeholders in lists of details rather than in the middle of a sentence.
 */
export enum EnyoInstallerMailPlaceholder {
    /** Full name of the customer. */
    CustomerName = 'customerName',
    /** The customer's enyo customer number. */
    CustomerNumber = 'customerNumber',
    /** The customer's e-mail address — where the installer can reply. */
    CustomerEmail = 'customerEmail',
    /** The customer's phone number. */
    CustomerPhone = 'customerPhone',
    /** Street and house number of the installation site. */
    InstallationStreet = 'installationStreet',
    /** Postal code of the installation site. */
    InstallationZip = 'installationZip',
    /** City of the installation site. */
    InstallationCity = 'installationCity',
    /**
     * Serial number of the device to set up (e.g. the inverter), as the
     * customer entered it in the portal. enyo does not know it from anywhere
     * else, so it is the value most likely to be missing.
     */
    SerialNumber = 'serialNumber',
    /** Vendor the customer selected, one of the package's `compatibility` vendors. */
    VendorName = 'vendorName',
    /** Model the customer selected, one of that vendor's `compatibility` models. */
    ModelName = 'modelName',
    /** Display title of the Energy App from its store entry, in the mail's language. */
    EnergyAppName = 'energyAppName',
    /**
     * Public link to the PDF rendered from
     * {@link EnergyAppPackageDefinition.onboardingGuide}. Only allowed when the
     * package declares that guide.
     */
    OnboardingGuideUrl = 'onboardingGuideUrl',
}

/**
 * A mail the customer sends to their installer from the enyo customer portal,
 * declared in {@link EnergyAppPackageDefinition.onboardingFlowInstallerMail}.
 *
 * ## Format
 *
 * - {@link subject} is plain text on one line.
 * - {@link body} is Markdown (CommonMark: paragraphs, headings, emphasis,
 *   lists, links). enyo renders it into its HTML mail template, so do not add a
 *   greeting header, footer or styling of your own. Raw HTML is not rendered.
 * - Both may contain {@link EnyoInstallerMailPlaceholder placeholders} written
 *   as `{{name}}`. enyo inserts the values as text, escaped for Markdown, so a
 *   customer name cannot break the layout.
 * - Both need a `de` and an `en` entry; enyo picks the one matching the
 *   customer's language.
 *
 * @example
 * ```typescript
 * const p = installerMailPlaceholder;
 * const P = EnyoInstallerMailPlaceholder;
 *
 * onboardingFlowInstallerMail: defineInstallerMail({
 *     subject: [
 *         {language: 'de', value: `Einrichtung ${p(P.EnergyAppName)} für ${p(P.CustomerName)}`},
 *         {language: 'en', value: `${p(P.EnergyAppName)} setup for ${p(P.CustomerName)}`},
 *     ],
 *     body: [
 *         {language: 'de', value: [
 *             'Bitte aktiviere Modbus TCP am Wechselrichter, damit enyo ihn steuern kann.',
 *             '',
 *             `- Kunde: ${p(P.CustomerName)} (${p(P.CustomerNumber)})`,
 *             `- Seriennummer: ${p(P.SerialNumber)}`,
 *             '',
 *             `[Anleitung (PDF)](${p(P.OnboardingGuideUrl)})`,
 *         ].join('\n')},
 *         {language: 'en', value: '...'},
 *     ],
 * })
 * ```
 */
export interface EnergyAppPackageInstallerMail {
    /** Translated subject line: plain text, one line, may contain placeholders. */
    subject: EnyoOnboardingTranslatedContent[];
    /** Translated Markdown body, may contain placeholders. */
    body: EnyoOnboardingTranslatedContent[];
    /**
     * Whether enyo attaches the PDF rendered from
     * {@link EnergyAppPackageDefinition.onboardingGuide}. Defaults to `true`
     * when the package declares that guide. Setting it to `true` without a
     * guide is a validation error.
     */
    attachOnboardingGuide?: boolean;
    /**
     * Further attachments, by the `name` of a file declared in
     * {@link EnergyAppPackageDefinition.files} (a datasheet, a wiring diagram).
     * Those files are public anyway; attaching them only saves the installer
     * a download.
     */
    attachments?: string[];
    /** Optional internal note explaining this mail; never shown to anyone. */
    internalComment?: string;
}

/**
 * Complete definition for a enyo Energy App package.
 * This interface defines all the metadata, permissions, and configuration
 * required to register a package with the enyo Hub.
 */
export interface EnergyAppPackageDefinition {
    /** Schema version for the package definition format */
    version: '1';
    /** Unique identifier for the package */
    packageName: string;
    /** Internal documentation describing the concept and purpose of this energy app (optional) */
    internalDescription?: string;
    /** Optional path to the logo */
    logo?: string;
    /** Categories that this package belongs to */
    categories: EnergyAppPackageCategory[];
    /** Localized store information for different languages */
    storeEntry: EnergyAppPackageStoreEntry[];
    /** Required permissions for this package to function. Can be simple permission types or objects with internal comments */
    permissions: (EnergyAppPermissionType | EnergyAppPackagePermission)[];
    /** Optional configuration settings */
    options?: EnergyAppPackageOptions;
    /** The version of the enyo SDK used to build this package (automatically injected) */
    sdkVersion: string;
    /** If the energy app should be visible in the enyo store. Default is true*/
    showInStore?: boolean;
    /**
     * declaration of vendors and models this package is compatible with.
     * Each entry pairs a vendor with the concrete models the package supports,
     * allowing the enyo Store and onboarding flows to surface accurate
     * compatibility information to users. Omit when the package targets a
     * single vendor implicitly or has no fixed compatibility surface.
     */
    compatibility: EnergyAppPackageCompatibilityVendor[];
    /**
     * Files shipped with this package, declared as local paths, uploaded by the
     * enyo CLI on release and served publicly from then on.
     *
     * Each entry is referenced elsewhere in the package by its `name` — today
     * from an onboarding v2 image block
     * ({@link EnyoOnboardingV2ImageBlock.file}) — so a guide never has to
     * hard-code a URL. Validate the declarations with `validatePackageFiles()`
     * before publishing.
     *
     * Every entry is publicly readable by anyone with its URL; see
     * {@link EnergyAppPackagePublicFile} for what that rules out. Omit for
     * packages that ship no assets.
     */
    files?: EnergyAppPackagePublicFile[];
    /**
     * Firmware images shipped with this package, declared as local file paths
     * and uploaded by the enyo CLI on release.
     *
     * The app reaches them at runtime through
     * {@link EnergyAppFirmwareRegistry}; how the next image is chosen is set by
     * {@link firmwareMode}. Requires the `FirmwareRegistry` permission. Omit for
     * packages that do not distribute firmware.
     */
    firmware?: EnergyAppPackageFirmwareFile[];
    /**
     * How the registry picks the next image for a device. Defaults to
     * `'latest'`, which always offers the last declared entry for the device's
     * model. Set to `'dependent'` when devices must be stepped through
     * intermediate versions — the order is then taken from each entry's
     * `installForFirmwareVersion` edges.
     *
     * Only relevant when {@link firmware} is declared.
     */
    firmwareMode?: EnergyAppPackageFirmwareMode;
    /**
     * The package's static **manual setup** onboarding guide (v2). It is
     * optional and there is at most one. The enyo CLI reads it at release time
     * and ships it with the package version, where enyo renders it as a
     * printable PDF installation manual.
     *
     * ## What it is for
     *
     * The guides an app returns from
     * {@link EnergyAppOnboardingV2.registerOnboardingGuidesHandler} are
     * interactive and only exist on a device where the app is running. This
     * guide is the opposite: a fixed document that exists as soon as the
     * package is released. An installer can read it on paper before the
     * device is even powered. It is written with the same v2 guide model, so
     * an app that already has an interactive manual setup flow can usually
     * declare the same steps here.
     *
     * It does not take part in onboarding runs. It is never offered by the
     * host, never addressed by name and never compared against the guides from
     * the runtime handler, so there are no naming or precedence rules between
     * the two.
     *
     * ## What it may contain
     *
     * Paper cannot scan the network or ask the app anything, so the guide is
     * limited to a manual setup the installer can follow by reading. The
     * following rules are enforced by `validatePackageOnboardingGuide()`, and
     * the CLI refuses the release if any of them is broken:
     *
     * | Rule | Why |
     * |---|---|
     * | `startVariant` is {@link EnyoOnboardingV2StartVariant.ManualSetup} | The document describes a manual setup, nothing else. |
     * | `requiresNetworkScan: false` is set explicitly | The default is `true`, and a printed manual has no scan to rely on. |
     * | No `network-scan` or `device-test` action blocks | Both act on devices found by a scan. |
     * | No `device-select` or `eebus-device-select` blocks | Both pick from devices the host discovered. |
     * | No `dynamic` blocks | Their value is resolved by the app at runtime and does not exist when the PDF is rendered. |
     * | No `start-variant` targets | They lead into another, scan-based guide that is not part of the document. |
     * | No `applianceId`, `vendorId` or `modelIds` | A document is not bound to an appliance, and enyo derives vendor and models from the package. |
     * | Plain JSON only (no functions, `Date`s, `undefined` in arrays, class instances) | The CLI serializes the guide into the release. |
     * | Every image block `file` is declared in {@link files} | Otherwise the PDF has a hole where the image belongs. |
     *
     * Everything else is allowed. Content blocks (text, headline, bullets,
     * image, hint, link) render as they are. Interactive blocks (choice,
     * select, input, credentials, auth, additional-setup and the
     * `connection-check` / `ocpp-connect` actions) render as instructions,
     * and their outcomes and transitions become the branches of the document
     * ("if the device is not reachable, continue with …"). Give every
     * outcome a label that reads well on paper.
     *
     * `name` is optional and has no meaning here.
     *
     * ## How to write one
     *
     * 1. Put the guide in its own file (for example
     *    `src/onboarding/manual-setup.guide.ts`) and build it with
     *    `defineOnboardingGuideV2()`, the `onboardingV2Block.*` and
     *    `onboardingV2Target.*` factories, and the `onContinueV2()` /
     *    `onOutcomeV2()` transition helpers.
     * 2. Keep the file free of runtime dependencies. The CLI loads it while
     *    loading this definition, outside the app sandbox, so it must not
     *    touch the SDK instance, storage, the network or environment state.
     * 3. Import it here and assign it to `onboardingGuide`.
     * 4. Check it locally with `validatePackageOnboardingGuide(definition)`.
     * 5. Release. The CLI validates the guide again and aborts on errors.
     *
     * ```typescript
     * // src/onboarding/manual-setup.guide.ts
     * import {
     *     defineOnboardingGuideV2,
     *     EnyoDeviceTestOutcomeEnum,
     *     EnyoOnboardingV2InputValueType,
     *     EnyoOnboardingV2StartVariant,
     *     onboardingV2Block,
     *     onboardingV2Target,
     *     onContinueV2,
     *     onOutcomeV2,
     * } from '@enyo-energy/energy-app-sdk';
     *
     * const t = (de: string, en: string) => [
     *     {language: 'de' as const, value: de},
     *     {language: 'en' as const, value: en},
     * ];
     *
     * export const manualSetupGuide = defineOnboardingGuideV2({
     *     title: t('Wechselrichter manuell einrichten', 'Set up the inverter manually'),
     *     startVariant: EnyoOnboardingV2StartVariant.ManualSetup,
     *     requiresNetworkScan: false,
     *     startStepId: 'prepare',
     *     steps: [
     *         {
     *             id: 'prepare',
     *             name: 'modbus-aktivieren',
     *             title: t('Modbus TCP aktivieren', 'Enable Modbus TCP'),
     *             blocks: [
     *                 onboardingV2Block.text('intro', t(
     *                     'Aktiviere Modbus TCP im Webinterface des Wechselrichters.',
     *                     'Enable Modbus TCP in the inverter web interface.',
     *                 )),
     *                 onboardingV2Block.imageFile('menu', 'modbus-menu', t('Menü', 'Menu')),
     *             ],
     *             transitions: [onContinueV2(onboardingV2Target.step('ip'))],
     *         },
     *         {
     *             id: 'ip',
     *             name: 'ip-eingeben',
     *             title: t('IP-Adresse eingeben', 'Enter the IP address'),
     *             blocks: [
     *                 onboardingV2Block.input(
     *                     'device-ip',
     *                     EnyoOnboardingV2InputValueType.IpAddress,
     *                     t('IP-Adresse des Wechselrichters', 'Inverter IP address'),
     *                     t('Verbindung prüfen', 'Check connection'),
     *                     [
     *                         {id: 'ok', value: EnyoDeviceTestOutcomeEnum.AppliancesCreated, label: t('Verbunden', 'Connected')},
     *                         {id: 'unreachable', value: EnyoDeviceTestOutcomeEnum.Unreachable, label: t('Nicht erreichbar', 'Unreachable')},
     *                     ],
     *                     {placeholder: t('z. B. 192.168.1.42', 'e.g. 192.168.1.42')},
     *                 ),
     *             ],
     *             transitions: [
     *                 onOutcomeV2('device-ip', 'ok', onboardingV2Target.success()),
     *                 onOutcomeV2('device-ip', 'unreachable', onboardingV2Target.step('prepare')),
     *             ],
     *         },
     *     ],
     * });
     *
     * // energy-app.package.ts
     * import {defineEnergyAppPackage, definePublicFile} from '@enyo-energy/energy-app-sdk';
     * import {manualSetupGuide} from './src/onboarding/manual-setup.guide.js';
     *
     * export default defineEnergyAppPackage({
     *     // ...
     *     files: [definePublicFile({name: 'modbus-menu', path: './assets/modbus-menu.png'})],
     *     onboardingGuide: manualSetupGuide,
     * });
     * ```
     *
     * Omit the field for packages that have no manual setup to document.
     */
    onboardingGuide?: EnyoOnboardingV2Guide;
    /**
     * The mail a customer sends to their installer from the enyo customer
     * portal, telling the installer what to do to set the device up.
     *
     * The enyo CLI reads it at release time. In the portal the customer enters
     * the installer's address and the details only they know (such as the
     * device's serial number); enyo fills in the
     * {@link EnyoInstallerMailPlaceholder placeholders}, renders the Markdown
     * body as an HTML mail and sends it — attaching the PDF of
     * {@link onboardingGuide} unless told otherwise.
     *
     * Validate it with `validatePackageInstallerMail()` before publishing; the
     * CLI refuses the release on errors. See
     * {@link EnergyAppPackageInstallerMail} for the format.
     *
     * Omit for packages that need no installer.
     */
    onboardingFlowInstallerMail?: EnergyAppPackageInstallerMail;
    /**
     * Subscription plans this package sells, including their prices. The enyo
     * CLI reads them at release time; enyo offers them to the customer and
     * handles checkout, billing, renewal and cancellation.
     *
     * Subscriptions belong to the device the app runs on. The app reads them
     * at runtime through {@link EnergyAppSubscriptions}, which requires the
     * `Subscriptions` permission. Validate the declarations with
     * `validatePackageSubscriptionPlans()` before publishing.
     *
     * Omit for packages that are free.
     */
    subscriptionPlans?: EnergyAppPackageSubscriptionPlan[];
    /**
     * The package's feature catalog: every feature that the plans and the free
     * tier refer to, declared once with its icon and translations. enyo builds
     * the feature lists and the comparison table of the offer screen from it.
     *
     * Only used together with {@link subscriptionPlans}. Validate it with
     * `validatePackageSubscriptionPlans()`.
     */
    subscriptionFeatures?: EnyoSubscriptionFeature[];
    /**
     * What the app offers without a plan, shown as the free column of the
     * comparison table. Only allowed with `subscriptionMode: 'optional'`.
     */
    subscriptionFreeTier?: EnyoSubscriptionFreeTier;
    /**
     * The blocks of the screen on which enyo offers the plans — a headline,
     * feature lists, a comparison table, hints such as why the app costs
     * money, and the plan cards — in display order.
     *
     * Omit to show only the plan cards. Validate it with
     * `validatePackageSubscriptionPlans()`.
     */
    subscriptionOfferScreen?: EnyoSubscriptionOfferScreen;
    /**
     * Whether the app needs one of its plans to work at all.
     *
     * - `'required'`: without an active plan the app does nothing useful and
     *   reports {@link EnergyAppStateEnum.SubscriptionRequired}. enyo offers no
     *   free option, and cancelling warns that the app stops working.
     * - `'optional'`: the app has a free base; its plans add features. The app
     *   never reports `SubscriptionRequired`. enyo offers a free base option
     *   and lets the customer downgrade to it.
     *
     * Required as soon as {@link subscriptionPlans} is set; omit it for free
     * packages.
     */
    subscriptionMode?: EnyoSubscriptionMode;
}

/**
 * Defines an Energy App package with automatic SDK version injection.
 * This function automatically adds the current SDK version to the package definition
 * for debugging and compatibility tracking purposes.
 *
 * @param definition The Energy App package definition
 * @returns The enhanced package definition with SDK version included
 */
export function defineEnergyAppPackage(definition: Omit<EnergyAppPackageDefinition, 'sdkVersion'>): EnergyAppPackageDefinition {
    return {
        ...definition,
        sdkVersion: getSdkVersion()
    };
}