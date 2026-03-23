/**
 * Enum of available energy manager features.
 * Used to check if a specific feature is supported by the current energy manager.
 */
export enum EnergyManagerFeatureEnum {
    /** The energy manager supports generating preview charge schedules */
    PreviewChargeSchedule = 'preview-charge-schedule',

    // PV / Solar

    /** Maximize on-site PV usage before grid export */
    PvSelfConsumptionOptimization = 'pv-self-consumption-optimization',
    /** Limit PV feed-in power per grid operator requirements */
    PvCurtailment = 'pv-curtailment',

    // Battery

    /** Charge during low-cost periods, discharge during high-cost */
    BatteryTouArbitrage = 'battery-tou-arbitrage',
    /** Discharge during demand peaks to reduce grid draw */
    BatteryPeakShaving = 'battery-peak-shaving',
    /** Reserve battery capacity for power outages */
    BatteryBackupPower = 'battery-backup-power',

    // Wallbox / EV Charging

    /** Charge EV from solar surplus */
    WallboxPvSurplusCharging = 'wallbox-pv-surplus-charging',
    /** Adjust EV charging based on total home load */
    WallboxDynamicLoadManagement = 'wallbox-dynamic-load-management',

    // Heat Pump

    /** Prevent room overheating by adjusting heat pump output */
    HeatpumpRoomOverheating = 'heatpump-room-overheating',
    /** Force domestic hot water heating on demand */
    HeatpumpDhwBoost = 'heatpump-dhw-boost',
    /** Shift heating loads to renewable generation periods */
    HeatpumpLoadShifting = 'heatpump-load-shifting',

    // Climate Control / AC

    /** Dynamic temperature setpoints based on occupancy/time */
    ClimateControlSmartThermostat = 'climate-control-smart-thermostat',
    /** Prioritize cooling when PV generation is high */
    ClimateControlSolarDrivenCooling = 'climate-control-solar-driven-cooling',

}

/**
 * Reason why a preview charging schedule is not available.
 * Returned when a preview charging schedule request cannot be fulfilled.
 */
export enum PreviewChargingScheduleUnavailableReasonEnum {
    /** No energy manager is configured in the system */
    NoEnergyManager = 'no-energy-manager',
    /** No electricity tariff data available for cost optimization */
    NoTariffData = 'no-tariff-data',
    /** The requested appliance was not found */
    ApplianceNotFound = 'appliance-not-found',
    /** The energy manager does not support the preview schedule feature */
    FeatureNotSupported = 'feature-not-supported'
}

/**
 * Information about the current energy manager.
 * Describes the active energy manager and its capabilities.
 */
export interface EnergyManagerInfo {
    /** Unique identifier of the energy manager package */
    packageId: string;
    /** Display name of the energy manager */
    name: string;
    /** Array of supported features */
    features: EnergyManagerFeatureEnum[];
}

/**
 * A single entry in the charging schedule.
 * Defines a time period with a specific charging power limit.
 */
export interface PreviewChargingScheduleEntry {
    /** ISO timestamp for when this schedule entry starts */
    startIso: string;
    /** ISO timestamp for when this schedule entry ends */
    endIso: string;
    /** Charging power limit in Watts for this period */
    chargingPowerW: number;
}

/**
 * Complete preview charging schedule with timing information.
 * Represents an optimized charging plan with detailed time slots.
 */
export interface PreviewChargingSchedule {
    /** Array of schedule entries defining the optimized charging plan */
    entries: PreviewChargingScheduleEntry[];
    /** Total energy to be delivered in Wh */
    totalEnergyWh: number;
    /** Estimated completion time as ISO timestamp */
    estimatedCompletionIso: string;
    estimatedKwhCharged?: number;
    estimatedChargingCostCents?: number;
}

/**
 * Cost comparison between optimized and immediate charging.
 * Shows potential savings from using an optimized charging schedule.
 */
export interface PreviewChargingScheduleCostComparison {
    /** Estimated cost for the optimized schedule in cents */
    optimizedCostCents: number;
    /** Estimated cost for immediate charging at max power in cents */
    immediateCostCents: number;
    /** Savings achieved by using the optimized schedule in cents */
    savingsCents: number;
    /** Currency code (e.g., 'EUR') */
    currency: string;
}
