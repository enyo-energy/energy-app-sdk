import {EebusOperatingStateEnum} from './enyo-eebus.js';

/**
 * Payload types for the typed EEbus use-case clients exposed via
 * {@link EebusUseCaseRegistry}.
 *
 * Each EEBUS use case has its own semantics, even when two cases superficially
 * resemble each other:
 * - **LPC** (Limitation of Power Consumption) — *obligation*. The consumer MUST
 *   respect the limit.
 * - **LPP** (Limitation of Power Production) — *recommendation*. The producer
 *   SHOULD respect the limit but is not contractually bound.
 * - **MGCP / MPC** — read-only telemetry, different vantage points.
 * - **OHPCF** — incentive-table-driven, conceptually unrelated to LoadControl.
 *
 * Keep payload types per-use-case rather than sharing a generic `PowerLimit`
 * type: the historical conflation of obligation vs recommendation behind a
 * single `isObligatory` flag was the original API smell this module replaces.
 */

// ═══════════════════════════════════════════════════════════════════════════
// LPC — Limitation of Power Consumption (obligation)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A consumption limit issued by an Energy Management System to a Controllable System.
 * LPC limits are obligations: the controllable system MUST respect them.
 */
export interface EebusLpcLimit {
    /** Maximum allowed power consumption in Watts */
    value: number;
    /** Whether the limit is currently active. `false` clears any previously active limit. */
    isActive: boolean;
    /**
     * Duration in seconds for which the limit applies. Omit or set to `0` for an
     * indefinite limit. The remote may downgrade or expire the limit independently
     * based on its own failsafe configuration.
     */
    durationSeconds?: number;
}

/**
 * Failsafe configuration for LPC — the limit a controllable system falls back to
 * when the connection to the energy manager is lost.
 */
export interface EebusLpcFailsafe {
    /** Power consumption limit in Watts to apply when the EMS connection is lost */
    value: number;
    /**
     * Time in seconds before the failsafe activates after the EMS connection
     * is detected as lost.
     */
    durationSeconds: number;
}

/**
 * Acknowledgement returned by a controllable system after receiving an LPC limit.
 */
export interface EebusLpcAck {
    /** Whether the controllable system accepted the limit */
    accepted: boolean;
    /** Optional human-readable reason when {@link accepted} is `false` */
    reason?: string;
}

/**
 * Push-side rejection from a controllable system, delivered to an EMS
 * subscriber via {@link EebusLpcClient.onConsumptionLimitNack}.
 *
 * Distinct from the SPINE write-ack that
 * {@link EebusLpcClient.setConsumptionLimit} resolves on: a write-ack
 * means "the CS received the limit message". A NACK arrives as a
 * separate event when the CS subsequently decides not to honour the
 * limit (out-of-range value, failsafe override active, queue full,
 * etc.).
 */
export interface EebusLpcNack {
    /** Human-readable reason the CS rejected the limit. */
    reason: string;
    /**
     * The limit the CS rejected, when attribution to the originating
     * write is available. Omitted on peers that don't echo the
     * rejected payload (some VICTRON / KEBA firmwares).
     */
    rejectedLimit?: EebusLpcLimit;
}

/**
 * Direction a LoadControl limit applies to — whether it caps power
 * flowing *into* the controllable system (consumption) or *out of* it
 * (production).
 *
 * Used by {@link EebusLpcClient.findLimit} to disambiguate peers that
 * advertise both directions (a battery storage system, for instance,
 * advertises both `consume` and `produce` limits).
 */
export type EebusLpcLimitDirection = 'consume' | 'produce';

/**
 * Category of a LoadControl limit — whether the controllable system
 * MUST respect it (obligation, LPC semantics) or SHOULD respect it
 * (recommendation, LPP semantics).
 *
 * Used by {@link EebusLpcClient.findLimit} to pin lookups when the peer
 * advertises both categories on the same direction.
 */
export type EebusLpcLimitCategory = 'obligation' | 'recommendation';

/**
 * Typed view of one entry in the peer's
 * `loadControlLimitDescriptionListData`. Returned by
 * {@link EebusLpcClient.findLimit} so consumers don't have to walk the
 * description list themselves.
 */
export interface EebusLpcLimitDescriptor {
    /**
     * SPINE `limitId` — opaque identifier the peer assigned to this
     * limit slot. Round-trip on subsequent writes when the peer
     * advertises more than one limit in the same direction / category.
     */
    limitId: number;
    /** Limit direction (consume / produce). */
    direction: EebusLpcLimitDirection;
    /** Limit category (obligation / recommendation). */
    category: EebusLpcLimitCategory;
    /** SPINE unit string (e.g. `'W'`, `'A'`). */
    unit?: string;
    /**
     * Optional cross-reference to the `MeasurementListData` slot the
     * limit constrains (a peer may report the live value via
     * Measurement while exposing the slot via LoadControl).
     */
    measurementId?: number;
    /**
     * Optional SPINE scope-type wire string (e.g. `'acPowerTotal'`,
     * `'acCurrentPerPhase'`). Useful when the peer advertises per-phase
     * slots that share a direction/category — pair with
     * {@link EebusLpcClient.findPerPhaseLimitIds} when a per-phase lookup
     * is needed.
     */
    scopeType?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// LPP — Limitation of Power Production (recommendation)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A production limit issued by an Energy Management System to a producing
 * Controllable System (e.g. a PV inverter). LPP limits are recommendations:
 * the producer SHOULD respect them but is not contractually bound.
 */
export interface EebusLppLimit {
    /** Maximum recommended power production in Watts */
    value: number;
    /** Whether the recommendation is currently active */
    isActive: boolean;
    /** Duration in seconds for which the recommendation applies. Omit or set to `0` for indefinite. */
    durationSeconds?: number;
}

/**
 * Failsafe configuration for LPP — the production limit a producer falls back to
 * when the connection to the energy manager is lost.
 */
export interface EebusLppFailsafe {
    /** Power production limit in Watts to apply when the EMS connection is lost */
    value: number;
    /**
     * Time in seconds before the failsafe activates after the EMS connection
     * is detected as lost.
     */
    durationSeconds: number;
}

/**
 * Acknowledgement returned by a producing controllable system after receiving an LPP recommendation.
 */
export interface EebusLppAck {
    /** Whether the producer acknowledged the recommendation */
    accepted: boolean;
    /** Optional human-readable reason when {@link accepted} is `false` */
    reason?: string;
}

/**
 * Push-side rejection from a producing controllable system, delivered to
 * an EMS subscriber via {@link EebusLppClient.onProductionLimitNack}.
 *
 * LPP is a *recommendation*: the producing CS may decline a
 * recommendation without violating the use case (compare with LPC,
 * where a NACK means the obligation could not be honoured). A NACK
 * arrives as a separate event after the SPINE write-ack that
 * {@link EebusLppClient.setProductionLimit} resolves on.
 */
export interface EebusLppNack {
    /** Human-readable reason the producer declined the recommendation. */
    reason: string;
    /**
     * The recommendation the producer declined, when attribution to the
     * originating write is available. Omitted on peers that don't echo
     * the declined payload.
     */
    rejectedLimit?: EebusLppLimit;
}

// ═══════════════════════════════════════════════════════════════════════════
// MGCP — Monitoring of Grid Connection Point (read-only telemetry)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A single telemetry reading from a grid connection point.
 * Positive power values indicate import (consumption from the grid);
 * negative values indicate export (feed-in to the grid).
 */
export interface EebusMgcpReading {
    /** Timestamp of this reading */
    timestamp: Date;
    /** Total active power in Watts. Positive = import, negative = export. */
    activePowerW: number;
    /**
     * Optional per-phase active power in Watts, keyed by phase label.
     * Each phase is independently optional — single-phase peers populate
     * only `a`, three-phase peers populate `a`, `b`, and `c`.
     */
    activePowerByPhase?: {a?: number; b?: number; c?: number};
    /**
     * Optional per-phase voltage in Volts, keyed by phase label. Each
     * phase is independently optional.
     */
    voltageByPhase?: {a?: number; b?: number; c?: number};
    /**
     * Optional per-phase current in Amperes, keyed by phase label. Each
     * phase is independently optional.
     */
    currentByPhase?: {a?: number; b?: number; c?: number};
    /** Optional grid frequency in Hertz */
    frequencyHz?: number;
    /** Cumulative energy imported from the grid in Watt-hours */
    totalEnergyImportWh?: number;
    /** Cumulative energy exported to the grid in Watt-hours */
    totalEnergyExportWh?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MPC — Monitoring of Power Consumption (read-only telemetry)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A single telemetry reading from a controllable system reporting its power consumption.
 */
export interface EebusMpcReading {
    /** Timestamp of this reading */
    timestamp: Date;
    /** Active power consumption in Watts */
    activePowerW: number;
    /**
     * Optional per-phase active power in Watts, keyed by phase label.
     * Each phase is independently optional — single-phase peers populate
     * only `a`, three-phase peers populate `a`, `b`, and `c`.
     */
    activePowerByPhase?: {a?: number; b?: number; c?: number};
    /**
     * Optional per-phase current in Amperes, keyed by phase label. Each
     * phase is independently optional.
     */
    currentByPhase?: {a?: number; b?: number; c?: number};
    /** Cumulative energy consumed in Watt-hours */
    totalEnergyConsumedWh?: number;
}

/**
 * Typed view of one entry in the peer's
 * `measurementDescriptionListData`. Returned by
 * {@link EebusMpcClient.findMeasurement} so consumers don't have to walk
 * the description list themselves.
 */
export interface EebusMpcMeasurementDescriptor {
    /**
     * SPINE `measurementId` — opaque identifier the peer assigned to
     * this measurement slot. Round-trip when joining a measurement
     * sample back to its descriptor.
     */
    measurementId: number;
    /**
     * SPINE scope-type wire string (e.g. `'acPowerTotal'`,
     * `'acEnergyConsumed'`, `'stateOfCharge'`). Identifies *what* the
     * measurement represents.
     */
    scopeType: string;
    /**
     * SPINE measurement-type wire string (e.g. `'power'`, `'energy'`,
     * `'current'`). Identifies *which physical quantity* the slot
     * carries.
     */
    measurementType?: string;
    /**
     * SPINE commodity-type wire string (e.g. `'electricity'`, `'gas'`,
     * `'heat'`). Disambiguates peers that report several commodities
     * on the same node.
     */
    commodityType?: string;
    /** SPINE unit string (e.g. `'W'`, `'Wh'`, `'A'`, `'%'`). */
    unit?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// OHPCF — Optimization of Self Consumption by Heat Pump Compressor Flexibility
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A single tier in an OHPCF incentive table. Each tier defines a price (or cost)
 * that applies from {@link startTime} until the next tier starts.
 *
 * @see https://techdocs.wago.com/Software/EEBUS_Connector/en-US/3657311371.html
 */
export interface EebusOhpcfIncentiveTier {
    /** Start of this tier */
    startTime: Date;
    /** Price or cost value for this tier (units defined by {@link EebusOhpcfIncentiveTable.currency} and {@link EebusOhpcfIncentiveTable.unit}) */
    value: number;
}

/**
 * An incentive table sent by a Customer Energy Manager to a heat pump,
 * communicating the time-varying cost of energy. The heat pump uses this
 * to schedule its compressor for cheap / green windows without further
 * coordination with the CEM.
 */
export interface EebusOhpcfIncentiveTable {
    /** ISO 4217 currency code (e.g. `'EUR'`, `'USD'`) for the {@link tiers} values */
    currency: string;
    /** Unit the price refers to (e.g. `'kWh'`) */
    unit: string;
    /** Ordered list of price tiers covering the planning horizon */
    tiers: EebusOhpcfIncentiveTier[];
}

/**
 * The heat pump's current operational plan in response to an incentive table.
 * Allows the CEM to monitor whether the heat pump is producing the intended
 * load shape.
 */
export interface EebusOhpcfPlanState {
    /** Timestamp this plan state was generated */
    timestamp: Date;
    /** Currently planned electrical power consumption in Watts */
    plannedPowerW: number;
    /** Optional planned start time of the next operation interval */
    nextStart?: Date;
    /** Optional planned end time of the next operation interval */
    nextEnd?: Date;
}

/**
 * The compressor flexibility a heat pump advertises to the CEM — the band
 * within which the CEM may shift consumption without affecting end-user comfort.
 */
export interface EebusOhpcfFlexibility {
    /** Timestamp this flexibility report was generated */
    timestamp: Date;
    /** Minimum electrical power the compressor can draw while operating, in Watts */
    minPowerW: number;
    /** Maximum electrical power the compressor can draw while operating, in Watts */
    maxPowerW: number;
    /** Minimum operating duration in seconds once the compressor starts */
    minRunDurationSeconds?: number;
    /** Minimum pause duration in seconds between operation intervals */
    minPauseDurationSeconds?: number;
    /** Whether the compressor is currently running */
    isRunning: boolean;
}

/**
 * On-wire flavour of the OHPCF use case. EEBUS defines two compatible
 * encodings:
 *
 * - `'incentiveTable'` — the canonical flavour. The CEM publishes an
 *   {@link EebusOhpcfIncentiveTable}; the heat pump schedules its
 *   compressor accordingly.
 * - `'smartEnergyManagementPs'` — the Vaillant flavour, layered on the
 *   `SmartEnergyManagementPs` SPINE feature. The heat pump publishes
 *   {@link EebusOhpcfAnnouncement}s describing planned consumption
 *   windows, and the CEM can activate a window now via
 *   {@link EebusOhpcfClient.activateNow}.
 *
 * The two flavours are *not* mutually exclusive on every peer, but most
 * peers expose only one. The default resolution (`'auto'`) probes the
 * feature catalog and picks whichever the peer advertises.
 */
export type EebusOhpcfFlavour = 'incentiveTable' | 'smartEnergyManagementPs' | 'auto';

/**
 * An OHPCF announcement emitted by a heat pump under the
 * `SmartEnergyManagementPs` flavour. The heat pump tells the CEM "here is
 * a window in which I plan to consume X watts for Y seconds; you may
 * activate me now or wait".
 *
 * Field shape is the SDK's parsed view of the SEMP payload — see
 * `SmartEnergyManagementPs` in the SPINE spec for the underlying wire
 * fields.
 */
export interface EebusOhpcfAnnouncement {
    /** Timestamp this announcement was emitted */
    timestamp: Date;
    /**
     * Manufacturer-assigned identifier for the announced operation window.
     * Round-trip this on {@link EebusOhpcfApplianceContext.announcementId}
     * when activating the window.
     */
    announcementId: string;
    /**
     * Earliest moment the CEM may activate the announced window. The heat
     * pump will reject {@link EebusOhpcfClient.activateNow} calls before
     * this point.
     */
    earliestActivation: Date;
    /**
     * Latest moment by which the CEM must have activated the window or it
     * lapses.
     */
    latestActivation: Date;
    /** Nominated electrical power the compressor will draw, in Watts */
    nominatedPowerW: number;
    /** Nominated operating duration, in seconds */
    nominatedDurationSeconds: number;
    /**
     * Whether the heat pump considers the window optional (CEM may skip)
     * or mandatory (heat pump will activate on its own at
     * {@link latestActivation} if the CEM stays silent).
     */
    optional: boolean;
}

/**
 * Context passed to {@link EebusOhpcfClient.activateNow} to tell the heat
 * pump "activate the announced window right now under these parameters".
 *
 * Most callers populate {@link announcementId} verbatim from the matching
 * {@link EebusOhpcfAnnouncement} and leave the optional overrides unset.
 */
export interface EebusOhpcfApplianceContext {
    /**
     * Identifier of the announcement being activated; copy from
     * {@link EebusOhpcfAnnouncement.announcementId}.
     */
    announcementId: string;
    /**
     * Optional override of the activated power level, in Watts. Must lie
     * within the announced flexibility band. Defaults to the
     * announcement's nominated power.
     */
    powerW?: number;
    /**
     * Optional override of the activated duration, in seconds. Defaults to
     * the announcement's nominated duration.
     */
    durationSeconds?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Setpoint — target value(s) for a controllable parameter (e.g. zone temperature)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A single setpoint reported or written via the EEBUS **Setpoint** feature.
 *
 * Setpoints carry the target value for a controllable parameter on a remote
 * node — most commonly the per-zone target temperature on a heat pump.
 * The {@link setpointId} matches the corresponding zone in
 * `Identification.identificationListData`, so a caller can join setpoints to
 * human-readable zone names.
 */
export interface EebusSetpointValue {
    /**
     * Setpoint list identifier. Matches the zone index used by
     * `Identification.identificationListData`.
     */
    setpointId: number;
    /** Target value (interpret using {@link unit}; e.g. °C for HVAC zones) */
    value: number;
    /**
     * SPINE unit string for {@link value}, e.g. `'Cel'` for Celsius.
     * Following the SPINE unit catalog.
     */
    unit: string;
    /** Whether the setpoint is currently active on the remote */
    isActive: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Hvac — heating / cooling operation mode + per-zone state
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A heating/cooling operation mode advertised or selected via the EEBUS
 * **Hvac** feature. Operation modes are vendor-defined identifiers (e.g.
 * heating, cooling, auto, standby) accompanied by an optional description.
 */
export interface EebusHvacOperationMode {
    /** SPINE operation mode identifier */
    modeId: number;
    /** Human-readable mode description as advertised by the remote */
    description?: string;
}

/**
 * Per-zone state reported via the EEBUS **Hvac** feature.
 *
 * The {@link zoneId} matches the zone index used by
 * `Identification.identificationListData`, so a caller can join zone state to
 * human-readable zone names.
 */
export interface EebusHvacZoneState {
    /**
     * Zone identifier. Matches the zone index used by
     * `Identification.identificationListData`.
     */
    zoneId: number;
    /** Current measured temperature in Celsius, if reported */
    currentTemperatureC?: number;
    /** Active operation mode for this zone, if reported */
    operationMode?: EebusHvacOperationMode;
}

// ═══════════════════════════════════════════════════════════════════════════
// EVSECC — EVSE Commissioning & Configuration
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Manufacturer-side identity of an EVSE (the charging station), as reported
 * via `DeviceClassification.ManufacturerData`. Used by an EMS to render the
 * EVSE in its UI and to gate vendor-specific behaviour by `vendorCode` /
 * `deviceCode`.
 */
export interface EebusEvseManufacturerData {
    /** Manufacturer-assigned device name (e.g. `'KEBA P30'`). */
    manufacturerName?: string;
    /** Brand under which the EVSE is sold. */
    brandName?: string;
    /** Vendor company code (manufacturer identifier). */
    vendorCode?: string;
    /** Manufacturer-assigned device / model code. */
    deviceCode?: string;
    /** Manufacturer-assigned serial number. */
    serialNumber?: string;
    /** Software / firmware revision of the EVSE. */
    softwareRevision?: string;
    /** Hardware revision of the EVSE. */
    hardwareRevision?: string;
}

/**
 * Operating state of an EVSE as reported via `DeviceDiagnosis.StateData` /
 * `DeviceDiagnosis.HeartbeatData`.
 *
 * The state itself reuses {@link EebusOperatingStateEnum} (the same enum
 * surfaced on {@link EebusNodeIdentity.operatingState}); this wrapper
 * adds the heartbeat timestamp so a stale heartbeat can be detected even
 * when the state nominally remains `Normal`.
 */
export interface EebusEvseOperatingState {
    /** Current operating state. */
    state: EebusOperatingStateEnum;
    /**
     * Timestamp of the last `DeviceDiagnosis.HeartbeatData` from the
     * EVSE. A heartbeat older than ~30 s typically indicates the SHIP
     * link is degraded even if `state` is still `Normal`.
     */
    lastHeartbeat?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// EVCC — EV Commissioning & Configuration
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Communication standard between the EV and the EVSE — the on-wire
 * protocol carrying the charging session (basic PWM signalling vs
 * digital ISO 15118 negotiation).
 *
 * Surfaced as an enum because the value gates UI affordances (e.g.
 * Plug & Charge is only available on ISO 15118 sessions) and gates
 * which higher-level UCs are even relevant (CEVC requires ISO 15118).
 */
export enum EebusEvCommunicationStandardEnum {
    /** Basic IEC 61851 PWM signalling — no digital negotiation. */
    IEC61851 = 'IEC61851',
    /** ISO 15118-2 digital communication (DIN SPEC 70121-compatible). */
    ISO15118_2 = 'ISO15118-2',
    /** ISO 15118-20 digital communication (next-gen). */
    ISO15118_20 = 'ISO15118-20',
    /** Standard not yet negotiated or unknown to the SDK. */
    Unknown = 'unknown',
}

/**
 * Identity of an EV currently presented to the EVSE, derived from the
 * EEBUS `Identification` feature on the EV entity. Typically the
 * EVCCID (a MAC-address-shaped vehicle identifier), but the EEBUS
 * `Identification` feature is general — {@link type} disambiguates.
 */
export interface EebusEvIdentification {
    /** Vendor-assigned EV identifier (often the EVCCID). */
    id: string;
    /**
     * Identification type wire string (e.g. `'eui48'`, `'macAddress'`,
     * `'vin'`). Mirrors the SPINE `Identification.identificationType`
     * field.
     */
    type: string;
    /** Optional human-readable description. */
    description?: string;
}

/**
 * Connection lifecycle event for the EV against this EVSE — fired when
 * a vehicle plugs in or unplugs.
 */
export interface EebusEvConnectionState {
    /** `true` for connect events; `false` for disconnect events. */
    connected: boolean;
    /** ISO timestamp when the connection state was observed. */
    observedAt: Date;
}

/**
 * One configuration key/value pair reported by the EV via
 * `DeviceConfiguration.keyValueListData`. The set of advertised keys is
 * EVCC-vocabulary defined (e.g. `'communicationStandard'`,
 * `'asymmetricChargingSupported'`); the {@link valueType} disambiguates
 * how to read {@link value}.
 */
export interface EebusEvConfigurationKey {
    /**
     * Vendor-published key name. Matches the wire string the EV
     * advertises in `keyValueDescriptionListData` (e.g.
     * `'communicationStandard'`).
     */
    key: string;
    /**
     * SPINE value-type discriminator (e.g. `'string'`, `'boolean'`,
     * `'scaledNumber'`). Use this to interpret {@link value}.
     */
    valueType: string;
    /**
     * Raw value as the EV published it — number, boolean, or string
     * depending on {@link valueType}. Callers that already know the key
     * may narrow the type at the call site; helper getters such as
     * {@link EebusEvccClient.getCommunicationStandard} narrow on the
     * caller's behalf.
     */
    value: number | boolean | string;
    /** Whether the value is currently advertised as active by the EV. */
    isActive?: boolean;
}

/**
 * Snapshot of the EV's `DeviceConfiguration.keyValueListData` — every
 * configuration key the EV currently advertises with its most recent
 * value. Surfaced as a snapshot so consumers don't have to walk
 * description + list separately.
 */
export interface EebusEvConfigurationSnapshot {
    /** Timestamp of the most recent `keyValueListData` notify. */
    timestamp: Date;
    /** Every key the EV currently advertises. */
    keys: EebusEvConfigurationKey[];
}

/**
 * Snapshot of the EV's electrical permitted-value sets — per-phase
 * minimum / maximum current the EV reports as allowable, derived from
 * `ElectricalConnection.permittedValueSetListData`. Used by the EMS to
 * gate per-phase charging limits (OPEV / OSCEV) against what the
 * vehicle will accept.
 */
export interface EebusEvElectricalLimits {
    /** Timestamp of the most recent `permittedValueSetListData` notify. */
    timestamp: Date;
    /** Minimum per-phase charging current the EV will accept, in Amperes. */
    minCurrentPerPhaseA?: number[];
    /** Maximum per-phase charging current the EV will accept, in Amperes. */
    maxCurrentPerPhaseA?: number[];
    /** Minimum total charging power the EV will accept, in Watts. */
    minPowerW?: number;
    /** Maximum total charging power the EV will accept, in Watts. */
    maxPowerW?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// EVCEM — Measurement of Electricity During EV Charging
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Single telemetry reading from an EV charging session — combines the
 * power, per-phase electrical view, and cumulative energy delivered
 * since the session started.
 */
export interface EebusEvcemReading {
    /** Timestamp of this reading. */
    timestamp: Date;
    /** Total active charging power in Watts. */
    activePowerW: number;
    /**
     * Optional per-phase active power in Watts, keyed by phase label.
     * Each phase is independently optional — single-phase EVSEs populate
     * only `a`, three-phase EVSEs populate `a`, `b`, and `c`.
     */
    activePowerByPhase?: {a?: number; b?: number; c?: number};
    /**
     * Optional per-phase current in Amperes, keyed by phase label. Each
     * phase is independently optional.
     */
    currentByPhase?: {a?: number; b?: number; c?: number};
    /**
     * Optional per-phase voltage in Volts, keyed by phase label. Each
     * phase is independently optional.
     */
    voltageByPhase?: {a?: number; b?: number; c?: number};
    /** Cumulative energy charged since session start, in Watt-hours. */
    totalEnergyChargedWh?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// EVSOC — EV State of Charge
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Single SoC reading from the connected EV. Reported only when the EV
 * actually publishes its SoC over EEBUS — many vehicles do not.
 */
export interface EebusEvSocReading {
    /** Timestamp of this reading. */
    timestamp: Date;
    /** State of charge in percent (0–100). */
    percent: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CEVC — Controllable EV Charging
// ═══════════════════════════════════════════════════════════════════════════

/**
 * One segment of an EV charging plan — the average power the EVSE
 * should deliver from {@link startSeconds} until the next segment's
 * `startSeconds` (or until the plan ends, for the final segment).
 */
export interface EebusCevcChargingPlanEntry {
    /** Start of this segment, relative to {@link EebusCevcChargingPlan.startTime}, in seconds. */
    startSeconds: number;
    /** Target average power for this segment, in Watts. */
    powerW: number;
}

/**
 * A time-series charging plan published by the EMS or returned by the EV.
 * Segments are sorted ascending by {@link EebusCevcChargingPlanEntry.startSeconds};
 * the first segment should be at `startSeconds = 0` so the EVSE has a
 * setpoint for "right now".
 */
export interface EebusCevcChargingPlan {
    /** Plan start time (wall clock). */
    startTime: Date;
    /** Ordered segments; first should be at `startSeconds = 0`. */
    segments: EebusCevcChargingPlanEntry[];
}

/**
 * Acknowledgement returned by the EV after receiving a CEVC time-series
 * plan or incentive table.
 */
export interface EebusCevcAck {
    /** Whether the EV accepted the plan. */
    accepted: boolean;
    /** Optional human-readable reason when {@link accepted} is `false`. */
    reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// OPEV — Overload Protection by EV Charging Curtailment
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Per-phase charging current limit issued by an EMS to an EVSE under the
 * OPEV use case. OPEV is an *obligation*: the EVSE MUST respect the
 * limit (it is grid-safety driven, not optimisation driven).
 *
 * Single-phase EVSEs populate only `a`; three-phase EVSEs populate `a`,
 * `b`, and `c`. Phases the EVSE does not carry are left absent rather
 * than implied by array length.
 */
export interface EebusOpevLimit {
    /**
     * Per-phase current limits in Amperes, keyed by phase label. Each
     * phase is independently optional — omit phases the EVSE does not
     * carry.
     */
    currentLimitByPhase: {a?: number; b?: number; c?: number};
    /** Whether the limit is currently active. */
    isActive: boolean;
    /**
     * Duration in seconds for which the limit applies. Omit or set to
     * `0` for an indefinite limit.
     */
    durationSeconds?: number;
}

/**
 * Acknowledgement returned by the EVSE after receiving an OPEV limit.
 */
export interface EebusOpevAck {
    /** Whether the EVSE accepted the limit. */
    accepted: boolean;
    /** Optional human-readable reason when {@link accepted} is `false`. */
    reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// OSCEV — Optimization of Self-Consumption During EV Charging
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Per-phase recommended charging current limit issued by an EMS to an
 * EVSE under the OSCEV use case. OSCEV is a *recommendation*: the EVSE
 * SHOULD respect it to optimise PV self-consumption, but is not
 * obligated.
 *
 * Compare {@link EebusOpevLimit} — same shape, different semantics
 * (obligation vs recommendation), as with LPC vs LPP.
 */
export interface EebusOscevLimit {
    /**
     * Per-phase recommended current limits in Amperes, keyed by phase
     * label. Each phase is independently optional — omit phases the EVSE
     * does not carry.
     */
    currentLimitByPhase: {a?: number; b?: number; c?: number};
    /** Whether the recommendation is currently active. */
    isActive: boolean;
    /** Duration in seconds; omit or `0` for indefinite. */
    durationSeconds?: number;
}

/**
 * Acknowledgement returned by the EVSE after receiving an OSCEV
 * recommendation.
 */
export interface EebusOscevAck {
    /** Whether the EVSE acknowledged the recommendation. */
    accepted: boolean;
    /** Optional human-readable reason when {@link accepted} is `false`. */
    reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// VABD — Visualization of Aggregated Battery Data
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aggregated telemetry reading for a battery / home storage system.
 *
 * Sign convention on {@link batteryPowerW}: positive = charging the
 * battery, negative = discharging into the home / grid. Same convention
 * as {@link EnyoBatteryValuesUpdateV1.data.batteryPowerW} for parity.
 */
export interface EebusVabdTelemetry {
    /** Timestamp of this reading. */
    timestamp: Date;
    /** Active power in Watts. Positive = charging, negative = discharging. */
    batteryPowerW: number;
    /** State of charge in percent (0–100). */
    batterySocPercent: number;
    /** Nominal capacity of the battery in Watt-hours, if known. */
    batteryNominalCapacityWh?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// VAPD — Visualization of Aggregated PV Data
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aggregated telemetry reading for a PV / solar inverter system.
 *
 * {@link activePowerW} is the *current* production; {@link nominalPeakPowerW}
 * is the *installed* peak — useful to chart utilisation.
 */
export interface EebusVapdTelemetry {
    /** Timestamp of this reading. */
    timestamp: Date;
    /** Current active production in Watts. */
    activePowerW: number;
    /** Nominal peak production capacity of the PV system, in Watts. */
    nominalPeakPowerW?: number;
}
