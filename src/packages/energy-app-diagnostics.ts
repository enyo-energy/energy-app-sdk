import {EnyoEnergyManagerCycleDiagnostics} from "../types/enyo-diagnostics.js";

/**
 * Interface for submitting operational diagnostics from the energy
 * manager. Today this surface exposes a single per-cycle telemetry
 * publisher; further diagnostics publishers can be added here as the
 * EM grows new observability needs.
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
}
