import {SpineRemoteTarget} from '../../types/enyo-eebus.js';
import {
    EebusEvCommunicationStandardEnum,
    EebusEvConnectionState,
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
