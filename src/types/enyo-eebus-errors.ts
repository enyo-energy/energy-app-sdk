import {SpineFeatureType, SpineFunctionType} from './enyo-spine.js';

/**
 * Typed errors thrown by the EEBUS surface — the typed use-case clients
 * ({@link EebusUseCaseRegistry}), the feature catalog
 * ({@link EebusFeatureCatalog}), and the low-level SPINE escape hatch
 * ({@link EebusSpineLowLevel}).
 *
 * The classes here exist so vendor packages can classify failures via
 * `instanceof` instead of pattern-matching on `error.message`. Error
 * messages are best-effort human-readable strings; their wording is *not*
 * part of the SDK contract and may change without notice. The class is.
 *
 * The four cases are deliberately narrow and mutually exclusive:
 *
 * - {@link EebusFeatureUnavailableError} — the peer permanently does not
 *   expose the requested feature. Retrying will not help; the caller
 *   should disable the dependent behaviour.
 * - {@link EebusFeatureNotResolvedError} — the peer exposes the feature
 *   but the SDK has not yet finished resolving it (description-list read
 *   pending, post-reconnect handshake in progress). Transient; retry
 *   after the next catalog update.
 * - {@link EebusFunctionUnsupportedError} — the peer exposes the feature
 *   but rejected the specific function (`"no function found for cmd data"`).
 *   Peer-side spec violation; not retryable on the same peer.
 * - {@link EebusRequestTimeoutError} — the request was dispatched but the
 *   reply did not arrive within the configured timeout. May or may not be
 *   transient depending on the peer.
 */

/**
 * Common metadata carried by every EEBUS error. The base
 * {@link EebusError} class exists only so consumers can write a single
 * catch-all `instanceof EebusError` check when they need to bail out of
 * any SDK-originated failure without distinguishing the cause.
 */
export abstract class EebusError extends Error {
    /** Subject Key Identifier of the remote node the failed call targeted. */
    public readonly ski: string;

    protected constructor(message: string, ski: string) {
        super(message);
        this.ski = ski;
        // Preserve correct prototype across transpilation targets / cross-realm boundaries
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = new.target.name;
    }
}

/**
 * Thrown when the peer does not expose the requested SPINE feature at
 * all — there is no entity hosting it in the catalog and there will not
 * be one without a peer-side firmware or configuration change.
 *
 * Distinguish from {@link EebusFeatureNotResolvedError} (the feature
 * exists but is not yet resolved) — that case is transient, this one is
 * permanent.
 */
export class EebusFeatureUnavailableError extends EebusError {
    /** SPINE feature type the caller asked for. */
    public readonly featureType: SpineFeatureType;
    /** SPINE role the caller asked for. */
    public readonly role: 'server' | 'client';

    public constructor(ski: string, featureType: SpineFeatureType, role: 'server' | 'client', message?: string) {
        super(
            message ?? `Peer ${ski} does not expose a ${role} ${featureType} feature`,
            ski,
        );
        this.featureType = featureType;
        this.role = role;
    }
}

/**
 * Thrown when the peer exposes the requested feature but the SDK has not
 * yet resolved its description (the `*DescriptionListData` read is still
 * pending, or the catalog snapshot is older than the most recent
 * reconnect).
 *
 * Transient — the typed clients re-resolve on every catalog update.
 * Callers that retry once the next `EebusFeatureCatalog.onFeaturesChanged`
 * event fires will usually succeed.
 */
export class EebusFeatureNotResolvedError extends EebusError {
    /** SPINE feature type the caller asked for. */
    public readonly featureType: SpineFeatureType;
    /** SPINE role the caller asked for. */
    public readonly role: 'server' | 'client';

    public constructor(ski: string, featureType: SpineFeatureType, role: 'server' | 'client', message?: string) {
        super(
            message ?? `Peer ${ski} ${role} ${featureType} feature is not yet resolved`,
            ski,
        );
        this.featureType = featureType;
        this.role = role;
    }
}

/**
 * Thrown when the peer accepted the addressed feature but rejected the
 * specific SPINE function — typically with the `"no function found for
 * cmd data"` ResultData reply. This is a peer-side spec violation: the
 * feature type advertises support for the function but the peer's
 * implementation does not handle it.
 *
 * Not retryable on the same peer. Vendor packages should record the
 * incident and disable the dependent behaviour for that SKI; firmware
 * upgrades are the only fix.
 */
export class EebusFunctionUnsupportedError extends EebusError {
    /** SPINE feature type the caller addressed. */
    public readonly featureType: SpineFeatureType;
    /** SPINE function the peer rejected (e.g. `SpineFunctionType.LoadControlLimitListData`). */
    public readonly functionName: SpineFunctionType;

    public constructor(ski: string, featureType: SpineFeatureType, functionName: SpineFunctionType, message?: string) {
        super(
            message ?? `Peer ${ski} ${featureType} feature does not support function ${functionName}`,
            ski,
        );
        this.featureType = featureType;
        this.functionName = functionName;
    }
}

/**
 * Thrown when an EEBUS read / write request was dispatched but no reply
 * arrived within the configured timeout. May indicate a transient peer
 * hang (retry on the next connection cycle) or a peer-side stall on a
 * specific function (consider a longer timeout via the relevant
 * `*ClientOptions.descriptionReadTimeoutMs`).
 *
 * Distinguish from {@link EebusFunctionUnsupportedError}: a timeout
 * means the peer never answered; a function-unsupported error means the
 * peer answered with an explicit rejection.
 */
export class EebusRequestTimeoutError extends EebusError {
    /** SPINE feature type the caller addressed. */
    public readonly featureType: SpineFeatureType;
    /** SPINE function the caller invoked. */
    public readonly functionName: SpineFunctionType;
    /** The timeout that was hit, in milliseconds. */
    public readonly timeoutMs: number;

    public constructor(
        ski: string,
        featureType: SpineFeatureType,
        functionName: SpineFunctionType,
        timeoutMs: number,
        message?: string,
    ) {
        super(
            message ?? `Peer ${ski} did not reply to ${featureType}.${functionName} within ${timeoutMs} ms`,
            ski,
        );
        this.featureType = featureType;
        this.functionName = functionName;
        this.timeoutMs = timeoutMs;
    }
}
