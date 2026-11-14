/**
 * Important capabilities a specific device model can support.
 *
 * Declared per model inside an Energy App package's compatibility section
 * (see {@link EnergyAppPackageCompatibilityModel}) so the enyo Store and
 * onboarding flows can surface accurate, model-level feature information to
 * users. Values are grouped by device category for readability; the
 * machine-readable grouping is `ENERGY_APP_MODEL_FEATURE_CATEGORIES`.
 *
 * A feature is a promise to the customer: declare it only when the energy app
 * actually delivers it for this model. Say *how well* with the model's
 * {@link EnergyAppModelLimitationEnum limitations}, and *what has to be in
 * place first* with its {@link EnergyAppModelRequirementEnum requirements} —
 * rather than leaving a feature out because it only works with restrictions.
 */
export enum EnergyAppModelFeatureEnum {

    // Battery / Storage

    /**
     * The battery can be charged from the grid (not only from PV surplus) at a
     * chosen power. For a battery that can only grid-charge at full power, declare
     * {@link BatteryGridChargeFullPowerOnly} instead.
     */
    BatteryChargingFromGrid = 'battery-charging-from-grid',
    /** The maximum charge power or target state of charge can be limited */
    BatteryChargeLimitation = 'battery-charge-limitation',
    /** The maximum discharge power or minimum state of charge can be limited */
    BatteryDischargeLimitation = 'battery-discharge-limitation',
    /**
     * The battery's only control is a grid charge at full power (e.g. the safety
     * charge of a SENEC.Home V3): no power setpoint, no holding, no discharge lock.
     * The energy manager can still fill it from the grid in cheap hours, but cannot
     * shift it by price and forecast.
     *
     * Declare it **instead of** {@link BatteryChargingFromGrid},
     * {@link BatteryChargeLimitation}, {@link BatteryDischargeLimitation},
     * {@link BatteryGridDischarging}, {@link BatteryHold} and
     * {@link BatteryManualCharge}. Model-level counterpart of the runtime feature
     * `EnyoBatteryFeature.GridChargeFullPowerOnly`.
     */
    BatteryGridChargeFullPowerOnly = 'battery-grid-charge-full-power-only',
    /**
     * A full-power grid charge ({@link BatteryGridChargeFullPowerOnly}) can be
     * ended early, so it does not have to run until the battery is full. Only
     * valid together with {@link BatteryGridChargeFullPowerOnly}. Model-level
     * counterpart of `EnyoBatteryFeature.GridChargeFullPowerStoppable`.
     */
    BatteryGridChargeFullPowerStoppable = 'battery-grid-charge-full-power-stoppable',
    /** The battery can be discharged into the grid on command (export, e.g. at high prices) */
    BatteryGridDischarging = 'battery-grid-discharging',
    /**
     * The battery can be held at its current state of charge — charging and/or
     * discharging blocked at 0 W — so its energy can be saved for expensive hours.
     * When only one direction can be blocked, declare the other one's limitation
     * ({@link EnergyAppModelLimitationEnum.BatteryChargeCannotBeBlocked} or
     * {@link EnergyAppModelLimitationEnum.BatteryDischargeCannotBeBlocked}).
     */
    BatteryHold = 'battery-hold',
    /** The customer can start a one-time "charge the battery now" from the enyo app */
    BatteryManualCharge = 'battery-manual-charge',

    // Inverter / PV

    /** The PV feed-in power into the grid can be limited (curtailment) */
    PvFeedInLimitation = 'pv-feed-in-limitation',
    /** The inverter active power output can be limited */
    InverterPowerLimitation = 'inverter-power-limitation',
    /** The inverter detects grid outages and reports on grid / off grid status */
    InverterGridOutageDetection = 'inverter-grid-outage-detection',

    // Wallbox / Charging

    /** Charging can be started and stopped remotely */
    ChargingStartStop = 'charging-start-stop',
    /** The charging power (in Ampere or Watt) can be limited */
    ChargingPowerLimitation = 'charging-power-limitation',
    /** The model supports switching between single- and three-phase charging */
    ChargingPhaseSwitching = 'charging-phase-switching',
    /** The model supports charging from PV surplus */
    PvSurplusCharging = 'pv-surplus-charging',
    /**
     * The wallbox follows a charging schedule set by the energy manager, so a
     * charge can be planned into the cheapest or sunniest hours. The energy
     * manager only steers wallboxes that support this — start/stop and power
     * limitation alone are not enough. Model-level counterpart of the runtime
     * feature `EnyoChargerApplianceAvailableFeaturesEnum.SmartChargingSchedule`.
     */
    ChargingSchedule = 'charging-schedule',
    /** The wallbox reads the connected car's state of charge itself (e.g. ISO 15118), without the car's cloud */
    ChargingVehicleSocReadout = 'charging-vehicle-soc-readout',
    /** The wallbox has a MID-certified meter for the charged energy */
    ChargingMidMeter = 'charging-mid-meter',
    /** The wallbox has an Eichrecht-compliant meter, so charged energy can be billed (e.g. company cars) */
    ChargingEichrechtMeter = 'charging-eichrecht-meter',
    /** Charging can be authorised with an RFID card */
    ChargingRfidAuthorization = 'charging-rfid-authorization',

    // Heat Pump

    /** Domestic hot water heating can be forced on demand (DHW boost) */
    HeatpumpDhwBoost = 'heatpump-dhw-boost',
    /** The target temperature setpoint can be controlled */
    HeatpumpTemperatureSetpoint = 'heatpump-temperature-setpoint',
    /** The heat pump output power can be modulated */
    HeatpumpPowerModulation = 'heatpump-power-modulation',
    /** The model supports the SG Ready interface for smart-grid signalling */
    HeatpumpSgReady = 'heatpump-sg-ready',
    /** The heat pump accepts measured room temperatures from an external sensor as control input */
    HeatpumpRoomTemperatureInput = 'heatpump-room-temperature-input',
    /** The heat pump takes the available PV surplus as an input and adapts its consumption to it */
    HeatpumpPvSurplusSignal = 'heatpump-pv-surplus-signal',
    /** The buffer tank can be heated above its normal setpoint to store cheap or PV energy */
    HeatpumpBufferTankOverheating = 'heatpump-buffer-tank-overheating',
    /** The rooms can be heated slightly above their setpoint to store cheap or PV energy */
    HeatpumpRoomOverheating = 'heatpump-room-overheating',
    /** The heat pump's built-in heating rod can be switched by the energy manager */
    HeatpumpHeatingRodControl = 'heatpump-heating-rod-control',
    /** Heating circuits / hot water can be switched between comfort and eco, e.g. eco in expensive hours */
    HeatpumpProgramSwitch = 'heatpump-program-switch',
    /** The heating curve can be shifted, and restored exactly, for heating curve optimisation */
    HeatpumpHeatingCurveOffset = 'heatpump-heating-curve-offset',
    /** The heat pump can be set to a vacation mode (frost protection, lowered heating or hot water pause) */
    HeatpumpVacationMode = 'heatpump-vacation-mode',
    /** The heat pump can cool (reversible heat pump) */
    HeatpumpCooling = 'heatpump-cooling',
    /** The heat pump's electrical power consumption can be read out */
    HeatpumpPowerReadout = 'heatpump-power-readout',

    // Heating Rod

    /** The heating rod can be switched on and off */
    HeatingRodSwitching = 'heating-rod-switching',
    /**
     * The heating rod's power can be modulated to match the PV surplus, not only
     * switched fully on or off. The energy manager needs this to heat with surplus.
     */
    HeatingRodPowerModulation = 'heating-rod-power-modulation',
    /** The heating rod measures the hot water tank temperature itself */
    HeatingRodDhwSensor = 'heating-rod-dhw-sensor',

    // Climate Control / Air Conditioning

    /** The target temperature setpoint can be controlled */
    ClimateTemperatureSetpoint = 'climate-temperature-setpoint',
    /** The operating mode (heat / cool / fan / off) can be controlled */
    ClimateModeControl = 'climate-mode-control',
    /** The unit can cool; the energy manager only plans air conditioning that cools */
    ClimateCooling = 'climate-cooling',
    /** The unit can heat */
    ClimateHeating = 'climate-heating',
    /** The unit's electrical power draw can be steered, e.g. limited to a target in watts */
    ClimatePowerControl = 'climate-power-control',

    // Meter

    /** The grid power (import / export) can be read out */
    GridPowerReadout = 'grid-power-readout',
    /** The accumulated energy consumption can be read out */
    EnergyConsumptionReadout = 'energy-consumption-readout',

    // Vehicle

    /** The car's state of charge can be read remotely (manufacturer cloud, ISO 15118) */
    VehicleSocReadout = 'vehicle-soc-readout',
    /** Charging can be started and stopped through the car rather than the wallbox */
    VehicleChargeStartStop = 'vehicle-charge-start-stop',
    /** The car's target state of charge or charging current can be set remotely */
    VehicleChargeLimit = 'vehicle-charge-limit',
    /** The car's position can be read, so "is it at home?" can be answered */
    VehicleLocationReadout = 'vehicle-location-readout',
    /** The car's odometer reading can be read */
    VehicleOdometerReadout = 'vehicle-odometer-readout',
    /** Cabin or battery preconditioning can be triggered remotely */
    VehiclePreconditioning = 'vehicle-preconditioning',

    // Smart Plug

    /** The plug can be switched on and off */
    SwitchOnOff = 'switch-on-off',
    /** The plug can measure the connected load's power */
    PowerMeasurement = 'power-measurement',

    // Grid operator (§14a EnWG) — any controllable device

    /**
     * The device follows a grid operator's consumption limit (§14a EnWG / EEBUS
     * LPC), so it can be dimmed through the control box. Grid operator limits are
     * only passed to devices that support this. Model-level counterpart of the
     * runtime feature `EnyoApplianceAvailableFeaturesEnum.LimitPowerConsumption`.
     */
    GridOperatorConsumptionLimitation = 'grid-operator-consumption-limitation',
    /**
     * The device follows a grid operator's production limit (EEBUS LPP), e.g.
     * curtailing an inverter. Model-level counterpart of the runtime feature
     * `EnyoApplianceAvailableFeaturesEnum.LimitPowerProduction`.
     */
    GridOperatorProductionLimitation = 'grid-operator-production-limitation',
}

/**
 * Something that must be in place before an Energy App works with a model —
 * the answer to "what do I need to do or buy first?".
 *
 * Declared per model in {@link EnergyAppPackageCompatibilityModel.requirements}.
 * A minimum firmware is not a member: declare it with
 * {@link EnergyAppPackageCompatibilityModel.minimumFirmwareVersion}.
 */
export enum EnergyAppModelRequirementEnum {
    /**
     * An installer has to switch on external control first — e.g. Modbus TCP,
     * battery control or an OCPP backend — in the device or the vendor's installer
     * portal. Pair it with an installer mail that says what to switch on.
     */
    InstallerEnablement = 'installer-enablement',
    /** The owner has to switch on external control themselves, e.g. a checkbox in the vendor app */
    UserEnablement = 'user-enablement',
    /** An extra communication gateway is needed (e.g. a data logger, Wi-Fi stick or RS485 gateway) */
    Gateway = 'gateway',
    /** The vendor's own energy meter has to be installed */
    VendorMeter = 'vendor-meter',
    /** The integration runs through the vendor's cloud: the customer needs an account and internet access */
    VendorCloudAccount = 'vendor-cloud-account',
    /** A paid licence or subscription from the vendor is needed (e.g. connected services of a car) */
    VendorSubscription = 'vendor-subscription',
}

/**
 * A known restriction on how well a model's declared features work — the
 * answer to "what works, but not fully?".
 *
 * Declared per model in {@link EnergyAppPackageCompatibilityModel.limitations}.
 * Most limitations qualify specific features (see
 * `ENERGY_APP_MODEL_LIMITATION_FEATURES`); `validatePackageCompatibility()`
 * warns when a model declares a limitation without any of them.
 */
export enum EnergyAppModelLimitationEnum {
    /**
     * Battery charging cannot be blocked: the battery always charges from PV
     * surplus, so room cannot be kept free for later (e.g. for hours with
     * negative prices or to avoid feed-in curtailment). Charge power can at
     * most be reduced, not set to 0 W.
     */
    BatteryChargeCannotBeBlocked = 'battery-charge-cannot-be-blocked',
    /**
     * Battery discharging cannot be blocked: the battery always covers the
     * house load, so its energy cannot be saved for expensive hours. Discharge
     * power can at most be reduced, not set to 0 W.
     */
    BatteryDischargeCannotBeBlocked = 'battery-discharge-cannot-be-blocked',
    /**
     * A charge power is executed as a forced setpoint, not as a cap: the battery
     * charges at exactly that power, drawing from the grid whatever the PV
     * surplus does not cover. Charging "only from PV, up to X W" is not possible.
     */
    BatteryChargeSetpointForced = 'battery-charge-setpoint-forced',
    /** A running charge cannot be paused, only stopped — so it cannot be split across cheap hours */
    ChargingCannotBePaused = 'charging-cannot-be-paused',
    /** After a charge has finished, a new one only starts once the car is unplugged and plugged in again */
    ChargingRequiresReplug = 'charging-requires-replug',
    /** Switching between one and three phases only takes effect at the start of the next session */
    PhaseSwitchingBetweenSessionsOnly = 'phase-switching-between-sessions-only',
    /** Commands may only be sent rarely (vendor rate limit, write budget or a few switches per day) */
    ControlRateLimited = 'control-rate-limited',
    /** Readings arrive with a delay of minutes, e.g. from a vendor cloud */
    DelayedReadings = 'delayed-readings',
    /** Energy counters are coarse (e.g. 1 kWh steps) or update only rarely (e.g. daily) */
    CoarseEnergyCounters = 'coarse-energy-counters',
    /** A forced hot water boost pauses space heating while it runs */
    HeatpumpDhwBoostInterruptsHeating = 'heatpump-dhw-boost-interrupts-heating',
    /** A forced boost heats with the electric heater instead of the compressor, at a much lower efficiency */
    HeatpumpBoostUsesElectricHeater = 'heatpump-boost-uses-electric-heater',
}
