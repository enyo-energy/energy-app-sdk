import {EnergyAppPackageLanguage} from "../energy-app-package-definition.js";

/**
 * A translated, human-readable string used when presenting a provided file to
 * the user (e.g. its display name or explanation).
 *
 * Mirrors the translation shape used elsewhere in the SDK (see
 * {@link EnyoPackageConfigurationTranslatedValue}): the host picks the entry
 * whose {@link language} matches the active UI language, falling back to another
 * available language when no exact match exists.
 */
export interface EnyoFileTranslation {
    /** Language code this translation applies to. */
    language: EnergyAppPackageLanguage;
    /** The displayed text in the given language. */
    value: string;
}

/**
 * The concrete, on-demand content of a provided file.
 *
 * Produced by an {@link EnyoFileContentHandler} at the moment the user chooses
 * to store the file. The payload is transferred as a base64-encoded string so
 * that arbitrary binary content (PDF, ZIP, images, ...) can cross the app/host
 * boundary safely.
 */
export interface EnyoFileContent {
    /**
     * File payload, base64-encoded. For text formats this is the base64 of the
     * UTF-8 bytes; for binary formats the base64 of the raw bytes. Must NOT
     * include a `data:` URI prefix.
     */
    base64: string;
    /**
     * IANA MIME type describing the payload, e.g. `application/pdf`,
     * `text/csv`, `application/zip`. Used by the host to choose which
     * application opens the file and to set download headers.
     */
    mimeType: string;
    /**
     * Concrete file name including extension used when the file is written to
     * disk, e.g. `charging-report-2026-07.pdf`. This is the technical on-disk
     * file name and is distinct from the translated display name shown in the
     * UI (see {@link EnyoFileRegistration.name}).
     */
    fileName: string;
}

/**
 * Handler invoked by the host when the user chooses to store/save a previously
 * registered provided file.
 *
 * The handler is called lazily — content is produced on demand rather than at
 * registration time — which lets the app generate large or expensive payloads
 * (reports, exports, log bundles) only when actually requested. The returned
 * promise must resolve to the file's {@link EnyoFileContent}; rejecting it
 * signals to the host that the content could not be produced and that the store
 * action should fail gracefully.
 *
 * @returns A promise resolving to the file's base64 content, MIME type and
 *   concrete file name.
 */
export type EnyoFileContentHandler = () => Promise<EnyoFileContent>;

/**
 * Registration payload describing a file the app offers to the user.
 *
 * The translated {@link name} (and optional {@link explanation}) are stored by
 * the host and shown in the UI without the app needing to ship per-host UI
 * strings. The actual bytes are supplied later by the
 * {@link EnyoFileContentHandler} passed alongside this registration to
 * {@link EnergyAppFile.registerFile}.
 */
export interface EnyoFileRegistration {
    /**
     * Stable, app-chosen identifier for this file. Used for upsert semantics on
     * {@link EnergyAppFile.registerFile} and as the key for
     * {@link EnergyAppFile.deregisterFile}. Must be unique within the package.
     */
    fileId: string;
    /** Translated display name shown to the user in the host UI. */
    name: EnyoFileTranslation[];
    /**
     * Optional translated explanation giving the user more context about what
     * the file contains and why they might want to store it.
     */
    explanation?: EnyoFileTranslation[];
    /**
     * Optional appliance ID scoping this file to a specific appliance. When
     * set, the host may surface the file on that appliance's screen; when
     * omitted the file is treated as package-level.
     */
    applianceId?: string;
}

/**
 * Read-only view of a currently registered provided file, as returned by
 * {@link EnergyAppFile.listFiles}.
 *
 * Contains only the descriptive metadata registered by the app — never the file
 * content itself, which is always produced on demand via the registered
 * {@link EnyoFileContentHandler}.
 */
export interface EnyoFileInfo {
    /** Identifier the file was registered under. */
    fileId: string;
    /** Translated display name shown to the user. */
    name: EnyoFileTranslation[];
    /** Optional translated explanation shown alongside the name. */
    explanation?: EnyoFileTranslation[];
    /** Optional appliance ID this file is scoped to, if any. */
    applianceId?: string;
}
