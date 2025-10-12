import {ConnectEmsPermissionType} from "./connect-ems-permission.type.js";

export type ConnectPackageLanguage = 'de' | 'en';

export enum ConnectPackageCategory {
    Inverter = 'inverter',
    Wallbox = 'wallbox',
    Meter = 'meter',
    SmartControl = 'smart-control',
}

/**
 * Configuration options for restricting internet access in a Connect EMS package.
 * Defines which internet origins (domains) the EMS Integration is allowed to access.
 */
export interface ConnectPackageRestrictedInternetAccessOption {
    /** List of allowed internet origins (domains) that the EMS Integration can access. Only these origins will be accessible. This information is shown to the user */
    origins: string[];
}

/**
 * Optional configuration settings for a Connect EMS package.
 */
export interface ConnectPackageOptions {
    /** Configuration for restricting internet access to specific domains */
    restrictedInternetAccess?: ConnectPackageRestrictedInternetAccessOption;
}

/**
 * Localized store entry information for a Connect EMS package.
 * Contains all the display information shown to users in the package store.
 */
export interface ConnectPackageStoreEntry {
    /** Language code for this store entry */
    language: ConnectPackageLanguage;
    /** Display title of the package */
    title: string;
    /** Brief description shown in package listings */
    shortDescription: string;
    /** Detailed description of the package functionality */
    description: string;
    // FIXME: what else here?
    // TODO: IMAGES?
}

/**
 * Complete definition for a Connect EMS package.
 * This interface defines all the metadata, permissions, and configuration
 * required to register a package with the Connect EMS system.
 */
export interface ConnectPackageDefinition {
    /** Schema version for the package definition format */
    version: '1';
    /** Unique identifier for the package */
    packageName: string;
    /** Categories that this package belongs to */
    categories: ConnectPackageCategory[];
    /** Localized store information for different languages */
    storeEntry: ConnectPackageStoreEntry[];
    /** Required permissions for this package to function */
    permissions: ConnectEmsPermissionType[];
    /** Optional configuration settings */
    options?: ConnectPackageOptions;
}

export function defineConnectEmsPackage(definition: ConnectPackageDefinition) {
    return definition;
}