/**
 * Options used when binding a UDP socket via {@link EnergyAppUdp.bind}.
 */
export interface UdpBindOptions {
    /** Bind port. 0 selects an ephemeral port. */
    port: number;
    /**
     * When `true`, sets `SO_REUSEADDR` on the underlying socket so multiple
     * sockets may bind to the same address/port. Maps to the `reuseAddr`
     * option of `node:dgram`'s `createSocket`.
     *
     * Defaults to `false`.
     */
    reuseAddr?: boolean;
}

/**
 * A single inbound datagram delivered to a handler registered with
 * {@link EnergyAppUdpSocket.onMessage}.
 */
export interface UdpInboundMessage {
    /** Raw payload bytes of the datagram. */
    data: Buffer;
    /** Remote port the datagram originated from. */
    remotePort: number;
    /** Remote address (IPv4/IPv6 textual form) the datagram originated from. */
    remoteAddress: string;
}

/**
 * Represents an active UDP socket bound to a local address/port.
 *
 * Obtained by calling {@link EnergyAppUdp.bind}. Provides methods for sending
 * datagrams, subscribing to inbound messages, querying the resolved local
 * address, and closing the socket.
 */
export interface EnergyAppUdpSocket {
    /**
     * The address the socket is actually bound to.
     * If port 0 was requested, the kernel-assigned port is returned here.
     *
     * @returns The bound local address descriptor.
     * @throws If the socket has been closed.
     */
    address(): { address: string; port: number; family: 'IPv4' | 'IPv6' };

    /**
     * Subscribe to inbound datagrams.
     *
     * Multiple handlers can be attached and each will receive a copy of every
     * inbound message. The returned handle can be passed to {@link off} to
     * stop receiving messages on that subscription.
     *
     * @param handler - Callback invoked for every datagram received.
     * @returns A unique handle that identifies this subscription.
     */
    onMessage(handler: (msg: UdpInboundMessage) => void): string;

    /**
     * Stop listening — removes a previously registered handler.
     *
     * @param handlerId - The id returned by {@link onMessage}. Unknown ids
     *                    are ignored.
     */
    off(handlerId: string): void;

    /**
     * Send a datagram to the given peer.
     *
     * @param data - Raw payload bytes to transmit.
     * @param port - Destination port on the peer.
     * @param address - Destination address on the peer (IPv4/IPv6 textual form
     *                  or hostname).
     * @returns A promise that resolves once the kernel has accepted the
     *          datagram and rejects if the underlying send call fails.
     */
    send(data: Buffer, port: number, address: string): Promise<void>;

    /**
     * Close the socket and release the bound port.
     *
     * Subsequent calls to {@link send} reject and {@link address} throws.
     * Idempotent close-after-close resolves without error.
     *
     * @returns A promise that resolves once the underlying socket has emitted
     *          its `close` event.
     */
    close(): Promise<void>;
}

/**
 * Interface for raw UDP communication in enyo packages.
 *
 * Provides a thin abstraction over `node:dgram` for binding sockets and
 * exchanging datagrams. Requires the package to declare the `Udp` permission.
 *
 * @example
 * ```typescript
 * const udp = energyApp.useUdp();
 * const socket = await udp.bind({ port: 0 });
 * const handlerId = socket.onMessage((msg) => {
 *     console.log(`Received ${msg.data.length} bytes from ${msg.remoteAddress}:${msg.remotePort}`);
 * });
 * await socket.send(Buffer.from('hello'), 5005, '192.168.1.42');
 * socket.off(handlerId);
 * await socket.close();
 * ```
 */
export interface EnergyAppUdp {
    /**
     * Bind a UDP socket on the requested host/port.
     *
     * Resolves once the underlying socket has emitted its `listening` event.
     *
     * @param options - Bind configuration (see {@link UdpBindOptions}).
     * @returns A bound socket ready to send and receive datagrams.
     * @throws {EnergyAppUdpBindError} If the requested port is already in use
     *         (EADDRINUSE). Other errors propagate as their original Error.
     */
    bind(options: UdpBindOptions): Promise<EnergyAppUdpSocket>;
}
