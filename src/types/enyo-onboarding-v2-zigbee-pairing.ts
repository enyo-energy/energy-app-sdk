/**
 * Onboarding guide **v2 Zigbee pairing** — the host handing an energy app the
 * Zigbee devices an installer paired and confirmed, and taking back the
 * appliances the app made of them.
 *
 * The Zigbee counterpart of `./enyo-onboarding-v2-eebus-device-select.ts`. A
 * Zigbee device is addressed by its IEEE address, joins a network the host
 * opened rather than being discovered on the LAN, and what an app builds from it
 * depends on the endpoints and clusters its interview revealed — none of which a
 * network device or an EEBUS peer has.
 *
 * The block ({@link EnyoOnboardingV2ZigbeePairingBlock}) pairs on its own: the
 * host opens the network, the devices join and are interviewed, and the
 * installer confirms them before this request is raised. Registering is
 * optional. Without a handler the confirmed devices still join and belong to the
 * app, the run takes its `paired` branch, and no appliance is created.
 *
 * Pure type declarations (no runtime logic). Register the handler through
 * {@link EnergyAppOnboardingV2} (`../packages/energy-app-onboarding-v2.ts`).
 */

import type {EnyoZigbeeDevice} from './enyo-zigbee.js';

/**
 * One "the installer paired these Zigbee devices — make appliances of them"
 * request.
 *
 * Raised after the installer confirmed the joined devices on an
 * {@link EnyoOnboardingV2ZigbeePairingBlock} (or the host confirmed them because
 * {@link autoSelected}), so it is on the critical path of a screen someone is
 * waiting on.
 */
export interface EnyoOnboardingV2ZigbeePairingRequest {
    /** Correlates this request with its result. Unique per request. */
    requestId: string;
    /** The {@link EnyoOnboardingV2ZigbeePairingBlock.id} the pairing ran on. */
    blockId: string;
    /**
     * The {@link EnyoOnboardingV2Step.name} the block sits on, so an app can tell
     * two pairings apart in a guide that pairs more than once.
     */
    stepName: string;
    /**
     * The confirmed devices, already joined and interviewed, and already owned
     * by this app. At least one, at most the block's
     * {@link EnyoOnboardingV2ZigbeePairingBlock.maxDevices}.
     *
     * Check each device's
     * {@link EnyoZigbeeDevice.interviewState}: a device whose interview failed
     * may have incomplete endpoints.
     */
    devices: EnyoZigbeeDevice[];
    /**
     * The appliance the run is already bound to, when one exists.
     *
     * Always set on a run of an appliance-bound guide
     * ({@link EnyoOnboardingV2StartVariant.Maintenance},
     * {@link EnyoOnboardingV2StartVariant.OfflineReconnect}). On a reconnect run
     * this is the appliance whose device was lost — re-point its
     * {@link EnyoApplianceZigbeeMetadata.ieeeAddress} at the new device and
     * answer with this same id rather than creating a second appliance.
     */
    applianceId?: string;
    /**
     * The budget for this request, in milliseconds.
     *
     * The host owns the clock: once it is spent the host stops waiting and
     * continues as if no appliance had been produced. The handler is not
     * notified, so it must bound its own work — read what is needed to create
     * the appliance and configure reporting later, in the app's normal runtime.
     */
    timeoutMs: number;
    /**
     * `true` when the host confirmed the devices on the installer's behalf
     * because {@link EnyoOnboardingV2PickerBlockBase.autoSelectSingleMatch} was
     * left on and {@link EnyoOnboardingV2ZigbeePairingBlock.maxDevices} matching
     * devices had joined. Changes nothing about what the handler must do; it
     * exists for support logs.
     */
    autoSelected?: boolean;
}

/** An app's answer to one {@link EnyoOnboardingV2ZigbeePairingRequest}. */
export interface EnyoOnboardingV2ZigbeePairingResult {
    /** The {@link EnyoOnboardingV2ZigbeePairingRequest.requestId} this answers. */
    requestId: string;
    /**
     * The appliances the paired devices are now represented by — created just
     * now, or already existing and re-confirmed. The host binds the run to them.
     *
     * An empty array is a valid answer and means no appliance could be made. It
     * does **not** re-route the flow — the devices stay joined either way and
     * the run still takes the block's `paired` branch.
     */
    applianceIds: string[];
    /** Untranslated technical detail for support, e.g. why nothing was created. Not shown to users. */
    detail?: string;
}

/**
 * Handles the host's "make appliances of these Zigbee devices" requests.
 *
 * One handler serves every Zigbee pairing block the app's guides declare —
 * switch on {@link EnyoOnboardingV2ZigbeePairingRequest.blockId} (and
 * `stepName`) when the treatment differs, and on each device's model and
 * clusters when one guide can pair more than one kind of device.
 *
 * Throwing is treated the same as answering with no appliance ids: the devices
 * stay joined and the run continues on the block's `paired` branch, unbound.
 */
export type EnyoOnboardingV2ZigbeePairingHandler = (
    request: EnyoOnboardingV2ZigbeePairingRequest,
) => Promise<EnyoOnboardingV2ZigbeePairingResult>;
