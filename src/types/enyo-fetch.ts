/**
 * TLS material for an outbound HTTPS connection made through {@link UseFetchOptions}.
 *
 * All certificate/key fields accept PEM as a UTF-8 string or a {@link Buffer}. When passed
 * to `useFetch`, the runtime uses these values to build a TLS-configured dispatcher for the
 * underlying fetch (e.g. for mutual TLS, custom trust anchors, or self-signed servers).
 */
export interface TlsClientOptions {
    /** Client cert chain (PEM) presented during the TLS handshake (mutual TLS). */
    cert?: string | Buffer;
    /** Private key (PEM) for the client cert. */
    key?: string | Buffer;
    /** Trusted CA cert(s) (PEM) to validate the server. */
    ca?: string | Buffer | Array<string | Buffer>;
    /** When false, accept self-signed/untrusted server certs. Default true. */
    rejectUnauthorized?: boolean;
    /** Optional SNI / expected server hostname override. */
    servername?: string;
}

/**
 * Options accepted by `useFetch` to customize the returned `fetch` implementation.
 *
 * The returned fetch still passes through the runtime's origin allow-list; these options only
 * add behavior (currently: TLS configuration) on top of that.
 */
export interface UseFetchOptions {
    /** TLS / mutual-TLS configuration for outbound HTTPS requests. */
    tls?: TlsClientOptions;
}
