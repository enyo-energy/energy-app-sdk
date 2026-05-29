import {SpineRemoteTarget} from '../../types/enyo-eebus.js';
import {
    EebusOhpcfAnnouncement,
    EebusOhpcfApplianceContext,
    EebusOhpcfFlavour,
    EebusOhpcfFlexibility,
    EebusOhpcfIncentiveTable,
    EebusOhpcfPlanState,
} from '../../types/enyo-eebus-use-cases.js';

/**
 * Per-call configuration for {@link EebusUseCaseRegistry.ohpcf}.
 *
 * On Vaillant peers — where OHPCF is layered on `SmartEnergyManagementPs`
 * and the feature lives on the `Compressor` sub-entity — pass
 * {@link address} (or `prefer`-equivalent: `flavour: 'smartEnergyManagementPs'`)
 * so the client targets the correct entity without falling back to raw
 * SPINE writes.
 */
export interface OhpcfClientOptions {
    /**
     * Pin the on-wire flavour. `'auto'` (the default) inspects the peer's
     * feature catalog and selects whichever flavour it advertises.
     */
    flavour?: EebusOhpcfFlavour;
    /**
     * Bind the client to a specific entity (and optionally feature
     * index). Required on multi-entity peers where the OHPCF-bearing
     * feature is hosted on more than one entity. Use
     * {@link EebusFeatureCatalog.findFeatureAddresses} with
     * `SpineFeatureType.INCENTIVE_TABLE` or
     * `SpineFeatureType.SMART_ENERGY_MANAGEMENT_PS` to enumerate
     * candidates.
     */
    address?: SpineRemoteTarget;
    /**
     * Override the internal description-list read timeout (default
     * 5_000 ms). Applies to the flavour-appropriate description function
     * (`incentiveDescriptionData` or
     * `smartEnergyManagementPsConfigurationData`).
     */
    descriptionReadTimeoutMs?: number;
}

/**
 * Client for the EEBUS **Optimization of Self Consumption by Heat Pump
 * Compressor Flexibility (OHPCF)** use case.
 *
 * OHPCF is an *incentive-driven* use case — the CEM (Customer Energy Manager)
 * sends a time-varying price/cost table; the heat pump schedules its
 * compressor to favour cheap or green windows without further coordination.
 * This is structurally different from LPC/LPP (which use LoadControl). The
 * CEM does not command the heat pump — it informs.
 *
 * The client exposes both actor roles on a single interface:
 * - **CEM role:** {@link sendIncentiveTable}, {@link getCurrentPlanState},
 *   {@link onFlexibilityUpdate}, {@link onAnnouncement}, {@link activateNow}
 * - **Heat Pump role:** {@link provideFlexibility}, {@link providePlanState},
 *   {@link onIncentiveTableReceived}
 *
 * **Flavours.** OHPCF ships in two interoperable encodings — the
 * canonical `IncentiveTable` flavour and Vaillant's
 * `SmartEnergyManagementPs` flavour. Pin the flavour via
 * {@link OhpcfClientOptions.flavour} when known, or rely on the default
 * `'auto'` to probe the feature catalog. Methods that are flavour-specific
 * are documented as such on each method.
 *
 * @see https://techdocs.wago.com/Software/EEBUS_Connector/en-US/3657311371.html
 * @see https://github.com/enbility/eebus-go/pull/122
 */
export interface EebusOhpcfClient {
    // ─── CEM role ────────────────────────────────────────────────────

    /**
     * Send an incentive table to the heat pump. The heat pump will use
     * the table to plan its compressor operation over the covered horizon.
     *
     * **Flavour:** `incentiveTable`. Throws on a client pinned to
     * `smartEnergyManagementPs` — use {@link activateNow} there instead.
     *
     * @param table The incentive table to send
     */
    sendIncentiveTable: (table: EebusOhpcfIncentiveTable) => Promise<void>;

    /**
     * Read the heat pump's current operational plan, generated in response
     * to the most recent incentive table.
     */
    getCurrentPlanState: () => Promise<EebusOhpcfPlanState>;

    /**
     * Subscribe to compressor flexibility updates from the heat pump.
     * Allows the CEM to track the operating band it can shift consumption within.
     * @param listener Callback invoked with each new flexibility report
     * @returns Listener ID that can be passed to {@link removeListener} to cancel
     */
    onFlexibilityUpdate: (
        listener: (flexibility: EebusOhpcfFlexibility) => void
    ) => string;

    /**
     * Subscribe to OHPCF announcements emitted by the heat pump. Each
     * announcement describes a planned consumption window the CEM may
     * activate via {@link activateNow}.
     *
     * **Flavour:** `smartEnergyManagementPs`. Returns a no-op listener
     * id on `incentiveTable` peers — those peers do not emit
     * announcements.
     *
     * @param listener Callback invoked with each new announcement
     * @returns Listener ID that can be passed to {@link removeListener} to cancel
     */
    onAnnouncement: (
        listener: (announcement: EebusOhpcfAnnouncement) => void
    ) => string;

    /**
     * Activate a previously-announced consumption window on the heat
     * pump. The heat pump starts the compressor under the parameters
     * carried in {@link EebusOhpcfApplianceContext}.
     *
     * **Flavour:** `smartEnergyManagementPs`. Throws on a client pinned
     * to `incentiveTable` — those peers schedule themselves from the
     * incentive table without an explicit activation.
     *
     * @param context Activation context (announcement id + optional overrides)
     */
    activateNow: (context: EebusOhpcfApplianceContext) => Promise<void>;

    // ─── Heat Pump role ──────────────────────────────────────────────

    /**
     * Register a provider that reports the heat pump's current compressor
     * flexibility when a remote CEM reads it.
     * @param provider Async callback returning the current flexibility report
     */
    provideFlexibility: (provider: () => Promise<EebusOhpcfFlexibility>) => void;

    /**
     * Register a provider that reports the heat pump's current operational
     * plan state when a remote CEM reads it.
     * @param provider Async callback returning the current plan state
     */
    providePlanState: (provider: () => Promise<EebusOhpcfPlanState>) => void;

    /**
     * Register a handler invoked when a remote CEM sends a new incentive table
     * to the heat pump.
     * @param handler Async callback invoked with the incoming incentive table
     * @returns Listener ID that can be passed to {@link removeListener} to deregister
     */
    onIncentiveTableReceived: (
        handler: (table: EebusOhpcfIncentiveTable) => Promise<void>
    ) => string;

    /**
     * Remove a listener or handler previously registered on this client.
     * @param listenerId The ID returned by the registration method
     */
    removeListener: (listenerId: string) => void;
}
