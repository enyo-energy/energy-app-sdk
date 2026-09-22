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

    // Transparency

    /**
     * The energy manager publishes an energy-distribution snapshot — who is being
     * served in the current slot, in what order, how far each participant is
     * toward its own goal, and why.
     *
     * Declare this only if the app actually calls
     * `useEnergyManager().publishEnergyDistribution()`. The cockpit reads the
     * feature list to decide whether to offer the card at all, so declaring it
     * without publishing leaves the user looking at an empty panel with no way to
     * tell whether it is broken or merely quiet.
     */
    EnergyDistributionView = 'energy-distribution-view',

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
    FeatureNotSupported = 'feature-not-supported',

    // ── The charger cannot be steered ──────────────────────────────────────

    /**
     * The charger integration does not permit control — its
     * {@link EnyoChargerApplianceMetadata.controlAllowed} is `false`, so the
     * appliance is read-only/monitor-only and no schedule could be applied even
     * if one were planned.
     *
     * A property of the *integration*, unlike
     * {@link ControlDisabledByUser}.
     */
    ControlNotAllowed = 'control-not-allowed',
    /**
     * The user switched charger control off in the energy manager's general
     * settings ({@link EnergyManagerSettingValues.chargerControl}). The
     * integration could be steered; the user asked that it is not.
     *
     * Actionable: a consumer can point the user at the setting, which is why it
     * is distinct from {@link ControlNotAllowed}.
     */
    ControlDisabledByUser = 'control-disabled-by-user',
    /**
     * The charger is offline / unreachable, so its state and power limits are
     * unknown. Transient — a later request may succeed.
     */
    ApplianceOffline = 'appliance-offline',

    // ── Nothing to plan for ────────────────────────────────────────────────

    /**
     * No vehicle is connected to the charger, so there is no session to plan.
     */
    NoVehicleConnected = 'no-vehicle-connected',
    /**
     * The {@link EnyoDataBusRequestPreviewChargingScheduleV1} named a
     * `vehicleId` that is unknown to the system.
     */
    VehicleNotFound = 'vehicle-not-found',
    /**
     * The amount of energy to plan for could not be determined — the request
     * carried no `targetEnergyWh`, no usable `startSocPercent` /
     * `targetSocPercent` pair (which needs the vehicle's `batterySizeKwh` to
     * become energy), and no `vehicleId` whose battery state yields one.
     */
    NoTargetEnergy = 'no-target-energy',
    /**
     * The requested `completeByIso` deadline lies in the past or leaves too
     * little time to deliver the target energy, so no schedule fits it.
     */
    DeadlineNotReachable = 'deadline-not-reachable',

    // ── Nothing to optimize ────────────────────────────────────────────────

    /**
     * Tariff data exists but carries no time-varying prices (a flat tariff), so
     * every slot costs the same and a cost-optimized plan cannot beat charging
     * immediately.
     *
     * Distinct from {@link NoTariffData}, which means no prices at all.
     */
    TariffNotDynamic = 'tariff-not-dynamic',
    /**
     * The requested charging mode is not one this energy manager can plan a
     * preview for.
     */
    ChargeModeNotSupported = 'charge-mode-not-supported',
    /**
     * A price ceiling was requested that no slot in the planning window meets,
     * so a cost-optimized plan would import nothing at all.
     *
     * Actionable, which is why it is distinct from
     * {@link DeadlineNotReachable}: the deadline is fine and the charger is
     * fine — the user's limit is simply below every price on offer, and a
     * consumer can say so and offer to raise it. Applies to both spellings of
     * a ceiling: a `priceLimitCtPerKwh` under the cheapest slot, or a
     * `priceLimitSharePercent` whose share contains no usable slot before the
     * deadline.
     */
    PriceLimitNotReachable = 'price-limit-not-reachable',

    // ── Everything else ────────────────────────────────────────────────────

    /**
     * The energy manager could not produce a preview right now — it is still
     * starting up, busy, or in a temporary error state. Transient: a later
     * request may succeed.
     */
    TemporarilyUnavailable = 'temporarily-unavailable',
    /**
     * No more specific reason applies. Prefer any of the members above; this
     * exists so a sender never has to omit the field, and consumers should
     * render it as a generic "not available right now".
     */
    Unknown = 'unknown',
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
