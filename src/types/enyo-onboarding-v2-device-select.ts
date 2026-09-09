/**
 * Onboarding guide **v2 device selection** — the host handing an energy app the
 * network devices an installer picked, and taking back the appliances the app
 * made of them.
 *
 * An {@link EnyoOnboardingV2DeviceSelectBlock} answers "which of these is
 * it?" and binds the run to the installer's pick. That binding is an
 * address, not an appliance: nothing in the system yet represents the device as
 * something the energy manager can read or control. This model closes that gap —
 * the app is asked to turn the picked device(s) into appliances and answer with
 * their ids, and the host binds the run to them so later steps have an
 * `applianceId` to work with.
 *
 * **Distinct from {@link EnyoDeviceTestHandler}, which stays the right tool when
 * the guide must branch.** A device test produces a verdict per device and an
 * aggregate outcome the graph routes on — the app decides whether the device is
 * usable. Here the installer already decided; there is no verdict, no branching,
 * and the handler's only job is to produce appliances. Reach for the device test
 * when "we could not use it" must lead somewhere different in the flow.
 *
 * Registering is optional. Without a handler the block still works: the run
 * takes its `selected` branch and stays bound to the device, and no appliance is
 * created.
 *
 * Pure type declarations (no runtime logic). Register the handler through
 * {@link EnergyAppOnboardingV2} (`../packages/energy-app-onboarding-v2.ts`).
 */

import type {EnyoNetworkDevice} from './enyo-network-device.js';

/**
 * One "the installer picked these — make appliances of them" request.
 *
 * Raised when an {@link EnyoOnboardingV2DeviceSelectBlock} completes, so it is
 * on the critical path of a screen someone is waiting on — including when the
 * block skipped its screen because only one device matched
 * ({@link autoSelected}).
 */
export interface EnyoOnboardingV2DeviceSelectRequest {
    /** Correlates this request with its result. Unique per request. */
    requestId: string;
    /** The {@link EnyoOnboardingV2DeviceSelectBlock.id} the pick was made on. */
    blockId: string;
    /**
     * The {@link EnyoOnboardingV2Step.name} the block sits on, so an app can tell
     * two picks apart in a guide that selects more than once, and so a log line
     * says where an empty answer came from.
     */
    stepName: string;
    /**
     * What the installer picked, as detected by the host. Never empty.
     *
     * An array because one pick can legitimately become several appliances — a
     * hybrid inverter is an inverter and a battery — and because a block that
     * later offers a multiple selection delivers here without a breaking change.
     * A single-pick block sends exactly one entry.
     */
    devices: EnyoNetworkDevice[];
    /**
     * The appliance the run is already bound to, when one exists.
     *
     * Always set on a run of an appliance-bound guide
     * ({@link EnyoOnboardingV2StartVariant.Maintenance},
     * {@link EnyoOnboardingV2StartVariant.OfflineReconnect}), and there it is an
     * instruction as much as context: a reconnect run is re-pointing *this*
     * appliance at the device the installer just picked, so the handler should
     * re-bind it and answer with this same id. Creating a second appliance for a
     * device the customer already has leaves them with a duplicate in the app and
     * a history split across two records.
     */
    applianceId?: string;
    /**
     * The budget for this request, in milliseconds.
     *
     * The host owns the clock: once it is spent the host stops waiting and
     * continues as if no appliance had been produced. The handler is not
     * notified, so it must bound its own work — cap socket timeouts and retries
     * so they fit inside the budget.
     */
    timeoutMs: number;
    /**
     * `true` when the host picked on the installer's behalf because exactly one
     * device matched the block's filter and
     * {@link EnyoOnboardingV2PickerBlockBase.autoSelectSingleMatch} was left on —
     * the screen was never rendered.
     *
     * Changes nothing about what the handler must do; the request is identical in
     * every other respect. It exists so a support log can say whether a human
     * confirmed this device or the system inferred it, which is the first
     * question asked when the wrong device turns out to be bound.
     */
    autoSelected?: boolean;
}

/**
 * An app's answer to one {@link EnyoOnboardingV2DeviceSelectRequest}.
 */
export interface EnyoOnboardingV2DeviceSelectResult {
    /** The {@link EnyoOnboardingV2DeviceSelectRequest.requestId} this answers. */
    requestId: string;
    /**
     * The appliances the picked device(s) are now represented by — created just
     * now, or already existing and re-confirmed. The host binds the run to them,
     * which is what fills `applianceId` for later dynamic and additional-setup
     * requests.
     *
     * Return the ids of appliances that already existed too. Omitting them
     * because the app did not create them in this call leaves the run unbound to
     * a device it can plainly see.
     *
     * An empty array is a valid answer and means no appliance could be made. It
     * does **not** re-route the flow — the run still takes the block's
     * `selected` branch. A guide that must go somewhere else in that case needs
     * an {@link EnyoOnboardingV2ActionKind.DeviceTest} block, whose verdict is a
     * routing handle.
     */
    applianceIds: string[];
    /** Untranslated technical detail for support, e.g. why nothing was created. Not shown to users. */
    detail?: string;
}

/**
 * Handles the host's "make appliances of these devices" requests.
 *
 * One handler serves every device-select block the app's guides declare —
 * switch on {@link EnyoOnboardingV2DeviceSelectRequest.blockId} (and `stepName`
 * where a block id repeats across guides) when the treatment differs.
 *
 * Throwing is treated the same as answering with no appliance ids: the run
 * continues on the block's `selected` branch, unbound. Creating an appliance is
 * a convenience the flow does not depend on, so a handler must never strand an
 * installer by failing loudly.
 */
export type EnyoOnboardingV2DeviceSelectHandler = (
    request: EnyoOnboardingV2DeviceSelectRequest,
) => Promise<EnyoOnboardingV2DeviceSelectResult>;
