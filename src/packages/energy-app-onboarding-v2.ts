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
 * Which run of a named guide an app means.
 *
 * A guide name identifies the *flow*; this narrows it to one walk of that flow
 * when more than one can be open at a time. A maintenance guide is bound to an
 * appliance and its runs live in a lane of their own — one per appliance — so
 * that is the only distinction the host needs.
 *
 * Omit it entirely for a guide that has one open run, which is every
 * installation variant.
 */
export interface EnyoOnboardingV2RunSelector {
    /**
     * The appliance whose run is meant, for a guide bound to one
     * ({@link EnyoOnboardingV2StartVariant.Maintenance}).
     *
     * Omitted on a maintenance guide, the call addresses that guide's single
     * open run when there is exactly one and is rejected when there are
     * several — an ambiguous "complete the run" must not close an arbitrary one.
     */
    applianceId?: string;
}

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
     * Retires one guide by name, without the app restating its whole set.
     *
     * The ordinary way to retire a guide is to leave it out of the next
     * {@link EnyoOnboardingV2GuidesHandler} answer, and that remains the right
     * choice when the app's guide set is a static list in its source. This is
     * for the case that answer cannot express: a guide the app decided to
     * withdraw *now* — a vendor account was unlinked, an appliance it was bound
     * to is gone — where waiting for the host's next pull means an installer
     * can still start a flow the app can no longer serve.
     *
     * Names the guide by its {@link EnyoOnboardingV2Guide.name}, so only a
     * guide that carries one can be retired this way. A guide without a name is
     * addressable only as part of the complete answer.
     *
     * **The handler is still the source of truth.** This drops the guide from
     * the host's cache; it does not stop the app from offering it again. If the
     * handler keeps returning the guide, the next pull brings it back — so
     * remove it from what the handler builds as well, or the retirement lasts
     * only until the next sync.
     *
     * Runs already walking the guide are not touched: a guide is retired for the
     * *next* installer, and pulling a flow out from under one already inside it
     * would strand them mid-installation. Use {@link removeOnboardingRun} to end
     * a run.
     *
     * Removing a guide the host does not know — wrong name, already retired — is
     * a no-op rather than an error.
     *
     * This API is available to every app — it is not permission-gated.
     *
     * @param name - The {@link EnyoOnboardingV2Guide.name} of the guide to retire.
     * @returns Promise that resolves once the host has dropped the guide.
     *
     * @example
     * ```typescript
     * await energyApp.useOnboardingV2().removeOnboardingGuide('vendor-cloud-setup');
     * ```
     */
    removeOnboardingGuide(name: string): Promise<void>;

    /**
     * Marks the run walking a named guide as **completed**.
     *
     * For the flow that finished somewhere other than on the installer's
     * screen. A guide normally completes when the walk reaches a success
     * target — the installer taps through to the end. But an app sometimes
     * learns the goal was met by another route: the wallbox connected over OCPP
     * by itself, the vendor cloud confirmed the pairing, the appliance the
     * maintenance run was servicing reported healthy. Leaving that run open
     * shows the customer an installation still in progress that nobody intends
     * to continue.
     *
     * The run is closed as a **success**: it leaves the "open" set, stops being
     * offered for resumption, and counts as a finished installation. Use
     * {@link removeOnboardingRun} for a flow that ended without achieving
     * anything — the two are not interchangeable, and reporting an abandoned
     * setup as completed is how a broken installation looks fine on a dashboard.
     *
     * Completing a run that is already finished — completed or removed — is a
     * no-op: the first outcome stands, and a late confirmation does not reopen
     * or re-close a run. So is naming a guide with no open run at all.
     *
     * Not permission-gated, like the rest of this API: a guide name is resolved
     * within the calling package, so an app can only reach runs of guides it
     * ships itself.
     *
     * @param name - The {@link EnyoOnboardingV2Guide.name} of the guide whose run
     *   should be completed.
     * @param selector - Which run, when the guide can have more than one open.
     * @returns Promise that resolves once the host has closed the run.
     *
     * @example
     * ```typescript
     * // The wallbox connected on its own — the installer never reached the last step.
     * ocpp.onChargePointConnect(async () => {
     *     await energyApp.useOnboardingV2().completeOnboardingRun('wallbox-ocpp-setup');
     * });
     * ```
     */
    completeOnboardingRun(name: string, selector?: EnyoOnboardingV2RunSelector): Promise<void>;

    /**
     * Ends the run walking a named guide **without** completing it.
     *
     * The counterpart to {@link completeOnboardingRun}, for a flow that is over
     * but achieved nothing: the device it was setting up was removed, the
     * appliance a maintenance run was servicing no longer exists, the app can no
     * longer serve the guide the run is walking. The run leaves the open set as
     * abandoned rather than successful, so it stops being offered for resumption
     * and is not counted as a finished installation.
     *
     * This ends a *run*, not a guide. The guide stays available and a new run
     * can start on it immediately — that is the point when a stuck run is
     * blocking a fresh attempt, since a device can have only one open run per
     * flow. Use {@link removeOnboardingGuide} to withdraw the flow itself.
     *
     * An installer may be looking at the run when it is removed. Do this because
     * the run genuinely cannot continue, not to tidy up: the screen ends the
     * setup under them, and nothing explains why.
     *
     * Removing a run that is already finished, or naming a guide with no open
     * run, is a no-op.
     *
     * Not permission-gated, like the rest of this API: a guide name is resolved
     * within the calling package, so an app can only reach runs of guides it
     * ships itself.
     *
     * @param name - The {@link EnyoOnboardingV2Guide.name} of the guide whose run
     *   should be removed.
     * @param selector - Which run, when the guide can have more than one open.
     * @returns Promise that resolves once the host has ended the run.
     *
     * @example
     * ```typescript
     * // The appliance this maintenance flow services was deleted.
     * await energyApp.useOnboardingV2().removeOnboardingRun('wallbox-service', {applianceId});
     * ```
     */
    removeOnboardingRun(name: string, selector?: EnyoOnboardingV2RunSelector): Promise<void>;

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
