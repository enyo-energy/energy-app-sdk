/**
 * Important capabilities a specific device model can support.
 *
 * Declared per model inside an Energy App package's compatibility section
 * (see {@link EnergyAppPackageCompatibilityModel}) so the enyo Store and
 * onboarding flows can surface accurate, model-level feature information to
 * users. Values are grouped by device category for readability.
 */
export enum EnergyAppModelFeatureEnum {

    // Battery / Storage

    /** The battery can be charged from the grid (not only from PV surplus) */
    BatteryChargingFromGrid = 'battery-charging-from-grid',
    /** The maximum charge power or target state of charge can be limited */
    BatteryChargeLimitation = 'battery-charge-limitation',
    /** The maximum discharge power or minimum state of charge can be limited */
    BatteryDischargeLimitation = 'battery-discharge-limitation',

    // Inverter / PV

    /** The PV feed-in power into the grid can be limited (curtailment) */
    PvFeedInLimitation = 'pv-feed-in-limitation',
    /** The inverter active power output can be limited */
    InverterPowerLimitation = 'inverter-power-limitation',

    // Wallbox / Charging

    /** Charging can be started and stopped remotely */
    ChargingStartStop = 'charging-start-stop',
    /** The charging power (in Ampere or Watt) can be limited */
    ChargingPowerLimitation = 'charging-power-limitation',
    /** The model supports switching between single- and three-phase charging */
    ChargingPhaseSwitching = 'charging-phase-switching',
    /** The model supports charging from PV surplus */
    PvSurplusCharging = 'pv-surplus-charging',

    // Heat Pump

    /** Domestic hot water heating can be forced on demand (DHW boost) */
    HeatpumpDhwBoost = 'heatpump-dhw-boost',
    /** The target temperature setpoint can be controlled */
    HeatpumpTemperatureSetpoint = 'heatpump-temperature-setpoint',
    /** The heat pump output power can be modulated */
    HeatpumpPowerModulation = 'heatpump-power-modulation',
    /** The model supports the SG Ready interface for smart-grid signalling */
    HeatpumpSgReady = 'heatpump-sg-ready',

    // Climate Control / Air Conditioning

    /** The target temperature setpoint can be controlled */
    ClimateTemperatureSetpoint = 'climate-temperature-setpoint',
    /** The operating mode (heat / cool / fan / off) can be controlled */
    ClimateModeControl = 'climate-mode-control',

    // Meter

    /** The grid power (import / export) can be read out */
    GridPowerReadout = 'grid-power-readout',
    /** The accumulated energy consumption can be read out */
    EnergyConsumptionReadout = 'energy-consumption-readout',

    // Smart Plug

    /** The plug can be switched on and off */
    SwitchOnOff = 'switch-on-off',
    /** The plug can measure the connected load's power */
    PowerMeasurement = 'power-measurement',
}
