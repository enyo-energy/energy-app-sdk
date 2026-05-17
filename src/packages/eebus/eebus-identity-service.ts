import {EebusNodeIdentity, EebusUseCaseSupport} from '../../types/enyo-eebus.js';

/**
 * Identity service for the EEBUS Node Identification (NID) data of a remote node.
 *
 * NID is the SPINE-mandatory bootstrap exchange that every EEbus device performs
 * after the SHIP handshake. It combines `NodeManagement.DetailedDiscoveryData` +
 * `NodeManagement.UseCaseData` + `DeviceClassification.ManufacturerData`/`UserData`
 * + `DeviceDiagnosis` (state + heartbeat).
 *
 * **Identity is observable, not one-shot.** The remote may reboot, update its
 * firmware, change its `UserNodeIdentification`, or demote its operating state
 * via a `DeviceDiagnosis` heartbeat at any time. Consumers that cache a
 * Promise-resolved snapshot will ship UI bugs. Always pair {@link get} with
 * {@link onIdentityChanged}.
 *
 * @example
 * ```typescript
 * const id = await eebus.identity.get(ski);
 * console.log(`${id.brandName} ${id.deviceName} (${id.operatingState})`);
 *
 * eebus.identity.onIdentityChanged(ski, (next) => {
 *   if (next.operatingState === EebusOperatingStateEnum.Failure) alert();
 * });
 *
 * const supported = await eebus.identity.getSupportedUseCases(ski);
 * if (supported.some(u => u.name === 'limitationOfPowerConsumption' && u.available)) {
 *   await eebus.useCases.lpc(ski).setConsumptionLimit({ value: 11000, isActive: true });
 * }
 * ```
 */
export interface EebusIdentityService {
    /**
     * Get the current identity snapshot for a remote node.
     * The snapshot reflects the most recent SPINE state observed by the SDK;
     * it does not trigger a re-fetch from the remote. To observe live changes
     * (firmware updates, operating-state demotions, heartbeat losses) use
     * {@link onIdentityChanged}.
     * @param ski Subject Key Identifier of the remote node
     * @returns The current identity snapshot
     */
    get: (ski: string) => Promise<EebusNodeIdentity>;

    /**
     * Subscribe to identity changes for a remote node. The listener is invoked
     * whenever any field of the node's identity changes — including firmware
     * revisions, user node identification, operating state, and heartbeat.
     * @param ski Subject Key Identifier of the remote node
     * @param listener Callback invoked with the full updated identity snapshot
     * @returns Listener ID that can be passed to {@link removeListener} to cancel
     */
    onIdentityChanged: (
        ski: string,
        listener: (identity: EebusNodeIdentity) => void
    ) => string;

    /**
     * Enumerate the EEBUS use cases the remote node advertises in
     * `NodeManagement.UseCaseData`. Call this before invoking any
     * {@link EebusUseCaseRegistry} client to verify the remote actually
     * implements the use case in the actor role you intend to use.
     * @param ski Subject Key Identifier of the remote node
     * @returns Array of supported use cases with actor, name, version, scenarios
     */
    getSupportedUseCases: (ski: string) => Promise<EebusUseCaseSupport[]>;

    /**
     * Remove an identity-change listener previously registered via
     * {@link onIdentityChanged}.
     * @param listenerId The ID returned by the registration method
     */
    removeListener: (listenerId: string) => void;
}
