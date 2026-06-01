import {SpineRemoteTarget} from '../../types/enyo-eebus.js';
import {
    EebusCevcAck,
    EebusCevcChargingPlan,
    EebusOhpcfIncentiveTable,
} from '../../types/enyo-eebus-use-cases.js';
import {SpineEntityType} from '../../types/enyo-spine.js';
import {EebusUseCaseClient} from './eebus-use-case-client.js';

/**
 * Per-call configuration for {@link EebusUseCaseRegistry.cevc}.
 */
export interface CevcClientOptions {
    address?: SpineRemoteTarget;
    /**
     * Resolution hint when {@link address} is omitted. Pin to
     * {@link SpineEntityType.EV}.
     */
    prefer?: SpineEntityType | 'auto';
    descriptionReadTimeoutMs?: number;
}

/**
 * Client for the EEBUS **Controllable EV Charging (CEVC)** use case.
 *
 * CEVC is the most expressive EV control surface: an EMS pushes a
 * time-series charging plan (or an incentive table, reusing the OHPCF
 * encoding) and the EV / EVSE follows it. Requires ISO 15118 on the
 * session — basic IEC 61851 wallboxes cannot honour a CEVC plan.
 *
 * The client exposes both actor roles on a single interface:
 * - **EMS role:** {@link setTimeSeriesPlan},
 *   {@link getActiveChargingPlan}, {@link publishIncentiveTable},
 *   {@link onPlanUpdated}.
 * - **EV role:** {@link providePlan},
 *   {@link onTimeSeriesPlanReceived}.
 *
 * Backed by `ElectricalConnection` (already present) +
 * `IncentiveTable` (already present) + `TimeSeries` (pending) on the
 * lib side. {@link publishIncentiveTable} is wired immediately; the
 * `setTimeSeriesPlan` / `getActiveChargingPlan` / `onPlanUpdated` /
 * `providePlan` / `onTimeSeriesPlanReceived` paths throw
 * {@link EebusFeatureUnavailableError} from the `connect-core` runtime
 * until `TimeSeriesClient` lands in `@enyo-energy/eebus`.
 */
export interface EebusCevcClient extends EebusUseCaseClient {
    // ─── EMS role ────────────────────────────────────────────────────

    /**
     * Send a time-series charging plan to the EV. The EV ack carries
     * either acceptance or a reason for rejection (e.g. plan exceeds
     * vehicle's maximum charging power).
     *
     * @throws {EebusFeatureUnavailableError} Until `TimeSeriesClient`
     *          lands in `@enyo-energy/eebus`.
     */
    setTimeSeriesPlan: (plan: EebusCevcChargingPlan) => Promise<EebusCevcAck>;

    /**
     * Read the charging plan currently active on the EV, if any.
     *
     * @throws {EebusFeatureUnavailableError} Until `TimeSeriesClient`
     *          lands in `@enyo-energy/eebus`.
     */
    getActiveChargingPlan: () => Promise<EebusCevcChargingPlan | undefined>;

    /**
     * Publish an incentive table to the EV — the EV plans its own
     * charging from the price curve, analogous to the OHPCF flow on
     * heat pumps. Uses {@link EebusOhpcfIncentiveTable} verbatim.
     */
    publishIncentiveTable: (table: EebusOhpcfIncentiveTable) => Promise<void>;

    /**
     * Subscribe to plan-state updates published by the EV (e.g. revised
     * plan after the EV revised its capacity estimate).
     *
     * @throws {EebusFeatureUnavailableError} Until `TimeSeriesClient`
     *          lands in `@enyo-energy/eebus`.
     */
    onPlanUpdated: (handler: (plan: EebusCevcChargingPlan) => void) => string;

    // ─── EV role ─────────────────────────────────────────────────────

    /**
     * Register a provider that supplies the EV's current charging plan
     * when a remote EMS reads it.
     *
     * @throws {EebusFeatureUnavailableError} Until `TimeSeriesClient`
     *          lands in `@enyo-energy/eebus`.
     */
    providePlan: (provider: () => Promise<EebusCevcChargingPlan>) => void;

    /**
     * Register a handler invoked when a remote EMS pushes a time-series
     * plan to this EV. The handler MUST return an ack.
     *
     * @throws {EebusFeatureUnavailableError} Until `TimeSeriesClient`
     *          lands in `@enyo-energy/eebus`.
     */
    onTimeSeriesPlanReceived: (
        handler: (plan: EebusCevcChargingPlan) => Promise<EebusCevcAck>,
    ) => string;

    /**
     * Remove a listener or handler previously registered on this client.
     */
    removeListener: (listenerId: string) => void;
}
