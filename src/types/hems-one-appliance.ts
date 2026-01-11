import {EnergyAppPackageLanguage} from "../energy-app-package-definition.js";
import {HemsOneChargerApplianceMetadata} from "./hems-one-charger-appliance.js";
import {HemsOneHeatpumpApplianceMetadata} from "./hems-one-heatpump-appliance.js";
import {HemsOneBatteryApplianceMetadata} from "./hems-one-battery-appliance.js";
import {HemsOneInverterApplianceMetadata} from "./hems-one-inverter-appliance.js";
import {HemsOneMeterAppliance} from "./hems-one-meter-appliance.js";

export enum HemsOneApplianceTypeEnum {
    Inverter = 'Inverter',
    Charger = 'Charger',
    Storage = 'Storage',
    Meter = 'Meter',
    Heatpump = 'Heatpump',
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

export interface HemsOneApplianceNetworkMetadata {
    /** If the appliance is connected via cellular network, you can put the imsi here*/
    imsi?: string;
}

export interface HemsOneApplianceMetadata {
    modelName?: string;
    vendorName?: string;
    serialNumber?: string;
    firmwareVersion?: string;
    state?: HemsOneApplianceStateEnum;
    network?: HemsOneApplianceNetworkMetadata;
}

export enum HemsOneApplianceTopologyFeatureEnum {
    /** If the meter is the real Primary Meter collecting feed in and consumption in Wh */
    PrimaryMeter = 'PrimaryMeter',
    /** If the meter is an Intermediate Meter (like the meter of an Inverter) directly behind the Primary Meter */
    IntermediateOfPrimaryMeter = 'IntermediateOfPrimaryMeter',
    /** If the meter is an Intermediate Meter for a single appliance */
    IntermediateMeter = 'PrimaryMeter',
    /** If the inverter does a direct grid feed in without self consumption */
    InverterFullGridFeedIn = 'InverterFullGridFeedIn',
}

export interface HemsOneApplianceTopology {
    features: HemsOneApplianceTopologyFeatureEnum[];
    /** Information, behind which meter this appliance is located, for example if the wallbox is behind the primary meter or a submeter. Put the appliance ID of the meter */
    behindMeterApplianceId?: string;
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
    /** Topology Information of the appliance */
    topology?: HemsOneApplianceTopology;
    /** Optional Metadata of the Appliance if of type Meter */
    meter?: HemsOneMeterAppliance;
    /** Optional Metadata of the Appliance if of type Inverter */
    inverter?: HemsOneInverterApplianceMetadata;
    /** Optional Metadata of the Appliance if of type Charger */
    charger?: HemsOneChargerApplianceMetadata;
    /** Optional Metadata of the Appliance if of type Heatpump */
    heatpump?: HemsOneHeatpumpApplianceMetadata;
    /** Optional Metadata of the Appliance if of type Battery */
    battery?: HemsOneBatteryApplianceMetadata;
}