import {
    EnyoCascadeGridFeeInfo,
    EnyoCascadeGridFeeSeries,
    EnyoCascadePriceSeries,
    EnyoCascadeTariff,
    EnyoCascadeTariffChangeEvent,
    EnyoCascadeTimeseriesRequest,
    EnyoCascadeTimeseriesResponse,
    EnyoMeterCascade,
    EnyoMeterCascadeChangeEvent,
} from "../types/enyo-meter-cascade.js";
import {
    EnyoElectricityTariff,
    EnyoTariffActivationResult,
    EnyoTariffPricePublication,
} from "../types/enyo-electricity-tariff.js";
import {
    EnyoDynamicGridFee,
    EnyoDynamicGridFeeRegistration,
    EnyoGridFeeChangeEvent,
    EnyoGridFeeValuesFilter,
} from "../types/enyo-grid-fee.js";
import {EnyoTariffPriceRange} from "./energy-app-electricity-tariff.js";

/**
 * Interface for the site's meter cascade: a second meter behind the primary
 * meter with its own electricity tariff and grid fee (see
 * {@link EnyoMeterCascade}).
 *
 * Three groups of methods:
 *
 * - **Topology** — {@link isActive}, {@link getCascade},
 *   {@link getApplianceIds}, {@link isApplianceBehindCascade} and
 *   {@link onCascadeChanged} say whether a cascade is in effect, whether it is
 *   working, and which appliances it covers; {@link getCascadeTimeseries}
 *   returns its history.
 * - **Tariff and prices** — the cascade has a **consumption tariff only**
 *   (feed-in leaves through the primary meter). Everyone reads it with
 *   {@link getTariff}, {@link getPrices} and {@link onTariffChanged}. The core
 *   owns it by default; an app providing a **dynamic** tariff can take it over
 *   via {@link onTariffSelected} → {@link setTariff}, then feeds
 *   {@link publishPrices}.
 * - **Grid fee** — {@link getGridFee}, {@link getGridFeeValues} and
 *   {@link onGridFeeChanged} read the cascade's grid fee. It is provided
 *   either by the core or by the app that owns the cascade tariff, which
 *   writes it with {@link registerGridFee} / {@link removeGridFee}.
 *
 * **Inheritance.** Until Z2 has a tariff or grid fee of its own, the hub prices
 * it with the site's (Z1) — and so does this API: {@link getTariff},
 * {@link getPrices}, {@link getGridFee} and {@link getGridFeeValues} then
 * return the site's values with `inheritedFromSite: true` instead of `null`.
 * An app therefore always computes the same Z2 price as the hub.
 *
 * **Prices are effective prices.** {@link getPrices} and
 * `useElectricityTariff().getPricesForAppliance()` already contain the billing meter's own grid
 * fee and taxes (see the series' `includes`). Use the grid fee methods only to
 * show the fee separately — never add it on top.
 *
 * To price an appliance, use `useElectricityTariff().getPricesForAppliance()`:
 * it returns the series that actually bills any appliance — Z2's if it is
 * behind an active cascade, otherwise Z1's — filled slot by slot, with the
 * fallback applied.
 *
 * **Split rule.** PV and battery cover Z2 first; Z2 only pays the cascade
 * tariff for what Z1 imports at the same moment (see {@link EnyoMeterCascade}).
 * For what the cascade is actually drawing and costing, listen to the
 * `CascadeSplitUpdateV1` data bus message (live) and use
 * {@link getCascadeTimeseries} (history).
 *
 * The site has at most one cascade. While none is configured, topology getters
 * resolve to `null` / `false` / `[]`, cascade price and grid fee getters to
 * `null`, and the write methods reject.
 *
 * Permissions — existing ones, no new one:
 * - Topology ({@link isActive}, {@link getCascade}, {@link getApplianceIds},
 *   {@link isApplianceBehindCascade}, {@link onCascadeChanged}) and tariff /
 *   price reads ({@link getTariff}, {@link getPrices},
 *   {@link onTariffChanged}): none, like the site's tariff reads.
 * - {@link getCascadeTimeseries}: `Timeseries`.
 * - Grid fee reads: `GridFeeUse`; grid fee writes: `GridFeeRegister`, and
 *   only for the app that owns the cascade tariff.
 * - Providing the tariff ({@link onTariffSelected}, {@link setTariff},
 *   {@link publishPrices}): `ElectricityTariff`.
 * - The `CascadeSplitUpdateV1` and `AggregatedStateUpdateV1` messages:
 *   `SubscribeDataBus`.
 *
 * @example
 * ```typescript
 * const cascade = energyApp.useCascade();
 *
 * if (await cascade.isApplianceBehindCascade('heatpump-1')) {
 *     // Effective Z2 prices per 15-minute slot, grid fee included — do not add one.
 *     const prices = await cascade.getPrices({fromIso, untilIso});
 * }
 * // Or, for any appliance: energyApp.useElectricityTariff().getPricesForAppliance(id, range)
 * ```
 */
export interface EnergyAppCascade {
    // Topology

    /**
     * Whether the site has a cascade that is currently in effect.
     *
     * `false` both when no cascade is configured and when one is configured
     * but inactive — in either case every appliance is billed on the site's
     * tariff and grid fee.
     *
     * `true` does not mean the cascade is working yet: check
     * {@link EnyoMeterCascade.status} via {@link getCascade} to tell "switched
     * on but nothing assigned" ({@link EnyoCascadeStatusEnum.NoCascadeSource})
     * from {@link EnyoCascadeStatusEnum.Live}.
     *
     * @returns Promise resolving to `true` when an active cascade exists
     */
    isActive(): Promise<boolean>;

    /**
     * Returns the site's cascade — whether it is active, its
     * {@link EnyoMeterCascade.status status}, whether it is
     * {@link EnyoMeterCascade.estimated estimated} from its appliances instead
     * of metered, its meter (absent when estimated), the meter it sits behind
     * and the appliances behind it — or `null` when none is configured.
     *
     * @returns Promise resolving to the cascade, or `null`
     */
    getCascade(): Promise<EnyoMeterCascade | null>;

    /**
     * Returns the IDs of the appliances behind the cascade meter, i.e. the ones
     * billed on the cascade's tariff and grid fee. Resolves to `[]` when no
     * cascade is configured.
     *
     * Returned regardless of {@link isActive}: the appliances are physically
     * behind the meter either way. Check {@link isActive} to know whether the
     * cascade's tariff applies to them.
     *
     * @returns Promise resolving to the appliance IDs behind the cascade meter
     */
    getApplianceIds(): Promise<string[]>;

    /**
     * Whether an appliance is billed on the cascade — i.e. a cascade is
     * {@link isActive active} and the appliance is behind its meter.
     *
     * @param applianceId - The appliance to check
     * @returns Promise resolving to `true` when the cascade's tariff and grid fee apply to the appliance
     */
    isApplianceBehindCascade(applianceId: string): Promise<boolean>;

    /**
     * Registers a listener invoked whenever the cascade is created, changed
     * (activated, deactivated, appliances moved) or removed.
     *
     * Use it to re-assign appliances to the right prices without polling.
     *
     * @param listener - Callback invoked with the change event
     * @returns A function that removes this listener when called; calling it twice is a no-op
     */
    onCascadeChanged(listener: (event: EnyoMeterCascadeChangeEvent) => void | Promise<void>): () => void;

    /**
     * Returns the cascade's history: per bucket, the energy of each share
     * (household grid, cascade grid, cascade self-consumed) in kWh and what
     * the household (Z1) and cascade (Z2) shares cost, in ct.
     *
     * The historical counterpart of the live `CascadeSplitUpdateV1` data bus
     * message, served from the hub's aggregation tiers: `'1m'` (kept 31 days),
     * `'15m'`, `'1d'` and `'1mo'`. Costs are priced at read time with the
     * tariffs then in force (see {@link EnyoCascadeTimeseriesEntry}). Returns
     * `null` when no cascade is configured; buckets without an active cascade
     * are omitted.
     *
     * Requires the `Timeseries` permission.
     *
     * @param request - The time range and bucket size
     * @returns Promise resolving to the cascade history, or `null`
     *
     * @example
     * ```typescript
     * const history = await cascade.getCascadeTimeseries({
     *     fromIso: '2026-10-01T00:00:00Z',
     *     untilIso: '2026-10-02T00:00:00Z',
     *     resolution: '15m',
     * });
     * const cascadeCostEur = (history?.entries.reduce((sum, e) => sum + e.cascadeCostCt, 0) ?? 0) / 100;
     * ```
     */
    getCascadeTimeseries(request: EnyoCascadeTimeseriesRequest): Promise<EnyoCascadeTimeseriesResponse | null>;

    // Electricity tariff and prices (consumption only)

    /**
     * Returns the tariff that bills Z2's consumption. While Z2 has no tariff of
     * its own, that is the site's consumption tariff, returned with
     * {@link EnyoCascadeTariff.inheritedFromSite} set. `null` only when no
     * cascade is configured, or neither Z2 nor the site has a tariff.
     *
     * The cascade has a **consumption tariff only**: anything fed in leaves
     * through the primary meter and is paid on the site's feed-in tariff
     * (`useElectricityTariff().getTariff(EnyoTariffDirectionEnum.FeedIn)`).
     *
     * By default the core owns this tariff (the user enters it in the hub). An
     * app owns it only after the user selected it as the cascade's tariff
     * provider and it called {@link setTariff} — see {@link onTariffSelected}.
     * {@link EnyoCascadeTariff.owner} says who owns it; compare
     * {@link EnyoElectricityTariff.externalTariffId} against your own to tell
     * whether it is yours.
     *
     * @returns Promise resolving to the tariff billing Z2, or `null`
     */
    getTariff(): Promise<EnyoCascadeTariff | null>;

    /**
     * Returns the effective consumption prices of Z2 over a time range, as a
     * **15-minute series** — the same resolution as the site's prices and the
     * grid fee series, so they zip index-by-index.
     *
     * Effective means: the series already contains Z2's grid fee and taxes, as
     * declared in {@link EnyoTariffPriceSeries.includes}. Do not add
     * {@link getGridFeeValues} on top.
     *
     * Served by the host whoever owns the tariff: computed from the tariff's
     * pricing when the core owns it, or from what the owning app published with
     * {@link publishPrices}. While Z2 has no tariff of its own, the site's
     * prices are returned with {@link EnyoCascadePriceSeries.inheritedFromSite}
     * set — never `null` in that case. `null` only when no cascade is
     * configured or neither meter has prices for the range.
     *
     * @param range - The time range to cover
     * @returns Promise resolving to Z2's price series, or `null`
     */
    getPrices(range: EnyoTariffPriceRange): Promise<EnyoCascadePriceSeries | null>;

    /**
     * Registers a listener invoked whenever the cascade's own tariff changes —
     * set by the core, taken over by an app, replaced, or cleared (after which
     * Z2 inherits the site's tariff). Does not fire
     * for the site's tariffs; subscribe to
     * `useElectricityTariff().onTariffChanged()` for those.
     *
     * An app that owned the cascade tariff should watch this to notice that it
     * lost ownership (e.g. the user switched back to a core-managed tariff) and
     * stop publishing prices.
     *
     * @param listener - Callback invoked with the change event
     * @returns A function that removes this listener when called; calling it twice is a no-op
     */
    onTariffChanged(listener: (event: EnyoCascadeTariffChangeEvent) => void | Promise<void>): () => void;

    /**
     * Offers this app as a provider of a **dynamic** cascade tariff, and
     * registers the handler the host calls when the user selects it — "my
     * heatpump runs on my Tibber tariff".
     *
     * Registering the handler is what makes the app appear in the hub's
     * cascade tariff selection; an app that does not register one is never
     * offered there. The cascade tariff otherwise stays with the core.
     *
     * The handler runs the app's activation flow and reports what it found,
     * exactly like `useElectricityTariff().onTariffSelected()`: return
     * {@link EnyoTariffActivationStatusEnum.AuthenticationRequired} or
     * {@link EnyoTariffActivationStatusEnum.OnboardingRequired} (with the
     * `authenticationUrl` / `onboardingGuideId`) to have the host send the user
     * somewhere, and call {@link setTariff} once the tariff is usable — that is
     * what takes over the slot. Returning
     * {@link EnyoTariffActivationStatusEnum.Success} without having called
     * {@link setTariff} leaves the tariff with its previous owner.
     *
     * Independent of `useElectricityTariff().onTariffSelected()`: an app may
     * register both, and the host calls whichever matches what the user
     * selected. One cascade handler per app; registering again replaces the
     * previous one.
     *
     * Requires the `ElectricityTariff` permission.
     *
     * @param handler - Called when the user selects this app as the cascade's tariff provider
     * @returns A function that removes the handler — and withdraws the offer — when called
     */
    onTariffSelected(handler: () => Promise<EnyoTariffActivationResult>): () => void;

    /**
     * Takes over the cascade's consumption tariff with this app's dynamic
     * tariff, replacing whatever was there — including a core-managed tariff.
     *
     * **Calling this is the activation signal**, as with
     * `useElectricityTariff().setTariff()`. Only allowed after the user
     * selected this app via {@link onTariffSelected} (directly in the handler,
     * or later when an OAuth redirect or onboarding guide completes). Re-setting
     * an unchanged tariff while owning the slot is harmless.
     *
     * Only dynamic tariffs can be provided by apps:
     * `tariff.pricing.type` must be {@link EnyoTariffPricingTypeEnum.Dynamic}.
     * Static and time-variable cascade tariffs are managed by the core.
     *
     * Rejects when no cascade is configured, the user has not selected this app
     * for the cascade tariff, or the tariff is not dynamic.
     *
     * Requires the `ElectricityTariff` permission.
     *
     * @param tariff - The dynamic tariff and its pricing details
     * @returns Promise resolving to the activation outcome
     */
    setTariff(tariff: EnyoElectricityTariff): Promise<EnyoTariffActivationResult>;

    /**
     * Publishes consumption prices for the cascade tariff this app owns. The
     * host serves them to every {@link getPrices} caller afterwards.
     *
     * Entries replace previously published entries with the same timestamp and
     * leave the rest alone. Declare in
     * {@link EnyoTariffPricePublication.includes} what the prices already
     * contain. The host serves effective prices from {@link getPrices}, so if
     * you publish pure energy prices it adds Z2's grid fee and taxes itself;
     * if you folded them in, say so here.
     *
     * Rejects when this app does not own the cascade tariff (the core owns it,
     * or another app does) or no cascade is configured. Ownership is checked
     * against the cascade slot only — owning the site's consumption tariff does
     * not allow publishing here.
     *
     * Requires the `ElectricityTariff` permission.
     *
     * @param prices - The priced intervals and what they already contain
     * @returns Promise that resolves once the prices are stored and listeners dispatched
     */
    publishPrices(prices: EnyoTariffPricePublication): Promise<void>;

    // Grid fee

    /**
     * Sets Z2's own grid fee (e.g. the reduced §14a EnWG network charge for a
     * controllable heatpump), replacing whatever was registered before. From
     * then on Z2 no longer inherits the site's fee.
     *
     * The cascade grid fee comes **with the cascade tariff**: it is provided
     * by the core, or by the app that owns the cascade tariff (see
     * {@link setTariff}). Only that app may call this — a tariff provider whose
     * contract already states the reduced network charge publishes it here
     * alongside its prices. When the app loses the cascade tariff, the grid fee
     * it registered goes with it and the core's (or the inherited site's)
     * applies again.
     *
     * Same semantics as `useGridFee().registerGridFee()`, scoped to the
     * cascade meter. Rejects when no cascade is configured or this app does
     * not own the cascade tariff.
     *
     * Requires the `GridFeeRegister` permission.
     *
     * @param registration - The complete grid fee, including its schedule
     * @returns Promise that resolves to the stored grid fee, including the host-assigned `publishedAtIso`
     */
    registerGridFee(registration: EnyoDynamicGridFeeRegistration): Promise<EnyoDynamicGridFee>;

    /**
     * Removes the grid fee this app registered for Z2; the core's fee, or
     * else the inherited site's, applies again afterwards. A no-op when this
     * app registered none. Rejects when this app does not own the cascade
     * tariff.
     *
     * Requires the `GridFeeRegister` permission.
     *
     * @returns Promise that resolves when the grid fee has been removed
     */
    removeGridFee(): Promise<void>;

    /**
     * Answers "what grid fee applies behind Z2?" in one call — static or
     * dynamic, with the gross cent per kWh when static.
     *
     * Z2's own fee comes from the core or from the app owning the cascade
     * tariff ({@link EnyoCascadeGridFeeInfo.owner}). While Z2 has none, the
     * hub prices it with the site's fee, so this returns the site's fee with
     * {@link EnyoCascadeGridFeeInfo.inheritedFromSite} set. `null` only when
     * no cascade is configured or neither meter has a grid fee.
     *
     * Informational: the fee is already contained in {@link getPrices} and
     * `useElectricityTariff().getPricesForAppliance()`. Use it to show the fee
     * separately.
     *
     * Requires the `GridFeeUse` permission.
     *
     * @returns Promise resolving to the grid fee billing Z2, or `null`
     */
    getGridFee(): Promise<EnyoCascadeGridFeeInfo | null>;

    /**
     * Resolves the grid fee billing Z2 to a flat 15-minute series of gross
     * cent per kWh over the requested range — the site's series with
     * {@link EnyoCascadeGridFeeSeries.inheritedFromSite} set while Z2 has no
     * fee of its own. `null` only when no cascade is configured or neither
     * meter has a grid fee.
     *
     * Informational: the fee is already contained in {@link getPrices}; never
     * add this series to it.
     *
     * Requires the `GridFeeUse` permission.
     *
     * @param filter - The time range and whether to include additional fees
     * @returns Promise that resolves to the 15-minute fee series, or `null`
     */
    getGridFeeValues(filter: EnyoGridFeeValuesFilter): Promise<EnyoCascadeGridFeeSeries | null>;

    /**
     * Registers a listener invoked whenever Z2's own grid fee is registered,
     * replaced or removed — by the core or by the app owning the cascade
     * tariff, including when it goes away because that app lost the tariff. Does not fire for the site's grid fee — which Z2
     * may be inheriting — so subscribe to `useGridFee().onGridFeeChanged()`
     * as well when that matters.
     *
     * Requires the `GridFeeUse` permission.
     *
     * @param listener - Callback invoked with the change event
     * @returns A function that removes this listener when called; calling it twice is a no-op
     */
    onGridFeeChanged(listener: (event: EnyoGridFeeChangeEvent) => void | Promise<void>): () => void;
}
