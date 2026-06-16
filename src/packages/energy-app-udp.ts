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
     * Particularly useful in combination with {@link multicastGroups} so
     * that multiple processes on the same host can receive the same
     * multicast stream.
     *
     * Defaults to `false`.
     */
    reuseAddr?: boolean;
    /**
     * IPv4 multicast group addresses to join after the socket is bound.
     *
     * Each entry must be a dotted-quad IPv4 address in the multicast range
     * `224.0.0.0/4` (i.e. first octet 224–239). The runtime joins every
     * listed group on the socket once the `listening` event fires; if any
     * join fails or any entry is not a valid multicast address, the socket
     * is closed and {@link EnergyAppUdp.bind} rejects with
     * {@link EnergyAppUdpBindError}.
     *
     * Typical use: SMA Speedwire receivers join `239.12.255.254`.
     *
     * Defaults to `undefined` (no multicast membership — unicast bind only).
     */
    multicastGroups?: string[];
    /**
     * Optional local interface address (IPv4 dotted-quad) to bind the
     * multicast membership(s) to. When omitted, the operating system
     * selects an interface — usually the one carrying the default route.
     *
     * Only meaningful in combination with {@link multicastGroups}. Most
     * callers should leave this `undefined`.
     */
    multicastInterface?: string;
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

    /**
     * Join an additional IPv4 multicast group on this already-bound socket.
     *
     * The address must be a dotted-quad in the multicast range
     * `224.0.0.0/4`. Implementations forward to the underlying
     * `dgram.Socket.addMembership` call.
     *
     * @param group - IPv4 multicast group address to join.
     * @param interfaceAddress - Optional local interface (IPv4 dotted-quad)
     *                           to bind the membership to. When omitted,
     *                           the operating system selects an interface.
     * @throws If the address is not a valid multicast address, the socket
     *         has been closed, or the underlying join fails.
     */
    addMembership(group: string, interfaceAddress?: string): void;

    /**
     * Leave a previously joined IPv4 multicast group.
     *
     * @param group - IPv4 multicast group address to leave.
     * @param interfaceAddress - Optional local interface (IPv4 dotted-quad)
     *                           the membership was originally bound to.
     * @throws If the address is not a valid multicast address, the socket
     *         has been closed, or no matching membership exists.
     */
    dropMembership(group: string, interfaceAddress?: string): void;
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
 *
 * @example Multicast receiver (SMA Speedwire)
 * ```typescript
 * const udp = energyApp.useUdp();
 * const socket = await udp.bind({
 *     port: 9522,
 *     reuseAddr: true,
 *     multicastGroups: ['239.12.255.254'],
 * });
 * socket.onMessage((msg) => {
 *     // Inbound SMA Speedwire datagram on 239.12.255.254:9522
 * });
 * ```
 */
export interface EnergyAppUdp {
    /**
     * Bind a UDP socket on the requested host/port.
     *
     * Resolves once the underlying socket has emitted its `listening` event.
     * When {@link UdpBindOptions.multicastGroups} is provided, the runtime
     * also joins each listed group before the returned promise resolves.
     *
     * @param options - Bind configuration (see {@link UdpBindOptions}).
     * @returns A bound socket ready to send and receive datagrams.
     * @throws {EnergyAppUdpBindError} If the requested port is already in use
     *         (EADDRINUSE), any entry in {@link UdpBindOptions.multicastGroups}
     *         is not a valid IPv4 multicast address, or joining a requested
     *         group fails. Other errors propagate as their original Error.
     */
    bind(options: UdpBindOptions): Promise<EnergyAppUdpSocket>;
}

/**
 * Thrown by {@link EnergyAppUdp.bind} when the underlying socket cannot be
 * bound — for example `EADDRINUSE`, an invalid multicast group address
 * supplied via {@link UdpBindOptions.multicastGroups}, or a failure to join
 * one of the requested groups after the socket starts listening.
 *
 * Implementations should wrap the originating `Error` and preserve its
 * `message` so callers can `instanceof`-check this class while still
 * surfacing the root cause in logs.
 */
export class EnergyAppUdpBindError extends Error {
    /**
     * Create a new `EnergyAppUdpBindError`.
     *
     * @param message - Human-readable description of the bind failure. Should
     *                  include the root cause (e.g. the originating `Error`'s
     *                  `message`) so it is preserved for logging.
     */
    constructor(message: string) {
        super(message);
        this.name = 'EnergyAppUdpBindError';
    }
}
