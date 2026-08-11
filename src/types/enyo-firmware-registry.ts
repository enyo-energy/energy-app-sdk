import type {EnyoFileTranslation} from './enyo-file.js';
import type {EnergyAppPackageFirmwareMode} from '../energy-app-package-definition.js';

/**
 * Runtime metadata for one firmware file published with an Energy App package.
 *
 * Returned by every read method of {@link EnergyAppFirmwareRegistry}. It never
 * contains the file's bytes — firmware images are large and are always fetched
 * out-of-band through a signed URL obtained from
 * {@link EnergyAppFirmwareRegistry.requestDownloadUrl}.
 *
 * The `firmwareVersion` field is an **opaque, vendor-defined string**. Neither
 * the SDK nor the host parses, orders or compares it beyond exact string
 * equality; the update order comes from the package's `firmwareMode` — either
 * declaration order (`'latest'`) or the explicit `installForFirmwareVersion`
 * edges (`'dependent'`).
 */
export interface EnyoFirmwareFileInfo {
    /** The identifier the file was declared under in the package definition. */
    fileId: string;
    /**
     * The firmware version this file installs, exactly as declared by the
     * package. An opaque string — only ever equality-matched, never ordered.
     */
    firmwareVersion: string;
    /**
     * The versions this file is installed for, as declared in the package
     * definition. Empty for a root entry that is never offered as an update to a
     * known version, and always empty under `firmwareMode: 'latest'`, where the
     * field carries no meaning.
     */
    installForFirmwareVersion: string[];
    /**
     * The resolution mode of the package this file belongs to, so an app can
     * tell whether it is walking a dependency chain or always being handed the
     * latest image.
     */
    firmwareMode: EnergyAppPackageFirmwareMode;
    /** Size of the uploaded file in bytes. */
    sizeBytes: number;
    /**
     * Lowercase hex SHA-256 checksum of the file content. Apps **must** verify
     * the downloaded bytes against this value before handing the image to a
     * device.
     */
    sha256: string;
    /** Concrete on-disk file name including extension, e.g. `wallbox-2.4.1.bin`. */
    fileName: string;
    /** IANA MIME type of the uploaded file, e.g. `application/octet-stream`. */
    mimeType: string;
    /** Vendor this firmware belongs to, when declared. */
    vendorName?: string;
    /**
     * Models this firmware applies to, when declared. An entry without models
     * applies to every model the package supports.
     */
    modelNames?: string[];
    /** Whether this entry is the fallback image for unknown current versions. */
    fallbackForUnknownVersion?: boolean;
    /** Translated release notes for this firmware version, when declared. */
    releaseNotes?: EnyoFileTranslation[];
    /** The package version this firmware file was released with. */
    packageVersion: number;
}

/**
 * Optional filter narrowing which firmware entries are considered.
 *
 * Resolution happens **within** the resulting scope, so passing a `modelName`
 * both filters the listing and restricts
 * {@link EnergyAppFirmwareRegistry.getNextFirmware} to the entries that apply to
 * that model — the edges it follows under `'dependent'`, or the pool it takes
 * the last declared entry from under `'latest'`.
 *
 * Omitting `modelName` considers every entry, which is only unambiguous for
 * packages that declare a single model chain — prefer passing the concrete
 * model of the device being updated.
 */
export interface EnyoFirmwareFileQuery {
    /**
     * Restrict to entries applying to this model. Matches entries whose
     * `modelNames` contains the value, plus entries that declare no
     * `modelNames` at all (which apply to every model).
     */
    modelName?: string;
}

/**
 * A time-limited, publicly reachable URL for downloading one firmware file.
 *
 * Obtained from {@link EnergyAppFirmwareRegistry.requestDownloadUrl}. The URL
 * carries its own authorization and can therefore be handed to a device that
 * fetches its firmware itself over plain HTTP(S).
 *
 * URLs expire — request one at the moment of use and never persist it. A URL
 * that outlives {@link expiresAt} returns an authorization error from the
 * storage backend, not the file.
 */
export interface EnyoFirmwareDownloadUrl {
    /** The file this URL points at. */
    fileId: string;
    /** The signed, time-limited download URL. */
    url: string;
    /**
     * Absolute expiry of {@link url} as epoch milliseconds. After this instant
     * the URL stops working and a new one must be requested.
     */
    expiresAt: number;
    /**
     * Lowercase hex SHA-256 of the file content, repeated here so a download
     * can be verified without a second lookup.
     */
    sha256: string;
    /** Size of the file in bytes, for progress reporting and space checks. */
    sizeBytes: number;
}
