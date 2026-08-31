/**
 * Onboarding guide **v2 dynamic values** — the host asking an energy app to
 * resolve the value behind an {@link EnyoOnboardingV2DynamicBlock}.
 *
 * A guide never carries an OCPP URL or a device IP. It declares a *slot* — a
 * dynamic block naming an {@link EnyoOnboardingV2DynamicKind} — and the value is
 * filled in when the step is rendered. That indirection is what keeps a guide a
 * device-independent document: guides are pulled once and cached
 * ({@link EnyoOnboardingV2GuidesHandler}), so a value baked into one at build
 * time would be a snapshot served to every installation afterwards.
 *
 * This model says *who* fills the slot. The app usually knows better than the
 * host: it is the app that opened the OCPP endpoint
 * ({@link EnergyAppOcpp.getAvailableConnectionDetails}) and the app that knows
 * which of a device's addresses is the one an installer should type. So the host
 * asks, and the app answers — with a value, or with `null` when it has none.
 *
 * Answering is optional in the strongest sense: a dynamic block is passive
 * content with no routing handle, so an unresolved value never strands a run.
 * The step simply renders without it.
 *
 * Pure type declarations (no runtime logic). Register the handler through
 * {@link EnergyAppOnboardingV2} (`../packages/energy-app-onboarding-v2.ts`) and
 * check an answer before returning it with `validateOnboardingV2DynamicResult()`
 * (`../implementations/onboarding-v2/onboarding-v2-dynamic-validators.ts`).
 */

import type {EnyoOnboardingV2DynamicKind} from './enyo-onboarding-v2.js';

/**
 * One "resolve this dynamic value" request from the host.
 *
 * Raised while a step containing a dynamic block is being rendered, so it is on
 * the critical path of a screen an installer is looking at.
 */
export interface EnyoOnboardingV2DynamicRequest {
    /** Correlates this request with its result. Unique per request. */
    requestId: string;
    /**
     * Which value is wanted. One handler serves every kind, so switch on this —
     * an app that only knows some of them returns `null` for the rest rather
     * than guessing.
     */
    kind: EnyoOnboardingV2DynamicKind;
    /** The {@link EnyoOnboardingV2DynamicBlock.id} being rendered. */
    blockId: string;
    /**
     * The {@link EnyoOnboardingV2Step.name} the block sits on. Present so an app
     * can tell two slots of the same kind apart when a guide renders more than
     * one, and so a log line says where a `null` came from.
     */
    stepName: string;
    /**
     * The network device the run is bound to, when there is one.
     *
     * Absent on a run that never found a device — a `manual-setup` guide for an
     * OCPP wallbox has no network device at all, which is exactly the case
     * {@link EnyoOnboardingV2DynamicKind.OcppUrl} serves. A handler asked for
     * {@link EnyoOnboardingV2DynamicKind.DeviceIp} without this should answer
     * `null`.
     */
    networkDeviceId?: string;
    /** The appliance the run is bound to, when one exists already. */
    applianceId?: string;
    /**
     * The budget for this request, in milliseconds.
     *
     * The host owns the clock: it stops waiting once the budget is spent and
     * renders the step as if the value were unavailable. The handler is not
     * notified when that happens. An installer is waiting on this, so answer
     * from state the app already holds — resolving a dynamic value is not the
     * place for a vendor-cloud round trip.
     */
    timeoutMs: number;
}

/**
 * An app's answer to one {@link EnyoOnboardingV2DynamicRequest}.
 *
 * Resolve the handler with `null` instead of this when the value is not
 * available — see {@link EnyoOnboardingV2DynamicHandler} for what the host does
 * with each answer.
 */
export interface EnyoOnboardingV2DynamicResult {
    /** The {@link EnyoOnboardingV2DynamicRequest.requestId} this answers. */
    requestId: string;
    /** Echo of the requested kind, so a mismatched answer is caught rather than rendered. */
    kind: EnyoOnboardingV2DynamicKind;
    /**
     * The resolved value, exactly as the installer should see and copy it.
     *
     * This is a copy target, not prose: no surrounding text, no trailing
     * punctuation, no whitespace. For
     * {@link EnyoOnboardingV2DynamicKind.OcppUrl} that is the complete backend
     * URL the charger's configuration expects (`wss://…`); for
     * {@link EnyoOnboardingV2DynamicKind.DeviceIp} the bare address
     * (`192.168.1.42`) or a link to the device UI.
     *
     * An empty string is not a way to say "unavailable" — return `null` for
     * that.
     */
    value: string;
    /** Untranslated technical detail for support, e.g. which endpoint was chosen. Not shown to users. */
    detail?: string;
}
