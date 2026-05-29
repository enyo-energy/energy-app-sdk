import {SpineRemoteTarget} from '../../types/enyo-eebus.js';
import {EebusSetpointValue} from '../../types/enyo-eebus-use-cases.js';
import {SpineEntityType} from '../../types/enyo-spine.js';

/**
 * Per-call configuration for {@link EebusUseCaseRegistry.setpoint}.
 *
 * Heat pumps expose `Setpoint` on the entity that owns the zone — most
 * commonly `HVACRoom`, occasionally `HeatingZone`. The default resolution
 * scans the catalog and picks the first match. Pin the target via
 * {@link address} or {@link prefer} when the peer hosts multiple
 * candidates.
 */
export interface SetpointClientOptions {
    /**
     * Bind the client to a specific entity (and optionally feature index)
     * on the remote. Wins over {@link prefer} when both are supplied.
     */
    address?: SpineRemoteTarget;
    /**
     * Resolution hint when {@link address} is omitted. Pin to a
     * {@link SpineEntityType} value — typically
     * {@link SpineEntityType.HVAC_ROOM} or
     * {@link SpineEntityType.HEATING_ZONE} on a multi-zone heat pump.
     */
    prefer?: SpineEntityType | 'auto';
    /**
     * Override the internal `setpointDescriptionListData` read timeout
     * (default 5_000 ms).
     */
    descriptionReadTimeoutMs?: number;
}

/**
 * Client for the EEBUS **Setpoint** feature.
 *
 * The Setpoint feature carries the target value(s) of a controllable
 * parameter on a remote node — most commonly the per-zone target temperature
 * on a heat pump (paired with the {@link EebusHvacClient} Hvac feature for
 * measured values). Setpoint ids align with the zone ids reported by
 * `Identification.identificationListData`, so callers can map setpoints to
 * human-readable zone names.
 *
 * The client exposes both actor roles on a single interface:
 * - **EMS role (outbound):** {@link getSetpoints}, {@link setSetpoint},
 *   {@link onSetpointsChanged}
 * - **CS role (inbound):** {@link provideSetpoints}, {@link onSetpointReceived}
 *
 * Consumers that only act in one role simply never call the other half — there
 * is no `asManager` / `asAppliance` split.
 *
 * **Resolution.** The client resolves the remote `Setpoint` feature via
 * the SPINE feature catalog rather than the peer's
 * `NodeManagement.UseCaseData` advertisement. Peers that expose `Setpoint`
 * without advertising a matching use case (e.g. Vaillant VR940) are now
 * supported. `EebusFeatureUnavailableError` is thrown only when no
 * `Setpoint` server feature exists on the peer at all.
 */
export interface EebusSetpointClient {
    // ─── EMS role (outbound) ─────────────────────────────────────────

    /**
     * Read the current setpoints reported by the remote node.
     * @returns The full list of setpoints currently published by the remote.
     */
    getSetpoints: () => Promise<EebusSetpointValue[]>;

    /**
     * Send a setpoint to the remote node. The remote applies the value to the
     * setpoint identified by {@link EebusSetpointValue.setpointId}; existing
     * setpoints at other ids are left unchanged.
     * @param value The setpoint to apply
     */
    setSetpoint: (value: EebusSetpointValue) => Promise<void>;

    /**
     * Subscribe to setpoint-list updates from the remote node. The listener is
     * invoked with the full current list whenever the remote republishes.
     * @param listener Callback invoked with the new setpoint list
     * @returns Listener ID that can be passed to {@link removeListener} to cancel
     */
    onSetpointsChanged: (
        listener: (values: EebusSetpointValue[]) => void
    ) => string;

    // ─── CS role (inbound) ───────────────────────────────────────────

    /**
     * Register a provider that supplies this device's current setpoints when a
     * remote EMS reads them.
     * @param provider Async callback returning the current setpoint list
     */
    provideSetpoints: (provider: () => Promise<EebusSetpointValue[]>) => void;

    /**
     * Register a handler invoked when a remote EMS writes a setpoint to this
     * device. Implementations should apply the value to the local controller.
     * @param handler Callback invoked with the incoming setpoint
     * @returns Listener ID that can be passed to {@link removeListener} to deregister
     */
    onSetpointReceived: (
        handler: (value: EebusSetpointValue) => Promise<void>
    ) => string;

    /**
     * Remove a listener previously registered via {@link onSetpointsChanged} or
     * {@link onSetpointReceived}.
     * @param listenerId The ID returned by the registration method
     */
    removeListener: (listenerId: string) => void;
}
