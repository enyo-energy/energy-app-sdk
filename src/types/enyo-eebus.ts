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
    /** SPINE entity type (e.g. "DeviceInformation", "EVSE", "EV", "HeatPumpAppliance") */
    entityType: string;
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
