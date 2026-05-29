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
    /** Optional per-phase active power in Watts (length 1 or 3) */
    activePowerPerPhaseW?: number[];
    /** Optional per-phase voltage in Volts */
    voltagePerPhaseV?: number[];
    /** Optional per-phase current in Amperes */
    currentPerPhaseA?: number[];
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
    /** Optional per-phase active power in Watts (length 1 or 3) */
    activePowerPerPhaseW?: number[];
    /** Optional per-phase current in Amperes */
    currentPerPhaseA?: number[];
    /** Cumulative energy consumed in Watt-hours */
    totalEnergyConsumedWh?: number;
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
