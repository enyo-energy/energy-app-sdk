import {SpineEntityType, SpineFeatureType, SpineFunctionType} from './enyo-spine.js';

/**
 * Types describing the SPINE feature/entity catalog advertised by a remote
 * EEbus peer.
 *
 * The catalog is the **authoritative source of truth** for what a peer can
 * actually do. It is derived from the lib's `RemoteDevice` view, which is
 * itself kept in sync with `NodeManagement.DetailedDiscoveryData` replies
 * and `NodeManagement.NotifyChange` events from the remote.
 *
 * Prefer feature/role gates based on this catalog over use-case gates from
 * {@link EebusUseCaseSupport}: many non-certified peers and simulators
 * implement working SPINE features (e.g. a `LoadControl` server with a
 * `loadControlLimitDescriptionData` of `limitDirection: 'consume'`) without
 * advertising the matching use case in `NodeManagement.UseCaseData`.
 */

/**
 * SPINE role under which a feature is advertised by the remote node.
 *
 * The set is intentionally widened with `string` so that lib upgrades that
 * introduce new SPINE role variants do not break consumer code that
 * pattern-matches on the role.
 */
export type EebusFeatureRole = 'client' | 'server' | 'special' | string;

/**
 * SPINE address triple identifying a feature within the EEbus topology.
 *
 * - {@link entity} addresses the entity within the remote node (e.g. `[1]`
 *   for a flat node, `[1, 1]` when the node nests sub-entities such as a
 *   compressor under a heat-pump appliance).
 * - {@link feature} addresses the feature within that entity.
 * - {@link device} optionally carries the remote node's SPINE
 *   `NetworkAddressDeviceID`. Usually omitted because the surrounding
 *   {@link EebusRemoteFeatureCatalog.deviceAddress} already provides it.
 */
export interface EebusFeatureAddress {
    /** SPINE entity address — a sequence of integers identifying the entity within the node */
    entity: number[];
    /** SPINE feature address within the entity */
    feature: number;
    /** Optional SPINE `NetworkAddressDeviceID` of the remote node */
    device?: string;
}

/**
 * A SPINE function the remote advertises as supported on a feature,
 * together with the operations (read / write) the remote permits on it.
 *
 * The operation payloads are intentionally opaque (`object`) — SPINE
 * permits per-function filters and bindings whose shape varies by
 * function and is irrelevant to most callers. Pass them through verbatim
 * when forwarding to {@link EebusSpineLowLevel}.
 */
export interface EebusSupportedFunction {
    /**
     * SPINE function/data-set name from the
     * {@link SpineFunctionType} catalogue
     * (e.g. `SpineFunctionType.LoadControlLimitListData`).
     */
    function: SpineFunctionType;
    /** Operations the remote permits on this function */
    possibleOperations: {
        /** Present when the remote permits reads; payload mirrors the SPINE `read` operation parameters */
        read?: object;
        /** Present when the remote permits writes; payload mirrors the SPINE `write` operation parameters */
        write?: object;
    };
}

/**
 * A single SPINE feature advertised by a remote entity.
 *
 * The {@link type} is a wire string (e.g. `'LoadControl'`,
 * `'Measurement'`, `'DeviceClassification'`) rather than a closed enum
 * so that lib upgrades that introduce new SPINE feature types do not
 * break existing packages — see {@link EebusSpineLowLevel} for the same
 * rationale applied to the low-level escape hatch.
 */
export interface EebusRemoteFeature {
    /** SPINE address triple for this feature */
    address: EebusFeatureAddress;
    /**
     * SPINE feature type from the {@link SpineFeatureType} catalogue
     * (e.g. `SpineFeatureType.LOAD_CONTROL`,
     * `SpineFeatureType.MEASUREMENT`). The low-level SPINE escape hatch
     * accepts wider strings; this structured surface does not.
     */
    type: SpineFeatureType;
    /** SPINE role under which the feature is advertised */
    role: EebusFeatureRole;
    /** Functions the remote advertises as supported on this feature */
    supportedFunctions: EebusSupportedFunction[];
    /** Optional manufacturer-provided label */
    label?: string;
    /** Optional manufacturer-provided description */
    description?: string;
}

/**
 * A SPINE entity advertised by a remote node.
 *
 * A node usually exposes a `DeviceInformation` entity (the node itself)
 * plus one or more application-specific entities (e.g. `EVSE`, `EV`,
 * `HeatPumpAppliance`, `Compressor`). Sub-entities are flattened into
 * this list with their full {@link address} path preserved (e.g. `[1, 1]`
 * for a compressor under a heat-pump appliance), so consumers can
 * reconstruct the hierarchy when needed.
 */
export interface EebusRemoteEntity {
    /** SPINE entity address — a sequence of integers identifying the entity (e.g. `[1]` or `[1, 1]`) */
    address: number[];
    /**
     * SPINE entity type from the {@link SpineEntityType} catalogue
     * (e.g. `SpineEntityType.HM_HEAT_PUMP`,
     * `SpineEntityType.HM_COMPRESSOR`, `SpineEntityType.EVSE`).
     */
    type: SpineEntityType;
    /** Optional manufacturer-provided label */
    label?: string;
    /** Optional manufacturer-provided description */
    description?: string;
    /** Features advertised on this entity */
    features: EebusRemoteFeature[];
}

/**
 * Snapshot of the full SPINE entity/feature catalog advertised by a
 * remote EEbus peer.
 *
 * Returned by {@link EebusFeatureCatalog.get} and delivered to
 * {@link EebusFeatureCatalog.onFeaturesChanged} listeners. The shape is
 * intentionally identical between the two so that change subscribers can
 * drop and replace their cached catalog on every event without diffing.
 *
 * When the peer identified by {@link ski} is not known (never paired or
 * not currently connected), {@link found} is `false` and {@link entities}
 * is an empty array — the call resolves cleanly rather than throwing, so
 * packages can use the snapshot as a feature gate without try/catch.
 */
export interface EebusRemoteFeatureCatalog {
    /** Subject Key Identifier of the remote node this catalog describes */
    ski: string;
    /** Whether the peer is currently known to the SDK (paired AND reachable) */
    found: boolean;
    /** Remote node's SPINE `NetworkAddressDeviceID`, when known */
    deviceAddress?: string;
    /** SPINE entities advertised by the remote node, flattened with their address path preserved */
    entities: EebusRemoteEntity[];
}
