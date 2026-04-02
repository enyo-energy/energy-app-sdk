import {
    MqttConnectOptions,
    MqttExternalConnectOptions,
    MqttConnectionStatus,
    MqttSubscribeOptions,
    MqttPublishOptions,
    MqttMessage,
} from "../types/enyo-mqtt.js";

/**
 * Interface for MQTT communication in enyo packages.
 * Provides MQTT client functionality with support for both the SDK-provided
 * internal broker and external custom brokers.
 *
 * @example
 * ```typescript
 * const mqtt = energyApp.useMqtt();
 *
 * // Connect to the SDK-provided internal broker (URL and credentials are automatic)
 * const internalClient = await mqtt.connectInternal();
 *
 * // Connect to an external broker
 * const externalClient = await mqtt.connect({
 *     brokerUrl: 'mqtt://192.168.1.100:1883',
 *     username: 'user',
 *     password: 'pass',
 * });
 *
 * // Subscribe and listen for messages
 * await internalClient.subscribe('devices/+/status');
 * internalClient.listenForMessage((message) => {
 *     console.log(`Received on ${message.topic}: ${message.payload.toString()}`);
 * });
 *
 * // Publish a message
 * await internalClient.publish('devices/myDevice/command', JSON.stringify({ action: 'restart' }));
 * ```
 */
export interface EnergyAppMqtt {
    /**
     * Connect to the SDK-provided internal MQTT broker.
     * The broker URL and authentication credentials are handled automatically by the runtime.
     *
     * @param options - Optional connection configuration (clientId, keepAlive, LWT, etc.)
     * @returns A connected MQTT client instance
     *
     * @example
     * ```typescript
     * const client = await mqtt.connectInternal();
     * ```
     */
    connectInternal: (options?: MqttConnectOptions) => Promise<EnergyAppMqttClient>;

    /**
     * Connect to an external MQTT broker.
     * Requires a broker URL and optionally authentication credentials.
     *
     * @param options - Connection configuration including broker URL and optional credentials
     * @returns A connected MQTT client instance
     *
     * @example
     * ```typescript
     * const client = await mqtt.connect({
     *     brokerUrl: 'mqtts://broker.example.com:8883',
     *     username: 'user',
     *     password: 'secret',
     * });
     * ```
     */
    connect: (options: MqttExternalConnectOptions) => Promise<EnergyAppMqttClient>;
}

/**
 * Represents an active MQTT client connection.
 * Provides methods for publishing messages, subscribing to topics,
 * and managing the connection lifecycle.
 *
 * Obtained by calling {@link EnergyAppMqtt.connectInternal} or {@link EnergyAppMqtt.connect}.
 */
export interface EnergyAppMqttClient {
    /**
     * Disconnect from the MQTT broker and release all resources.
     */
    disconnect: () => Promise<void>;

    /**
     * Check whether the client is currently connected to the broker.
     *
     * @returns true if the client has an active connection
     */
    isConnected: () => boolean;

    /**
     * Subscribe to an MQTT topic to receive messages.
     * Supports MQTT wildcard characters: '+' for single-level and '#' for multi-level.
     *
     * @param topic - The topic filter to subscribe to (e.g. "devices/+/status" or "sensors/#")
     * @param options - Subscription options including QoS level
     *
     * @example
     * ```typescript
     * await client.subscribe('devices/+/status', { qos: MqttQos.AtLeastOnce });
     * ```
     */
    subscribe: (topic: string, options?: MqttSubscribeOptions) => Promise<void>;

    /**
     * Unsubscribe from a previously subscribed MQTT topic.
     *
     * @param topic - The topic filter to unsubscribe from
     */
    unsubscribe: (topic: string) => Promise<void>;

    /**
     * Publish a message to an MQTT topic.
     *
     * @param topic - The topic to publish to
     * @param payload - The message payload as a string or Buffer
     * @param options - Publish options including QoS and retain flag
     *
     * @example
     * ```typescript
     * await client.publish('devices/myDevice/command', JSON.stringify({ action: 'restart' }), {
     *     qos: MqttQos.AtLeastOnce,
     *     retain: false,
     * });
     * ```
     */
    publish: (topic: string, payload: string | Buffer, options?: MqttPublishOptions) => Promise<void>;

    /**
     * Register a listener for incoming messages on subscribed topics.
     *
     * @param listener - Callback invoked with each received message
     * @returns Listener ID that can be passed to {@link removeListener} to stop receiving messages
     *
     * @example
     * ```typescript
     * const listenerId = client.listenForMessage((message) => {
     *     console.log(`Topic: ${message.topic}, Payload: ${message.payload.toString()}`);
     * });
     * ```
     */
    listenForMessage: (listener: (message: MqttMessage) => void | Promise<void>) => string;

    /**
     * Register a listener for connection status changes (connected, disconnected, error, etc.).
     *
     * @param listener - Callback invoked with the new connection status and an optional error
     * @returns Listener ID that can be passed to {@link removeListener}
     *
     * @example
     * ```typescript
     * const listenerId = client.listenForConnectionStatusChange((status, error) => {
     *     if (status === MqttConnectionStatus.Error) {
     *         console.error('MQTT error:', error);
     *     }
     * });
     * ```
     */
    listenForConnectionStatusChange: (
        listener: (status: MqttConnectionStatus, error?: Error) => void | Promise<void>
    ) => string;

    /**
     * Register a listener that only receives messages matching a specific topic pattern.
     * This avoids manual topic filtering when handling multiple subscriptions.
     * Supports MQTT wildcard characters: '+' for single-level and '#' for multi-level.
     *
     * @param topicPattern - The topic pattern to match incoming messages against (e.g. "devices/+/status")
     * @param listener - Callback invoked with each matching message. May be async.
     * @returns Listener ID that can be passed to {@link removeListener}
     *
     * @example
     * ```typescript
     * const listenerId = client.onTopic('devices/+/status', async (message) => {
     *     const status = JSON.parse(message.payload.toString());
     *     await saveToDatabase(status);
     * });
     * ```
     */
    onTopic: (topicPattern: string, listener: (message: MqttMessage) => void | Promise<void>) => string;

    /**
     * Remove a previously registered listener.
     * Works for listener IDs returned by {@link listenForMessage}, {@link listenForConnectionStatusChange},
     * and {@link onTopic}.
     *
     * @param listenerId - The ID returned by the listener registration method
     */
    removeListener: (listenerId: string) => void;

    /**
     * Remove all registered listeners at once.
     * Useful for cleanup when a component or plugin is being unloaded.
     * Removes listeners registered via {@link listenForMessage}, {@link listenForConnectionStatusChange},
     * and {@link onTopic}.
     */
    removeAllListeners: () => void;

    /**
     * Get the current connection status of the client.
     *
     * @returns The current connection status
     */
    getStatus: () => MqttConnectionStatus;
}
