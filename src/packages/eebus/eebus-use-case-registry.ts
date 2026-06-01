import {CevcClientOptions, EebusCevcClient} from './eebus-cevc-client.js';
import {EebusEvccClient, EvccClientOptions} from './eebus-evcc-client.js';
import {EebusEvcemClient, EvcemClientOptions} from './eebus-evcem-client.js';
import {EebusEvseccClient, EvseccClientOptions} from './eebus-evsecc-client.js';
import {EebusEvsocClient, EvsocClientOptions} from './eebus-evsoc-client.js';
import {EebusHvacClient, HvacClientOptions} from './eebus-hvac-client.js';
import {EebusLpcClient, LpcClientOptions} from './eebus-lpc-client.js';
import {EebusLppClient} from './eebus-lpp-client.js';
import {EebusMgcpClient} from './eebus-mgcp-client.js';
import {EebusMpcClient, MpcClientOptions} from './eebus-mpc-client.js';
import {EebusOhpcfClient, OhpcfClientOptions} from './eebus-ohpcf-client.js';
import {EebusOpevClient, OpevClientOptions} from './eebus-opev-client.js';
import {EebusOscevClient, OscevClientOptions} from './eebus-oscev-client.js';
import {EebusSetpointClient, SetpointClientOptions} from './eebus-setpoint-client.js';
import {EebusVabdClient, VabdClientOptions} from './eebus-vabd-client.js';
import {EebusVapdClient, VapdClientOptions} from './eebus-vapd-client.js';

/**
 * Registry of typed EEBUS use-case clients, scoped per remote device (SKI).
 *
 * Each accessor returns a client interface that knows how to talk to the named
 * use case on the given remote node, in both actor roles. Adding a new use
 * case in the future is a mechanical change: add one type group to
 * `enyo-eebus-use-cases.ts`, one client interface file under `packages/eebus/`,
 * and one accessor here.
 *
 * Before invoking a use-case client, consider verifying that the remote
 * actually advertises support for it via
 * {@link EebusIdentityService.getSupportedUseCases}.
 *
 * @example
 * ```typescript
 * // Energy manager limits a wallbox to 11kW
 * await eebus.useCases.lpc(wallboxSki).setConsumptionLimit({
 *   value: 11000,
 *   isActive: true,
 * });
 *
 * // CEM streams grid-connection-point telemetry from the house meter
 * eebus.useCases.mgcp(meterSki).onReading(r => {
 *   chart.push({ t: r.timestamp, p: r.activePowerW });
 * });
 *
 * // CEM coordinates a heat pump via incentive table
 * await eebus.useCases.ohpcf(heatPumpSki).sendIncentiveTable({
 *   currency: 'EUR',
 *   unit: 'kWh',
 *   tiers: hourlyPriceTiers,
 * });
 * ```
 */
export interface EebusUseCaseRegistry {
    /**
     * Get the **Limitation of Power Consumption** client for a remote node.
     * LPC limits are obligations the remote MUST respect.
     *
     * Multi-entity peers (e.g. a heat pump that hosts `LoadControl` on
     * more than one entity) should pass {@link LpcClientOptions.address}
     * or {@link LpcClientOptions.prefer} to pin the client to a specific
     * entity. Omitting `options` keeps the existing first-match
     * behaviour.
     *
     * @param ski Subject Key Identifier of the remote node
     * @param options Optional address/timeout configuration
     */
    lpc: (ski: string, options?: LpcClientOptions) => EebusLpcClient;

    /**
     * Get the **Limitation of Power Production** client for a remote node.
     * LPP limits are recommendations the remote SHOULD respect.
     * @param ski Subject Key Identifier of the remote node
     */
    lpp: (ski: string) => EebusLppClient;

    /**
     * Get the **Monitoring of Grid Connection Point** client for a remote node.
     * Read-only telemetry from a smart meter / grid connection point.
     * @param ski Subject Key Identifier of the remote node
     */
    mgcp: (ski: string) => EebusMgcpClient;

    /**
     * Get the **Monitoring of Power Consumption** client for a remote node.
     * Read-only telemetry from a controllable system reporting its own consumption.
     *
     * Heat pumps that host `Measurement` on both `HeatPumpAppliance` and
     * `Compressor` should pass {@link MpcClientOptions.prefer} (or
     * {@link MpcClientOptions.address} when the address is already
     * known). Without a hint the client picks the first server match the
     * SDK resolves.
     *
     * The default options enable `fallbackToInlineScope`, so a single
     * slow `measurementDescriptionListData` read on a flaky peer no
     * longer silences the client — it falls back to extracting scope
     * from inbound notifies.
     *
     * @param ski Subject Key Identifier of the remote node
     * @param options Optional address/timeout/fallback configuration
     */
    mpc: (ski: string, options?: MpcClientOptions) => EebusMpcClient;

    /**
     * Get the **Optimization of Self Consumption by Heat Pump Compressor
     * Flexibility** client for a remote node. Incentive-table-driven heat
     * pump coordination.
     *
     * Two on-wire flavours exist (see {@link OhpcfClientOptions.flavour}):
     * `IncentiveTable` (canonical) and `SmartEnergyManagementPs`
     * (Vaillant). `auto` (the default) probes the feature catalog and
     * picks whichever the peer advertises.
     *
     * @param ski Subject Key Identifier of the remote node
     * @param options Optional address/flavour configuration
     */
    ohpcf: (ski: string, options?: OhpcfClientOptions) => EebusOhpcfClient;

    /**
     * Get the **Setpoint** client for a remote node. Manages target values
     * for controllable parameters such as per-zone heat-pump temperature
     * setpoints. Pair with {@link hvac} to read measured values.
     * @param ski Subject Key Identifier of the remote node
     * @param options Optional address/timeout configuration
     */
    setpoint: (ski: string, options?: SetpointClientOptions) => EebusSetpointClient;

    /**
     * Get the **Hvac** client for a remote node. Observes heating/cooling
     * operation mode and per-zone state on a heat-pump appliance. Pair with
     * {@link setpoint} to write target values.
     * @param ski Subject Key Identifier of the remote node
     * @param options Optional address/timeout configuration
     */
    hvac: (ski: string, options?: HvacClientOptions) => EebusHvacClient;

    /**
     * Get the **Controllable EV Charging (CEVC)** client for a remote
     * EV. Time-series-plan-driven; the most expressive EV control
     * surface. Requires ISO 15118 on the session.
     *
     * Method bodies throw `EebusFeatureUnavailableError` from the
     * `connect-core` runtime until `ElectricalConnectionClient` and
     * `TimeSeriesClient` land in `@enyo-energy/eebus`.
     *
     * @param ski Subject Key Identifier of the remote node
     * @param options Optional address/timeout configuration
     */
    cevc: (ski: string, options?: CevcClientOptions) => EebusCevcClient;

    /**
     * Get the **EV Commissioning & Configuration (EVCC)** client for a
     * remote EV. Surfaces EV identity, communication standard, and
     * asymmetric-charging support.
     *
     * Method bodies throw `EebusFeatureUnavailableError` from the
     * `connect-core` runtime until `IdentificationClient` and
     * `ElectricalConnectionClient` land in `@enyo-energy/eebus`.
     *
     * @param ski Subject Key Identifier of the remote node
     * @param options Optional address/timeout configuration
     */
    evcc: (ski: string, options?: EvccClientOptions) => EebusEvccClient;

    /**
     * Get the **Measurement of Electricity During EV Charging (EVCEM)**
     * client for a remote EV. Read-only per-phase power / current /
     * voltage and cumulative energy delivered.
     *
     * Method bodies throw `EebusFeatureUnavailableError` from the
     * `connect-core` runtime until `ElectricalConnectionClient` lands
     * in `@enyo-energy/eebus`.
     *
     * @param ski Subject Key Identifier of the remote node
     * @param options Optional address/timeout configuration
     */
    evcem: (ski: string, options?: EvcemClientOptions) => EebusEvcemClient;

    /**
     * Get the **EVSE Commissioning & Configuration (EVSECC)** client
     * for a remote EVSE. Read-only: vendor identity and operating
     * state from `DeviceClassification` + `DeviceDiagnosis`. Fully
     * wired immediately — does not depend on any pending
     * `@enyo-energy/eebus` prerequisite.
     *
     * @param ski Subject Key Identifier of the remote node
     * @param options Optional address/timeout configuration
     */
    evsecc: (ski: string, options?: EvseccClientOptions) => EebusEvseccClient;

    /**
     * Get the **EV State of Charge (EVSOC)** client for a remote EV.
     * Read-only; many vehicles do not publish their SoC over EEBUS, so
     * consumers should handle the "never arrives" case.
     *
     * Method bodies throw `EebusFeatureUnavailableError` from the
     * `connect-core` runtime until `ElectricalConnectionClient` lands
     * in `@enyo-energy/eebus`.
     *
     * @param ski Subject Key Identifier of the remote node
     * @param options Optional address/timeout configuration
     */
    evsoc: (ski: string, options?: EvsocClientOptions) => EebusEvsocClient;

    /**
     * Get the **Overload Protection by EV Charging Curtailment (OPEV)**
     * client for a remote EVSE. Per-phase current obligation
     * (grid-safety driven).
     *
     * Method bodies throw `EebusFeatureUnavailableError` from the
     * `connect-core` runtime until `ElectricalConnectionClient` lands
     * in `@enyo-energy/eebus`.
     *
     * @param ski Subject Key Identifier of the remote node
     * @param options Optional address/timeout configuration
     */
    opev: (ski: string, options?: OpevClientOptions) => EebusOpevClient;

    /**
     * Get the **Optimization of Self-Consumption During EV Charging
     * (OSCEV)** client for a remote EVSE. Per-phase current
     * recommendation (PV-optimisation driven).
     *
     * Method bodies throw `EebusFeatureUnavailableError` from the
     * `connect-core` runtime until `ElectricalConnectionClient` lands
     * in `@enyo-energy/eebus`.
     *
     * @param ski Subject Key Identifier of the remote node
     * @param options Optional address/timeout configuration
     */
    oscev: (ski: string, options?: OscevClientOptions) => EebusOscevClient;

    /**
     * Get the **Visualization of Aggregated Battery Data (VABD)**
     * client for a remote battery / home-storage system. Read-only
     * telemetry (power, SoC, nominal capacity).
     *
     * Method bodies throw `EebusFeatureUnavailableError` from the
     * `connect-core` runtime until `ElectricalConnectionClient` lands
     * in `@enyo-energy/eebus`.
     *
     * @param ski Subject Key Identifier of the remote node
     * @param options Optional address/timeout configuration
     */
    vabd: (ski: string, options?: VabdClientOptions) => EebusVabdClient;

    /**
     * Get the **Visualization of Aggregated PV Data (VAPD)** client
     * for a remote PV / solar-inverter system. Read-only telemetry
     * (active power, nominal peak).
     *
     * Method bodies throw `EebusFeatureUnavailableError` from the
     * `connect-core` runtime until `ElectricalConnectionClient` lands
     * in `@enyo-energy/eebus`.
     *
     * @param ski Subject Key Identifier of the remote node
     * @param options Optional address/timeout configuration
     */
    vapd: (ski: string, options?: VapdClientOptions) => EebusVapdClient;
}
