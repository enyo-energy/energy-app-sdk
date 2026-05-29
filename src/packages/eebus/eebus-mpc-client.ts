import {SpineRemoteTarget} from '../../types/enyo-eebus.js';
import {EebusMpcReading} from '../../types/enyo-eebus-use-cases.js';
import {SpineEntityType} from '../../types/enyo-spine.js';

/**
 * Per-call configuration for {@link EebusUseCaseRegistry.mpc}.
 *
 * Heat pumps frequently expose `Measurement` (server) on more than one
 * entity — typically both the `HeatPumpAppliance` (whole-appliance
 * roll-up) and the `Compressor` (compressor-only draw). Without targeting
 * the SDK resolves the first match it encounters, which has historically
 * meant consumers silently picked up the wrong vantage point. These
 * options give the caller direct control.
 */
export interface MpcClientOptions {
    /**
     * Bind the client to a specific entity (and optionally feature index)
     * on the remote. Wins over {@link prefer} when both are supplied.
     * Use {@link EebusFeatureCatalog.findFeatureAddresses} to enumerate
     * candidates.
     */
    address?: SpineRemoteTarget;
    /**
     * Resolution hint when {@link address} is omitted. `'auto'` (the
     * default) keeps current behaviour — first match wins. Otherwise
     * pin the resolver to a {@link SpineEntityType} value — most
     * commonly {@link SpineEntityType.HM_COMPRESSOR} or
     * {@link SpineEntityType.HM_HEAT_PUMP} on heat-pump peers.
     */
    prefer?: SpineEntityType | 'auto';
    /**
     * Override the internal `measurementDescriptionListData` read timeout
     * (default 5_000 ms). Useful for peers whose description-list reply is
     * sluggish but functional — extend rather than disable.
     */
    descriptionReadTimeoutMs?: number;
    /**
     * When the internal description read fails (timeout or
     * not-supported), fall back to extracting `scopeType` from each
     * inbound notify (`acPowerTotal` → {@link EebusMpcReading.activePowerW},
     * `acEnergyConsumed` → {@link EebusMpcReading.totalEnergyConsumedWh})
     * so the client keeps emitting readings instead of going silent.
     * Defaults to `true`.
     */
    fallbackToInlineScope?: boolean;
}

/**
 * Client for the EEBUS **Monitoring of Power Consumption (MPC)** use case.
 *
 * MPC is read-only telemetry from a controllable system reporting its own
 * power consumption to the EMS.
 *
 * The client exposes both actor roles on a single interface:
 * - **EMS role (consume):** {@link getReading}, {@link onReading}
 * - **CS role (provide):** {@link provideReading}
 *
 * **Resolution.** From SDK 0.0.139 onward this client resolves the remote
 * `Measurement` feature via the SPINE feature catalog rather than via the
 * peer's advertised `monitoringOfPowerConsumption` use-case entry. Many
 * non-certified peers (notably Vaillant heat pumps) expose the feature
 * without advertising the use case; the previous resolution path silently
 * no-op'd on them. The client now only throws
 * `EebusFeatureUnavailableError` when no `Measurement` server feature
 * exists at all on the peer.
 */
export interface EebusMpcClient {
    // ─── EMS role (consume) ──────────────────────────────────────────

    /**
     * Read the latest consumption telemetry from the controllable system.
     */
    getReading: () => Promise<EebusMpcReading>;

    /**
     * Subscribe to updates whenever the controllable system publishes new telemetry.
     * @param listener Callback invoked with each new reading
     * @returns Listener ID that can be passed to {@link removeListener} to cancel
     */
    onReading: (listener: (reading: EebusMpcReading) => void) => string;

    // ─── CS role (provide) ───────────────────────────────────────────

    /**
     * Register a provider that supplies the current consumption reading
     * when a remote EMS reads it.
     * @param provider Async callback returning the current reading
     */
    provideReading: (provider: () => Promise<EebusMpcReading>) => void;

    /**
     * Remove a listener previously registered via {@link onReading}.
     * @param listenerId The ID returned by the registration method
     */
    removeListener: (listenerId: string) => void;
}
