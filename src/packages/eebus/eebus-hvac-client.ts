import {
    EebusHvacOperationMode,
    EebusHvacZoneState
} from '../../types/enyo-eebus-use-cases.js';

/**
 * Client for the EEBUS **Hvac** feature.
 *
 * The Hvac feature reports heating/cooling operation mode and per-zone state
 * (current temperature, active mode). Pair with the
 * {@link EebusSetpointClient} Setpoint feature to read or write target values.
 * Zone ids align with `Identification.identificationListData`, so callers can
 * map zone state to human-readable zone names.
 *
 * The client exposes both actor roles on a single interface:
 * - **EMS role (outbound):** {@link getOperationMode}, {@link setOperationMode},
 *   {@link getZoneStates}, {@link onZoneStateChanged}
 * - **CS role (inbound):** {@link provideOperationMode}, {@link provideZoneStates},
 *   {@link onOperationModeReceived}
 *
 * Consumers that only act in one role simply never call the other half — there
 * is no `asManager` / `asAppliance` split.
 */
export interface EebusHvacClient {
    // ─── EMS role (outbound) ─────────────────────────────────────────

    /**
     * Read the active heating/cooling operation mode from the remote node.
     */
    getOperationMode: () => Promise<EebusHvacOperationMode>;

    /**
     * Request the remote node to switch to the given operation mode. The
     * remote may reject modes it does not advertise — verify support via
     * `EebusIdentityService.getSupportedUseCases` before calling.
     * @param mode The operation mode to select on the remote
     */
    setOperationMode: (mode: EebusHvacOperationMode) => Promise<void>;

    /**
     * Read per-zone Hvac state (current temperature, active mode) from the
     * remote node.
     * @returns The state of each zone reported by the remote.
     */
    getZoneStates: () => Promise<EebusHvacZoneState[]>;

    /**
     * Subscribe to per-zone Hvac state updates. The listener fires once per
     * zone whenever the remote republishes its state.
     * @param listener Callback invoked with the updated zone state
     * @returns Listener ID that can be passed to {@link removeListener} to cancel
     */
    onZoneStateChanged: (
        listener: (state: EebusHvacZoneState) => void
    ) => string;

    // ─── CS role (inbound) ───────────────────────────────────────────

    /**
     * Register a provider that supplies this device's current operation mode
     * when a remote EMS reads it.
     * @param provider Async callback returning the active operation mode
     */
    provideOperationMode: (
        provider: () => Promise<EebusHvacOperationMode>
    ) => void;

    /**
     * Register a provider that supplies this device's current per-zone state
     * when a remote EMS reads it.
     * @param provider Async callback returning the current zone-state list
     */
    provideZoneStates: (
        provider: () => Promise<EebusHvacZoneState[]>
    ) => void;

    /**
     * Register a handler invoked when a remote EMS writes the operation mode
     * to this device. Implementations should apply the mode to the local
     * controller. Mirrors {@link EebusSetpointClient.onSetpointReceived} so
     * package authors see a consistent write-handler shape across features.
     * @param handler Callback invoked with the incoming operation mode
     * @returns Listener ID that can be passed to {@link removeListener} to deregister
     */
    onOperationModeReceived: (
        handler: (mode: EebusHvacOperationMode) => Promise<void>
    ) => string;

    /**
     * Remove a listener previously registered via {@link onZoneStateChanged}
     * or {@link onOperationModeReceived}.
     * @param listenerId The ID returned by the registration method
     */
    removeListener: (listenerId: string) => void;
}
