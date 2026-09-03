import {
    EnyoDynamicGridFee,
    EnyoDynamicGridFeeRegistration,
    EnyoGridFeeChangeEvent,
    EnyoGridFeeInfo,
    EnyoGridFeeSeries,
    EnyoGridFeeValuesFilter,
} from '../types/enyo-grid-fee.js';

/**
 * Interface for publishing and consuming grid fees (network charges).
 *
 * Five methods, split by role. A **producer** — an app that knows the local grid
 * operator's tariff sheet or fetches a published series — owns
 * {@link registerGridFee} and {@link removeGridFee}. A **consumer** asks
 * {@link getGridFee} what applies and {@link getGridFeeValues} for the numbers
 * over a range, and subscribes with {@link onGridFeeChanged}. Nothing else is
 * needed, so nothing else is offered.
 *
 * Publishing requires the `GridFeeRegister` permission; consuming requires
 * `GridFeeUse`.
 *
 * A grid fee describes the site's **grid connection**, not a supplier contract:
 * it is registered and resolved independently of any tariff, and the same fee
 * applies whichever supplier the site buys from. This API is the *only* place a
 * grid fee lives — a tariff declares nothing about how the fee is determined,
 * so there is no second source to reconcile against.
 *
 * **A site has exactly one grid fee.** It has one grid connection, and the
 * operator of that connection publishes one network charge for it. So nothing
 * here takes an identifier: registering replaces whatever was there, and reading
 * needs no selector.
 *
 * **Nothing here is applied to a price automatically.** The host never folds a
 * grid fee into {@link EnergyAppEnergyPrices.getPrices}, because provider APIs
 * differ: some already return grid-fee-inclusive prices, some do not. The app
 * that owns the tariff knows which is the case — it declares it via the
 * price series' `includes` list and composes the effective price
 * itself with `composeElectricityPrices()`. That flag is the one thing a tariff
 * says about grid fees, and it describes the provider's price feed rather than
 * the fee.
 *
 * @example
 * ```typescript
 * // Producer: a §14a EnWG module 3 HT/NT network charge
 * const gridFee = energyApp.useGridFee();
 * await gridFee.registerGridFee({
 *     name: 'Netzentgelt HT/NT 2026',
 *     gridOperator: 'Netze BW',
 *     currency: EnyoCurrencyEnum.EUR,
 *     timezone: 'Europe/Berlin',
 *     appliesTo: EnyoPriceAppliesToEnum.Consumption,
 *     moduleThreeCompliant: true,
 *     schedule: {
 *         type: EnyoPriceScheduleTypeEnum.Recurring,
 *         windows: [
 *             { startTimeOfDay: '06:00', endTimeOfDay: '22:00', amountPerKwh: 0.0912 },
 *             { startTimeOfDay: '22:00', endTimeOfDay: '06:00', amountPerKwh: 0.0431 },
 *         ],
 *     },
 * });
 *
 * // Consumer: resolve it for the next 24 hours
 * const fees = await gridFee.getGridFeeValues({
 *     fromIso: new Date().toISOString(),
 *     untilIso: new Date(Date.now() + 86_400_000).toISOString(),
 * });
 * ```
 */
export interface EnergyAppGridFee {
    /**
     * Sets the site's grid fee, replacing whatever was registered before.
     *
     * Full replacement is the only write there is, and it is enough for every
     * case — correcting a name, moving to next year's tariff sheet, or
     * republishing a day-ahead schedule are all "here is the fee now". A partial
     * update would only add a second way to say the same thing, and a
     * schedule-only write would let metadata and windows drift apart.
     *
     * There is no identifier and no create-versus-update distinction: the site
     * has one grid connection and therefore one grid fee. Two apps that both
     * register one will overwrite each other, so an app should only publish a
     * fee it is actually authoritative for.
     *
     * Requires the `GridFeeRegister` permission.
     *
     * @param registration - The complete grid fee, including its schedule
     * @returns Promise that resolves to the stored grid fee, including the host-assigned `publishedAtIso`
     *
     * @example
     * ```typescript
     * // Republishing tomorrow's day-ahead windows is the same call.
     * await gridFee.registerGridFee({...fee, schedule: {
     *     type: EnyoPriceScheduleTypeEnum.Absolute,
     *     windows: tomorrowsWindows,
     * }});
     * ```
     */
    registerGridFee(registration: EnyoDynamicGridFeeRegistration): Promise<EnyoDynamicGridFee>;

    /**
     * Removes the site's grid fee. {@link getGridFee} and
     * {@link getGridFeeValues} resolve to `null` afterwards. If no fee is
     * registered, this operation is a no-op.
     *
     * Requires the `GridFeeRegister` permission.
     *
     * @returns Promise that resolves when the grid fee has been removed
     */
    removeGridFee(): Promise<void>;

    /**
     * Answers "what grid fee applies here?" in one call.
     *
     * This is the entry point for consuming a grid fee. The returned
     * {@link EnyoGridFeeInfo} says whether the fee is
     * {@link EnyoGridFeeTypeEnum.Static static} or
     * {@link EnyoGridFeeTypeEnum.Dynamic dynamic}, carries the gross cent per
     * kWh outright when it is static, and reports any additional fixed charges
     * separately. A static fee needs no second call; a dynamic one is fetched
     * interval by interval with {@link getGridFeeValues}.
     *
     * Takes no arguments — the site has one grid fee, so there is nothing to
     * select. Returns `null` when none is registered, which is a normal answer
     * and not an error.
     *
     * Requires the `GridFeeUse` permission.
     *
     * @returns Promise resolving to the site's grid fee, or `null` when none is registered
     *
     * @example
     * ```typescript
     * const fee = await gridFee.getGridFee();
     * if (fee?.type === EnyoGridFeeTypeEnum.Static) {
     *     show(fee.grossCentPerKwh, fee.additionalFeesGrossCentPerKwh);
     * } else if (fee) {
     *     const series = await gridFee.getGridFeeValues({fromIso, untilIso});
     * }
     * ```
     */
    getGridFee(): Promise<EnyoGridFeeInfo | null>;

    /**
     * Resolves the applicable grid fee to a flat **15-minute series** of gross
     * cent per kWh over the requested range — the same resolution
     * {@link EnergyAppEnergyPrices.getPrices} uses, so both series can be
     * combined interval by interval.
     *
     * Works for every fee, static or dynamic: a flat charge resolves to a series
     * whose entries all carry the same amount, so a caller that only wants
     * numbers over a range never has to branch on {@link EnyoGridFeeInfo.type}
     * at all.
     *
     * Set `includeAdditionalFees` to fold the fee's fixed charges into every
     * interval and get the full gross charge per kWh; leave it off for the
     * network charge alone. The result reports which of the two you got in
     * {@link EnyoGridFeeSeries.includesAdditionalFees}, so a fee that declares
     * no additional charges is never mistaken for a total.
     *
     * Returns `null` when the site has no grid fee registered. Intervals no
     * window covers resolve to `0`, and intervals outside the fee's
     * `validFromIso` / `validUntilIso` window are omitted.
     *
     * Requires the `GridFeeUse` permission.
     *
     * @param filter - The time range and whether to include additional fees
     * @returns Promise that resolves to the 15-minute fee series, or `null` when no fee applies
     *
     * @example
     * ```typescript
     * // network charge only
     * const net = await gridFee.getGridFeeValues({fromIso, untilIso});
     *
     * // everything the customer pays per kWh
     * const total = await gridFee.getGridFeeValues({
     *     fromIso,
     *     untilIso,
     *     includeAdditionalFees: true,
     * });
     * total?.entries.forEach(e => console.log(e.timestampIso, e.grossCentPerKwh));
     * ```
     */
    getGridFeeValues(filter: EnyoGridFeeValuesFilter): Promise<EnyoGridFeeSeries | null>;

    /**
     * Registers a listener invoked whenever any grid fee is registered, replaced
     * or removed.
     *
     * Use it to recompute composed prices without polling: a grid operator that
     * publishes a new day-ahead series mid-day changes the cost of every future
     * interval.
     *
     * Returns the unsubscribe function directly rather than an id to hand back
     * to a second method — calling it twice is a no-op.
     *
     * Requires the `GridFeeUse` permission.
     *
     * @param listener - Callback invoked with the change event
     * @returns A function that removes this listener when called
     *
     * @example
     * ```typescript
     * const unsubscribe = gridFee.onGridFeeChanged(async () => {
     *     await recomputePrices();
     * });
     * // later
     * unsubscribe();
     * ```
     */
    onGridFeeChanged(listener: (event: EnyoGridFeeChangeEvent) => void | Promise<void>): () => void;
}
