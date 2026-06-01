/**
 * Common shape inherited by every typed EEBUS use-case client.
 *
 * Adding a shared base avoids each client growing its own warm-up
 * vocabulary. Today vendor packages trigger the lazy SPINE handshake
 * by issuing a fake call (e.g. `onReading(noop)` on
 * {@link EebusMpcClient}) just to make the description-list reads
 * happen. {@link ready} replaces that ritual with an explicit hook.
 */
export interface EebusUseCaseClient {
    /**
     * Drive the SPINE binding + description-list reads for this
     * use-case client to completion without dispatching any real
     * read, write, or subscription. Resolves once the handshake has
     * landed (or rejects with an {@link EebusFeatureUnavailableError}
     * / {@link EebusFeatureNotResolvedError} /
     * {@link EebusRequestTimeoutError} if the peer cannot satisfy it
     * within the client's configured `descriptionReadTimeoutMs`).
     *
     * Idempotent: subsequent calls resolve as soon as the handshake
     * has succeeded once. Safe to call from package start-up to
     * surface "peer is not ready" early instead of letting the first
     * real call fail later.
     */
    ready: () => Promise<void>;
}
