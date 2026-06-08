import {EebusFeatureRole, EebusRemoteFeatureCatalog} from '../../types/enyo-eebus-features.js';
import {SpineEntityType, SpineFeatureType, SpineFunctionType} from '../../types/enyo-spine.js';

/**
 * Options for {@link EebusFeatureCatalog.findFeatureAddressForClient}.
 *
 * Mirrors the lib's priority-ordered resolver used internally by the
 * typed use-case clients. Consumers that needed to reimplement this
 * resolver (heat pumps that host the same feature type on several
 * entities) can now call into the SDK instead.
 */
export interface EebusFindFeatureForClientOptions {
    /** SPINE feature type to look up (e.g. `SpineFeatureType.LOAD_CONTROL`). */
    featureType: SpineFeatureType;
    /** SPINE role to match (`'server'` or `'client'`). */
    role: EebusFeatureRole;
    /**
     * Entity types to prefer, in priority order. The resolver picks the
     * first feature found whose host entity matches the earliest entry
     * in this list. Mix {@link SpineEntityType} values with raw wire
     * strings for vendor-specific entity types that pre-date the
     * catalogue.
     *
     * Omit to skip preference-based matching and fall straight back to
     * {@link fallbackToAny}.
     */
    preferredEntityTypes?: Array<SpineEntityType | string>;
    /**
     * When no entity in {@link preferredEntityTypes} hosts the feature,
     * return the first match from any entity instead of resolving to
     * `undefined`. Defaults to `true` — preserves the legacy
     * "first-match-wins" behaviour. Set `false` to force a strict match
     * on {@link preferredEntityTypes}.
     */
    fallbackToAny?: boolean;
}

/**
 * One match returned by {@link EebusFeatureCatalog.findFeatureAddresses}.
 *
 * Carries enough context for a caller to pick *which* entity it wants to
 * target without having to walk the full {@link EebusRemoteFeatureCatalog}
 * tree itself. {@link entityType} is the deciding field on heat pumps —
 * it lets a caller say "the compressor's `Measurement`, not the heat
 * pump's" without hard-coding entity addresses.
 */
export interface EebusFeatureAddressMatch {
    /** SPINE entity address that hosts the feature (e.g. `[3, 1]`) */
    entity: number[];
    /**
     * SPINE entity type that hosts the feature, from the
     * {@link SpineEntityType} catalogue
     * (e.g. `SpineEntityType.HM_COMPRESSOR`,
     * `SpineEntityType.HVAC_ROOM`).
     */
    entityType: SpineEntityType;
    /** SPINE feature index within {@link entity} */
    feature: number;
    /**
     * Functions the remote advertises as supported on this feature
     * (e.g. `[SpineFunctionType.MeasurementListData,
     * SpineFunctionType.MeasurementDescriptionListData]`). Useful for
     * picking between entities that nominally host the same feature
     * type but expose different functions.
     */
    supportedFunctions: SpineFunctionType[];
}

/**
 * Per-peer SPINE entity/feature catalog for paired EEbus remotes.
 *
 * Exposes the lib's `RemoteDevice` view — the set of entities and
 * features the peer actually advertises via
 * `NodeManagement.DetailedDiscoveryData`, kept in sync by the SDK as the
 * remote emits `NodeManagement.NotifyChange` events.
 *
 * Use this service in preference to {@link EebusIdentityService.getSupportedUseCases}
 * when gating package behaviour on remote capability. Non-certified peers
 * and simulators routinely under-populate `NodeManagement.UseCaseData`
 * while still exposing the matching SPINE features (e.g. a `LoadControl`
 * server with `loadControlLimitDescriptionData` of
 * `limitDirection: 'consume'` but no corresponding
 * `limitationOfPowerConsumption` use case). Feature-level gates work on
 * these peers; use-case gates do not.
 *
 * Identity, like the use-case list, is observable rather than one-shot:
 * remotes add or remove entities and features after a firmware update or
 * a runtime mode change. Always pair {@link get} with
 * {@link onFeaturesChanged} for any package that reacts to peer
 * capabilities, otherwise the package will keep operating against a
 * stale snapshot.
 *
 * @example
 * ```typescript
 * // Feature-based LPC gate that works on peers with incomplete UseCaseData
 * const catalog = await eebus.features.get(ski);
 * const loadControl = catalog.entities
 *   .flatMap(e => e.features)
 *   .find(f =>
 *     f.type === 'LoadControl'
 *     && f.role === 'server'
 *     && f.supportedFunctions.some(s => s.function === 'loadControlLimitListData'),
 *   );
 * if (loadControl) {
 *   await eebus.useCases.lpc(ski).setConsumptionLimit({ value: 11000, isActive: true });
 * }
 *
 * // React to the peer adding or removing features at runtime
 * const listenerId = eebus.features.onFeaturesChanged(ski, next => {
 *   refreshCapabilityGates(next);
 * });
 * ```
 */
export interface EebusFeatureCatalog {
    /**
     * Get the current SPINE entity/feature catalog snapshot for a remote node.
     *
     * The snapshot reflects the most recent `NodeManagement.DetailedDiscoveryData`
     * state the SDK has observed; it does not trigger a re-fetch from the
     * remote. To observe live additions, removals, and updates use
     * {@link onFeaturesChanged}.
     *
     * If the peer identified by `ski` is not paired or not currently
     * connected, the returned snapshot resolves with `found: false` and an
     * empty `entities` list rather than throwing — so packages can use the
     * call as a capability gate without wrapping it in `try`/`catch`.
     *
     * @param ski Subject Key Identifier of the remote node
     * @returns The current entity/feature catalog snapshot
     */
    get: (ski: string) => Promise<EebusRemoteFeatureCatalog>;

    /**
     * Subscribe to feature/entity catalog changes for a remote node.
     *
     * The listener is invoked with the full updated snapshot whenever the
     * lib emits `featureAdded`, `featureUpdated`, `featureRemoved`,
     * `entityAdded`, or `entityRemoved` for the peer. The payload shape
     * matches {@link get} so subscribers can replace their cached catalog
     * on every event without diffing.
     *
     * Subscriptions are scoped to the peer identified by `ski`. If the
     * peer disconnects, the listener remains registered and resumes
     * delivering events when the peer reconnects — packages do not need
     * to re-subscribe after a transient disconnect.
     *
     * @param ski Subject Key Identifier of the remote node
     * @param listener Callback invoked with the full updated catalog snapshot
     * @returns Listener ID that can be passed to {@link removeListener} to cancel
     */
    onFeaturesChanged: (
        ski: string,
        listener: (catalog: EebusRemoteFeatureCatalog) => void,
    ) => string;

    /**
     * Enumerate every entity on a remote node that advertises a feature of
     * the given type and role, with enough context for the caller to pick
     * meaningfully between them.
     *
     * The canonical use case is multi-entity heat pumps: a Vaillant VR940
     * advertises `Measurement` (server) on its `HeatPumpAppliance`,
     * `Compressor`, `HVACRoom`, and `TemperatureSensor` entities. A caller
     * that wants the compressor's electrical measurement (not the
     * appliance-wide MPC roll-up) walks this list, filters by
     * `entityType === 'Compressor'`, and passes the resulting `entity` /
     * `feature` to {@link EebusSpineLowLevel.subscribe} (or to a typed
     * use-case client's `address` option).
     *
     * The result is derived from the current {@link get} snapshot — it
     * does not trigger a re-fetch from the remote. When the peer is not
     * paired or not currently connected the call resolves to an empty
     * array rather than throwing.
     *
     * @param ski Subject Key Identifier of the remote node
     * @param featureType SPINE feature type from the {@link SpineFeatureType} catalogue (e.g. `SpineFeatureType.MEASUREMENT`, `SpineFeatureType.SMART_ENERGY_MANAGEMENT_PS`)
     * @param role SPINE role to match: `'server'` for features the remote *hosts*, `'client'` for features it *consumes*
     * @returns Every matching feature address on the peer, in catalog order
     */
    findFeatureAddresses: (
        ski: string,
        featureType: SpineFeatureType,
        role: EebusFeatureRole,
    ) => Promise<EebusFeatureAddressMatch[]>;

    /**
     * Resolve a single best-fit feature address for a typed client
     * binding, applying the lib's priority-ordered resolver.
     *
     * Walks {@link findFeatureAddresses} and picks the first match that
     * (a) sits on one of {@link EebusFindFeatureForClientOptions.preferredEntityTypes}
     * in the supplied order, or (b) — when no preferred entity hosts the
     * feature and {@link EebusFindFeatureForClientOptions.fallbackToAny}
     * is `true` (the default) — the first match from any entity.
     *
     * Returns `undefined` when the peer is not connected, when no
     * entity hosts a matching feature, or when
     * `fallbackToAny: false` is set and no entity in the preferred
     * list hosts one.
     *
     * @param ski Subject Key Identifier of the remote node
     * @param opts Match parameters; see {@link EebusFindFeatureForClientOptions}
     */
    findFeatureAddressForClient: (
        ski: string,
        opts: EebusFindFeatureForClientOptions,
    ) => Promise<EebusFeatureAddressMatch | undefined>;

    /**
     * Remove a feature-catalog listener previously registered via
     * {@link onFeaturesChanged}.
     * @param listenerId The ID returned by the registration method
     */
    removeListener: (listenerId: string) => void;
}
