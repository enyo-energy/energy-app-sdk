import {SpineRemoteTarget} from '../../types/enyo-eebus.js';
import {
    EebusEvCommunicationStandardEnum,
    EebusEvConfigurationSnapshot,
    EebusEvConnectionState,
    EebusEvElectricalLimits,
    EebusEvIdentification,
} from '../../types/enyo-eebus-use-cases.js';
import {SpineEntityType} from '../../types/enyo-spine.js';
import {EebusUseCaseClient} from './eebus-use-case-client.js';

/**
 * Per-call configuration for {@link EebusUseCaseRegistry.evcc}.
 *
 * The EV is a sub-entity of the EVSE on most wallboxes — multi-EVSE
 * peers (dual-socket wallboxes) host one EV entity per EVSE. Pin via
 * {@link address} or {@link prefer} = {@link SpineEntityType.EV}.
 */
export interface EvccClientOptions {
    address?: SpineRemoteTarget;
    /**
     * Resolution hint when {@link address} is omitted. Pin to
     * {@link SpineEntityType.EV}.
     */
    prefer?: SpineEntityType | 'auto';
    descriptionReadTimeoutMs?: number;
}

/**
 * Client for the EEBUS **EV Commissioning & Configuration (EVCC)** use
 * case.
 *
 * EVCC surfaces EV-side identity and capabilities — the vehicle's EVCCID,
 * the communication standard it negotiated with the EVSE, and whether
 * it supports asymmetric (per-phase) charging. Used by an EMS to (a)
 * render the connected vehicle in its UI and (b) decide whether higher
 * UCs (CEVC needs ISO 15118, OPEV / OSCEV need at least asymmetric
 * support to be useful per-phase) are even relevant on this session.
 *
 * Backed by `Identification` + `ElectricalConnection` +
 * `DeviceClassification` + `DeviceDiagnosis` on the lib side.
 */
export interface EebusEvccClient extends EebusUseCaseClient {
    /**
     * Read the EV's identification (EVCCID and identification type).
     * Returns `undefined` when the EV does not publish an
     * `Identification` server feature.
     */
    getEvIdentification: () => Promise<EebusEvIdentification | undefined>;

    /**
     * Read the communication standard negotiated between the EV and the
     * EVSE for the current session.
     */
    getEvCommunicationStandard: () => Promise<EebusEvCommunicationStandardEnum>;

    /**
     * Read whether the EV supports asymmetric (per-phase) charging.
     */
    getEvAsymmetricChargingSupport: () => Promise<boolean>;

    /**
     * Return the most recent EV identification (EVCCID + identification
     * type) the SDK has observed on this peer, without dispatching a
     * wire read. Resolves from the lib's cached snapshot —
     * side-effect-free.
     *
     * Resolves to `undefined` until the first `identificationListData`
     * notify has landed.
     */
    getLastEvIdentification: () => Promise<EebusEvIdentification | undefined>;

    /**
     * Return the most recent `DeviceConfiguration.keyValueListData`
     * snapshot the SDK has observed on this peer. Surfaces every
     * configuration key the EV advertises with its current value;
     * consumers that only need a specific key can use
     * {@link getCommunicationStandard} or
     * {@link supportsAsymmetricCharging} which already narrow the
     * lookup.
     *
     * Resolves to `undefined` until the first notify has landed.
     */
    getLastEvConfiguration: () => Promise<EebusEvConfigurationSnapshot | undefined>;

    /**
     * Return the most recent EV electrical permitted-value snapshot the
     * SDK has observed on this peer — per-phase minimum / maximum
     * current and total power the EV reports as allowable.
     *
     * Resolves to `undefined` until the first
     * `permittedValueSetListData` notify has landed.
     */
    getLastEvElectricalLimits: () => Promise<EebusEvElectricalLimits | undefined>;

    /**
     * Read the EV's negotiated communication standard from the cached
     * configuration snapshot — `'IEC61851'`, `'ISO15118-2'`,
     * `'ISO15118-20'`, etc. Resolves from the lib's cached snapshot;
     * does not hit the wire.
     *
     * Distinct from {@link getEvCommunicationStandard} which returns
     * the typed enum — this getter returns the raw wire string for
     * vendor-specific values the enum doesn't cover, and `undefined`
     * when the key is not yet cached.
     */
    getCommunicationStandard: () => Promise<string | undefined>;

    /**
     * Read whether the EV advertises asymmetric (per-phase) charging
     * support from the cached configuration snapshot. Resolves from the
     * lib's cached snapshot; does not hit the wire.
     *
     * Resolves to `undefined` when the key is not yet cached (handshake
     * still in progress, or the EV does not publish the key at all).
     * Callers that need a boolean-only answer should treat `undefined`
     * as `false` only after {@link ready} reports the client is bound.
     */
    supportsAsymmetricCharging: () => Promise<boolean | undefined>;

    /**
     * Subscribe to EV-connect events (vehicle plugged in).
     */
    onEvConnected: (
        handler: (state: EebusEvConnectionState) => void,
    ) => string;

    /**
     * Subscribe to EV-disconnect events (vehicle unplugged).
     */
    onEvDisconnected: (
        handler: (state: EebusEvConnectionState) => void,
    ) => string;

    /**
     * Remove a listener previously registered on this client.
     */
    removeListener: (listenerId: string) => void;
}
