/**
 * Why this peer is (or is not) ready to service calls on a typed use-case
 * client. The shape mirrors the underlying lib's `ready(ski)` probe — the
 * SDK simply surfaces what the lib already keeps cached.
 *
 * The {@link reason} strings are the canonical set the lib publishes; the
 * type widens with `string` so a lib upgrade that adds a new variant does
 * not break consumers that pattern-match on it.
 */
export interface EebusUseCaseReadiness {
    /**
     * `true` once the SHIP session is live, the peer advertises a
     * compatible entity for this use case, and the SPINE binding +
     * subscription have landed. `false` while any of those preconditions
     * is outstanding.
     */
    ready: boolean;
    /**
     * Why the peer is not yet ready. Populated only when {@link ready}
     * is `false`. The canonical values published by the lib are:
     *
     * - `'no connection for ski'` — no SHIP session for this peer.
     * - `'peer advertises no compatible entity with scenarios for this use case'` —
     *   the peer is connected but its `NodeManagement` view does not
     *   include an entity that hosts the scenarios this use case needs.
     * - `'peer session not yet bound/subscribed'` — the binding /
     *   subscription is still in flight; usually transient (resolves
     *   within a couple of seconds of the connection coming up).
     */
    reason?:
        | 'no connection for ski'
        | 'peer advertises no compatible entity with scenarios for this use case'
        | 'peer session not yet bound/subscribed'
        | string;
}

/**
 * Common shape inherited by every typed EEBUS use-case client.
 *
 * The lib drives the SPINE binding + description-list reads automatically
 * once a use-case client is created — consumers do not have to "warm it
 * up" with a noop call any more. {@link ready} surfaces the lib's cached
 * readiness state so a consumer can answer "is this peer ready for me to
 * use this use case yet?" without firing any wire traffic.
 *
 * The probe is synchronous and side-effect-free: it neither triggers nor
 * waits for the handshake. Call it from a render path, an event handler,
 * or a polling loop without worrying about cost.
 */
export interface EebusUseCaseClient {
    /**
     * Probe the lib's cached readiness state for this use-case client.
     *
     * Returns `{ ready: true }` once the peer is fully bound and
     * subscribed. Returns `{ ready: false, reason }` while any
     * precondition is outstanding — {@link EebusUseCaseReadiness.reason}
     * carries the lib-published explanation so callers can distinguish
     * "peer is offline" from "peer does not support this use case" from
     * "binding is still in flight".
     *
     * Synchronous and side-effect-free. Safe to call from hot paths.
     */
    ready: () => EebusUseCaseReadiness;
}
