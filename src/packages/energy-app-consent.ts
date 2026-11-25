import type {EnyoConsentState} from '../types/enyo-consent.js';

/**
 * Listener called when the answer to one of this package's consents changes.
 *
 * @param state - The new state of the consent that changed.
 */
export type EnyoConsentChangeListener = (state: EnyoConsentState) => void | Promise<void>;

/**
 * Interface for reading the consents this package declares
 * ({@link EnergyAppPackageDefinition.consents}) and reacting when they are given
 * or withdrawn.
 *
 * Consents are asked for by the host — in an onboarding guide's `consent` block
 * or before an additional-setup block runs — and recorded by enyo with the
 * version, the role of the person who agreed and the time. The app only reads
 * the result. It cannot give or withdraw a consent itself: a record the app
 * could write would prove nothing.
 *
 * **Act on {@link EnyoConsentState.granted}, and keep acting on it.** A customer
 * can withdraw a consent at any time in the enyo app, and a new package version
 * that changes a consent's `version` makes every earlier answer stop counting.
 * Read the state on boot, and switch off what depends on a consent as soon as
 * {@link listenForConsentChanges} reports it is no longer granted.
 *
 * This API is available to every app — it is not permission-gated. An app only
 * ever sees the consents of its own package.
 *
 * @example
 * ```typescript
 * const consent = energyApp.useConsent();
 *
 * const apply = (state: EnyoConsentState) => {
 *     if (state.consentKey === 'share-usage-data') usageSharing.setEnabled(state.granted);
 * };
 *
 * (await consent.getConsents()).forEach(apply);
 * consent.listenForConsentChanges(apply);
 * ```
 */
export interface EnergyAppConsent {
    /**
     * Returns the state of every consent this package declares, one entry per
     * declared consent — including those never answered, with
     * `granted: false`.
     *
     * @returns Promise resolving to the states, in declaration order.
     */
    getConsents(): Promise<EnyoConsentState[]>;

    /**
     * Returns the state of one consent.
     *
     * @param consentKey - The {@link EnergyAppPackageConsent.consentKey} to read.
     * @returns Promise resolving to the state, or `null` when the package
     *   declares no consent with that key.
     */
    getConsent(consentKey: string): Promise<EnyoConsentState | null>;

    /**
     * Registers a listener that is called whenever one of this package's
     * consents is given, withdrawn, or stops counting because the package
     * changed its version.
     *
     * @param listener - Called with the new state of the consent that changed.
     * @returns The listener id, to pass to {@link removeListener}.
     */
    listenForConsentChanges(listener: EnyoConsentChangeListener): string;

    /**
     * Removes a listener registered with {@link listenForConsentChanges}.
     * Removing an unknown id is a no-op.
     *
     * @param listenerId - The id returned when the listener was registered.
     */
    removeListener(listenerId: string): void;
}
