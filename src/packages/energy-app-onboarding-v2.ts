import type {
    EnyoOnboardingV2GuidesRequest,
    EnyoOnboardingV2GuidesResult,
} from '../types/enyo-onboarding-v2-provider.js';
import type {
    EnyoOnboardingV2DynamicRequest,
    EnyoOnboardingV2DynamicResult,
} from '../types/enyo-onboarding-v2-dynamic.js';
import type {
    EnyoOnboardingV2AdditionalSetupRequest,
    EnyoOnboardingV2AdditionalSetupResult,
} from '../types/enyo-onboarding-v2-additional-setup.js';

/**
 * Handler the host calls to collect every onboarding guide (v2) an app ships.
 *
 * The handler builds the guides and resolves — that promise is the whole
 * protocol. There is no per-guide save, update or delete call: each invocation
 * returns the app's *complete* current set, and the host replaces what it knew
 * with the answer. A guide is retired by leaving it out of the array.
 *
 * Answer from memory. The host owns the clock and stops waiting after
 * {@link EnyoOnboardingV2GuidesRequest.timeoutMs}, and an abandoned handler is
 * never told, so a handler that fetches guides over the network on every call
 * will eventually be the reason an installer sees no guide.
 *
 * **`null` is not the same as an empty array.** Resolve with `null` (or reject)
 * to say "I am not answering right now" — the host keeps whatever it cached.
 * Resolve with an empty `guides` array to say "I genuinely have no guides" —
 * the host drops the ones it cached. Use `null` for the transient case, never
 * an empty array.
 *
 * Registering a handler requires no permission.
 *
 * @param request - Who is asking, the correlation id, and the time budget.
 * @returns A promise resolving to the app's complete guide set, or `null` to
 *   leave the host's cached guides untouched.
 */
export type EnyoOnboardingV2GuidesHandler = (
    request: EnyoOnboardingV2GuidesRequest
) => Promise<EnyoOnboardingV2GuidesResult | null>;

/**
 * Handler the host calls to resolve the value behind a dynamic block while a
 * step is being rendered.
 *
 * A guide declares a slot — `onboardingV2Block.dynamic(id, kind)` — and never a
 * value. This is where the value comes from. The app is asked because it is
 * usually the one that knows: it opened the OCPP endpoint
 * ({@link EnergyAppOcpp.getAvailableConnectionDetails}), and it knows which of a
 * device's addresses is the one worth typing.
 *
 * **`null` means "not available", and that is a normal answer.** Return it for
 * a {@link EnyoOnboardingV2DynamicKind} the app does not serve, or when the run
 * carries no device to answer about. A dynamic block is passive content with no
 * routing handle, so an unresolved value never strands a run — the host falls
 * back to whatever it can resolve itself, and failing that renders the step
 * without the value. Nothing branches on it.
 *
 * **The app's answer wins.** When the handler returns a value the host uses it
 * over its own resolution, so an app that answers is taking responsibility for
 * being right — a plausible-but-wrong OCPP URL is copied into a wallbox and
 * surfaces much later as an `ocpp-connect` timeout with nothing to point at.
 * Answer `null` rather than guessing.
 *
 * An installer is looking at the screen this fills, and the host stops waiting
 * after {@link EnyoOnboardingV2DynamicRequest.timeoutMs}. Answer from state the
 * app already holds; this is not the place for a vendor-cloud round trip.
 * Rejecting the promise is treated as `null`.
 *
 * Registering a handler requires no permission.
 *
 * @param request - Which value is wanted, for which block, device and run.
 * @returns A promise resolving to the value, or `null` when it is unavailable.
 */
export type EnyoOnboardingV2DynamicHandler = (
    request: EnyoOnboardingV2DynamicRequest
) => Promise<EnyoOnboardingV2DynamicResult | null>;

/**
 * Handler the host calls when an installer runs an
 * {@link EnyoOnboardingV2AdditionalSetupBlock}.
 *
 * The only interactive block whose verdict is the **app's**. A host can check an
 * IP and a server can gate an OAuth session; neither can say whether a vendor
 * API token is the right token. The guide collects, the host forwards, the app
 * answers.
 *
 * One handler serves every setup block in every guide — switch on
 * {@link EnyoOnboardingV2AdditionalSetupRequest.setupKey}, which is stable
 * across guides, rather than on `blockId`, which is not.
 *
 * **The request carries credentials.** Four rules follow:
 *
 * 1. Never log a value. Log `setupKey`, field *names*, and the outcome.
 * 2. Never echo one into `message` (rendered on screen) or `detail` (goes to
 *    support), not even truncated.
 * 3. Persist through {@link EnergyAppSecretManager}, not the app's own storage.
 * 4. Do not hold them past the call. Secret fields are not kept in run state, so
 *    the handler is the only place they exist.
 *
 * **Everything that is not a verdict is `failed`.** A rejection, exceeding
 * {@link EnyoOnboardingV2AdditionalSetupRequest.timeoutMs}, no registered
 * handler, or an `outcome` matching nothing the block declared all route to the
 * block's mandatory `failed` outcome. Prefer resolving with a real outcome and a
 * translated `message`: `failed` gets the installer a branch, but not an
 * explanation.
 *
 * Registering a handler requires no permission; what the handler *does* may.
 *
 * @param request - Which setup was run, with what values, and the time budget.
 * @returns A promise resolving to the verdict to route on.
 */
export type EnyoOnboardingV2AdditionalSetupHandler = (
    request: EnyoOnboardingV2AdditionalSetupRequest
) => Promise<EnyoOnboardingV2AdditionalSetupResult>;

/**
 * Interface for answering the host's "give me your v2 onboarding guides"
 * question.
 *
 * Guides are **pulled, not pushed**. The app registers one handler here and the
 * host calls it — when the package is installed or updated, when it syncs its
 * catalog, and when an installer starts a run. The app never publishes a guide
 * and never deletes one: it simply answers with whatever set it currently
 * offers, and the host's picture is replaced by that answer.
 *
 * That inversion is the point. A guide lives in the app's source next to the
 * code it describes, so shipping a new package version ships the corrected
 * guide with it — there is no separate publish step to forget and no stored
 * copy to drift out of date. It also lets the guide set be *computed*: an app
 * can return a different variant depending on which firmware it supports, or
 * omit a guide for hardware it no longer handles, without any host-side
 * bookkeeping.
 *
 * Author the guides with `defineOnboardingGuideV2()` and check them with
 * `validateOnboardingV2GuidesResult()` before returning — a guide with blocking
 * errors is dropped by the host, and dropped silently is the worst way to find
 * out.
 *
 * This API is available to every app — it is not permission-gated.
 *
 * @example
 * ```typescript
 * const guides = [
 *     defineOnboardingGuideV2({
 *         title: t('Wallbox über OCPP', 'Wallbox via OCPP'),
 *         startVariant: EnyoOnboardingV2StartVariant.ManualSetup,
 *         requiresNetworkScan: false,
 *         startStepId: 'enter-url',
 *         steps: [ ... ],
 *         vendorId: 'acme',
 *         modelIds: ['ac22'],
 *     }),
 * ];
 *
 * energyApp.useOnboardingV2().registerOnboardingGuidesHandler(async (request) => {
 *     const result = {requestId: request.requestId, guides};
 *     const {ok, errors} = validateOnboardingV2GuidesResult(result, {
 *         files: packageDefinition.files,
 *     });
 *     if (!ok) {
 *         console.error('onboarding guides invalid', errors);
 *         return null;   // keep whatever the host already has
 *     }
 *     return result;
 * });
 * ```
 */
export interface EnergyAppOnboardingV2 {
    /**
     * Registers the handler the host calls to collect this app's v2 onboarding
     * guides.
     *
     * One handler per package: registering again replaces the previous one, so a
     * hot-reloading app does not accumulate stale handlers. Register during
     * startup — a request that arrives before registration is answered as
     * *nothing*, which leaves the host's cached guides in place but means a
     * freshly installed app offers no guide until it registers.
     *
     * @param handler - Callback invoked once per guide request.
     * @returns Promise that resolves once the handler is registered with the host.
     *
     * @example
     * ```typescript
     * const onboarding = energyApp.useOnboardingV2();
     * await onboarding.registerOnboardingGuidesHandler(async (request) => ({
     *     requestId: request.requestId,
     *     guides: buildGuides(),
     * }));
     * ```
     */
    registerOnboardingGuidesHandler(handler: EnyoOnboardingV2GuidesHandler): Promise<void>;

    /**
     * Removes the registered handler.
     *
     * After deregistration the host no longer asks this package for guides. Its
     * cached guides are left as they were — deregistering is not a way to retire
     * them; return an empty `guides` array for that. If no handler is registered
     * this operation is a no-op.
     *
     * @returns Promise that resolves once the handler has been removed.
     */
    deregisterOnboardingGuidesHandler(): Promise<void>;

    /**
     * Asks the host to call the registered handler again now, instead of waiting
     * for its next sync.
     *
     * For the case where the app's guide set changed after startup — a firmware
     * capability was discovered, a vendor account was linked — and the app wants
     * the host's picture updated without a restart. It is a request to re-pull,
     * not a push: the host still calls the handler, and the handler still
     * returns the complete set.
     *
     * @returns Promise that resolves once the host has taken the new answer.
     */
    refreshOnboardingGuides(): Promise<void>;

    /**
     * Registers the handler the host calls to resolve dynamic block values
     * (`ocpp-url`, `device-ip`) while a step is rendered.
     *
     * One handler per package, serving every
     * {@link EnyoOnboardingV2DynamicKind}: registering again replaces the
     * previous one. Register during startup — a request that arrives before
     * registration is answered as unavailable, and the installer sees a step
     * missing the value they were told to copy.
     *
     * Optional. An app whose guides use no dynamic blocks need not register
     * anything, and an app that registers may still answer `null` for kinds it
     * does not serve.
     *
     * @param handler - Callback invoked once per dynamic-value request.
     * @returns Promise that resolves once the handler is registered with the host.
     *
     * @example
     * ```typescript
     * await energyApp.useOnboardingV2().registerDynamicValueHandler(async (request) => {
     *     if (request.kind !== EnyoOnboardingV2DynamicKind.OcppUrl) return null;
     *
     *     const {cloud, local} = await energyApp.useOcpp().getAvailableConnectionDetails();
     *     const endpoint = cloud ?? local;
     *     if (!endpoint) return null;   // nothing to offer — better than a wrong URL
     *
     *     return {requestId: request.requestId, kind: request.kind, value: endpoint.url};
     * });
     * ```
     */
    registerDynamicValueHandler(handler: EnyoOnboardingV2DynamicHandler): Promise<void>;

    /**
     * Removes the registered dynamic-value handler.
     *
     * After deregistration the host resolves dynamic blocks on its own again. If
     * no handler is registered this operation is a no-op.
     *
     * @returns Promise that resolves once the handler has been removed.
     */
    deregisterDynamicValueHandler(): Promise<void>;

    /**
     * Registers the handler the host calls when an installer runs an
     * {@link EnyoOnboardingV2AdditionalSetupBlock}.
     *
     * One handler per package, serving every `setupKey`: registering again
     * replaces the previous one. Register during startup — a request arriving
     * before registration is routed to the block's `failed` outcome, which in a
     * guided run means the installer sees the failure branch of a setup that was
     * never actually attempted.
     *
     * Optional. An app whose guides use no setup blocks registers nothing.
     *
     * @param handler - Callback invoked once per additional-setup request.
     * @returns Promise that resolves once the handler is registered with the host.
     *
     * @example
     * ```typescript
     * await energyApp.useOnboardingV2().registerAdditionalSetupHandler(async (request) => {
     *     if (request.setupKey !== 'vendor-cloud-token') {
     *         return {requestId: request.requestId, outcome: 'failed'};
     *     }
     *
     *     const token = request.values.find((v) => v.name === 'api-token')?.value;
     *     if (!token) return {requestId: request.requestId, outcome: 'failed'};
     *
     *     const accepted = await vendorCloud.verify(token);   // never log `token`
     *     if (!accepted) {
     *         return {
     *             requestId: request.requestId,
     *             outcome: 'invalid',
     *             message: [
     *                 {language: 'de', value: 'Token wurde abgelehnt.'},
     *                 {language: 'en', value: 'The token was rejected.'},
     *             ],
     *         };
     *     }
     *
     *     await energyApp.useSecretManager().saveSecret('vendor-cloud', {token});
     *     return {requestId: request.requestId, outcome: 'connected'};
     * });
     * ```
     */
    registerAdditionalSetupHandler(handler: EnyoOnboardingV2AdditionalSetupHandler): Promise<void>;

    /**
     * Removes the registered additional-setup handler.
     *
     * After deregistration every setup block of this package routes to its
     * `failed` outcome. If no handler is registered this operation is a no-op.
     *
     * @returns Promise that resolves once the handler has been removed.
     */
    deregisterAdditionalSetupHandler(): Promise<void>;
}
