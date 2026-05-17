import {EnergyAppPermissionType} from "./energy-app-permission.type.js";
import {getSdkVersion} from "./version.js";

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
 * Used inside {@link EnergyAppPackageCompatibilityVendor.models} to enumerate
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
     * Free-form string compared lexicographically by hosts that need it.
     */
    minimumFirmwareVersion?: string;
    /** Optional internal note explaining model-specific caveats or limitations */
    internalComment?: string;
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
     * Optional vendor logo path, mirroring the package-level `logo` field.
     * Useful when the host wants to render a vendor list in the store.
     */
    logo?: string;
    /** Models from this vendor that the package supports */
    models: EnergyAppPackageCompatibilityModel[];
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
     * Optional declaration of vendors and models this package is compatible with.
     * Each entry pairs a vendor with the concrete models the package supports,
     * allowing the enyo Store and onboarding flows to surface accurate
     * compatibility information to users. Omit when the package targets a
     * single vendor implicitly or has no fixed compatibility surface.
     */
    compatibility?: EnergyAppPackageCompatibilityVendor[];
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