import {
    EnyoDiagnosticsControlPlan,
    EnyoDiagnosticsCurrentState,
    EnyoDiagnosticsForecast
} from "../types/enyo-diagnostics.js";

/**
 * Interface for submitting energy manager diagnostics data.
 * Allows energy managers to report their current state, forecast, and control plan
 * for internal processing and analysis.
 */
export interface EnergyAppDiagnostics {
    /**
     * Submits the current energy system state, forecast, and control plan for diagnostics processing.
     *
     * @param currentState - The aggregated current state of the energy system including
     *   system-level power values, per-appliance snapshots, and derived energy values
     * @param forecast - The forecast containing time-bucketed predictions for consumption,
     *   production, pricing, and appliance-specific data
     * @param controlPlan - The time-slotted control plan with commands for each appliance
     *   and estimated costs
     *
     * @example
     * ```typescript
     * const diagnostics = energyApp.useDiagnostics();
     * diagnostics.energyManagerDiagnostics(currentState, forecast, controlPlan);
     * ```
     */
    energyManagerDiagnostics(
        currentState: EnyoDiagnosticsCurrentState,
        forecast: EnyoDiagnosticsForecast,
        controlPlan: EnyoDiagnosticsControlPlan
    ): void;
}
