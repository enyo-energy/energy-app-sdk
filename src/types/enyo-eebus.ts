import {SpineEntityType} from './enyo-spine.js';

/**
 * Enum representing the connection status of an EEbus device.
 */
export enum EebusConnectionStatusEnum {
    /** The device is actively connected via SHIP */
    Connected = 'connected',
    /** The device is not connected */
    Disconnected = 'disconnected',
    /** A SHIP connection is currently being established */
    Connecting = 'connecting',
}

/**
 * Represents an EEbus device that has been successfully paired (trusted).
 */
export interface EebusDevice {
    /** Subject Key Identifier — unique cryptographic identifier for the device */
    ski: string;
    /** Human-readable device name */
    deviceName: string;
    /** Device brand or model description, if available */
    deviceModel?: string;
    /** Current connection status of the device */
    connectionStatus: EebusConnectionStatusEnum;
    /** Timestamp of when the pairing (trust) was established */
    pairedAt: Date;
    /** Timestamp of the last successful communication with the device */
    lastSeen?: Date;
}

/**
 * Represents a device discovered on the network via mDNS that has not yet been paired.
 */
export interface EebusDiscoveredDevice {
    /** Subject Key Identifier — unique cryptographic identifier for the device */
    ski: string;
    /** Human-readable device name advertised during discovery */
    deviceName?: string;
    /** IP address or hostname of the device */
    host: string;
    /** Port number for the SHIP connection */
    port: number;
}

/**
 * Targets a specific entity (and optionally feature) on a remote SPINE node
 * when issuing a low-level read / write / subscribe.
 *
 * The SDK resolves the actual SPINE feature address from this hint:
 * - When {@link feature} is supplied it is used verbatim.
 * - When omitted the SDK searches for the unique server feature of the
 *   requested type on {@link entity}; if more than one exists on that entity
 *   the operation throws — callers can disambiguate by supplying
 *   {@link feature} explicitly.
 *
 * Heat pumps routinely expose the same `featureType` on multiple entities
 * (e.g. `Measurement` on both `HeatPumpAppliance` and `Compressor`). Without
 * a target, the SDK has to pick one vantage point and consumers cannot tell
 * which — pass a target whenever a peer advertises a feature on more than
 * one entity. Use {@link EebusFeatureCatalog.findFeatureAddresses} to
 * enumerate the candidates.
 */
export interface SpineRemoteTarget {
    /**
     * Remote entity address (e.g. `[3, 1]` for a Compressor sub-entity under
     * a HeatPumpAppliance).
     */
    entity: number[];
    /**
     * Remote feature index within {@link entity}. Optional — when omitted
     * the SDK resolves it from the entity's feature catalog by matching the
     * requested feature type and server role.
     */
    feature?: number;
}

/**
 * Represents an opaque data point read from a SPINE feature via the low-level API.
 * The {@link value} is intentionally `unknown` — the low-level API is the escape
 * hatch and does not enforce SPINE message structure. Use the typed use-case
 * clients (LPC, LPP, MGCP, MPC, OHPCF, …) for structured access.
 */
export interface EebusDataPoint {
    /** The raw value returned by the SPINE feature. Caller is responsible for typing. */
    value: unknown;
    /** Timestamp when the value was read or last updated */
    timestamp: Date;
    /** Unit of measurement, if applicable (e.g. "W", "Wh", "°C") */
    unit?: string;
    /**
     * Source address of this notify/reply from the remote SHIP node.
     *
     * Populated on inbound data points so callers that subscribed across
     * multiple entities can attribute each event to a specific entity and
     * feature — essential on peers that expose the same feature type on
     * more than one entity. May be `undefined` on data points produced
     * before the SDK could resolve the source address (e.g. an early notify
     * that arrives before DetailedDiscovery has completed).
     */
    source?: {
        /** SPINE entity address the data point originated from */
        entity: number[];
        /** SPINE feature index on {@link entity} the data point originated from */
        feature: number;
    };
}

/**
 * Compact view of the `DeviceClassification.ManufacturerData` SPINE
 * payload — the fields a vendor package most often needs to gate
 * behaviour on (vendor identity, model code, firmware revision).
 *
 * Returned by {@link EebusDeviceManagement.getPeerManufacturerData} so
 * consumers can keep vendor-specific quirks at the consumer boundary
 * instead of pushing them into the SDK. Distinct from
 * {@link EebusNodeIdentity}, which carries the full NID snapshot — use
 * this getter when you only need the identity fields and want to skip
 * the identity-service round trip.
 */
export interface EebusPeerManufacturerData {
    /** Manufacturer-assigned device name (e.g. `'KEBA P30'`). */
    manufacturerName?: string;
    /** Brand under which the device is sold. */
    brandName?: string;
    /** Vendor company code (manufacturer identifier). */
    vendorCode?: string;
    /** Manufacturer-assigned device / model code. */
    deviceCode?: string;
    /** Manufacturer-assigned serial number. */
    serialNumber?: string;
    /** Software / firmware revision of the device. */
    softwareRevision?: string;
    /** Hardware revision of the device. */
    hardwareRevision?: string;
}

/**
 * Power source of an EEbus device as reported via `DeviceClassification`.
 * Mirrors SPINE `PowerSourceType`. Values beyond this set may appear in
 * future SPINE revisions; consumers should treat unknown strings as opaque.
 */
export enum EebusPowerSourceEnum {
    /** Powered from the AC grid */
    Mains1Phase = 'mains1Phase',
    /** Powered from the AC grid, 3-phase */
    Mains3Phase = 'mains3Phase',
    /** Battery-backed device */
    Battery = 'battery',
    /** DC-powered device */
    DC = 'dc',
    /** Power source unknown or not advertised */
    Unknown = 'unknown',
}

/**
 * Operating state of an EEbus device as reported via `DeviceDiagnosis`.
 * Mirrors SPINE `DeviceDiagnosisOperatingStateType`. Demotions to `Failure`
 * or `Standby` may occur mid-session; consumers must observe identity
 * changes via {@link EebusIdentityService.onIdentityChanged} to react.
 */
export enum EebusOperatingStateEnum {
    /** Device is running normally */
    Normal = 'normal',
    /** Device is in standby mode */
    Standby = 'standby',
    /** Device is in a failure state */
    Failure = 'failure',
    /** Device is in service mode (manual operation) */
    Service = 'service',
    /** Operating state unknown or not advertised */
    Unknown = 'unknown',
}

/**
 * Describes a single SPINE entity discovered on a remote node via
 * `NodeManagement.DetailedDiscoveryData`. A node usually exposes a
 * `DeviceInformation` entity (the node itself) plus one or more
 * application-specific entities (e.g. `EVSE`, `EV`, `HeatPump`).
 */
export interface EebusEntityDescriptor {
    /** SPINE entity address (a sequence of integers identifying the entity within the node) */
    address: number[];
    /**
     * SPINE entity type from the {@link SpineEntityType} catalogue
     * (e.g. `SpineEntityType.EVSE`, `SpineEntityType.HM_HEAT_PUMP`).
     */
    entityType: SpineEntityType;
    /** Optional human-readable description provided by the device */
    description?: string;
}

/**
 * Identifies the actor role under which a remote node advertises support for a use case.
 * In EEBUS each use case is defined for two actors; e.g. LPC has
 * `EnergyManagementSystem` (sends the limit) and `ControllableSystem` (receives it).
 */
export type EebusUseCaseActor =
    | 'EnergyManagementSystem'
    | 'ControllableSystem'
    | 'Monitor'
    | 'Monitored'
    | 'GridConnectionPoint'
    | 'CustomerEnergyManager'
    | 'HeatPump'
    | string;

/**
 * Describes one use case advertised as supported by a remote node via
 * `NodeManagement.UseCaseData`. Use {@link EebusIdentityService.getSupportedUseCases}
 * to enumerate these before invoking the corresponding {@link EebusUseCaseRegistry} client.
 */
export interface EebusUseCaseSupport {
    /** Actor role under which the remote node implements this use case */
    actor: EebusUseCaseActor;
    /** Use case name as advertised by the remote (e.g. `'limitationOfPowerConsumption'`, `'monitoringOfGridConnectionPoint'`) */
    name: string;
    /** Use case version (e.g. `'1.0.0'`) */
    version: string;
    /** Whether the remote currently advertises this use case as available */
    available: boolean;
    /** Scenario numbers supported by the remote for this use case (per the EEBUS UC spec) */
    scenarios: number[];
}

/**
 * Identity snapshot of a remote EEbus node — the EEBUS Node Identification (NID) view.
 *
 * Combines the SPINE-mandatory triplet that every node performs after the SHIP
 * handshake:
 * - `DeviceClassification.ManufacturerData` and `UserData` — the 13 identity fields below
 * - `DeviceDiagnosis` — {@link operatingState} and {@link lastHeartbeat}
 * - `NodeManagement.DetailedDiscoveryData` — the {@link entities} tree
 *
 * Identity is **observable, not one-shot.** Devices reboot, swap firmware, change
 * {@link userNodeIdentification}, and may demote to `Failure` mid-session via
 * `DeviceDiagnosis` heartbeats. Always subscribe to changes via
 * {@link EebusIdentityService.onIdentityChanged} rather than caching the snapshot.
 *
 * @see {@link EebusIdentityService} for retrieval and subscription
 */
export interface EebusNodeIdentity {
    // ─── DeviceClassification.ManufacturerData ──────────────────────────

    /** Manufacturer-assigned device name */
    deviceName?: string;
    /** Manufacturer-assigned device code (model identifier) */
    deviceCode?: string;
    /** Manufacturer-assigned serial number */
    serialNumber?: string;
    /** Software / firmware revision of the device */
    softwareRevision?: string;
    /** Hardware revision of the device */
    hardwareRevision?: string;
    /** Vendor company name */
    vendorName?: string;
    /** Vendor company code */
    vendorCode?: string;
    /** Brand name under which the device is sold */
    brandName?: string;
    /** Power source classification of the device */
    powerSource?: EebusPowerSourceEnum;
    /**
     * Manufacturer-assigned node identifier — the literal `ManufacturerNodeIdentification`
     * field from SPINE `DeviceClassificationManufacturerDataType`. Often used by
     * vendors as a stable identifier across firmware upgrades.
     */
    manufacturerNodeIdentification?: string;
    /** Short manufacturer-provided label */
    manufacturerLabel?: string;
    /** Free-form manufacturer-provided description */
    manufacturerDescription?: string;

    // ─── DeviceClassification.UserData ──────────────────────────────────

    /**
     * User-assigned node identifier — the literal `UserNodeIdentification` field
     * from SPINE `DeviceClassificationUserDataType`. May be changed by the end
     * user via the device's UI at any time.
     */
    userNodeIdentification?: string;

    // ─── DeviceDiagnosis (first-class, NID-as-observable) ───────────────

    /** Current operating state of the remote device */
    operatingState?: EebusOperatingStateEnum;
    /** Timestamp of the last `DeviceDiagnosis` heartbeat received from the device */
    lastHeartbeat?: Date;

    // ─── NodeManagement.DetailedDiscoveryData ───────────────────────────

    /** SPINE entities discovered on the remote node */
    entities: EebusEntityDescriptor[];
}
