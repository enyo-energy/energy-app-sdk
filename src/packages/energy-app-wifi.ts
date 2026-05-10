import {EnergyAppWifiSsid} from "../types/enyo-wifi.js";

/**
 * WiFi API for enyo packages.
 *
 * Provides discovery of WiFi networks (SSIDs) currently visible to the
 * device's WiFi adapter. All operations require the package to declare the
 * `Wifi` permission.
 *
 * @example
 * ```ts
 * const wifi = energyApp.useWifi();
 *
 * // Discover all known SSIDs that are currently in range
 * const knownNetworks = await wifi.getKnownSsids();
 * for (const network of knownNetworks) {
 *     console.log(`${network.ssid} @ ${network.rssi} dBm`);
 * }
 * ```
 */
export interface EnergyAppWifi {
    /**
     * Run a WiFi scan and return all known SSIDs that were discovered.
     *
     * "Known" means the network is currently saved on the device — i.e. the
     * device has previously joined it and credentials are stored. Networks
     * that are visible but not saved are not returned by this method.
     *
     * The scan is synchronous from the caller's perspective: the returned
     * promise resolves once the underlying WiFi stack has finished its
     * discovery sweep. Each call performs a fresh scan; results are not
     * cached between calls.
     *
     * @returns Promise resolving with the list of known SSIDs that were
     *          discovered during the scan. The list is empty when no known
     *          networks are currently in range.
     */
    getKnownSsids(): Promise<EnergyAppWifiSsid[]>;
}
