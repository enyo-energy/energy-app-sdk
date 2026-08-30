import type {
    EnyoOnboardingV2GuidesRequest,
    EnyoOnboardingV2GuidesResult,
} from '../types/enyo-onboarding-v2-provider.js';

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
}
