import {EnyoWebhookEvent} from "../types/enyo-webhook.js";

/**
 * Interface for receiving webhooks from third-party services.
 *
 * Energy apps run on the hub, usually behind NAT, so a vendor cloud cannot
 * call them directly. Instead every app gets **one** public webhook endpoint
 * on the enyo API. The app reads its URL with {@link getWebhookUrl}, hands it
 * to the vendor (often through the vendor's own API), and every JSON body
 * POSTed to that URL is forwarded, already parsed, to the listeners registered with
 * {@link listenForWebhook}.
 *
 * There is a single endpoint per app, not one per use case. When an app
 * subscribes to several kinds of events, it tells them apart by the content
 * of the body.
 *
 * Access to this API requires the `Webhook` permission
 * ({@link EnergyAppPermissionType}); {@link EnergyApp.useWebhook} throws when
 * it has not been granted.
 *
 * @example
 * ```typescript
 * const webhook = energyApp.useWebhook();
 *
 * // Tell the vendor where to send its events.
 * const url = await webhook.getWebhookUrl();
 * await vendorApi.subscribe({callbackUrl: url});
 *
 * const seen = new Set<string>();
 * webhook.listenForWebhook<VendorEvent>(async (event) => {
 *     if (seen.has(event.webhookRequestId)) {
 *         return; // at-least-once delivery: skip duplicates
 *     }
 *     seen.add(event.webhookRequestId);
 *     await handleVendorEvent(event.body);
 * });
 * ```
 */
export interface EnergyAppWebhook {
    /**
     * Returns the public URL of this app's webhook endpoint on the enyo API.
     *
     * The URL is stable for the app installation, so it is safe to register it
     * once with a vendor and reuse it after restarts.
     *
     * @returns Promise that resolves to the absolute HTTPS webhook URL
     */
    getWebhookUrl(): Promise<string>;

    /**
     * Registers a listener for webhook calls forwarded from the enyo API.
     *
     * The listener receives the JSON body already parsed. Its structure is not
     * validated by the host, so the type parameter is an assertion, not a
     * guarantee — check the fields you rely on. Delivery
     * is at least once and the order of calls is not guaranteed; deduplicate
     * with {@link EnyoWebhookEvent.webhookRequestId}.
     *
     * @typeParam T - Shape of the JSON body the app expects.
     * @param listener - Callback invoked for every forwarded webhook call. May be async.
     * @returns The listener ID, to be passed to {@link removeListener}
     */
    listenForWebhook<T = unknown>(listener: (event: EnyoWebhookEvent<T>) => void | Promise<void>): string;

    /**
     * Removes a listener previously registered with {@link listenForWebhook}.
     *
     * @param listenerId - The ID returned by {@link listenForWebhook}
     */
    removeListener(listenerId: string): void;

    /**
     * Removes every webhook listener registered by this app.
     */
    removeAllListeners(): void;
}
