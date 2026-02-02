import {EnergyAppPackageLanguage} from "../energy-app-package-definition.js";
import {EnyoChargerApplianceMetadata} from "./enyo-charger-appliance.js";
import {EnyoHeatpumpApplianceMetadata} from "./enyo-heatpump-appliance.js";
import {EnyoBatteryApplianceMetadata} from "./enyo-battery-appliance.js";
import {EnyoInverterApplianceMetadata} from "./enyo-inverter-appliance.js";
import {EnyoMeterAppliance} from "./enyo-meter-appliance.js";

export enum EnyoApplianceTypeEnum {
    Inverter = 'Inverter',
    Charger = 'Charger',
    Storage = 'Storage',
    Meter = 'Meter',
    Heatpump = 'Heatpump',
}

export interface EnyoApplianceName {
    language: EnergyAppPackageLanguage;
    name: string;
}

export enum EnyoApplianceStateEnum {
    Connected = 'connected',
    ConnectionPending = 'connection-pending',
    Offline = 'offline',
    ConfigurationRequired = 'configuration-required',
}

export interface EnyoApplianceNetworkMetadata {
    /** If the appliance is connected via cellular network, you can put the imsi here*/
    imsi?: string;
}

export enum EnyoApplianceConnectionType {
    Connector = 'Connector',
    Cloud = 'Cloud'
}

export interface EnyoApplianceMetadata {
    modelName?: string;
    vendorName?: string;
    serialNumber?: string;
    firmwareVersion?: string;
    state?: EnyoApplianceStateEnum;
    network?: EnyoApplianceNetworkMetadata;
    connectionType: EnyoApplianceConnectionType;
}

export enum EnyoApplianceTopologyFeatureEnum {
    /** If the meter is the real Primary Meter collecting feed in and consumption in Wh */
    PrimaryMeter = 'PrimaryMeter',
    /** If the meter is an Intermediate Meter (like the meter of an Inverter) directly behind the Primary Meter */
    IntermediateOfPrimaryMeter = 'IntermediateOfPrimaryMeter',
    /** If the meter is an Intermediate Meter for a single appliance */
    IntermediateMeter = 'PrimaryMeter',
    /** If the inverter does a direct grid feed in without self consumption */
    InverterFullGridFeedIn = 'InverterFullGridFeedIn',
}

export interface EnyoApplianceTopology {
    features: EnyoApplianceTopologyFeatureEnum[];
    /** Information, behind which meter this appliance is located, for example if the wallbox is behind the primary meter or a submeter. Put the appliance ID of the meter */
    behindMeterApplianceId?: string;
}

/**
 * Represents an appliance managed by the enyo system.
 */
export interface EnyoAppliance {
    /** Unique identifier for the appliance */
    id: string;
    /** Name of the appliance in different supported languages */
    name: EnyoApplianceName[];
    /** Type/category of the appliance */
    type: EnyoApplianceTypeEnum;
    /** network device IDs associated with the appliance */
    networkDeviceIds: string[];
    /** Optional Metadata of the Appliance */
    metadata?: EnyoApplianceMetadata;
    /** Topology Information of the appliance */
    topology?: EnyoApplianceTopology;
    /** Optional Metadata of the Appliance if of type Meter */
    meter?: EnyoMeterAppliance;
    /** Optional Metadata of the Appliance if of type Inverter */
    inverter?: EnyoInverterApplianceMetadata;
    /** Optional Metadata of the Appliance if of type Charger */
    charger?: EnyoChargerApplianceMetadata;
    /** Optional Metadata of the Appliance if of type Heatpump */
    heatpump?: EnyoHeatpumpApplianceMetadata;
    /** Optional Metadata of the Appliance if of type Battery */
    battery?: EnyoBatteryApplianceMetadata;
}