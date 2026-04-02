/**
 * MQTT Quality of Service levels defining message delivery guarantees.
 */
export enum MqttQos {
    /** At most once delivery — fire and forget, no acknowledgment */
    AtMostOnce = 0,
    /** At least once delivery — message is acknowledged, may be delivered multiple times */
    AtLeastOnce = 1,
    /** Exactly once delivery — assured delivery using a four-step handshake */
    ExactlyOnce = 2,
}

/**
 * Connection status of an MQTT client.
 */
export enum MqttConnectionStatus {
    /** Successfully connected to the broker */
    Connected = 'connected',
    /** Disconnected from the broker */
    Disconnected = 'disconnected',
    /** Initial connection attempt in progress */
    Connecting = 'connecting',
    /** Attempting to reconnect after a connection loss */
    Reconnecting = 'reconnecting',
    /** Connection error occurred */
    Error = 'error',
}

/**
 * Last Will and Testament (LWT) configuration for an MQTT connection.
 * The broker publishes this message on behalf of the client when the connection is lost unexpectedly.
 */
export interface MqttLastWillTestament {
    /** Topic to publish the will message to */
    topic: string;
    /** Will message payload */
    payload: string | Buffer;
    /** QoS level for the will message (default: AtMostOnce) */
    qos?: MqttQos;
    /** Whether the will message should be retained by the broker (default: false) */
    retain?: boolean;
}

/**
 * Configuration options for connecting to the SDK-provided internal MQTT broker.
 * URL and credentials are handled automatically by the runtime.
 */
export interface MqttConnectOptions {
    /** Client identifier. Auto-generated if omitted. */
    clientId?: string;
    /** Start a clean session, discarding any previous session state (default: true) */
    cleanSession?: boolean;
    /** Keep-alive interval in seconds. The client sends periodic pings to keep the connection alive (default: 60) */
    keepAliveSeconds?: number;
    /** Connection timeout in milliseconds */
    timeout?: number;
    /** Last Will and Testament configuration */
    lastWill?: MqttLastWillTestament;
}

/**
 * Configuration options for connecting to an external MQTT broker.
 * Extends the base options with broker URL and authentication credentials.
 */
export interface MqttExternalConnectOptions extends MqttConnectOptions {
    /** Broker URL including protocol and port (e.g. "mqtt://192.168.1.100:1883" or "mqtts://broker.example.com:8883") */
    brokerUrl: string;
    /** Username for broker authentication */
    username?: string;
    /** Password for broker authentication */
    password?: string;
    /** Whether to use TLS/SSL. When omitted, inferred from the protocol in brokerUrl (mqtts:// enables TLS) */
    useTls?: boolean;
}

/**
 * Options for subscribing to an MQTT topic.
 */
export interface MqttSubscribeOptions {
    /** QoS level for the subscription (default: AtMostOnce) */
    qos?: MqttQos;
}

/**
 * Options for publishing an MQTT message.
 */
export interface MqttPublishOptions {
    /** QoS level for the published message (default: AtMostOnce) */
    qos?: MqttQos;
    /** Whether the broker should retain this message as the last known value for the topic (default: false) */
    retain?: boolean;
}

/**
 * Represents an incoming MQTT message received on a subscribed topic.
 */
export interface MqttMessage {
    /** The topic the message was received on */
    topic: string;
    /** The message payload as a Buffer. Use .toString() for text payloads or JSON.parse(.toString()) for JSON */
    payload: Buffer;
    /** QoS level of the received message */
    qos: MqttQos;
    /** Whether this message was a retained message from the broker */
    retain: boolean;
    /** Timestamp when the message was received by the client */
    timestamp: Date;
}
