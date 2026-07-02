import {
    EnyoFileRegistration,
    EnyoFileContentHandler,
    EnyoFileInfo
} from "../types/enyo-file.js";

/**
 * Interface for providing files to the user from within an Energy App package.
 *
 * A package registers files it can produce; the host renders each file's
 * translated name (and optional explanation) in its UI. The file's bytes are
 * NOT supplied at registration time — instead the package registers an
 * {@link EnyoFileContentHandler} that the host invokes lazily when the user
 * chooses to store/save the file. This allows large or expensive payloads
 * (reports, CSV/PDF exports, diagnostic bundles) to be generated on demand.
 *
 * Registration uses upsert semantics keyed by `fileId`: re-registering the same
 * `fileId` replaces both the translations and the content handler.
 *
 * Access to this API requires the `ProvidedFiles` permission
 * ({@link EnergyAppPermissionType}); {@link EnergyApp.useFiles} throws when it
 * has not been granted.
 */
export interface EnergyAppFile {
    /**
     * Registers a provided file with the host, or updates an existing one.
     *
     * Uses upsert logic based on `registration.fileId`: if a file with the same
     * ID is already registered it is replaced (both its translations and its
     * content handler); otherwise a new entry is created. The `handler` is
     * stored by the host and invoked later — once per store action — when the
     * user decides to save the file.
     *
     * @param registration - Descriptive metadata for the file: its `fileId`,
     *   translated `name`, optional translated `explanation`, and optional
     *   `applianceId` scoping.
     * @param handler - Callback invoked lazily by the host when the user stores
     *   the file; resolves to the file's base64 content, MIME type and concrete
     *   file name.
     * @returns Promise that resolves once the file has been registered with the
     *   host.
     * @throws {EnergyAppPermissionNotGrantedError} If the `ProvidedFiles`
     *   permission is not granted.
     *
     * @example
     * ```typescript
     * await file.registerFile(
     *     {
     *         fileId: 'monthly-charging-report',
     *         name: [
     *             { language: 'en', value: 'Monthly charging report' },
     *             { language: 'de', value: 'Monatlicher Ladebericht' }
     *         ],
     *         explanation: [
     *             { language: 'en', value: 'A PDF summary of this month\'s charging sessions.' },
     *             { language: 'de', value: 'Eine PDF-Zusammenfassung der Ladevorgänge dieses Monats.' }
     *         ]
     *     },
     *     async () => ({
     *         base64: await buildReportPdfBase64(),
     *         mimeType: 'application/pdf',
     *         fileName: 'charging-report-2026-07.pdf'
     *     })
     * );
     * ```
     */
    registerFile(
        registration: EnyoFileRegistration,
        handler: EnyoFileContentHandler
    ): Promise<void>;

    /**
     * Removes a previously registered provided file by its ID.
     *
     * After deregistration the host no longer shows the file and will not invoke
     * its content handler. If no file with the given ID is registered this
     * operation is a no-op.
     *
     * @param fileId - The identifier the file was registered under.
     * @returns Promise that resolves once the file has been removed.
     */
    deregisterFile(fileId: string): Promise<void>;

    /**
     * Retrieves all files currently registered by this package.
     *
     * Returns descriptive metadata only (ids, translated names and
     * explanations, optional appliance scoping); the file content is never
     * included and is always produced on demand via the registered handler.
     *
     * @returns Promise resolving to an array of registered file descriptors.
     *
     * @example
     * ```typescript
     * const files = await file.listFiles();
     * files.forEach(f => console.log(f.fileId));
     * ```
     */
    listFiles(): Promise<EnyoFileInfo[]>;
}
