import {EebusRemoteFeatureCatalog} from '../../types/enyo-eebus-features.js';

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
     * Remove a feature-catalog listener previously registered via
     * {@link onFeaturesChanged}.
     * @param listenerId The ID returned by the registration method
     */
    removeListener: (listenerId: string) => void;
}
