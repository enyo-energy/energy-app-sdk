import {SpineRemoteTarget} from '../../types/enyo-eebus.js';
import {
    EebusEvseManufacturerData,
    EebusEvseOperatingState,
} from '../../types/enyo-eebus-use-cases.js';
import {SpineEntityType} from '../../types/enyo-spine.js';

/**
 * Per-call configuration for {@link EebusUseCaseRegistry.evsecc}.
 *
 * Most wallboxes expose `DeviceClassification` + `DeviceDiagnosis` on
 * the EVSE entity. Multi-EVSE peers (e.g. dual-socket wallboxes) should
 * pin the client to a single EVSE via {@link address} or {@link prefer}.
 */
export interface EvseccClientOptions {
    /**
     * Bind the client to a specific entity (and optionally feature
     * index) on the remote. Wins over {@link prefer} when both are
     * supplied. Use
     * {@link EebusFeatureCatalog.findFeatureAddresses} with
     * `SpineFeatureType.DEVICE_CLASSIFICATION` /
     * `SpineFeatureType.DEVICE_DIAGNOSIS` to enumerate candidates.
     */
    address?: SpineRemoteTarget;
    /**
     * Resolution hint when {@link address} is omitted. Pin to
     * {@link SpineEntityType.EVSE} on multi-EVSE peers. `'auto'`
     * (default) keeps first-match behaviour.
     */
    prefer?: SpineEntityType | 'auto';
    /**
     * Override the internal description-list read timeout (default
     * 5_000 ms).
     */
    descriptionReadTimeoutMs?: number;
}

/**
 * Client for the EEBUS **EVSE Commissioning & Configuration (EVSECC)**
 * use case.
 *
 * EVSECC is read-only: the EMS reads the EVSE's manufacturer identity
 * and operating state. There is no write or "configure" path — the
 * "commissioning" in the name refers to the *commissioning step in the
 * EMS lifecycle*, not configuration of the EVSE itself.
 *
 * Resolution uses `DeviceClassification` (for the manufacturer data)
 * and `DeviceDiagnosis` (for the operating state and heartbeat) — both
 * present in the EEBUS library, so this client is fully wired
 * immediately (no missing-library throws).
 */
export interface EebusEvseccClient {
    /**
     * Read the EVSE's `DeviceClassification.ManufacturerData` — vendor /
     * model identifiers and revisions.
     */
    getEvseManufacturerData: () => Promise<EebusEvseManufacturerData>;

    /**
     * Read the EVSE's current `DeviceDiagnosis.StateData` and the
     * timestamp of the most recent `HeartbeatData`.
     */
    getEvseOperatingState: () => Promise<EebusEvseOperatingState>;

    /**
     * Subscribe to operating-state changes — the listener fires on every
     * inbound `DeviceDiagnosis.StateData` or `HeartbeatData` notify.
     * @param handler Callback invoked with each new operating-state snapshot.
     * @returns Listener ID that can be passed to {@link removeListener}.
     */
    onOperatingStateChanged: (
        handler: (state: EebusEvseOperatingState) => void,
    ) => string;

    /**
     * Remove a listener previously registered via
     * {@link onOperatingStateChanged}.
     */
    removeListener: (listenerId: string) => void;
}
