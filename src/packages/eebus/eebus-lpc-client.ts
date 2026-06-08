import {SpineRemoteTarget} from '../../types/enyo-eebus.js';
import {
    EebusLpcAck,
    EebusLpcFailsafe,
    EebusLpcLimit,
    EebusLpcLimitCategory,
    EebusLpcLimitDescriptor,
    EebusLpcLimitDirection,
    EebusLpcNack,
} from '../../types/enyo-eebus-use-cases.js';
import {SpineEntityType} from '../../types/enyo-spine.js';
import {EebusUseCaseClient} from './eebus-use-case-client.js';

/**
 * Options for {@link EebusLpcClient.findLimit} — used to disambiguate
 * peers that advertise more than one LoadControl limit slot.
 */
export interface FindLpcLimitOptions {
    /**
     * Limit direction to match — `'consume'` for LPC obligations on a
     * controllable load, `'produce'` for production limits on a
     * battery / inverter.
     */
    direction: EebusLpcLimitDirection;
    /**
     * Optional limit category to match. Omit to accept either category
     * (the resolver picks the first match it finds in description-list
     * order). Pin when the peer advertises both an obligation and a
     * recommendation in the same direction.
     */
    category?: EebusLpcLimitCategory;
}

/**
 * Options for {@link EebusLpcClient.findPerPhaseLimitIds} — used by EMS
 * code that needs to write per-phase limits (OPEV-style) over the
 * LoadControl feature.
 */
export interface FindPerPhaseLimitIdsOptions {
    /**
     * Limit category to match — see
     * {@link FindLpcLimitOptions.category}.
     */
    category: EebusLpcLimitCategory;
}

/**
 * Options for {@link EebusLpcClient.setConsumptionLimit}.
 */
export interface SetConsumptionLimitOptions {
    /**
     * When `true`, write the limit as a partial
     * `LoadControlLimitListData` payload (only the addressed limit slot,
     * not the full list). Some non-conformant firmwares — notably
     * Vaillant VR940 — reject the full-list write the spec mandates;
     * partial writes are the only way to push a limit there.
     *
     * Default `false` — the spec-conformant full-list write. Consumers
     * should gate `true` on
     * {@link EebusDeviceManagement.getPeerManufacturerData} so the
     * vendor sniff stays at the consumer boundary.
     */
    partial?: boolean;
}

/**
 * Per-call configuration for {@link EebusUseCaseRegistry.lpc}.
 *
 * On flat peers (a single controllable system per node) the defaults
 * resolve correctly. Multi-entity peers — notably heat pumps that host
 * `LoadControl` on both a top-level `HeatPumpAppliance` entity and an
 * inner controllable entity — should pin the client to the entity whose
 * limit semantics they want.
 */
export interface LpcClientOptions {
    /**
     * Bind the client to a specific entity (and optionally feature index)
     * on the remote. Wins over {@link prefer} when both are supplied.
     */
    address?: SpineRemoteTarget;
    /**
     * Resolution hint when {@link address} is omitted. `'auto'` (default)
     * keeps current first-match behaviour. Otherwise pin the resolver
     * to a {@link SpineEntityType} value — typically
     * {@link SpineEntityType.HM_HEAT_PUMP} for an appliance-level
     * `LoadControl` server.
     */
    prefer?: SpineEntityType | 'auto';
    /**
     * Override the internal `loadControlLimitDescriptionListData` read
     * timeout (default 5_000 ms).
     */
    descriptionReadTimeoutMs?: number;
}

/**
 * Client for the EEBUS **Limitation of Power Consumption (LPC)** use case.
 *
 * LPC is an *obligation*: when an Energy Management System (EMS) sends a limit,
 * the receiving Controllable System (CS) MUST respect it. Compare with
 * {@link EebusLppClient} which is a recommendation.
 *
 * The client exposes both actor roles on a single interface:
 * - **EMS role (outbound):** {@link setConsumptionLimit}, {@link setFailsafeLimit},
 *   {@link getActiveConsumptionLimit}, {@link getFailsafeLimit}
 * - **EMS role (inbound):** {@link onActiveConsumptionLimitChanged},
 *   {@link onConsumptionLimitNack}, {@link onFailsafeChanged}
 * - **CS role (inbound):** {@link onConsumptionLimitReceived},
 *   {@link provideFailsafeLimit}
 *
 * Consumers that only act in one role simply never call the other half — there is
 * no `asManager` / `asAppliance` split.
 *
 * **Acknowledgement semantics.** {@link setConsumptionLimit} resolves once
 * the SPINE write-ack lands — the CS has accepted the message into its
 * queue. That is *not* the same as the CS having applied the limit; for
 * the latter, subscribe to {@link onActiveConsumptionLimitChanged}.
 * Explicit rejections (limit out of permitted set, failsafe override
 * engaged, etc.) arrive via {@link onConsumptionLimitNack} so EMS code
 * does not have to poll {@link getActiveConsumptionLimit} to detect them.
 */
export interface EebusLpcClient extends EebusUseCaseClient {
    // ─── EMS role (outbound) ─────────────────────────────────────────

    /**
     * Send a consumption limit to the controllable system. The remote is
     * obligated to respect the limit until it expires, is replaced, or is
     * cleared by sending a limit with `isActive: false`.
     *
     * Resolves on the SPINE write-ack. See the class-level note for the
     * difference between "accepted" and "applied"; subscribe to
     * {@link onActiveConsumptionLimitChanged} and
     * {@link onConsumptionLimitNack} to observe the CS's downstream
     * decision.
     *
     * Pass `{ partial: true }` in {@link options} for peers that only
     * accept partial `LoadControlLimitListData` writes — currently
     * Vaillant VR940 firmware, which rejects the full-list write the
     * SPINE spec mandates. Default is a bare full-list write; consumers
     * should gate `partial: true` on
     * {@link EebusDeviceManagement.getPeerManufacturerData}.
     *
     * @param limit The consumption limit to apply
     * @param options Optional write-style configuration
     */
    setConsumptionLimit: (limit: EebusLpcLimit, options?: SetConsumptionLimitOptions) => Promise<void>;

    /**
     * Configure the controllable system's failsafe limit — the value it
     * falls back to when the SHIP connection to this EMS drops. The
     * canonical use case is §14a EnWG, where a grid-operator-acting
     * EMS pushes a 4.2 kW (or jurisdictional equivalent) floor and a
     * fall-back duration that survives transient disconnects.
     *
     * Resolves on the SPINE write-ack. To learn about subsequent
     * CS-side revisions (e.g. the CS rounds the value to its nearest
     * supported set-point), subscribe to {@link onFailsafeChanged}.
     *
     * @param failsafe The failsafe configuration to apply on the CS
     */
    setFailsafeLimit: (failsafe: EebusLpcFailsafe) => Promise<void>;

    /**
     * Read the consumption limit currently active on the controllable system,
     * if any. Useful for verifying that a previously-sent limit was applied,
     * or for synchronising on reconnect.
     * @returns The active limit, or `undefined` if no limit is currently active
     */
    getActiveConsumptionLimit: () => Promise<EebusLpcLimit | undefined>;

    /**
     * Read the failsafe limit the controllable system will fall back to if
     * it loses the connection to this EMS.
     */
    getFailsafeLimit: () => Promise<EebusLpcFailsafe>;

    // ─── EMS role (inbound) ──────────────────────────────────────────

    /**
     * Subscribe to changes in the *active* consumption limit reported by
     * the CS — fires on every inbound `loadControlLimitListData` notify.
     * The handler receives the new active limit, or `undefined` when the
     * CS clears the active limit (e.g. on expiry).
     *
     * Use this instead of polling {@link getActiveConsumptionLimit} after
     * a {@link setConsumptionLimit} call: the SPINE write-ack resolves
     * before the CS publishes its updated active state, so the polling
     * pattern races against the notify.
     *
     * @param handler Callback invoked with the new active limit (or `undefined`)
     * @returns Listener ID that can be passed to {@link removeListener}
     */
    onActiveConsumptionLimitChanged: (
        handler: (limit: EebusLpcLimit | undefined) => void
    ) => string;

    /**
     * Subscribe to explicit NACKs from the CS — fires when the CS
     * rejects a previously-sent limit with a reason (e.g. value
     * out-of-range, failsafe override active, command queue full).
     * Distinct from the SPINE write-ack that {@link setConsumptionLimit}
     * resolves on: a write-ack means "received", a NACK arrives as a
     * separate event when the CS subsequently decides not to honour
     * the limit.
     *
     * @param handler Callback invoked with the NACK payload
     * @returns Listener ID that can be passed to {@link removeListener}
     */
    onConsumptionLimitNack: (
        handler: (nack: EebusLpcNack) => void
    ) => string;

    /**
     * Subscribe to CS-published failsafe revisions — fires on every
     * inbound `deviceConfigurationKeyValueListData` notify carrying
     * a new failsafe value or duration. Allowed by the LPC UC TS as
     * a mid-session signal; consumers that only read the failsafe at
     * warm-up time will otherwise miss it.
     *
     * @param handler Callback invoked with the revised failsafe
     * @returns Listener ID that can be passed to {@link removeListener}
     */
    onFailsafeChanged: (
        handler: (failsafe: EebusLpcFailsafe) => void
    ) => string;

    // ─── CS role (inbound) ───────────────────────────────────────────

    /**
     * Register a handler invoked when a remote EMS sends a consumption limit
     * to this device. The handler MUST return an acknowledgement.
     * @param handler Callback invoked with the incoming limit; returns the ack
     * @returns Listener ID that can be passed to {@link removeListener} to deregister
     */
    onConsumptionLimitReceived: (
        handler: (limit: EebusLpcLimit) => Promise<EebusLpcAck>
    ) => string;

    /**
     * Register a provider that supplies this device's current failsafe limit
     * when a remote EMS reads it.
     * @param provider Async callback returning the current failsafe configuration
     */
    provideFailsafeLimit: (provider: () => Promise<EebusLpcFailsafe>) => void;

    /**
     * Remove a handler previously registered via {@link onConsumptionLimitReceived}.
     * @param listenerId The ID returned by the registration method
     */
    removeListener: (listenerId: string) => void;

    // ─── Description-list helpers (sync, cached) ─────────────────────

    /**
     * Resolve the descriptor for a LoadControl limit slot on the peer,
     * using the SDK's cached `loadControlLimitDescriptionListData`.
     * Synchronous; does not hit the wire.
     *
     * Returns the matching descriptor, or `undefined` when no slot on
     * the resolved entity satisfies the requested
     * {@link FindLpcLimitOptions.direction} (and, when supplied,
     * {@link FindLpcLimitOptions.category}). On peers that advertise
     * several matching slots the resolver returns the first one in
     * description-list order — consumers that need a different slot
     * should use {@link EebusFeatureCatalog.findFeatureAddressForClient}
     * + a per-slot enumeration.
     */
    findLimit: (opts: FindLpcLimitOptions) => EebusLpcLimitDescriptor | undefined;

    /**
     * Resolve the per-phase `limitId`s advertised by the peer for a
     * given limit {@link FindPerPhaseLimitIdsOptions.category}, in
     * phase order (L1, L2, L3). Used by EMS code that pushes per-phase
     * current limits over LoadControl (the OPEV / OSCEV path on
     * wallboxes that don't expose a dedicated OPEV feature).
     *
     * Returns `undefined` when the peer does not advertise per-phase
     * slots for the requested category. Synchronous; does not hit the
     * wire.
     */
    findPerPhaseLimitIds: (opts: FindPerPhaseLimitIdsOptions) => number[] | undefined;
}
