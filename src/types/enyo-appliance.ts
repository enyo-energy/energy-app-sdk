import {EnergyAppPackageLanguage} from "../energy-app-package-definition.js";
import type {EnyoAutomationActionTypeEnum} from "./enyo-automation.js";
import {EnyoChargerApplianceMetadata} from "./enyo-charger-appliance.js";
import {EnyoHeatpumpApplianceMetadata} from "./enyo-heatpump-appliance.js";
import {EnyoBatteryApplianceMetadata} from "./enyo-battery-appliance.js";
import {EnyoInverterApplianceMetadata} from "./enyo-inverter-appliance.js";
import {EnyoMeterAppliance} from "./enyo-meter-appliance.js";
import {EnyoTemperatureSensorApplianceMetadata} from "./enyo-temperature-sensor-appliance.js";
import {EnyoAirConditioningApplianceMetadata} from "./enyo-air-conditioning-appliance.js";
import {EnyoHeatingRodApplianceMetadata} from "./enyo-heating-rod-appliance.js";
import {EnyoSmartPlugApplianceMetadata} from "./enyo-smart-plug-appliance.js";

export enum EnyoApplianceTypeEnum {
    Inverter = 'Inverter',
    Charger = 'Charger',
    Storage = 'Storage',
    Meter = 'Meter',
    Heatpump = 'Heatpump',
    AirConditioning = 'AirConditioning',
    TemperatureSensor = 'TemperatureSensor',
    HeatingRod = 'HeatingRod',
    /** Switchable socket / relay channel powering an arbitrary load (e.g. a Shelly channel) */
    SmartPlug = 'SmartPlug',
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

/**
 * Health status of an appliance. Orthogonal to {@link EnyoApplianceStateEnum},
 * which describes connectivity. `Healthy` means the appliance is operating
 * normally; `Warning` means a non-blocking issue has been reported (the
 * appliance is still functional but should be inspected); `Faulted` means it
 * has reported an internal error and may need attention; `Deactivated` means
 * the appliance has been intentionally switched off from energy management and
 * is neither monitored nor controlled until it is reactivated. Vendor- or
 * protocol-specific details should be conveyed via accompanying error codes.
 */
export enum EnyoApplianceStatusEnum {
    /** Appliance is operating normally */
    Healthy = 'healthy',
    /** Appliance is operating but has reported a non-blocking issue that should be inspected */
    Warning = 'warning',
    /** Appliance has reported an internal fault */
    Faulted = 'faulted',
    /**
     * Appliance has been intentionally deactivated and is excluded from energy
     * management. It is not controlled and its health is not evaluated until it
     * is reactivated.
     */
    Deactivated = 'deactivated',
}

/**
 * Severity classification for an {@link EnyoApplianceErrorCode}.
 * Producers should mark non-blocking issues as `'warning'` and blocking
 * faults as `'error'`. When omitted on an error code, consumers should
 * treat it as `'error'` for backwards compatibility.
 */
export type EnyoApplianceErrorSeverity = 'error' | 'warning';

/**
 * Translated, human-readable message for an appliance error code.
 * Producers should emit at most one entry per supported language.
 */
export interface EnyoApplianceErrorMessage {
    /** Language code for this translation */
    language: EnergyAppPackageLanguage;
    /** Localized message describing the error to end users */
    message: string;
}

/**
 * Vendor- or protocol-specific error or warning reported by an appliance,
 * optionally accompanied by translated human-readable messages. The `code` is
 * the machine-readable identifier (stable, non-localized); `messages` is an
 * optional set of pre-translated descriptions intended for UI display.
 * Consumers should fall back to rendering `code` when no `messages` entry
 * matches their locale. Use `severity` to distinguish a blocking error from
 * a non-blocking warning; when omitted, consumers should treat the entry as
 * an error for backwards compatibility.
 */
export interface EnyoApplianceErrorCode {
    /** Machine-readable, vendor- or protocol-specific error code */
    code: string;
    /** Optional translated messages explaining the error */
    messages?: EnyoApplianceErrorMessage[];
    /**
     * Optional severity of this entry. Defaults to `'error'` semantics when
     * omitted. Use `'warning'` to indicate a non-blocking issue that should
     * be surfaced but does not put the appliance into a faulted state.
     */
    severity?: EnyoApplianceErrorSeverity;
}

export interface EnyoApplianceNetworkMetadata {
    /** If the appliance is connected via cellular network, you can put the imsi here*/
    imsi?: string;
}

/** Optional MQTT configuration for the appliance */
export interface EnyoApplianceMqttConfig {
    /** Optional MQTT client identifier for the appliance */
    clientId?: string;
}

/** Modbus connection metadata for the appliance */
export interface EnyoApplianceModbusMetadata {
    /** The Modbus unit identifier for addressing the appliance */
    unitId: number;
    /** Optional register offset for the appliance */
    offset?: number;
    /** Optional base address for the appliance's Modbus registers */
    baseAddress?: number;
}

/**
 * EEBUS connection metadata for the appliance.
 *
 * Holds EEBUS-/SPINE-specific identifiers that identify the underlying
 * remote node and entity. Vendor-neutral fields such as `vendorName`,
 * `serialNumber`, `firmwareVersion` and `modelName` are already exposed on
 * the top-level {@link EnyoApplianceMetadata} and should not be duplicated
 * here — this interface only carries identifiers that have no meaningful
 * equivalent outside of EEBUS.
 */
export interface EnyoApplianceEebusMetadata {
    /**
     * Subject Key Identifier — the unique cryptographic identifier of the
     * remote EEBUS node this appliance is bound to. Stable across firmware
     * upgrades and the primary key for EEBUS pairing/trust.
     */
    ski: string;
    /**
     * SPINE entity type of the appliance within the remote node (e.g.
     * `'EVSE'`, `'EV'`, `'HeatPumpAppliance'`). Comes from
     * `NodeManagement.DetailedDiscoveryData` and identifies which sub-entity
     * of the node represents this appliance when a node exposes multiple.
     */
    deviceType?: string;
    /**
     * SPINE entity address of the appliance within the remote node — a
     * sequence of integers identifying the entity. Useful when the node
     * exposes multiple entities of the same {@link deviceType}.
     */
    entityAddress?: number[];
    /**
     * Vendor company code as reported via SPINE
     * `DeviceClassification.ManufacturerData.VendorCode`. EEBUS-specific
     * counterpart to the human-readable `vendorName` on the parent
     * metadata.
     */
    vendorCode?: string;
    /**
     * Brand name under which the device is sold, as reported via SPINE
     * `DeviceClassification.ManufacturerData.BrandName`.
     */
    brandName?: string;
    /**
     * Manufacturer-assigned device code (model identifier) as reported via
     * SPINE `DeviceClassification.ManufacturerData.DeviceCode`.
     */
    deviceCode?: string;
    /**
     * Manufacturer-assigned node identifier — the literal
     * `ManufacturerNodeIdentification` field from SPINE
     * `DeviceClassificationManufacturerDataType`. Often used by vendors as
     * a stable identifier across firmware upgrades.
     */
    manufacturerNodeIdentification?: string;
    /**
     * User-assigned node identifier — the literal `UserNodeIdentification`
     * field from SPINE `DeviceClassificationUserDataType`. May be changed
     * by the end user via the device's UI at any time.
     */
    userNodeIdentification?: string;
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
    hostname?: string;
    ipAddress?: string;
    /** Connection state */
    state?: EnyoApplianceStateEnum;
    /** Health status of the appliance (e.g. healthy, faulted or deactivated) */
    status?: EnyoApplianceStatusEnum;
    network?: EnyoApplianceNetworkMetadata;
    modbus?: EnyoApplianceModbusMetadata;
    /** Optional EEBUS connection metadata (SKI, SPINE entity type, vendor code, …) */
    eebus?: EnyoApplianceEebusMetadata;
    /** Optional MQTT configuration */
    mqtt?: EnyoApplianceMqttConfig;
    connectionType: EnyoApplianceConnectionType;
}

/**
 * General-purpose capability flags that apply to any {@link EnyoAppliance}
 * regardless of its {@link EnyoApplianceTypeEnum}. Appliance-type-specific
 * capabilities (e.g. charger or heatpump features) are expressed via the
 * dedicated `availableFeatures` enums on the respective metadata interfaces.
 */
export enum EnyoApplianceAvailableFeaturesEnum {
    /** If the appliance can limit its power consumption (active power drawn from the grid/site) */
    LimitPowerConsumption = 'LimitPowerConsumption',
    /** If the appliance can limit its power production (active power fed into the grid/site) */
    LimitPowerProduction = 'LimitPowerProduction',
    /**
     * If the appliance runs on its own battery rather than mains power — a
     * wireless room sensor, a battery-backed gateway, a radio button — and
     * therefore reports {@link EnyoAppliance.batteryState}.
     *
     * Worth declaring rather than inferring from a reading having arrived: a
     * consumer needs to know it should watch for a flat battery before the
     * first reading, and a device whose battery reporting is intermittent
     * would otherwise appear and disappear from a maintenance list.
     *
     * Nothing to do with a home storage battery — that is an appliance of type
     * {@link EnyoApplianceTypeEnum.Storage}, whose runtime values are
     * {@link EnyoBatteryState}.
     */
    BatteryPowered = 'BatteryPowered',
}

/**
 * The state of an appliance's **own** power source, for appliances that run on
 * a battery rather than mains power.
 *
 * Not to be confused with {@link EnyoBatteryState}, which is the runtime state
 * of a *home storage* battery — an appliance in its own right, measured in kWh
 * and priced. This type is about keeping a sensor alive: a wireless room sensor
 * that goes quiet because its cell died looks exactly like one that went
 * offline, and only this tells the two apart before someone goes looking.
 *
 * Reported by appliances declaring
 * {@link EnyoApplianceAvailableFeaturesEnum.BatteryPowered}.
 */
export interface EnyoApplianceBatteryState {
    /**
     * Remaining charge in percent (0-100), when the device reports a level.
     *
     * Many battery devices report only a coarse level or nothing at all — a
     * cell's voltage barely moves until it is nearly flat. Omit it rather than
     * deriving a percentage from voltage, and use {@link low} to say what
     * actually matters.
     */
    levelPercent?: number;
    /**
     * Whether the device considers its battery low and in need of replacement.
     *
     * The load-bearing field: it is what a maintenance view lists and what a
     * notification fires on. Set it from whatever the device reports — a
     * dedicated low-battery flag, a voltage threshold, a level below the
     * vendor's cut-off — rather than leaving a consumer to pick a threshold
     * against {@link levelPercent} it cannot calibrate.
     */
    low?: boolean;
    /** Battery voltage in Volts, when the device reports it. */
    voltageV?: number;
    /**
     * Whether the battery is currently being charged, for devices that are
     * rechargeable or run on mains with battery backup.
     *
     * Omitted means not known, which is not the same as `false` — most
     * primary-cell devices simply cannot say.
     */
    charging?: boolean;
    /**
     * Whether the battery can be replaced or recharged by the user. `false`
     * marks a sealed device that must be swapped out entirely, which changes
     * what a low-battery warning should tell the user to do.
     */
    replaceable?: boolean;
    /**
     * When the reading was taken, ISO 8601.
     *
     * Battery devices report rarely — hourly, daily, or only when something
     * changes — so a level without an age says nothing about whether the
     * device is still alive. Always set it.
     */
    measuredAtIso?: string;
}

export enum EnyoApplianceTopologyFeatureEnum {
    /** If the meter is the real Primary Meter collecting feed in and consumption in Wh */
    PrimaryMeter = 'PrimaryMeter',
    /** If the meter is an Intermediate Meter (like the meter of an Inverter) directly behind the Primary Meter */
    IntermediateOfPrimaryMeter = 'IntermediateOfPrimaryMeter',
    /** If the meter is an Intermediate Meter for a single appliance */
    IntermediateMeter = 'IntermediateMeter',
    /** If the inverter does a direct grid feed in without self consumption */
    InverterFullGridFeedIn = 'InverterFullGridFeedIn',
}

export interface EnyoApplianceTopology {
    features: EnyoApplianceTopologyFeatureEnum[];
    /** Information, behind which meter this appliance is located, for example if the wallbox is behind the primary meter or a submeter. Put the appliance ID of the meter */
    behindMeterApplianceId?: string;
    /** Information, in front of which appliance this appliance is located (i.e. upstream on the electrical path). Put the appliance ID of the downstream appliance. */
    inFrontOfApplianceId?: string;
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
    /**
     * General-purpose capabilities supported by the appliance, independent of
     * its {@link EnyoApplianceTypeEnum}. Appliance-type-specific capabilities
     * are exposed via the `availableFeatures` field on the type-specific
     * metadata (e.g. `charger.availableFeatures`).
     */
    availableFeatures?: EnyoApplianceAvailableFeaturesEnum[];
    /**
     * State of the appliance's own battery, for appliances that run on one —
     * see {@link EnyoApplianceAvailableFeaturesEnum.BatteryPowered}.
     *
     * Absent on mains-powered appliances, and on battery-powered ones that
     * have not reported yet. This is the appliance's power source, not a home
     * storage battery's contents; for those see {@link EnyoBatteryState}.
     */
    batteryState?: EnyoApplianceBatteryState;
    /**
     * Automation action types this appliance can be the target of. Set by the
     * owning app when it {@link save}s the appliance — e.g. a Shelly SmartPlug
     * channel supporting on/off switching lists
     * {@link EnyoAutomationActionTypeEnum.SmartPlugSwitch}. The automation UI
     * offers only appliances whose list includes the action type the user
     * selected.
     */
    supportedAutomationActions?: EnyoAutomationActionTypeEnum[];
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
    /** Optional Metadata of the Appliance if of type TemperatureSensor */
    temperatureSensor?: EnyoTemperatureSensorApplianceMetadata;
    /** Optional Metadata of the Appliance if of type AirConditioning */
    airConditioning?: EnyoAirConditioningApplianceMetadata;
    /** Optional Metadata of the Appliance if of type HeatingRod */
    heatingRod?: EnyoHeatingRodApplianceMetadata;
    /** Optional Metadata of the Appliance if of type SmartPlug */
    smartPlug?: EnyoSmartPlugApplianceMetadata;
    /** Optional custom name for the appliance, defined by the user */
    customName?: string;
    /**
     * Optional list of vendor- or integration-specific compatibility modes that
     * are active for this appliance. Each entry is a free-form, non-localized
     * identifier describing a behavioural deviation the appliance requires
     * (e.g. a firmware quirk workaround or a legacy protocol dialect).
     * Consumers that do not know a given mode should ignore it.
     */
    compatibilityModes?: string[];
    /**
     * Optional identifier of the cloud-deployed energy app package that manages
     * this appliance. Set when the appliance is provisioned and operated by a
     * cloud package (e.g. {@link EnyoApplianceConnectionType.Cloud}), so that
     * downstream consumers can correlate the appliance with its owning package.
     */
    cloudPackageId?: string;
}