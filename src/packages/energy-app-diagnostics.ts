import {EnyoEnergyManagerCycleDiagnostics} from "../types/enyo-diagnostics.js";
import {EnyoCategoryFlexibilityDiagnostics} from "../types/enyo-flexibility-announcement.js";

/**
 * Interface for submitting operational diagnostics from the energy
 * manager. Today this surface exposes a per-cycle telemetry publisher
 * and a category-flexibility publisher; further diagnostics publishers
 * can be added here as the EM grows new observability needs.
 *
 * This interface is intentionally complementary to
 * `EnergyAppEnergyManager.publishForecast`, which ships the *plan*
 * (what the EM decided to do). The methods on `EnergyAppDiagnostics`
 * ship the *health of the planning loop* — how long it took, what it
 * dispatched, what went wrong.
 */
export interface EnergyAppDiagnostics {
    /**
     * Publishes one energy-manager cycle's operational telemetry.
     *
     * Call once per cycle, ideally at the very end of the cycle so the
     * timings carried by {@link EnyoEnergyManagerCycleDiagnostics} are
     * final. The payload aggregates the cycle's outcome, per-phase
     * durations, forecast-call timings, dispatched-command counts,
     * acknowledgement deltas, and any issues encountered while
     * running.
     *
     * For the *plan itself* (the schedule of actions the cycle decided
     * to apply), use `EnergyAppEnergyManager.publishForecast` —
     * diagnostics intentionally does not re-publish that payload.
     *
     * @param cycle - The cycle's operational telemetry. See
     *   {@link EnyoEnergyManagerCycleDiagnostics} for the field-by-field
     *   contract.
     *
     * @example
     * ```typescript
     * const diagnostics = energyApp.useDiagnostics();
     * diagnostics.publishCycleDiagnostics({
     *     cycleStartedAtIso: cycleStart.toISOString(),
     *     cycleCompletedAtIso: cycleEnd.toISOString(),
     *     outcome: EnyoEnergyManagerCycleOutcomeEnum.Completed,
     *     totalDurationMs: 842,
     *     phaseDurations: [
     *         {phase: EnyoEnergyManagerCyclePhaseEnum.LoadCurrentState, durationMs: 32},
     *         {phase: EnyoEnergyManagerCyclePhaseEnum.FetchForecasts,   durationMs: 411},
     *         {phase: EnyoEnergyManagerCyclePhaseEnum.Optimize,         durationMs: 318},
     *         {phase: EnyoEnergyManagerCyclePhaseEnum.DispatchCommands, durationMs: 58},
     *         {phase: EnyoEnergyManagerCyclePhaseEnum.Publish,          durationMs: 23},
     *     ],
     *     forecastsConsumed: [
     *         {forecastType: EnyoEnergyManagerForecastTypeEnum.PvProduction, durationMs: 120, ok: true},
     *         {forecastType: EnyoEnergyManagerForecastTypeEnum.Battery,      applianceId: 'battery-1', durationMs: 90, ok: true},
     *     ],
     *     commandsIssued: [
     *         {messageType: EnyoDataBusMessageEnum.SetStorageScheduleV1, count: 1},
     *     ],
     *     commandAcknowledgements: [
     *         {messageType: EnyoDataBusMessageEnum.SetStorageScheduleV1, accepted: 1, rejected: 0, notSupported: 0},
     *     ],
     *     appliancesManaged: [
     *         {applianceType: EnyoApplianceTypeEnum.Storage, count: 1},
     *     ],
     *     plannedHorizonMinutes: 360,
     *     issues: [],
     * });
     * ```
     */
    publishCycleDiagnostics(cycle: EnyoEnergyManagerCycleDiagnostics): void;

    /**
     * Publishes the category-level flexibility exchange of one planning
     * round: the flexibility the appliance managers *announced*, and the
     * flexibility the decision maker *granted* back.
     *
     * Call once per round, after the decision maker has answered, so a
     * single payload carries both sides of the exchange. Announcements
     * are aggregated per appliance category (all chargers, all batteries,
     * …) — the per-appliance breakdown stays inside the manager and is
     * intentionally not part of this surface.
     *
     * Both lists are complete snapshots, not deltas. Publishing a grant
     * with no matching announcement (or vice versa) is allowed — it
     * simply means the two sides were out of step when the snapshot was
     * taken — but grants SHOULD pair with an announcement by `category` +
     * `flexibilityAnnouncementType`.
     *
     * This is complementary to {@link publishCycleDiagnostics} (the
     * *health* of the planning loop) and to
     * `EnergyAppEnergyManager.publishForecast` (the resulting *plan*):
     * this method ships the *negotiation* that produced the plan.
     *
     * @param flexibility - The announced and granted category flexibility.
     *   See {@link EnyoCategoryFlexibilityDiagnostics} for the
     *   field-by-field contract.
     *
     * @example
     * ```typescript
     * const diagnostics = energyApp.useDiagnostics();
     * diagnostics.publishCategoryFlexibility({
     *     generatedAtIso: new Date().toISOString(),
     *     announced: [
     *         {
     *             category: EnyoApplianceTypeEnum.Charger,
     *             flexibilityAnnouncementType:
     *                 EnyoFlexibilityAnnouncementTypeEnum.FlexibleKwhTarget,
     *             flexibleKwhTarget: {
     *                 rangeStart: windowStart,
     *                 rangeEnd: windowEnd,
     *                 kwh: 22,
     *                 target: EnyoFlexibilityTimingTargetEnum.Earliest,
     *                 power: {minWatt: 1380, maxWatt: 11040, stepWatt: 230},
     *             },
     *         },
     *         {
     *             category: EnyoApplianceTypeEnum.Storage,
     *             flexibilityAnnouncementType:
     *                 EnyoFlexibilityAnnouncementTypeEnum.FlexibleDischarge,
     *             flexibleDischarge: {
     *                 rangeStart: windowStart,
     *                 rangeEnd: windowEnd,
     *                 kwh: 8,
     *                 power: {minWatt: 0, maxWatt: 5000, stepWatt: 100},
     *                 marginalCostEurPerKwh: 0.08,
     *             },
     *         },
     *     ],
     *     granted: [
     *         {
     *             category: EnyoApplianceTypeEnum.Charger,
     *             flexibilityAnnouncementType:
     *                 EnyoFlexibilityAnnouncementTypeEnum.FlexibleKwhTarget,
     *             status: EnyoCategoryFlexibilityGrantStatusEnum.PartiallyGranted,
     *             grantedRange: {rangeStart: windowStart, rangeEnd: windowEnd},
     *             grantedPower: {minWatt: 1380, maxWatt: 7360, stepWatt: 230},
     *             grantedKwh: 16,
     *             reason: 'grid connection point limit',
     *         },
     *         {
     *             category: EnyoApplianceTypeEnum.Storage,
     *             flexibilityAnnouncementType:
     *                 EnyoFlexibilityAnnouncementTypeEnum.FlexibleDischarge,
     *             status: EnyoCategoryFlexibilityGrantStatusEnum.Denied,
     *             reason: 'discharge more expensive than grid import',
     *         },
     *     ],
     * });
     * ```
     */
    publishCategoryFlexibility(flexibility: EnyoCategoryFlexibilityDiagnostics): void;
}
