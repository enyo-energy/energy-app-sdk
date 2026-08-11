import {
    EnyoFirmwareDownloadUrl,
    EnyoFirmwareFileInfo,
    EnyoFirmwareFileQuery
} from '../types/enyo-firmware-registry.js';

/**
 * Interface for accessing the firmware files published with an Energy App
 * package.
 *
 * Firmware images are declared in the package definition
 * ({@link EnergyAppPackageDefinition.firmware}) as local file paths, uploaded by
 * the enyo CLI during `enyo release`, and exposed to the running app through
 * this API. The app never ships the bytes itself — it looks up the applicable
 * entry and requests a signed, time-limited URL that either it or the device
 * downloads.
 *
 * **Versions are opaque strings.** A `firmwareVersion` is whatever the vendor
 * calls it (`'2.4.1'`, `'2024-11-rc3'`, `'A7F2'`) and is never parsed, ordered
 * or compared beyond exact equality. The update order is therefore declared, not
 * computed, and which form it takes is set by the package's `firmwareMode`:
 *
 * - `'latest'` (default) — every device is offered the **last declared** entry
 *   for its model, whatever it currently runs. Declaration order is the order.
 * - `'dependent'` — each entry lists the versions it is installed for
 *   (`installForFirmwareVersion`), forming an upgrade graph that
 *   {@link getNextFirmware} walks one hop at a time.
 *
 * Access to this API requires the `FirmwareRegistry` permission
 * ({@link EnergyAppPermissionType}); {@link EnergyApp.useFirmwareRegistry}
 * throws when it has not been granted.
 *
 * @example
 * ```typescript
 * const registry = energyApp.useFirmwareRegistry();
 *
 * const next = await registry.getNextFirmware(device.reportedVersion, { modelName: 'AC-22-Pro' });
 * if (!next) return; // already up to date — the normal outcome
 *
 * const { url, sha256 } = await registry.requestDownloadUrl(next.fileId);
 * await device.installFirmware(url, sha256);
 * ```
 */
export interface EnergyAppFirmwareRegistry {
    /**
     * Resolves the single next firmware step for a device.
     *
     * Returns `undefined` when the device is already up to date. This is the
     * normal, non-error outcome and the common case, so treat it as "nothing to
     * do" rather than a failure.
     *
     * Under `firmwareMode: 'latest'` the last declared entry for the device's
     * model is returned, whatever `currentFirmwareVersion` is, until the device
     * already runs it.
     *
     * Under `'dependent'` the `currentFirmwareVersion` is matched by **exact
     * string equality** against the `installForFirmwareVersion` list of every
     * entry in scope. When it matches no declared entry, the one marked
     * `fallbackForUnknownVersion` is returned if the package declares one, and
     * `undefined` otherwise. The result is one hop, not the final destination:
     * after the device has installed the image and reports its new version, call
     * again to continue the chain — each hop is verified on the device before
     * the next one is offered. Use {@link getFirmwareUpdatePath} when you need
     * the whole chain up front.
     *
     * @param currentFirmwareVersion - The version currently installed on the
     *   device, as reported by the device itself. Matched verbatim.
     * @param query - Optional scoping; pass the device's `modelName` so only the
     *   edges declared for that model are followed.
     * @returns Promise resolving to the next firmware file, or `undefined` when
     *   the device is already up to date.
     * @throws {EnergyAppPermissionNotGrantedError} If the `FirmwareRegistry`
     *   permission is not granted.
     *
     * @example
     * ```typescript
     * const next = await registry.getNextFirmware('2024-11-rc3', { modelName: 'AC-22-Pro' });
     * console.log(next ? `Update to ${next.firmwareVersion}` : 'Up to date');
     * ```
     */
    getNextFirmware(
        currentFirmwareVersion: string,
        query?: EnyoFirmwareFileQuery
    ): Promise<EnyoFirmwareFileInfo | undefined>;

    /**
     * Resolves the complete chain of firmware steps from
     * `currentFirmwareVersion` to its terminal node, in the order they must be
     * applied.
     *
     * Equivalent to calling {@link getNextFirmware} repeatedly and collecting
     * the results, without installing anything in between. Returns an empty
     * array when the device is already up to date, and never more than one entry
     * under `firmwareMode: 'latest'`, where there is no chain to walk.
     *
     * Use it to tell the user how many updates are pending or to sum
     * `sizeBytes` before starting a long multi-step update.
     *
     * @param currentFirmwareVersion - The version currently installed on the
     *   device. Matched verbatim.
     * @param query - Optional scoping; pass the device's `modelName`.
     * @returns Promise resolving to the ordered chain of firmware files; empty
     *   when nothing is pending.
     * @throws {EnergyAppPermissionNotGrantedError} If the `FirmwareRegistry`
     *   permission is not granted.
     *
     * @example
     * ```typescript
     * const path = await registry.getFirmwareUpdatePath(current, { modelName: 'AC-22-Pro' });
     * const totalMb = path.reduce((sum, f) => sum + f.sizeBytes, 0) / 1_000_000;
     * console.log(`${path.length} updates pending, ${totalMb.toFixed(1)} MB`);
     * ```
     */
    getFirmwareUpdatePath(
        currentFirmwareVersion: string,
        query?: EnyoFirmwareFileQuery
    ): Promise<EnyoFirmwareFileInfo[]>;

    /**
     * Lists the firmware files published with this package.
     *
     * Returns metadata only — never file content. Useful for showing an
     * inventory of available images or for apps that pick an image by criteria
     * of their own (e.g. a forced re-flash of a specific version).
     *
     * @param query - Optional scoping by model.
     * @returns Promise resolving to the matching firmware entries, in the order
     *   they were declared in the package definition.
     * @throws {EnergyAppPermissionNotGrantedError} If the `FirmwareRegistry`
     *   permission is not granted.
     */
    listFirmwareFiles(query?: EnyoFirmwareFileQuery): Promise<EnyoFirmwareFileInfo[]>;

    /**
     * Retrieves a single firmware entry by the `fileId` it was declared under.
     *
     * @param fileId - The identifier from the package definition.
     * @returns Promise resolving to the entry, or `undefined` when no file with
     *   that ID is published with the installed package version.
     * @throws {EnergyAppPermissionNotGrantedError} If the `FirmwareRegistry`
     *   permission is not granted.
     */
    getFirmwareFile(fileId: string): Promise<EnyoFirmwareFileInfo | undefined>;

    /**
     * Requests a signed, time-limited public URL for downloading a firmware
     * file.
     *
     * The returned URL carries its own authorization, so it can be handed
     * directly to a device that fetches firmware over HTTP(S) itself, or used
     * with `fetch` to stream the image into the app.
     *
     * Request the URL at the moment of use and never cache or persist it: it
     * expires at {@link EnyoFirmwareDownloadUrl.expiresAt}, after which the
     * storage backend rejects it. Always verify the downloaded bytes against
     * the returned `sha256` before flashing.
     *
     * @param fileId - The identifier of the firmware file to download.
     * @param options - Optional settings. `ttlSeconds` requests a lifetime for
     *   the URL; it is a hint only — the host clamps it to its own bounds.
     * @returns Promise resolving to the signed URL together with its expiry,
     *   checksum and size.
     * @throws {EnergyAppPermissionNotGrantedError} If the `FirmwareRegistry`
     *   permission is not granted.
     * @throws {Error} If no firmware file with the given ID is published with
     *   the installed package version.
     *
     * @example
     * ```typescript
     * const download = await registry.requestDownloadUrl('wallbox-2-4-1', { ttlSeconds: 900 });
     * const response = await fetch(download.url);
     * ```
     */
    requestDownloadUrl(
        fileId: string,
        options?: {
            /**
             * Requested lifetime of the signed URL in seconds. A hint — the host
             * clamps it to its supported range (typically 15 minutes by
             * default, one hour at most).
             */
            ttlSeconds?: number;
        }
    ): Promise<EnyoFirmwareDownloadUrl>;
}
