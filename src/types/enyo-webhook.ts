/**
 * The {@link EnyoWebhookEvent.source} the enyo API reports when a webhook call
 * was not attributed to a more specific source.
 */
export const DEFAULT_ENYO_WEBHOOK_SOURCE = 'custom-webhook';

/**
 * Grants a webhook listener access to a hidden webhook source.
 *
 * Some sources are not delivered to every app. They are only forwarded to a
 * listener that presents the matching token for that source when it is
 * registered with {@link EnergyAppWebhook.listenForWebhook}.
 */
export interface EnyoWebhookSecretKey {
    /** The hidden source to subscribe to, matching {@link EnyoWebhookEvent.source}. */
    source: string;
    /**
     * The static access token for {@link source}. Treat it like a password:
     * keep it in the secret manager rather than in the app's source code.
     */
    token: string;
}

/**
 * Options for {@link EnergyAppWebhook.listenForWebhook}.
 */
export interface EnyoWebhookListenOptions {
    /**
     * Optional access tokens for hidden webhook sources, at most one per
     * source. The listener receives calls from these sources in addition to
     * the public ones. A source whose token is wrong is not delivered.
     */
    secretKeys?: EnyoWebhookSecretKey[];
}

/**
 * A webhook call the enyo API received for this app and forwarded to it.
 *
 * Every app has exactly **one** webhook endpoint on the enyo API (see
 * {@link EnergyAppWebhook.getWebhookUrl}). Whatever a third party POSTs to it
 * is forwarded to the app with its JSON body already parsed.
 *
 * @typeParam T - Shape of the JSON body the app expects. Defaults to
 *   `unknown`, since the host does not validate the body's structure.
 */
export interface EnyoWebhookEvent<T = unknown> {
    /**
     * Unique id of this webhook call, assigned by the enyo API.
     *
     * Delivery is at least once: the same call may be forwarded again (for
     * example after the device was offline), so use this id to ignore
     * duplicates.
     */
    webhookRequestId: string;
    /**
     * Where the webhook call came from. The value is
     * {@link DEFAULT_ENYO_WEBHOOK_SOURCE} (`'custom-webhook'`) unless the enyo
     * API attributes the call to a more specific source.
     */
    source: string;
    /** ISO 8601 timestamp of when the enyo API received the call. */
    receivedAtIso: string;
    /** The JSON body the caller sent, already parsed into an object. */
    body: T;
}
