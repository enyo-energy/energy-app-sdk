/**
 * Onboarding guide **v2 EEBUS device selection** — the host handing an energy
 * app the EEBUS peer an installer picked and paired, and taking back the
 * appliances the app made of it.
 *
 * The EEBUS counterpart of `./enyo-onboarding-v2-device-select.ts`, and the
 * split is deliberate: an EEBUS peer is not an {@link EnyoNetworkDevice}. It is
 * addressed by its **SKI** rather than by an IP address, it is trusted rather
 * than merely reachable, and what an app needs in order to build an appliance
 * from it — the SKI, the announced device type — has no counterpart in a network
 * device. One handler taking a union of the two would leave every
 * implementation branching on which half of its argument is populated.
 *
 * The block ({@link EnyoOnboardingV2EebusDeviceSelectBlock}) pairs the peer on
 * its own: the SHIP handshake happens before this request is raised, and a
 * handshake that never completes takes the block's `failure` branch without the
 * app hearing about it. What is left after a successful pairing is the same gap
 * device selection has — a trusted address is not something the energy manager
 * can read or control — and this model closes it.
 *
 * Registering is optional. Without a handler the block still works: the peer is
 * paired, the run takes its `paired` branch and stays bound to the SKI, and no
 * appliance is created.
 *
 * Pure type declarations (no runtime logic). Register the handler through
 * {@link EnergyAppOnboardingV2} (`../packages/energy-app-onboarding-v2.ts`).
 */

import type {EnyoEebusDeviceTypeEnum} from './enyo-eebus.js';

/**
 * The EEBUS peer an installer picked, as the host knows it at pairing time.
 *
 * A snapshot of the discovery record plus the pairing result — not a live
 * handle. Read the SKI and address the peer through the app's own EEBUS APIs for
 * anything beyond building an appliance.
 */
export interface EnyoOnboardingV2EebusPeer {
    /**
     * Subject Key Identifier — the peer's cryptographic identity, and the only
     * field guaranteed to be present and stable.
     *
     * This is what an appliance should be keyed on. A peer's name, model and
     * address all change over its life; the SKI changes only when the device is
     * factory-reset, which is exactly when a re-pairing is expected anyway.
     */
    ski: string;
    /** Human-readable name the peer advertised during discovery, if any. */
    deviceName?: string;
    /** Brand or model the peer advertised, if any. */
    deviceModel?: string;
    /**
     * The device type the peer announced, when it announced one this SDK knows.
     *
     * The same claim {@link EnyoOnboardingV2EebusDeviceSelectBlock.deviceTypes}
     * filters the picker by, passed on so a handler can build the right kind of
     * appliance without repeating the guide's filter. Absent means the peer
     * announced nothing usable — decide from the guide's own context rather than
     * assuming a default.
     */
    deviceType?: EnyoEebusDeviceTypeEnum;
    /** IP address or hostname the SHIP connection was made to. */
    host?: string;
    /** Port the SHIP connection was made to. */
    port?: number;
}

/**
 * One "the installer paired this peer — make appliances of it" request.
 *
 * Raised after the SHIP handshake succeeded on an
 * {@link EnyoOnboardingV2EebusDeviceSelectBlock}, so it is on the critical path
 * of a screen someone is waiting on — including when the block skipped its
 * screen because only one peer matched ({@link autoSelected}).
 */
export interface EnyoOnboardingV2EebusDeviceSelectRequest {
    /** Correlates this request with its result. Unique per request. */
    requestId: string;
    /**
     * The {@link EnyoOnboardingV2EebusDeviceSelectBlock.id} the pick was made on.
     */
    blockId: string;
    /**
     * The {@link EnyoOnboardingV2Step.name} the block sits on, so an app can tell
     * two picks apart in a guide that pairs more than once, and so a log line
     * says where an empty answer came from.
     */
    stepName: string;
    /**
     * The peer that was picked and paired. Exactly one — EEBUS pairing is a
     * per-peer trust decision, and an installer confirming two devices at once
     * is not a thing that happens.
     *
     * One peer may still become several appliances: a hybrid device announcing
     * one SKI can be an inverter and a battery, which is why the answer is a
     * list even though the request is not.
     */
    peer: EnyoOnboardingV2EebusPeer;
    /**
     * The appliance the run is already bound to, when one exists.
     *
     * Always set on a run of an appliance-bound guide
     * ({@link EnyoOnboardingV2StartVariant.Maintenance},
     * {@link EnyoOnboardingV2StartVariant.OfflineReconnect}). On a reconnect run
     * this is the appliance whose pairing was lost — re-point it at the new SKI
     * and answer with this same id rather than creating a second appliance for a
     * device the customer already has.
     */
    applianceId?: string;
    /**
     * The budget for this request, in milliseconds.
     *
     * The host owns the clock: once it is spent the host stops waiting and
     * continues as if no appliance had been produced. The handler is not
     * notified, so it must bound its own work. SPINE discovery against a
     * freshly paired peer is the usual reason this budget is missed — read what
     * is needed to create the appliance, and leave the rest to the app's normal
     * runtime.
     */
    timeoutMs: number;
    /**
     * `true` when the host paired on the installer's behalf because exactly one
     * peer matched the block's
     * {@link EnyoOnboardingV2EebusDeviceSelectBlock.deviceTypes} filter and
     * {@link EnyoOnboardingV2PickerBlockBase.autoSelectSingleMatch} was left on —
     * the screen was never rendered.
     *
     * Changes nothing about what the handler must do. It exists so a support log
     * can say whether a human confirmed this peer or the system inferred it,
     * which is the first question asked when the wrong device turns out to be
     * paired.
     */
    autoSelected?: boolean;
}

/**
 * An app's answer to one {@link EnyoOnboardingV2EebusDeviceSelectRequest}.
 */
export interface EnyoOnboardingV2EebusDeviceSelectResult {
    /**
     * The {@link EnyoOnboardingV2EebusDeviceSelectRequest.requestId} this answers.
     */
    requestId: string;
    /**
     * The appliances the paired peer is now represented by — created just now, or
     * already existing and re-confirmed. The host binds the run to them, which is
     * what fills `applianceId` for later dynamic and additional-setup requests.
     *
     * Return the ids of appliances that already existed too, and on a reconnect
     * run return the appliance the request came in with. Omitting an id because
     * the app did not create it in this call leaves the run unbound to a device
     * it has just been given the keys to.
     *
     * An empty array is a valid answer and means no appliance could be made. It
     * does **not** re-route the flow — the peer is paired either way and the run
     * still takes the block's `paired` branch. A guide that must go somewhere
     * else in that case needs an {@link EnyoOnboardingV2ActionKind.DeviceTest}
     * block after the pairing, whose verdict is a routing handle.
     */
    applianceIds: string[];
    /** Untranslated technical detail for support, e.g. why nothing was created. Not shown to users. */
    detail?: string;
}

/**
 * Handles the host's "make appliances of this EEBUS peer" requests.
 *
 * One handler serves every EEBUS picker block the app's guides declare — switch
 * on {@link EnyoOnboardingV2EebusDeviceSelectRequest.blockId} (and `stepName`
 * where a block id repeats across guides) when the treatment differs, and on
 * {@link EnyoOnboardingV2EebusPeer.deviceType} when one guide can pair more than
 * one kind of device.
 *
 * Throwing is treated the same as answering with no appliance ids: the peer
 * stays paired and the run continues on the block's `paired` branch, unbound.
 * Creating an appliance is a convenience the flow does not depend on, so a
 * handler must never strand an installer by failing loudly.
 */
export type EnyoOnboardingV2EebusDeviceSelectHandler = (
    request: EnyoOnboardingV2EebusDeviceSelectRequest,
) => Promise<EnyoOnboardingV2EebusDeviceSelectResult>;
