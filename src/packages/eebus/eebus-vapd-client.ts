import {SpineRemoteTarget} from '../../types/enyo-eebus.js';
import {EebusVapdTelemetry} from '../../types/enyo-eebus-use-cases.js';
import {SpineEntityType} from '../../types/enyo-spine.js';
import {EebusUseCaseClient} from './eebus-use-case-client.js';

/**
 * Per-call configuration for {@link EebusUseCaseRegistry.vapd}.
 */
export interface VapdClientOptions {
    address?: SpineRemoteTarget;
    /**
     * Resolution hint when {@link address} is omitted. Pin to
     * {@link SpineEntityType.SOLAR_INVERTER} or
     * {@link SpineEntityType.PV_STRING} depending on the peer's
     * advertised entity type.
     */
    prefer?: SpineEntityType | 'auto';
    descriptionReadTimeoutMs?: number;
}

/**
 * Client for the EEBUS **Visualization of Aggregated PV Data (VAPD)**
 * use case.
 *
 * VAPD is read-only telemetry from a PV / solar-inverter system:
 * current active production and nominal peak capacity. Used by an EMS
 * to render PV output in its UI.
 *
 * Backed by `ElectricalConnection` + `Measurement` + `DeviceConfiguration`
 * on the lib side.
 */
export interface EebusVapdClient extends EebusUseCaseClient {
    /**
     * Read the PV system's current active production in Watts.
     */
    getPvActivePowerW: () => Promise<number>;

    /**
     * Read the PV system's nominal peak power in Watts, if advertised.
     */
    getPvNominalPeakPowerW: () => Promise<number | undefined>;

    /**
     * Subscribe to consolidated PV telemetry updates.
     */
    onTelemetry: (handler: (telemetry: EebusVapdTelemetry) => void) => string;

    /**
     * Remove a listener previously registered via {@link onTelemetry}.
     */
    removeListener: (listenerId: string) => void;
}
