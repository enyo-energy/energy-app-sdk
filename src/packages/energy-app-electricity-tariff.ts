import {
    EnyoElectricityTariff,
    EnyoTariffActivationResult,
    EnyoTariffChangeEvent,
    EnyoTariffDirectionEnum,
    EnyoTariffPricePublication,
    EnyoTariffPriceSeries,
} from "../types/enyo-electricity-tariff.js";

/**
 * The time range a price query covers.
 */
export interface EnyoTariffPriceRange {
    /** Start of the requested range in ISO format (inclusive). */
    fromIso: string;
    /** End of the requested range in ISO format (exclusive). */
    untilIso: string;
}

/**
 * Interface for reading and supplying the site's electricity tariffs.
 *
 * A site has **two tariff slots** — one for consumption, one for feed-in — and
 * everything here addresses them by {@link EnyoTariffDirectionEnum}. There is no
 * list of tariffs, no default flag and no tariff id: occupying a slot is what it
 * means to be the tariff in force.
 *
 * Six methods, split by role. A **consumer** asks {@link getTariff} what applies
 * and {@link getPrices} what it costs, and follows {@link onTariffChanged}. An
 * **owner** — the app integrating a provider like Tibber or Ostrom — answers
 * {@link onTariffSelected} when the user picks it, calls {@link setTariff} once
 * its tariff is usable, and feeds {@link publishPrices} as new prices arrive.
 *
 * A tariff carries no grid fee. A network charge belongs to the site's grid
 * connection, not to the supplier contract — read it from `useGridFee()` and
 * combine the two with `composeElectricityPrices()`.
 *
 * @example
 * ```typescript
 * const tariffs = energyApp.useElectricityTariff();
 *
 * // Owner: the user picked us in the app UI.
 * tariffs.onTariffSelected(async direction => {
 *     if (!await isAuthenticated()) {
 *         return {
 *             status: EnyoTariffActivationStatusEnum.AuthenticationRequired,
 *             authenticationUrl: buildOAuthUrl(direction),
 *         };
 *     }
 *     await tariffs.setTariff(direction, myTariff);
 *     return {status: EnyoTariffActivationStatusEnum.Success};
 * });
 * ```
 */
export interface EnergyAppElectricityTariff {
    /**
     * Returns the tariff currently filling a direction slot, whichever app owns
     * it, or `null` when the slot is empty.
     *
     * `null` is a normal answer — a site with no feed-in contract has no feed-in
     * tariff — and not an error.
     *
     * @param direction - Which slot to read
     * @returns Promise resolving to the tariff in that slot, or `null`
     */
    getTariff(direction: EnyoTariffDirectionEnum): Promise<EnyoElectricityTariff | null>;

    /**
     * Returns prices for one direction over a time range, as a **15-minute
     * series** — the same resolution `useGridFee().getGridFeeValues()` and
     * `useEpexSpotPrices().getPrices()` use, so all three zip index-by-index.
     *
     * The host serves this from what the slot's owning app published with
     * {@link publishPrices}, so a consumer never has to know which app is behind
     * the tariff. Returns `null` when the slot is empty or nothing has been
     * published covering the range.
     *
     * Read {@link EnyoTariffPriceSeries.includes} before adding anything to
     * these prices: a series that already contains the grid fee must not have
     * one added on top.
     *
     * @param direction - Which slot to price
     * @param range - The time range to cover
     * @returns Promise resolving to the price series, or `null` when none applies
     *
     * @example
     * ```typescript
     * const prices = await tariffs.getPrices(EnyoTariffDirectionEnum.Consumption, {
     *     fromIso, untilIso,
     * });
     * const needsGridFee = !prices?.includes.includes(EnyoPriceComponentEnum.GridFee);
     * ```
     */
    getPrices(direction: EnyoTariffDirectionEnum, range: EnyoTariffPriceRange): Promise<EnyoTariffPriceSeries | null>;

    /**
     * Puts this app's tariff into a direction slot, replacing whatever was
     * there.
     *
     * **Calling this is the activation signal.** An app calls it once its tariff
     * is actually usable — credentials valid, contract fetched — whether that is
     * immediately when the user selects it or later, when an OAuth redirect
     * comes back or an onboarding guide completes. There is nothing else to
     * report afterwards.
     *
     * Full replacement is the only write there is: a partial update would let an
     * app half-change a tariff another app owns. Re-setting an unchanged tariff
     * is harmless, so an app that refetches its contract on every start can call
     * this unconditionally.
     *
     * The returned {@link EnyoTariffActivationResult} is the host's answer, not
     * the app's — it reports whether the slot is now live or whether the host
     * still needs something from the user.
     *
     * Requires the `ElectricityTariff` permission.
     *
     * @param direction - Which slot to fill
     * @param tariff - The tariff and its pricing details
     * @returns Promise resolving to the activation outcome
     */
    setTariff(direction: EnyoTariffDirectionEnum, tariff: EnyoElectricityTariff): Promise<EnyoTariffActivationResult>;

    /**
     * Publishes prices for a slot this app owns.
     *
     * Push, not pull: providers hand out prices on their own schedule — day-ahead
     * prices land in the afternoon, and provider APIs are rate-limited — so an
     * app fetches when it makes sense and publishes what it got. The host serves
     * those to every {@link getPrices} caller afterwards.
     *
     * Entries replace previously published entries with the same timestamp and
     * leave the rest alone, so republishing a corrected day does not erase the
     * days around it.
     *
     * Declare in {@link EnyoTariffPricePublication.includes} what the prices
     * already contain. An app that folds the grid fee in before publishing must
     * say so, or every consumer will add it a second time.
     *
     * Fails when this app does not own the slot — only the tariff's owner may
     * price it.
     *
     * Requires the `ElectricityTariff` permission.
     *
     * @param direction - Which slot the prices belong to
     * @param prices - The priced intervals and what they already contain
     * @returns Promise that resolves once the prices are stored and listeners dispatched
     */
    publishPrices(direction: EnyoTariffDirectionEnum, prices: EnyoTariffPricePublication): Promise<void>;

    /**
     * Registers the handler the host calls when the user picks this app's tariff
     * for a direction — "this should be my consumption tariff".
     *
     * Not a notification: the handler runs the app's activation flow and reports
     * what it found. Returning
     * {@link EnyoTariffActivationStatusEnum.AuthenticationRequired} or
     * {@link EnyoTariffActivationStatusEnum.OnboardingRequired} tells the host to
     * send the user somewhere, so carry the `authenticationUrl` or
     * `onboardingGuideId` that makes it actionable. When the flow later
     * completes, call {@link setTariff} — that is what marks the tariff live.
     *
     * Returning {@link EnyoTariffActivationStatusEnum.Success} without having
     * called {@link setTariff} leaves the slot empty; return it only when the
     * tariff is already set.
     *
     * One handler per app. Registering again replaces the previous one.
     *
     * @param handler - Called with the direction the user selected this app for
     * @returns A function that removes the handler when called
     */
    onTariffSelected(
        handler: (direction: EnyoTariffDirectionEnum) => Promise<EnyoTariffActivationResult>,
    ): () => void;

    /**
     * Registers a listener invoked whenever either slot changes — a tariff set,
     * replaced, or cleared.
     *
     * This is the signal to recompose prices. It fires for changes made by every
     * app, so filter on {@link EnyoTariffChangeEvent.direction} when only one
     * slot matters, and compare
     * {@link EnyoElectricityTariff.externalTariffId} against your own to notice
     * that a slot you were publishing for is now owned by someone else.
     *
     * Returns the unsubscribe function directly; calling it twice is a no-op.
     *
     * @param listener - Callback invoked with the change event
     * @returns A function that removes this listener when called
     */
    onTariffChanged(listener: (event: EnyoTariffChangeEvent) => void | Promise<void>): () => void;
}
