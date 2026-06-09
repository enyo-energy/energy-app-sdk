import {EebusMgcpReading} from '../../types/enyo-eebus-use-cases.js';
import {EebusUseCaseClient} from './eebus-use-case-client.js';

/**
 * Client for the EEBUS **Monitoring of Grid Connection Point (MGCP)** use case.
 *
 * MGCP is read-only telemetry from a smart meter / grid connection point.
 * The CEM (Customer Energy Manager) actor consumes the readings; the GCP
 * (Grid Connection Point) actor provides them.
 *
 * The client exposes both actor roles on a single interface:
 * - **CEM role (consume):** {@link getReading}, {@link onReading}
 * - **GCP role (provide):** {@link provideReading}
 */
export interface EebusMgcpClient extends EebusUseCaseClient {
    // ─── CEM role (consume) ──────────────────────────────────────────

    /**
     * Read the latest telemetry from the grid connection point.
     */
    getReading: () => Promise<EebusMgcpReading>;

    /**
     * Return the most recent reading the SDK has observed on this peer
     * without dispatching a wire read. Resolves from the lib's cached
     * snapshot — side-effect-free.
     *
     * Resolves to `undefined` until the first inbound notify lands.
     * Subsequent notifies update the snapshot — callers that only need
     * to poll the latest value can drop their {@link onReading}
     * subscription in favour of this getter.
     */
    getLastReading: () => Promise<EebusMgcpReading | undefined>;

    /**
     * Subscribe to updates whenever the grid connection point publishes new telemetry.
     * @param listener Callback invoked with each new reading
     * @returns Listener ID that can be passed to {@link removeListener} to cancel
     */
    onReading: (listener: (reading: EebusMgcpReading) => void) => string;

    // ─── GCP role (provide) ──────────────────────────────────────────

    /**
     * Register a provider that supplies the current grid connection point reading
     * when a remote CEM reads it.
     * @param provider Async callback returning the current reading
     */
    provideReading: (provider: () => Promise<EebusMgcpReading>) => void;

    /**
     * Remove a listener previously registered via {@link onReading}.
     * @param listenerId The ID returned by the registration method
     */
    removeListener: (listenerId: string) => void;
}
