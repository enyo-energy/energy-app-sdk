import {EnergyAppPermissionType} from "./energy-app-permission.type.js";
import {getSdkVersion} from "./version.js";
import {EnergyAppModelFeatureEnum} from "./energy-app-model-feature.enum.js";
import type {EnyoFileTranslation} from "./types/enyo-file.js";

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

export interface EnergyAppPackageOptionsDeviceDetectionModbus {
    unitIds: number[];
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
 * A specific device model supported by an Energy App package.
 * the concrete models the package has been verified to work with.
 */
export interface EnergyAppPackageCompatibilityModel {
    /** Human-readable model name as marketed by the vendor (e.g. "SE10K-RW0TEBNN4") */
    modelName: string;
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
    /** Optional internal note explaining model-specific caveats or limitations */
    internalComment?: string;
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
    /** Models from this vendor that the package supports */
    models: EnergyAppPackageCompatibilityModel[];
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