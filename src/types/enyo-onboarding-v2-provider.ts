/**
 * Onboarding guide **v2 provisioning** — the host asking an energy app to hand
 * over the guides it ships.
 *
 * This inverts how guides used to reach enyo. Previously an app *pushed* its
 * guides out (the v1 {@link EnergyAppOnboarding.saveOnboardingGuide} surface,
 * and the guide editor's create/update calls): the app decided when to publish,
 * the host stored a copy, and the two could drift — a guide fixed in the app's
 * source stayed stale on the host until someone remembered to re-publish it.
 *
 * The v2 model *pulls* instead. The app registers one handler
 * ({@link EnyoOnboardingV2GuidesHandler}) and the host calls it with
 * "give me your v2 onboarding guides". The app answers with **all** of them or
 * with **nothing** — there is no partial answer and no per-guide lifecycle to
 * keep in sync, because every call replaces the host's whole picture of what
 * this app offers. Deleting a guide is deleting it from the returned array.
 *
 * The app is the single source of truth; the host caches at most a snapshot of
 * the last answer.
 *
 * Pure type declarations (no runtime logic). Register the handler through
 * {@link EnergyAppOnboardingV2} (`../packages/energy-app-onboarding-v2.ts`) and
 * check an answer before returning it with `validateOnboardingV2GuidesResult()`
 * (`../implementations/onboarding-v2/onboarding-v2-provider-validators.ts`).
 */

import type {EnyoOnboardingV2Guide} from './enyo-onboarding-v2.js';

/**
 * Who asked for the guides. One handler serves every caller, so an app builds
 * its guides once; this field exists so an app can tell a routine catalog
 * refresh apart from a request made while an installer is standing in front of
 * a device.
 */
export enum EnyoOnboardingV2GuidesOriginEnum {
    /**
     * The host is refreshing its catalog of what this app offers — on install,
     * on update, or on a periodic sync. Not time-critical, and nobody is
     * waiting on a screen.
     */
    CatalogSync = 'catalog-sync',
    /**
     * An installer is starting an onboarding run and the host needs the current
     * guide for the device in front of them. Answer fast: this call is on the
     * critical path of a screen.
     */
    OnboardingStart = 'onboarding-start',
    /** A user or support agent explicitly asked the host to re-read the guides. */
    UserRequest = 'user-request',
}

/**
 * One "give me your v2 onboarding guides" request from the host.
 *
 * Deliberately carries no filter. The host does not ask for *some* guides — it
 * asks for everything this app has and filters the answer itself against the
 * vendor, model and start variant of the run at hand. That keeps the app's
 * side of the contract a single, cacheable computation instead of a query
 * engine whose filtering could disagree with the host's.
 */
export interface EnyoOnboardingV2GuidesRequest {
    /** Correlates this request with its result. Unique per request. */
    requestId: string;
    /** Who asked for the guides. */
    origin: EnyoOnboardingV2GuidesOriginEnum;
    /**
     * The budget for this request, in milliseconds.
     *
     * The host owns the clock: it stops waiting once the budget is spent and
     * treats the answer as *nothing* — the app's previously cached guides, if
     * any, are left untouched rather than cleared, so a slow app degrades to
     * stale guides and not to no guides at all. The handler is not notified when
     * the host gives up, so bound the work to fit: build the guides in memory,
     * do not go to the network for them.
     */
    timeoutMs: number;
}

/**
 * An app's answer to one {@link EnyoOnboardingV2GuidesRequest}.
 *
 * The complete set, always. The host replaces everything it knows about this
 * app's guides with {@link guides}, so a guide that is missing from the array is
 * a guide that no longer exists — this is how a guide is retired.
 *
 * "Nothing" — an app that ships no guides, or cannot produce them right now — is
 * expressed by resolving the handler with `null`, **not** with an empty
 * {@link guides} array: an empty array is the deliberate statement "I have no
 * guides, drop the ones you cached", while `null` means "I am not answering,
 * keep what you have". The distinction is the difference between retiring every
 * guide of an app and surviving a transient failure during startup.
 */
export interface EnyoOnboardingV2GuidesResult {
    /** The {@link EnyoOnboardingV2GuidesRequest.requestId} this answers. */
    requestId: string;
    /**
     * Every guide this app offers. May be empty — see the note on
     * {@link EnyoOnboardingV2GuidesResult} for what an empty array means as
     * opposed to a `null` answer.
     *
     * Each guide should carry the `vendorId` / `modelIds` and `startVariant` it
     * applies to: those are what the host matches a run against, and a guide
     * without them cannot be selected for any device. Two guides claiming the
     * same vendor + model + start variant collide — the host keeps neither.
     */
    guides: EnyoOnboardingV2Guide[];
    /** Untranslated technical detail for support, e.g. a build id. Not shown to users. */
    detail?: string;
}
