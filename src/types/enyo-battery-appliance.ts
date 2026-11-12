export enum EnyoBatteryStorageMode {
    CHARGE = 'charge',
    DISCHARGE = 'discharge',
    HOLDING = 'holding',
    AUTO = 'auto',
    Unknown = 'unknown'
}

export enum EnyoBatteryFeature {
    /**
     * If the battery supports being charged from the grid
     */
    GridCharging = 'grid-charging',
    /**
     * If the battery supports discharging into the grid
     */
    GridDischarging = 'grid-discharging',
    /**
     * If the battery supports discharge power limitation
     * @deprecated
     */
    DischargeLimitation = 'discharge-limitation',
    /**
     * If the battery supports charge power limitation
     * @deprecated
     */
    ChargeLimitation = 'charge-limitation',
    /** If the battery is connected between DC strings and the inverter */
    BetweenDcStringAndInverter = 'between-dc-string-and-inverter',
    /** If the battery supports manual charging */
    ManualCharge = 'manual-charge',
    /** If the battery supports manual discharging */
    ManualDischarge = 'manual-discharge',
    /**
     * The battery's only control is a grid charge at full power, e.g. the safety charge of a
     * SENEC.Home V3: once started it charges from the grid at about `maxChargingPowerW`. It has
     * no power setpoint, no holding and no discharge lock.
     *
     * Declare it **instead of** {@link GridCharging}, {@link ManualCharge},
     * {@link ManualDischarge}, {@link GridDischarging} and the limitation features, and declare
     * {@link EnyoBatteryApplianceMetadata.maxChargingPowerW}. An energy manager that does not
     * know this feature then treats the battery as not controllable, rather than sending it
     * small charge setpoints that the battery would turn into a full-power grid charge.
     *
     * Contract between the energy manager and the integration:
     * - The energy manager only uses the battery for whole grid charges in cheap hours. It sends
     *   `Charge` with `powerW` of at least `maxChargingPowerW` to start one, and `Auto` (or a
     *   schedule entry `Idle`) to release the battery afterwards.
     * - It never sends a charge below full power (no PV surplus charging by command),
     *   `Hold`, `Discharge`, or a `Charge`/`Discharge` with `powerW = 0`. The integration
     *   answers those with `NotSupported`.
     * - Unless the battery also declares {@link GridChargeFullPowerStoppable}, a started charge
     *   cannot be ended early: it runs until the battery is full, even after `Auto`. The energy
     *   manager must plan it as a charge to 100 % SoC, regardless of `maxSoC`.
     *
     * `validateFullPowerGridChargeControl` and `validateFullPowerGridChargeSchedule` check a
     * command against this contract.
     */
    GridChargeFullPowerOnly = 'grid-charge-full-power-only',
    /**
     * A full-power grid charge of a {@link GridChargeFullPowerOnly} battery can be ended early:
     * `Auto` (or a schedule entry `Idle`) stops it and hands the battery back to its own logic.
     * The energy manager may then plan charges that stop below 100 % SoC.
     *
     * Only meaningful together with {@link GridChargeFullPowerOnly}. Declare it only when the
     * integration has verified that the device really stops.
     */
    GridChargeFullPowerStoppable = 'grid-charge-full-power-stoppable'
}

export interface EnyoBatteryApplianceMetadata {
    connectedToApplianceId?: string;
    /** If the battery is connected in between dc strings, you can configure it here*/
    connectedWithDcStrings?: number[];
    maxDischargePowerW?: number;
    maxChargingPowerW?: number;
    maxCapacityWh?: number;
    storageMode?: EnyoBatteryStorageMode;
    /** Whether grid-to-storage charging is currently enabled */
    gridChargingEnabled?: boolean;
    /** Whether storage-to-grid discharging is currently enabled */
    gridDischargingEnabled?: boolean;
    /** Currently active charge power limit in Watts (if any) */
    activeChargeLimitW?: number;
    /** Currently active discharge power limit in Watts (if any) */
    activeDischargeLimitW?: number;
    features?: EnyoBatteryFeature[];
    /**
     * Whether the energy manager is allowed to actively control (steer) this
     * battery. When `false`, the battery is treated as read-only/monitor-only
     * and the EMS must not issue control commands to it. When omitted,
     * consumers should fall back to their configured default behaviour.
     */
    controlAllowed?: boolean;
    /**
     * Minimum state of charge the battery should be kept at, as a percentage
     * (0–100). The EMS should not discharge the battery below this value.
     */
    minSoC?: number;
    /**
     * Maximum state of charge the battery should be charged to, as a percentage
     * (0–100). The EMS should not charge the battery above this value.
     */
    maxSoC?: number;
    /**
     * Observed round-trip efficiency as a percentage (0–100): of the energy put
     * into the battery, how much comes back out again.
     *
     * A **calculated** value, not a nameplate figure — derived from measured
     * charge and discharge energy over completed cycles. It therefore drifts
     * with cell age, temperature and depth of discharge, and is absent until
     * enough cycles have been observed to compute it. Consumers should treat a
     * missing value as "not yet known" rather than substituting a datasheet
     * number.
     *
     * This is what decides whether a charge/discharge cycle is worth running at
     * all: arbitrage pays only when the price spread exceeds the energy lost to
     * the round trip, so an optimizer that assumes 100% will schedule cycles
     * that lose money.
     *
     * Measure it at the same boundary the battery reports its power and meter
     * values at. An AC-to-AC round trip includes the inverter's conversion
     * losses in both directions and typically lands several points below the
     * DC-to-DC figure for the same pack — quoting one where the other is
     * expected silently misprices every cycle.
     */
    roundTripEfficiencyPercent?: number;
}