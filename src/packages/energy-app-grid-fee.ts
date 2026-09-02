import {
    EnyoDynamicGridFee,
    EnyoDynamicGridFeeFilter,
    EnyoDynamicGridFeeRegistration,
    EnyoDynamicGridFeeSeries,
    EnyoGridFeeChangeEvent,
} from '../types/enyo-grid-fee.js';
import {EnyoAbsolutePriceWindow} from '../types/enyo-price-schedule.js';

/**
 * Interface for publishing and consuming dynamic grid fees (network charges).
 *
 * Any energy app can act as a producer by registering a grid fee — typically an
 * app that knows the local grid operator's tariff sheet or fetches a published
 * series — and any energy app can act as a consumer by resolving that fee for a
 * time range with {@link getDynamicGridFees}.
 *
 * Publishing requires the `GridFeeRegister` permission; consuming requires
 * `GridFeeUse`.
 *
 * A grid fee describes the site's **grid connection**, not a supplier contract:
 * it is registered and resolved independently of any tariff, and the same fee
 * applies whichever supplier the site buys from.
 *
 * **Nothing here is applied to a price automatically.** The host never folds a
 * grid fee into {@link EnergyAppEnergyPrices.getPrices}, because provider APIs
 * differ: some already return grid-fee-inclusive prices, some do not. The app
 * that owns the tariff knows which is the case — it declares it via the
 * tariff's `priceComposition` and composes the effective price itself with
 * `composeElectricityPrices()`.
 *
 * @example
 * ```typescript
 * // Producer: a §14a EnWG module 3 HT/NT network charge
 * const gridFee = energyApp.useGridFee();
 * await gridFee.registerGridFee({
 *     id: 'dso-hd-2026',
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
 * const fees = await gridFee.getDynamicGridFees({
 *     fromIso: new Date().toISOString(),
 *     untilIso: new Date(Date.now() + 86_400_000).toISOString(),
 * });
 * ```
 */
export interface EnergyAppGridFee {
    /**
     * Registers a new dynamic grid fee or updates an existing one. Uses upsert
     * logic based on `id` — if a fee with the same id already exists it is
     * replaced, otherwise a new one is created.
     *
     * Requires the `GridFeeRegister` permission.
     *
     * @param registration - The grid fee to register, including its schedule
     * @returns Promise that resolves to the stored grid fee, including the host-assigned `publishedAtIso`
     */
    registerGridFee(registration: EnyoDynamicGridFeeRegistration): Promise<EnyoDynamicGridFee>;

    /**
     * Partially updates a registered grid fee. Only the provided attributes are
     * modified; all other fields remain unchanged.
     *
     * Requires the `GridFeeRegister` permission.
     *
     * @param id - The unique identifier of the grid fee to update
     * @param attributes - A partial set of grid fee fields to update (excluding `id`)
     * @returns Promise that resolves to the full updated grid fee
     */
    updateGridFee(
        id: string,
        attributes: Partial<Omit<EnyoDynamicGridFeeRegistration, 'id'>>,
    ): Promise<EnyoDynamicGridFee>;

    /**
     * Removes a registered grid fee. {@link getDynamicGridFees} resolves to
     * `null` for it afterwards. If the fee does not exist, this operation is a
     * no-op.
     *
     * Requires the `GridFeeRegister` permission.
     *
     * @param id - The unique identifier of the grid fee to remove
     * @returns Promise that resolves when the grid fee has been removed
     */
    removeGridFee(id: string): Promise<void>;

    /**
     * Retrieves all registered grid fees across all energy apps on the system.
     *
     * Requires the `GridFeeUse` permission.
     *
     * @returns Promise that resolves to an array of all registered grid fees
     */
    listGridFees(): Promise<EnyoDynamicGridFee[]>;

    /**
     * Retrieves a single registered grid fee by its id, or `null` when no fee
     * with that id exists.
     *
     * Requires the `GridFeeUse` permission.
     *
     * @param id - The unique identifier of the grid fee
     * @returns Promise that resolves to the grid fee, or `null`
     */
    getGridFee(id: string): Promise<EnyoDynamicGridFee | null>;

    /**
     * Replaces the absolute windows of a grid fee whose schedule is
     * {@link EnyoPriceScheduleTypeEnum.Absolute}. Use this for fees the grid
     * operator publishes as a dated series (for example day-ahead), where the
     * schedule changes far more often than the fee's metadata.
     *
     * Windows must not overlap and are stored sorted ascending by `startIso`.
     * Publishing replaces the previously stored windows in full.
     *
     * Requires the `GridFeeRegister` permission.
     *
     * @param id - The unique identifier of the registered grid fee
     * @param windows - The complete set of absolute windows to store
     * @returns Promise that resolves when the windows have been stored and change listeners dispatched
     */
    publishGridFeeWindows(id: string, windows: EnyoAbsolutePriceWindow[]): Promise<void>;

    /**
     * Resolves a dynamic grid fee to a flat **15-minute series** over the
     * requested range — the same resolution
     * {@link EnergyAppEnergyPrices.getPrices} uses, so both series can be
     * combined interval by interval.
     *
     * The fee is selected by `gridFeeId` or `meteringPointId`; with no selector
     * the grid fee that applies to this device is used. Grid fees are **not**
     * bound to a tariff — a network charge is a property of the grid connection,
     * and the same fee applies no matter which supplier the site buys from.
     * Returns `null` when no fee matches the selector.
     *
     * Intervals no window covers resolve to `feePerKwh: 0`, and intervals
     * outside the fee's `validFromIso` / `validUntilIso` window are omitted.
     *
     * Requires the `GridFeeUse` permission.
     *
     * @param filter - The time range and the selector identifying which fee to resolve
     * @returns Promise that resolves to the 15-minute fee series, or `null` when no fee applies
     *
     * @example
     * ```typescript
     * const fees = await gridFee.getDynamicGridFees({
     *     fromIso: '2026-09-02T00:00:00Z',
     *     untilIso: '2026-09-03T00:00:00Z',
     * });
     * fees?.entries.forEach(e => console.log(e.timestampIso, e.feePerKwh));
     * ```
     */
    getDynamicGridFees(filter: EnyoDynamicGridFeeFilter): Promise<EnyoDynamicGridFeeSeries | null>;

    /**
     * Registers a listener invoked whenever any grid fee is registered, updated
     * or removed — including when its absolute windows are republished.
     *
     * Use it to recompute composed prices without polling: a grid operator that
     * publishes a new day-ahead series mid-day changes the cost of every future
     * interval.
     *
     * Requires the `GridFeeUse` permission.
     *
     * @param listener - Callback invoked with the change event
     * @returns A unique listener id that can be passed to {@link offGridFeeChanged}
     *
     * @example
     * ```typescript
     * const id = gridFee.onGridFeeChanged(async event => {
     *     if (event.gridFeeId === myFeeId) await recomputePrices();
     * });
     * // later
     * gridFee.offGridFeeChanged(id);
     * ```
     */
    onGridFeeChanged(listener: (event: EnyoGridFeeChangeEvent) => void | Promise<void>): string;

    /**
     * Removes a previously registered grid fee change listener. If the listener
     * id is unknown, this operation is a no-op.
     *
     * @param listenerId - The id returned from {@link onGridFeeChanged}
     */
    offGridFeeChanged(listenerId: string): void;
}
