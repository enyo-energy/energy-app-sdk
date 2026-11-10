/**
 * Zigbee device types shared by {@link EnergyAppZigbee}
 * (`../packages/energy-app-zigbee.ts`), the Zigbee onboarding block
 * (`./enyo-onboarding-v2-zigbee-pairing.ts`) and the appliance metadata
 * ({@link EnyoApplianceZigbeeMetadata}).
 *
 * The host owns the Zigbee coordinator (the radio) and the network it forms.
 * An app never talks to the coordinator directly: it opens the network for new
 * devices, is told when one has joined, and manages the devices it owns.
 *
 * Pure type declarations (no runtime logic).
 */

/**
 * How far the host has got with interviewing a joined device — reading its
 * node descriptor, endpoints and clusters.
 *
 * A device is only handed to an app (by
 * {@link EnergyAppZigbee.listenForDeviceJoined} or an onboarding pairing block)
 * once its interview has finished, successfully or not, because what an app
 * builds from a device depends on the endpoints and clusters the interview
 * reveals.
 */
export enum EnyoZigbeeInterviewStateEnum {
    /** The interview is still running; endpoints and clusters may be incomplete. */
    Pending = 'pending',
    /** The interview finished; endpoints and clusters are known. */
    Completed = 'completed',
    /**
     * The interview did not finish — the device fell asleep or went out of
     * range while being read. The device is on the network but its endpoints
     * may be missing; re-pairing it usually helps.
     */
    Failed = 'failed',
}

/** Where a Zigbee device takes its power from, as reported by its node descriptor. */
export enum EnyoZigbeePowerSourceEnum {
    /** Mains powered; usually routes traffic for other devices. */
    Mains = 'mains',
    /** Battery powered; usually a sleepy end device that is only reachable when it wakes up. */
    Battery = 'battery',
    /** The device did not report its power source. */
    Unknown = 'unknown',
}

/** The role a device plays in the Zigbee mesh. */
export enum EnyoZigbeeDeviceRoleEnum {
    /** Forwards traffic for other devices (typically mains-powered plugs and relays). */
    Router = 'router',
    /** Leaf device that does not forward traffic (typically battery-powered sensors). */
    EndDevice = 'end-device',
}

/**
 * One application endpoint of a Zigbee device, as discovered during the
 * interview. A device can expose several — a double smart plug, for instance,
 * has one endpoint per socket.
 */
export interface EnyoZigbeeEndpoint {
    /** Endpoint number (1–240). */
    id: number;
    /** Application profile id (e.g. `0x0104` for Zigbee Home Automation). */
    profileId?: number;
    /** Profile-specific device id (e.g. `0x0051` for a smart plug). */
    deviceId?: number;
    /** Ids of the server clusters this endpoint implements (e.g. `0x0006` On/Off, `0x0B04` Electrical Measurement). */
    inputClusters: number[];
    /** Ids of the client clusters this endpoint implements. */
    outputClusters: number[];
}

/**
 * How good the radio link of a Zigbee device is, judged by the host from the
 * received signal strength of its last frame.
 */
export enum EnyoZigbeeSignalQualityEnum {
    /** -60 dBm or stronger. */
    Excellent = 'excellent',
    /** -60 to -75 dBm. */
    Good = 'good',
    /** -75 to -85 dBm: works, but a frame gets lost now and then. */
    Fair = 'fair',
    /** Weaker than -85 dBm: expect lost reports; move the device closer to the enyo Box or add a router. */
    Poor = 'poor',
}

/**
 * A device joined to the host's Zigbee network.
 *
 * A snapshot, not a live handle: read it again with
 * {@link EnergyAppZigbee.getDevice} for current values such as
 * {@link lastSeenIso}, {@link linkQuality}, {@link rssi} and
 * {@link signalQuality}.
 */
export interface EnyoZigbeeDevice {
    /**
     * IEEE (EUI-64) address as a lowercase hex string with `0x` prefix, e.g.
     * `0x00124b0012345678`.
     *
     * The device's stable identity and the key every method of
     * {@link EnergyAppZigbee} takes. Unlike {@link networkAddress}, it never
     * changes for the life of the device.
     */
    ieeeAddress: string;
    /**
     * 16-bit network (short) address assigned by the coordinator. Changes when
     * the device rejoins, so never key anything on it.
     */
    networkAddress?: number;
    /** User-facing name; set through {@link EnergyAppZigbee.updateDevice}. */
    name?: string;
    /** Manufacturer name from the Basic cluster (`0x0000`), verbatim. */
    manufacturerName?: string;
    /** Model identifier from the Basic cluster (`0x0000`), verbatim. */
    modelId?: string;
    /** Firmware/software build id from the Basic cluster, if reported. */
    softwareBuildId?: string;
    /** Where the device takes its power from. */
    powerSource?: EnyoZigbeePowerSourceEnum;
    /** The role the device plays in the mesh. */
    role?: EnyoZigbeeDeviceRoleEnum;
    /** How far the host has got with interviewing the device. */
    interviewState: EnyoZigbeeInterviewStateEnum;
    /** Application endpoints discovered during the interview. */
    endpoints: EnyoZigbeeEndpoint[];
    /** ISO 8601 timestamp the coordinator last heard from the device. */
    lastSeenIso?: string;
    /** Link quality indicator of the last received frame (0–255). */
    linkQuality?: number;
    /** Received signal strength of the last received frame in dBm (last hop). */
    rssi?: number;
    /** The host's verdict on the link, from {@link rssi}. */
    signalQuality?: EnyoZigbeeSignalQualityEnum;
    /**
     * The appliance this device is linked to, if any.
     *
     * A convenience the host keeps in sync with
     * {@link EnergyAppZigbee.updateDevice}. The authoritative link is the
     * appliance's own {@link EnyoApplianceZigbeeMetadata.ieeeAddress}; set both
     * when linking, since one physical device may back several appliances (one
     * per endpoint) and only the first is recorded here.
     */
    applianceId?: string;
}

/**
 * Fields of an {@link EnyoZigbeeDevice} an app may change with
 * {@link EnergyAppZigbee.updateDevice}.
 *
 * An omitted field is left unchanged; `null` clears it.
 */
export interface EnyoZigbeeDeviceUpdate {
    /** New user-facing name, or `null` to clear it. */
    name?: string | null;
    /** Appliance to link the device to, or `null` to unlink it. */
    applianceId?: string | null;
}

/** Options for {@link EnergyAppZigbee.startPairing}. */
export interface EnyoZigbeeStartPairingOptions {
    /**
     * How long the network stays open for new devices, in seconds. Defaults to
     * 180; the host caps it at 254, the maximum the Zigbee permit-join
     * mechanism allows.
     */
    durationSeconds?: number;
}

/** Whether the host's Zigbee network is currently open for new devices. */
export interface EnyoZigbeePairingStatus {
    /** `true` while new devices may join. */
    active: boolean;
    /** ISO 8601 timestamp at which pairing closes on its own; set while {@link active}. */
    endsAtIso?: string;
}

/** Options for {@link EnergyAppZigbee.removeDevice}. */
export interface EnyoZigbeeRemoveDeviceOptions {
    /**
     * Delete the device from the coordinator even when it does not acknowledge
     * the leave request — a sensor with a dead battery, or a device that was
     * already factory-reset. Defaults to `false`, in which case an
     * unacknowledged leave rejects and the device is kept.
     */
    force?: boolean;
}

// ---------------------------------------------------------------------------
// Data access: attributes, commands, reports
// ---------------------------------------------------------------------------

/**
 * Well-known ZCL cluster ids, as a convenience for the clusters energy apps
 * most often translate to data bus values. Every method also accepts any other
 * cluster id as a plain number, including manufacturer-specific ones
 * (`0xFC00`–`0xFFFF`).
 */
export enum EnyoZigbeeClusterIdEnum {
    /** Basic — manufacturer name, model id, software build. */
    Basic = 0x0000,
    /** Power Configuration — battery voltage and remaining percentage. */
    PowerConfiguration = 0x0001,
    /** On/Off — switch a relay or smart plug. */
    OnOff = 0x0006,
    /** Level Control — dimming / set points expressed as a level. */
    LevelControl = 0x0008,
    /** Thermostat — local temperature, heating/cooling set points, system mode. */
    Thermostat = 0x0201,
    /** Temperature Measurement — measured value in 0.01 °C. */
    TemperatureMeasurement = 0x0402,
    /** Relative Humidity Measurement — measured value in 0.01 %. */
    RelativeHumidityMeasurement = 0x0405,
    /** Occupancy Sensing. */
    OccupancySensing = 0x0406,
    /** IAS Zone — contact, motion, water-leak and similar alarm sensors. */
    IasZone = 0x0500,
    /** Metering — cumulative energy (summation delivered/received) and instantaneous demand. */
    Metering = 0x0702,
    /** Electrical Measurement — per-phase voltage, current and active power. */
    ElectricalMeasurement = 0x0B04,
}

/**
 * Common ZCL attribute data type ids, needed when writing an attribute or
 * configuring a report so the device can decode the value. Any other ZCL type
 * id may be passed as a plain number.
 */
export enum EnyoZigbeeDataTypeEnum {
    Boolean = 0x10,
    Bitmap8 = 0x18,
    Bitmap16 = 0x19,
    Uint8 = 0x20,
    Uint16 = 0x21,
    Uint24 = 0x22,
    Uint32 = 0x23,
    Uint48 = 0x25,
    Uint64 = 0x27,
    Int8 = 0x28,
    Int16 = 0x29,
    Int24 = 0x2a,
    Int32 = 0x2b,
    Int48 = 0x2d,
    Int64 = 0x2f,
    Enum8 = 0x30,
    Enum16 = 0x31,
    Float32 = 0x39,
    OctetString = 0x41,
    CharString = 0x42,
}

/**
 * A decoded ZCL attribute value.
 *
 * Integers up to 48 bits, enums, bitmaps and floats are `number`; 64-bit
 * integers are a decimal `string` so no precision is lost; booleans are
 * `boolean`; character strings are `string`; octet strings and any type the
 * host does not decode are the raw `Uint8Array`. `null` means the device
 * reported the type's "invalid / not available" value.
 */
export type EnyoZigbeeAttributeValue = number | string | boolean | Uint8Array | null;

/**
 * Addresses one cluster on one endpoint of a device — the common part of every
 * data-access request.
 */
export interface EnyoZigbeeClusterAddress {
    /** Endpoint number the cluster lives on, from {@link EnyoZigbeeDevice.endpoints}. */
    endpoint: number;
    /** Cluster id; see {@link EnyoZigbeeClusterIdEnum} for the common ones. */
    cluster: number;
    /**
     * Manufacturer code for manufacturer-specific attributes or commands.
     * Omit for standard ZCL.
     */
    manufacturerCode?: number;
    /**
     * How long to wait for the device to answer, in milliseconds. Defaults to
     * the host's own timeout. Battery-powered end devices only answer when they
     * wake up, so a read against one may need a much longer budget — or should
     * rely on reports ({@link EnergyAppZigbee.configureReporting}) instead.
     */
    timeoutMs?: number;
}

/** One attribute as returned by a read, or as carried in a report. */
export interface EnyoZigbeeAttributeRecord {
    /** Attribute id within its cluster. */
    attributeId: number;
    /** ZCL data type id of {@link value}, when the device reported one. */
    dataType?: number;
    /** The decoded value; absent when {@link status} is not success. */
    value?: EnyoZigbeeAttributeValue;
    /**
     * ZCL status code for this attribute. `0` (SUCCESS) or absent means the
     * value is valid; e.g. `0x86` (UNSUPPORTED_ATTRIBUTE) means the device does
     * not have it.
     */
    status?: number;
}

/** Request for {@link EnergyAppZigbee.readAttributes}. */
export interface EnyoZigbeeReadAttributesRequest extends EnyoZigbeeClusterAddress {
    /** Ids of the attributes to read. */
    attributes: number[];
}

/** One attribute to write with {@link EnergyAppZigbee.writeAttributes}. */
export interface EnyoZigbeeAttributeWrite {
    /** Attribute id within its cluster. */
    attributeId: number;
    /** ZCL data type id the device expects; see {@link EnyoZigbeeDataTypeEnum}. */
    dataType: number;
    /** The value to write, in the same representation as {@link EnyoZigbeeAttributeValue}. */
    value: Exclude<EnyoZigbeeAttributeValue, null>;
}

/** Request for {@link EnergyAppZigbee.writeAttributes}. */
export interface EnyoZigbeeWriteAttributesRequest extends EnyoZigbeeClusterAddress {
    /** The attributes to write in one ZCL Write Attributes frame. */
    attributes: EnyoZigbeeAttributeWrite[];
}

/** Request for {@link EnergyAppZigbee.sendCommand}. */
export interface EnyoZigbeeSendCommandRequest extends EnyoZigbeeClusterAddress {
    /** Command id within the cluster (e.g. `0x01` On, `0x00` Off on the On/Off cluster). */
    commandId: number;
    /**
     * The ZCL command payload, without the ZCL frame header — the host adds the
     * header, sequence number and addressing. Omit for commands without
     * payload.
     */
    payload?: Uint8Array;
    /**
     * `true` (the default) for a cluster-specific command, `false` for a
     * profile-wide (global) command such as Discover Attributes.
     */
    clusterSpecific?: boolean;
    /**
     * Ask the device not to send a ZCL Default Response. The call then resolves
     * as soon as the frame was acknowledged at the network layer. Defaults to
     * `false`.
     */
    disableDefaultResponse?: boolean;
}

/** What {@link EnergyAppZigbee.sendCommand} got back from the device. */
export interface EnyoZigbeeCommandResult {
    /**
     * ZCL status from the device's Default Response (`0` = SUCCESS). Absent
     * when {@link EnyoZigbeeSendCommandRequest.disableDefaultResponse} was set
     * or the device answered with a cluster-specific response instead.
     */
    status?: number;
    /** Command id of a cluster-specific response, when the device sent one. */
    responseCommandId?: number;
    /** Payload of a cluster-specific response, without the ZCL frame header. */
    responsePayload?: Uint8Array;
}

/**
 * One attribute report configuration for
 * {@link EnergyAppZigbee.configureReporting}.
 */
export interface EnyoZigbeeReportingConfiguration {
    /** Attribute id within the cluster. */
    attributeId: number;
    /** ZCL data type id of the attribute; see {@link EnyoZigbeeDataTypeEnum}. */
    dataType: number;
    /** The device reports no more often than this, in seconds. */
    minIntervalSeconds: number;
    /**
     * The device reports at least this often even without a change, in
     * seconds. `0xFFFF` disables reporting for the attribute.
     */
    maxIntervalSeconds: number;
    /**
     * Smallest change (in the attribute's own unit) that triggers a report
     * before {@link maxIntervalSeconds} elapses. Only meaningful for analog
     * types; omit for discrete ones (booleans, enums, bitmaps).
     */
    reportableChange?: number;
}

/** Request for {@link EnergyAppZigbee.configureReporting}. */
export interface EnyoZigbeeConfigureReportingRequest extends EnyoZigbeeClusterAddress {
    /** The attributes to configure in one ZCL Configure Reporting frame. */
    attributes: EnyoZigbeeReportingConfiguration[];
}

/** Discriminator for {@link EnyoZigbeeMessage}. */
export enum EnyoZigbeeMessageTypeEnum {
    /** The device reported attribute values (ZCL Report Attributes). */
    AttributeReport = 'attribute-report',
    /**
     * The device sent a cluster command to the coordinator — a button press, an
     * IAS zone status change notification, an alarm.
     */
    Command = 'command',
}

/** Fields shared by every {@link EnyoZigbeeMessage}. */
export interface EnyoZigbeeMessageBase {
    /** IEEE address of the device the message came from. */
    ieeeAddress: string;
    /** Source endpoint on the device. */
    endpoint: number;
    /** Cluster id the message belongs to. */
    cluster: number;
    /** Manufacturer code, for manufacturer-specific frames. */
    manufacturerCode?: number;
    /** ISO 8601 timestamp at which the coordinator received the frame. */
    receivedAtIso: string;
    /** Link quality indicator of the frame (0–255). */
    linkQuality?: number;
    /**
     * Received signal strength of the frame in dBm. Last hop: for a device
     * behind a router this is the router's link to the enyo Box, not the device's own.
     */
    rssi?: number;
    /** The host's verdict on the link, from {@link rssi}. Absent when no RSSI is known. */
    signalQuality?: EnyoZigbeeSignalQualityEnum;
}

/** A ZCL attribute report — the usual way a device delivers measurements. */
export interface EnyoZigbeeAttributeReportMessage extends EnyoZigbeeMessageBase {
    type: EnyoZigbeeMessageTypeEnum.AttributeReport;
    /** The reported attributes. */
    attributes: EnyoZigbeeAttributeRecord[];
}

/** A cluster command sent by the device. */
export interface EnyoZigbeeCommandMessage extends EnyoZigbeeMessageBase {
    type: EnyoZigbeeMessageTypeEnum.Command;
    /** Command id within the cluster. */
    commandId: number;
    /** `true` for a cluster-specific command, `false` for a global one. */
    clusterSpecific: boolean;
    /** The command payload, without the ZCL frame header. */
    payload: Uint8Array;
}

/** Anything a device sends unprompted, delivered to {@link EnergyAppZigbee.listenForMessages}. */
export type EnyoZigbeeMessage = EnyoZigbeeAttributeReportMessage | EnyoZigbeeCommandMessage;

/**
 * Narrows which messages a {@link EnergyAppZigbee.listenForMessages} listener
 * receives. All populated fields must match; an omitted field matches
 * anything.
 */
export interface EnyoZigbeeMessageFilter {
    /** Only messages from these devices. */
    ieeeAddresses?: string[];
    /** Only messages for these cluster ids. */
    clusters?: number[];
    /** Only messages of these types. */
    types?: EnyoZigbeeMessageTypeEnum[];
}
