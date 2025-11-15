import {EnergyAppPackageLanguage} from "../energy-app-package-definition.js";

export enum HemsOneApplianceTypeEnum {
    Inverter = 'Inverter',
    Charger = 'Charger',
    Storage = 'Storage',
    Meter = 'Meter',
}

export interface HemsOneApplianceName {
    language: EnergyAppPackageLanguage;
    name: string;
}

export enum HemsOneApplianceStateEnum {
    Connected = 'connected',
    ConnectionPending = 'connection-pending',
    Offline = 'offline',
}

export interface HemsOneApplianceMetadata {
    modelName?: string;
    serialNumber?: string;
    firmwareVersion?: string;
    state?: HemsOneApplianceStateEnum;
}

/**
 * Represents an appliance managed by the HEMS one system.
 */
export interface HemsOneAppliance {
    /** Unique identifier for the appliance */
    id: string;
    /** Name of the appliance in different supported languages */
    name: HemsOneApplianceName[];
    /** Type/category of the appliance */
    type: HemsOneApplianceTypeEnum;
    /** network device IDs associated with the appliance */
    networkDeviceIds: string[];
    /** Optional Metadata of the Appliance */
    metadata?: HemsOneApplianceMetadata;
}