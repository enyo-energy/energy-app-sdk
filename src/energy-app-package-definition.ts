import {EnergyAppPermissionType} from "./energy-app-permission.type.js";

export type EnergyAppPackageLanguage = 'de' | 'en';

export enum EnergyAppPackageCategory {
    Inverter = 'inverter',
    Wallbox = 'wallbox',
    Meter = 'meter',
    EnergyManagement = 'energy-management',
    HeatPump = 'heat-pump',
    BatteryStorage = 'battery-storage',
    ClimateControl = 'climate-control',
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
 * Optional device detection configuration
 */
export interface EnergyAppPackageOptionsDeviceDetection {
    modbus?: {
        /** Register address, for example 30001 */
        registerAddress: number;
        /** Register size, for example 2 for 30001 - 30002 */
        registerSize: number;
        /** the data type of the register, numbers will be mapped to strings to compare with matching values */
        type: 'string' | 'UInt32BE' | 'UInt16BE' | 'UInt32LE' | 'UInt16LE';
        /** matching values, for example the vendor names or model names */
        matchingValues: string[];
    }[];
    http?: {
        /** port of http call */
        port: number;
        /** path of http call */
        path: string;
        /** for rest APIs with json response, define the field for example device.vendor*/
        field: string;
        /** matching values, for example the vendor names or model names */
        matchingValues: string[];
    }[];
    ocpp?: {
        /** ocpp message name, for example BootNotification */
        message: string;
        /** field name in the boot notification */
        field: string;
        /** matching values, for example the vendor names or model names */
        matchingValues: string[];
    }[];
}

/**
 * Optional configuration settings for an Energy App package.
 */
export interface EnergyAppPackageOptions {
    /** Configuration for restricting internet access to specific domains */
    restrictedInternetAccess?: EnergyAppPackageRestrictedInternetAccessOption;
    /** device detection configuration to auto-suggest this energy app on onboarding */
    deviceDetection?: EnergyAppPackageOptionsDeviceDetection;
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
 * Complete definition for a HEMS one Energy App package.
 * This interface defines all the metadata, permissions, and configuration
 * required to register a package with the HEMS one Hub.
 */
export interface EnergyAppPackageDefinition {
    /** Schema version for the package definition format */
    version: '1';
    /** Unique identifier for the package */
    packageName: string;
    /** Categories that this package belongs to */
    categories: EnergyAppPackageCategory[];
    /** Localized store information for different languages */
    storeEntry: EnergyAppPackageStoreEntry[];
    /** Required permissions for this package to function */
    permissions: EnergyAppPermissionType[];
    /** Optional configuration settings */
    options?: EnergyAppPackageOptions;
}

export function defineEnergyAppPackage(definition: EnergyAppPackageDefinition) {
    return definition;
}