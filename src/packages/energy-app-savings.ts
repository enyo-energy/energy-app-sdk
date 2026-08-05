import {
    EnyoDailySavingsReport,
    EnyoDailySavingsRequest,
    EnyoDailySavingsResponse
} from "../types/enyo-savings.js";

/**
 * Interface for publishing and reading back day-scoped savings reports.
 *
 * An energy manager app replays a finished day's measured environment through a
 * simulation of the same house running uncontrolled, prices both worlds against
 * the tariff that actually applied, and publishes the difference here. The
 * platform stores the day-level records and owns every aggregation above them
 * (month, year, lifetime) — a device is the wrong place to keep a running annual
 * figure, because it can be replaced, reset, or offline for a week.
 *
 * Publishing is an upsert keyed by {@link EnyoDailySavingsReport.dayIso} plus
 * {@link EnyoDailySavingsReport.method}, in the same spirit as
 * {@link EnergyAppFile.registerFile}. This is deliberate: settlement is stateless
 * and recomputable, so a day may legitimately be recomputed after a backfill, a
 * bugfix, or a change in assumptions.
 *
 * Access to this API requires the `Savings` permission
 * ({@link EnergyAppPermissionType}); {@link EnergyApp.useSavings} throws when it
 * has not been granted.
 *
 * @example
 * ```typescript
 * const savings = energyApp.useSavings();
 *
 * // On boot: find the days that still need settling.
 * const { missingDayIsos } = await savings.getDailySavings({
 *     startDayIso: '2026-07-01',
 *     endDayIso: '2026-07-31'
 * });
 * for (const dayIso of missingDayIsos) {
 *     await savings.publishDailySavings(await settleDay(dayIso));
 * }
 * ```
 */
export interface EnergyAppSavings {
    /**
     * Publishes (upserts) the savings report for one day.
     *
     * The record is keyed by `report.dayIso` + `report.method`: re-publishing the
     * same day with the same method replaces the stored record entirely, rather
     * than appending a second one. Publishing a `Settled` report therefore does
     * not remove an earlier `Projected` report for the same day — the two are
     * distinct records and consumers should prefer the settled one.
     *
     * The report should carry both worlds, not only the delta: a lone savings
     * number is unauditable and cannot be re-aggregated.
     * {@link EnyoDailySavingsReport.confidence} must reflect the state of the
     * inputs, since the platform excludes low-confidence days from rollups.
     *
     * @param report - The complete, self-contained report for one local calendar
     *   day, including costs, energy terms, coverage and the assumptions the
     *   counterfactual rested on.
     * @returns Promise that resolves once the report has been stored by the host.
     * @throws {EnergyAppPermissionNotGrantedError} If the `Savings` permission is
     *   not granted.
     *
     * @example
     * ```typescript
     * await savings.publishDailySavings({
     *     schemaVersion: 1,
     *     dayIso: '2026-07-14',
     *     timeZone: 'Europe/Berlin',
     *     dayStartUtcMs: Date.parse('2026-07-14T00:00:00+02:00'),
     *     dayEndUtcMs: Date.parse('2026-07-15T00:00:00+02:00'),
     *     method: EnyoSavingsMethodEnum.Settled,
     *     computedAtIso: '2026-07-15T02:14:03+02:00',
     *     calculatorVersion: '3.2.0',
     *     confidence: EnyoSavingsConfidenceEnum.High,
     *     confidenceIssues: [],
     *     costs: {
     *         currency: EnyoCurrencyEnum.EUR,
     *         optimizedCost: 1.42,
     *         baselineCost: 3.07,
     *         savings: 1.65,
     *         savingsFromSelfConsumption: 1.12,
     *         savingsFromArbitrage: 0.53
     *     },
     *     energy: { ... },
     *     metrics: { ... },
     *     attribution: [
     *         { applianceType: EnergyAppApplianceTypeEnum.Charger, savings: 0.91, shiftedEnergyWh: 12400 }
     *     ],
     *     coverage: [
     *         { series: 'pv', source: EnyoSavingsDataSourceEnum.Measured, expectedBuckets: 96, presentBuckets: 96 }
     *     ],
     *     assumptions: [
     *         { key: 'battery.dischargeEfficiency', value: 0.95 }
     *     ]
     * });
     * ```
     */
    publishDailySavings(report: EnyoDailySavingsReport): Promise<void>;

    /**
     * Reads back previously published reports for a range of local days.
     *
     * This is the counterpart that makes the API usable without duplicated state:
     * the app asks the host which days it has already reported instead of
     * maintaining its own shadow index. The response's
     * {@link EnyoDailySavingsResponse.missingDayIsos} is exactly the backfill
     * work list.
     *
     * Per-slot detail is only returned when it was published AND
     * {@link EnyoDailySavingsRequest.includeSlots} is set.
     *
     * @param request - Inclusive local day range, with optional method filter and
     *   opt-in per-slot detail.
     * @returns Promise resolving to the stored reports plus the days in the range
     *   that carry none.
     * @throws {EnergyAppPermissionNotGrantedError} If the `Savings` permission is
     *   not granted.
     *
     * @example
     * ```typescript
     * const response = await savings.getDailySavings({
     *     startDayIso: '2026-07-01',
     *     endDayIso: '2026-07-07',
     *     method: EnyoSavingsMethodEnum.Settled
     * });
     * const weekTotal = response.reports
     *     .filter(r => r.confidence === EnyoSavingsConfidenceEnum.High)
     *     .reduce((sum, r) => sum + r.costs.savings, 0);
     * ```
     */
    getDailySavings(request: EnyoDailySavingsRequest): Promise<EnyoDailySavingsResponse>;
}
