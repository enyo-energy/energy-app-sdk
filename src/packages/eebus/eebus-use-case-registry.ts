import {EebusHvacClient} from './eebus-hvac-client.js';
import {EebusLpcClient} from './eebus-lpc-client.js';
import {EebusLppClient} from './eebus-lpp-client.js';
import {EebusMgcpClient} from './eebus-mgcp-client.js';
import {EebusMpcClient} from './eebus-mpc-client.js';
import {EebusOhpcfClient} from './eebus-ohpcf-client.js';
import {EebusSetpointClient} from './eebus-setpoint-client.js';

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
     * @param ski Subject Key Identifier of the remote node
     */
    lpc: (ski: string) => EebusLpcClient;

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
     * @param ski Subject Key Identifier of the remote node
     */
    mpc: (ski: string) => EebusMpcClient;

    /**
     * Get the **Optimization of Self Consumption by Heat Pump Compressor
     * Flexibility** client for a remote node. Incentive-table-driven heat
     * pump coordination.
     * @param ski Subject Key Identifier of the remote node
     */
    ohpcf: (ski: string) => EebusOhpcfClient;

    /**
     * Get the **Setpoint** client for a remote node. Manages target values
     * for controllable parameters such as per-zone heat-pump temperature
     * setpoints. Pair with {@link hvac} to read measured values.
     * @param ski Subject Key Identifier of the remote node
     */
    setpoint: (ski: string) => EebusSetpointClient;

    /**
     * Get the **Hvac** client for a remote node. Observes heating/cooling
     * operation mode and per-zone state on a heat-pump appliance. Pair with
     * {@link setpoint} to write target values.
     * @param ski Subject Key Identifier of the remote node
     */
    hvac: (ski: string) => EebusHvacClient;
}
